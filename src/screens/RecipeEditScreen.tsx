import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useRecipeMedia } from '../hooks/useRecipeMedia';
import IngredientParseReviewModal, { formatIngredientPreview } from '../components/IngredientParseReviewModal';
import { api, recipeAssetUrl, recipeImageSource } from '../lib/mealieApi';
import { formatTimeText } from '../lib/timeEstimate';
import { colors, radius, spacing, typography } from '../theme';
import type { Recipe, RecipeIngredient, RecipeTag, RecipeCategory } from '../types';
import type { RecipesStackParams } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RecipesStackParams, 'RecipeEdit'>;
  route: RouteProp<RecipesStackParams, 'RecipeEdit'>;
};

// `parsed` is set once a row has gone through ingredient parsing and become
// a real structured ingredient (quantity/unit/food) -- `text` becomes a
// read-only preview at that point, since editing it in place would silently
// invalidate the structure. Unparsed rows are plain freeform text, same as
// this editor has always worked.
// `title` mirrors Mealie's own "toggle section" behavior: it's a section
// heading attached to whichever ingredient row starts a new section (e.g.
// "Sauce"), rendered directly above that row -- not a separate divider
// type. `undefined` means no title editor shown for this row; `''` means
// shown but not yet typed.
type IngDraft = { key: string; text: string; parsed?: RecipeIngredient; title?: string };
type StepDraft = { key: string; title: string; text: string };
type NoteDraft = { key: string; title: string; text: string };

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function SectionLabel({ title }: { title: string }) {
  return <Text style={sectionStyles.label}>{title}</Text>;
}

function AddBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={sectionStyles.addBtn} onPress={onPress}>
      <Text style={sectionStyles.addBtnText}>+ {label}</Text>
    </TouchableOpacity>
  );
}

export default function RecipeEditScreen({ navigation, route }: Props) {
  const { slug } = route.params;
  const { serverUrl, token } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showParseModal, setShowParseModal] = useState(false);
  const {
    imageUploading, attachmentUploading, imgError, setImgError,
    handlePickImage, handleAddAttachment,
  } = useRecipeMedia(
    slug,
    image => setRecipe(prev => prev ? { ...prev, image } : prev),
    asset => setRecipe(prev => prev ? { ...prev, assets: [...prev.assets, asset] } : prev),
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [recipeYield, setRecipeYield] = useState('');
  const [prepTime, setPrepTime] = useState('');
  // Mealie's own edit UI writes "Cook Time" to `performTime`, not the legacy
  // `cookTime` field (that one's only ever populated by URL/migration
  // imports) — matching that here so edits made in this app show up
  // correctly in Mealie's own web UI too.
  const [performTime, setPerformTime] = useState('');
  const [totalTime, setTotalTime] = useState('');
  const [ingredients, setIngredients] = useState<IngDraft[]>([]);
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [notes, setNotes] = useState<NoteDraft[]>([]);
  const [selectedTags, setSelectedTags] = useState<RecipeTag[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<RecipeCategory[]>([]);
  const [availableTags, setAvailableTags] = useState<RecipeTag[]>([]);
  const [availableCategories, setAvailableCategories] = useState<RecipeCategory[]>([]);

  useEffect(() => {
    api.getRecipe(slug)
      .then(async r => {
        setRecipe(r);
        setName(r.name);
        setDescription(r.description ?? '');
        setRecipeYield(r.recipeYield ?? '');
        setPrepTime(formatTimeText(r.prepTime) ?? '');
        setPerformTime(formatTimeText(r.performTime) ?? formatTimeText(r.cookTime) ?? '');
        setTotalTime(formatTimeText(r.totalTime) ?? '');
        setSelectedTags(r.tags ?? []);
        setSelectedCategories(r.recipeCategory ?? []);
        setIngredients(r.recipeIngredient.map((ing, i) => {
          // Preserve real structure on load -- flattening an already-
          // structured ingredient (e.g. one created via Mealie's own web UI,
          // or already parsed here before) down to plain text would silently
          // discard its quantity/unit/food the moment this screen re-saves.
          const isStructured = !ing.disableAmount && !!ing.quantity;
          return {
            key: `i${i}`,
            text: isStructured ? formatIngredientPreview(ing) : (ing.display ?? ing.originalText ?? ing.note ?? ''),
            parsed: isStructured ? ing : undefined,
            title: ing.title ?? undefined,
          };
        }));
        setSteps(r.recipeInstructions.map((step, i) => ({
          key: `s${i}`,
          title: step.title ?? '',
          text: step.text,
        })));
        setNotes(r.notes.map((note, i) => ({
          key: `n${i}`,
          title: note.title,
          text: note.text,
        })));
        const [tagData, catData] = await Promise.all([
          api.getTags().catch(() => ({ items: [] })),
          api.getCategories().catch(() => ({ items: [] })),
        ]);
        setAvailableTags(tagData.items);
        setAvailableCategories(catData.items);

        // Matches Mealie's own post-import behavior (its `?parse=true` query
        // param after URL/image creation) -- offer the parse review
        // immediately rather than making the user find the button.
        if (route.params.autoParse && r.recipeIngredient.some(ing => (ing.display ?? ing.originalText ?? ing.note ?? '').trim())) {
          setShowParseModal(true);
        }
      })
      .catch(e => {
        Alert.alert('Could not load recipe', e instanceof Error ? e.message : 'Unknown error');
        navigation.goBack();
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const handleSave = async () => {
    if (!recipe) return;
    const trimmedName = name.trim();
    if (!trimmedName) { Alert.alert('Recipe name is required'); return; }
    setSaving(true);
    try {
      await api.updateRecipe(slug, {
        ...recipe,
        name: trimmedName,
        description: description.trim() || undefined,
        recipeYield: recipeYield.trim() || undefined,
        prepTime: prepTime.trim() || undefined,
        performTime: performTime.trim() || undefined,
        totalTime: totalTime.trim() || undefined,
        tags: selectedTags,
        recipeCategory: selectedCategories,
        recipeIngredient: ingredients
          .filter(i => i.parsed || i.text.trim() || i.title?.trim())
          .map(i => ({
            ...(i.parsed ?? { note: i.text.trim(), originalText: i.text.trim(), disableAmount: true }),
            title: i.title?.trim() || undefined,
          })),
        recipeInstructions: steps
          .filter(s => s.text.trim())
          .map(s => ({ title: s.title.trim() || undefined, text: s.text.trim() })),
        notes: notes
          .filter(n => n.title.trim() || n.text.trim())
          .map(n => ({ title: n.title.trim(), text: n.text.trim() })),
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save recipe');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.topBarCancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Edit Recipe</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color={colors.primary} size="small" />
            : <Text style={styles.topBarSave}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Photo ───────────────────────────────────────── */}
        <TouchableOpacity style={photoStyles.container} onPress={handlePickImage} disabled={imageUploading}>
          {recipe?.image && serverUrl && !imgError ? (
            <Image
              source={recipeImageSource(serverUrl, token, recipe.id, recipe.image)}
              style={photoStyles.image}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={photoStyles.placeholder}>
              <Text style={photoStyles.placeholderIcon}>📷</Text>
              <Text style={photoStyles.placeholderText}>Add a photo</Text>
            </View>
          )}
          {imageUploading && (
            <View style={photoStyles.uploadOverlay}>
              <ActivityIndicator color="#fff" size="large" />
            </View>
          )}
        </TouchableOpacity>

        {/* ── Basic Info ──────────────────────────────────── */}
        <SectionLabel title="BASIC INFO" />

        <View style={styles.field}>
          <Text style={styles.label}>Recipe Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Spaghetti Bolognese"
            placeholderTextColor={colors.textDisabled}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Short description of this dish..."
            placeholderTextColor={colors.textDisabled}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Servings / Yield</Text>
          <TextInput
            style={styles.input}
            value={recipeYield}
            onChangeText={setRecipeYield}
            placeholder="e.g. 4 servings"
            placeholderTextColor={colors.textDisabled}
          />
        </View>

        <View style={styles.timeRow}>
          <View style={[styles.field, styles.timeField]}>
            <Text style={styles.label}>Prep Time</Text>
            <TextInput
              style={styles.input}
              value={prepTime}
              onChangeText={setPrepTime}
              placeholder="15 min"
              placeholderTextColor={colors.textDisabled}
            />
          </View>
          <View style={[styles.field, styles.timeField]}>
            <Text style={styles.label}>Cook Time</Text>
            <TextInput
              style={styles.input}
              value={performTime}
              onChangeText={setPerformTime}
              placeholder="30 min"
              placeholderTextColor={colors.textDisabled}
            />
          </View>
          <View style={[styles.field, styles.timeField]}>
            <Text style={styles.label}>Total Time</Text>
            <TextInput
              style={styles.input}
              value={totalTime}
              onChangeText={setTotalTime}
              placeholder="45 min"
              placeholderTextColor={colors.textDisabled}
            />
          </View>
        </View>

        {/* ── Ingredients ─────────────────────────────────── */}
        <View style={sectionStyles.headerRow}>
          <SectionLabel title="INGREDIENTS" />
          {ingredients.some(i => i.text.trim()) && (
            <TouchableOpacity onPress={() => setShowParseModal(true)}>
              <Text style={sectionStyles.addBtnText}>🪄 Parse Ingredients</Text>
            </TouchableOpacity>
          )}
        </View>

        {ingredients.map((ing, idx) => (
          <View key={ing.key}>
            {ing.title !== undefined && (
              <TextInput
                style={styles.sectionTitleInput}
                value={ing.title}
                onChangeText={title =>
                  setIngredients(prev => prev.map(i => i.key === ing.key ? { ...i, title } : i))
                }
                placeholder="Section title (e.g. Sauce)"
                placeholderTextColor={colors.textDisabled}
              />
            )}
            <View style={styles.listRow}>
              <View style={styles.bulletCircle}>
                <Text style={styles.bulletText}>{idx + 1}</Text>
              </View>
              {ing.parsed ? (
                <View style={[styles.input, styles.listInput, styles.parsedRow]}>
                  <Text style={styles.parsedRowText}>{ing.text}</Text>
                  <TouchableOpacity
                    onPress={() => setIngredients(prev => prev.map(i => i.key === ing.key ? { ...i, parsed: undefined } : i))}
                  >
                    <Text style={styles.editAsTextLink}>Edit as text</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TextInput
                  style={[styles.input, styles.listInput]}
                  value={ing.text}
                  onChangeText={text =>
                    setIngredients(prev => prev.map(i => i.key === ing.key ? { ...i, text } : i))
                  }
                  placeholder="e.g. 2 cups all-purpose flour"
                  placeholderTextColor={colors.textDisabled}
                  multiline
                />
              )}
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => setIngredients(prev => prev.map(i => i.key === ing.key
                  ? { ...i, title: i.title === undefined ? '' : undefined }
                  : i
                ))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.sectionToggleText}>{ing.title !== undefined ? '▤▾' : '▤'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => setIngredients(prev => prev.filter(i => i.key !== ing.key))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <AddBtn
          label="Add Ingredient"
          onPress={() => setIngredients(prev => [...prev, { key: uid(), text: '' }])}
        />

        {/* ── Instructions ────────────────────────────────── */}
        <SectionLabel title="INSTRUCTIONS" />

        {steps.map((step, idx) => (
          <View key={step.key} style={styles.stepBlock}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNumCircle}>
                <Text style={styles.stepNumText}>{idx + 1}</Text>
              </View>
              <TextInput
                style={[styles.input, styles.stepTitleInput]}
                value={step.title}
                onChangeText={v =>
                  setSteps(prev => prev.map(s => s.key === step.key ? { ...s, title: v } : s))
                }
                placeholder="Step title (optional)"
                placeholderTextColor={colors.textDisabled}
              />
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => setSteps(prev => prev.filter(s => s.key !== step.key))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.multiline, styles.stepBodyInput]}
              value={step.text}
              onChangeText={v =>
                setSteps(prev => prev.map(s => s.key === step.key ? { ...s, text: v } : s))
              }
              placeholder="Describe this step..."
              placeholderTextColor={colors.textDisabled}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        ))}

        <AddBtn
          label="Add Step"
          onPress={() => setSteps(prev => [...prev, { key: uid(), title: '', text: '' }])}
        />

        {/* ── Tags ────────────────────────────────────────── */}
        {availableTags.length > 0 && (
          <>
            <SectionLabel title="TAGS" />
            <View style={styles.chipRow}>
              {availableTags.map(tag => {
                const active = selectedTags.some(t => t.slug === tag.slug);
                return (
                  <TouchableOpacity
                    key={tag.slug}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSelectedTags(prev =>
                      active ? prev.filter(t => t.slug !== tag.slug) : [...prev, tag]
                    )}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {tag.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* ── Categories ──────────────────────────────────── */}
        {availableCategories.length > 0 && (
          <>
            <SectionLabel title="CATEGORIES" />
            <View style={styles.chipRow}>
              {availableCategories.map(cat => {
                const active = selectedCategories.some(c => c.slug === cat.slug);
                return (
                  <TouchableOpacity
                    key={cat.slug}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSelectedCategories(prev =>
                      active ? prev.filter(c => c.slug !== cat.slug) : [...prev, cat]
                    )}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* ── Notes ───────────────────────────────────────── */}
        <SectionLabel title="NOTES" />

        {notes.map(note => (
          <View key={note.key} style={styles.noteBlock}>
            <View style={styles.noteHeader}>
              <TextInput
                style={[styles.input, styles.noteTitleInput]}
                value={note.title}
                onChangeText={v =>
                  setNotes(prev => prev.map(n => n.key === note.key ? { ...n, title: v } : n))
                }
                placeholder="Note title"
                placeholderTextColor={colors.textDisabled}
              />
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => setNotes(prev => prev.filter(n => n.key !== note.key))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={note.text}
              onChangeText={v =>
                setNotes(prev => prev.map(n => n.key === note.key ? { ...n, text: v } : n))
              }
              placeholder="Note content..."
              placeholderTextColor={colors.textDisabled}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        ))}

        <AddBtn
          label="Add Note"
          onPress={() => setNotes(prev => [...prev, { key: uid(), title: '', text: '' }])}
        />

        {/* ── Attachments ─────────────────────────────────── */}
        <View style={sectionStyles.headerRow}>
          <SectionLabel title="ATTACHMENTS" />
          <TouchableOpacity onPress={handleAddAttachment} disabled={attachmentUploading}>
            {attachmentUploading
              ? <ActivityIndicator color={colors.primary} size="small" />
              : <Text style={sectionStyles.addBtnText}>+ Add</Text>
            }
          </TouchableOpacity>
        </View>
        {recipe && recipe.assets.length > 0 ? recipe.assets.map((asset, i) => (
          <TouchableOpacity
            key={i}
            style={styles.assetItem}
            onPress={() => recipe && Linking.openURL(recipeAssetUrl(serverUrl, recipe.id, asset.fileName)).catch(() =>
              Alert.alert('Cannot open', 'Could not open this file.')
            )}
          >
            <Text style={styles.assetIcon}>📎</Text>
            <Text style={styles.assetName} numberOfLines={1}>{asset.name || asset.fileName}</Text>
            <Text style={styles.assetOpen}>Open ›</Text>
          </TouchableOpacity>
        )) : (
          <Text style={styles.emptyText}>No attachments yet</Text>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <IngredientParseReviewModal
        visible={showParseModal}
        ingredientLines={ingredients.map(i => i.text).filter(t => t.trim())}
        onCancel={() => setShowParseModal(false)}
        onComplete={result => {
          setIngredients(result.map(ing => ({
            key: uid(),
            text: formatIngredientPreview(ing),
            parsed: ing.disableAmount ? undefined : ing,
          })));
          setShowParseModal(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const sectionStyles = StyleSheet.create({
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  addBtn: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  addBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

const photoStyles = StyleSheet.create({
  container: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  placeholderIcon: {
    fontSize: 32,
  },
  placeholderText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 56,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarCancel: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    width: 70,
  },
  topBarTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  topBarSave: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    width: 70,
    textAlign: 'right',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  multiline: {
    minHeight: 88,
    paddingTop: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeField: {
    flex: 1,
    gap: spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bulletCircle: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bulletText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
  listInput: {
    flex: 1,
  },
  parsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  parsedRowText: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  editAsTextLink: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },
  removeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  removeBtnText: {
    fontSize: 14,
    color: colors.textDisabled,
  },
  sectionToggleText: {
    fontSize: 13,
    color: colors.primary,
  },
  sectionTitleInput: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginLeft: 32,
    marginBottom: spacing.xs,
    paddingVertical: spacing.xs,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  stepBlock: {
    gap: spacing.xs,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepNumCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textInverse,
  },
  stepTitleInput: {
    flex: 1,
  },
  stepBodyInput: {
    marginLeft: 28 + spacing.sm,
  },
  noteBlock: {
    gap: spacing.xs,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  noteTitleInput: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
  chipTextActive: {
    color: colors.textInverse,
  },
  assetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  assetIcon: {
    fontSize: 18,
  },
  assetName: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  assetOpen: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },
  emptyText: {
    color: colors.textDisabled,
    fontSize: typography.size.md,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
