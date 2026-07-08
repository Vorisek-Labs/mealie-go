import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, ScrollView, Share,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { api, recipeAssetUrl, recipeImageUrl } from '../lib/mealieApi';
import { colors, radius, spacing, typography } from '../theme';
import type { Recipe, RecipeComment } from '../types';
import type { RecipesStackParams } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RecipesStackParams, 'RecipeDetail'>;
  route: RouteProp<RecipesStackParams, 'RecipeDetail'>;
};

type ActiveTab = 'ingredients' | 'steps' | 'notes' | 'comments';

function StarRating({ rating, onRate }: { rating: number; onRate: (r: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity key={star} onPress={() => onRate(star)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
          <Text style={{ fontSize: 22, color: star <= rating ? colors.warning : colors.border }}>
            {star <= rating ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function parseServings(yieldStr?: string): number {
  if (!yieldStr) return 1;
  const match = yieldStr.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 1;
}

function formatQty(qty: number): string {
  if (qty === Math.floor(qty)) return String(Math.floor(qty));
  return parseFloat(qty.toFixed(2)).toString();
}

export default function RecipeDetailScreen({ navigation, route }: Props) {
  const { slug, name } = route.params;
  const { serverUrl } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('ingredients');
  const [imgError, setImgError] = useState(false);

  const [servings, setServings] = useState(1);
  const [originalServings, setOriginalServings] = useState(1);

  const [comments, setComments] = useState<RecipeComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentSending, setCommentSending] = useState(false);

  const [rating, setRating] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRecipe(slug);
      setRecipe(data);
      const base = parseServings(data.recipeYield);
      setOriginalServings(base);
      setServings(base);
      setRating(data.rating ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recipe');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const loadComments = useCallback(async () => {
    if (!recipe) return;
    setCommentsLoading(true);
    try {
      const data = await api.getComments(slug);
      setComments(Array.isArray(data) ? data : []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [slug, recipe]);

  useEffect(() => {
    if (activeTab === 'comments') loadComments();
  }, [activeTab, loadComments]);

  const handleRate = async (star: number) => {
    if (!recipe) return;
    const newRating = star === rating ? 0 : star;
    setRating(newRating);
    try {
      await api.updateRecipe(slug, { ...recipe, rating: newRating });
    } catch {
      setRating(rating);
    }
  };

  const handleAddComment = async () => {
    if (!recipe || !newComment.trim()) return;
    setCommentSending(true);
    try {
      const created = await api.addComment(recipe.id, newComment.trim());
      setComments(prev => [...prev, created]);
      setNewComment('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not post comment');
    } finally {
      setCommentSending(false);
    }
  };

  const handleDeleteComment = (comment: RecipeComment) => {
    Alert.alert('Delete comment', 'Remove this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteComment(comment.id);
            setComments(prev => prev.filter(c => c.id !== comment.id));
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete');
          }
        },
      },
    ]);
  };

  const handleShare = async () => {
    if (!recipe) return;
    try {
      await Share.share({
        title: recipe.name,
        message: `${recipe.name} — ${serverUrl}/g/home/r/${recipe.slug}`,
      });
    } catch {}
  };

  const handleDelete = () => {
    Alert.alert('Delete recipe', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteRecipe(slug);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete recipe');
          }
        },
      },
    ]);
  };

  const openAsset = (fileName: string) => {
    Linking.openURL(recipeAssetUrl(serverUrl, slug, fileName)).catch(() =>
      Alert.alert('Cannot open', 'Could not open this file.')
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Recipe not found'}</Text>
        <TouchableOpacity onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scale = servings / (originalServings || 1);
  const imgSrc = recipe.image && serverUrl && !imgError
    ? { uri: recipeImageUrl(serverUrl, recipe.slug) }
    : null;

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'ingredients', label: 'Ingredients' },
    { key: 'steps', label: 'Steps' },
    { key: 'notes', label: 'Notes' },
    { key: 'comments', label: 'Comments' },
  ];

  const hasNutrition = recipe.nutrition && Object.values(recipe.nutrition).some(Boolean);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {imgSrc ? (
          <Image
            source={imgSrc}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.heroPlaceholderIcon}>🍽️</Text>
          </View>
        )}

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.overlayActions}>
          <TouchableOpacity
            style={styles.overlayBtn}
            onPress={() => navigation.navigate('RecipeEdit', { slug, name: recipe.name })}
          >
            <Text style={styles.overlayBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.overlayBtn} onPress={handleShare}>
            <Text style={styles.overlayBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.recipeName}>{recipe.name}</Text>

          <StarRating rating={rating} onRate={handleRate} />

          {recipe.description ? (
            <Text style={styles.description}>{recipe.description}</Text>
          ) : null}

          {(recipe.prepTime || recipe.cookTime || recipe.totalTime || recipe.recipeYield) && (
            <View style={styles.metaRow}>
              {recipe.prepTime ? <MetaStat label="Prep" value={recipe.prepTime} /> : null}
              {recipe.cookTime ? <MetaStat label="Cook" value={recipe.cookTime} /> : null}
              {recipe.totalTime ? <MetaStat label="Total" value={recipe.totalTime} /> : null}
              {recipe.recipeYield ? <MetaStat label="Serves" value={recipe.recipeYield} /> : null}
            </View>
          )}

          {hasNutrition && recipe.nutrition && (
            <View style={styles.nutritionBox}>
              <Text style={styles.nutritionTitle}>Nutrition</Text>
              <View style={styles.nutritionGrid}>
                {recipe.nutrition.calories ? <NutrStat label="Calories" value={recipe.nutrition.calories} /> : null}
                {recipe.nutrition.proteinContent ? <NutrStat label="Protein" value={recipe.nutrition.proteinContent} /> : null}
                {recipe.nutrition.carbohydrateContent ? <NutrStat label="Carbs" value={recipe.nutrition.carbohydrateContent} /> : null}
                {recipe.nutrition.fatContent ? <NutrStat label="Fat" value={recipe.nutrition.fatContent} /> : null}
                {recipe.nutrition.fiberContent ? <NutrStat label="Fiber" value={recipe.nutrition.fiberContent} /> : null}
                {recipe.nutrition.sodiumContent ? <NutrStat label="Sodium" value={recipe.nutrition.sodiumContent} /> : null}
                {recipe.nutrition.sugarContent ? <NutrStat label="Sugar" value={recipe.nutrition.sugarContent} /> : null}
              </View>
            </View>
          )}

          <View style={styles.tabs}>
            {TABS.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, activeTab === t.key && styles.tabActive]}
                onPress={() => setActiveTab(t.key)}
              >
                <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'ingredients' && (
            <View style={styles.section}>
              {originalServings > 1 && (
                <View style={styles.scaler}>
                  <Text style={styles.scalerLabel}>Servings:</Text>
                  <TouchableOpacity
                    style={styles.scalerBtn}
                    onPress={() => setServings(s => Math.max(1, s - 1))}
                  >
                    <Text style={styles.scalerBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.scalerValue}>{servings}</Text>
                  <TouchableOpacity
                    style={styles.scalerBtn}
                    onPress={() => setServings(s => s + 1)}
                  >
                    <Text style={styles.scalerBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
              {recipe.recipeIngredient.length === 0 ? (
                <Text style={styles.emptyText}>No ingredients listed</Text>
              ) : recipe.recipeIngredient.map((ing, i) => {
                const scaledQty = ing.quantity && scale !== 1 ? formatQty(ing.quantity * scale) : null;
                const base = ing.display ?? ing.originalText ?? [
                  ing.quantity ? String(ing.quantity) : '',
                  ing.unit?.abbreviation ?? ing.unit?.name ?? '',
                  ing.food?.name ?? '',
                  ing.note ? `(${ing.note})` : '',
                ].filter(Boolean).join(' ');
                const displayText = scaledQty && ing.quantity
                  ? base.replace(String(ing.quantity), scaledQty)
                  : base;
                return (
                  <View key={i} style={styles.ingredient}>
                    <View style={styles.bullet} />
                    <Text style={styles.ingredientText}>{displayText}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {activeTab === 'steps' && (
            <View style={styles.section}>
              {recipe.recipeInstructions.length === 0 ? (
                <Text style={styles.emptyText}>No instructions listed</Text>
              ) : recipe.recipeInstructions.map((step, i) => (
                <View key={i} style={styles.step}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    {step.title ? <Text style={styles.stepTitle}>{step.title}</Text> : null}
                    <Text style={styles.stepText}>{step.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'notes' && (
            <View style={styles.section}>
              {recipe.notes.length === 0 ? (
                <Text style={styles.emptyText}>No notes</Text>
              ) : recipe.notes.map((note, i) => (
                <View key={i} style={styles.note}>
                  {note.title ? <Text style={styles.noteTitle}>{note.title}</Text> : null}
                  <Text style={styles.noteText}>{note.text}</Text>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'comments' && (
            <View style={styles.section}>
              <View style={styles.commentInput}>
                <TextInput
                  style={styles.commentTextInput}
                  value={newComment}
                  onChangeText={setNewComment}
                  placeholder="Add a comment…"
                  placeholderTextColor={colors.textDisabled}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.commentSendBtn, (!newComment.trim() || commentSending) && { opacity: 0.4 }]}
                  onPress={handleAddComment}
                  disabled={!newComment.trim() || commentSending}
                >
                  {commentSending
                    ? <ActivityIndicator color={colors.textInverse} size="small" />
                    : <Text style={styles.commentSendText}>Post</Text>
                  }
                </TouchableOpacity>
              </View>
              {commentsLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
              ) : comments.length === 0 ? (
                <Text style={styles.emptyText}>No comments yet — be the first!</Text>
              ) : comments.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.commentItem}
                  onLongPress={() => handleDeleteComment(c)}
                >
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>
                      {c.user?.fullName ?? c.user?.username ?? 'User'}
                    </Text>
                    <Text style={styles.commentDate}>
                      {new Date(c.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.commentText}>{c.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {recipe.assets && recipe.assets.length > 0 && (
            <View style={styles.assetsSection}>
              <Text style={styles.assetsSectionTitle}>ATTACHMENTS</Text>
              {recipe.assets.map((asset, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.assetItem}
                  onPress={() => openAsset(asset.fileName)}
                >
                  <Text style={styles.assetIcon}>📎</Text>
                  <Text style={styles.assetName} numberOfLines={1}>{asset.name || asset.fileName}</Text>
                  <Text style={styles.assetOpen}>Open ›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Recipe</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={metaStyles.container}>
      <Text style={metaStyles.value}>{value}</Text>
      <Text style={metaStyles.label}>{label}</Text>
    </View>
  );
}

function NutrStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={nutrStyles.cell}>
      <Text style={nutrStyles.value}>{value}</Text>
      <Text style={nutrStyles.label}>{label}</Text>
    </View>
  );
}

const metaStyles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1 },
  value: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.textPrimary },
  label: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
});

const nutrStyles = StyleSheet.create({
  cell: { alignItems: 'center', width: '25%', paddingVertical: spacing.xs },
  value: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.textPrimary },
  label: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.xxl },
  centered: {
    flex: 1, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center', gap: spacing.md,
  },
  heroImage: { width: '100%', height: 260 },
  heroPlaceholder: {
    width: '100%', height: 200,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  heroPlaceholderIcon: { fontSize: 64 },
  backButton: {
    position: 'absolute', top: 52, left: spacing.md,
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  backButtonText: { fontSize: 24, color: '#fff', lineHeight: 30 },
  overlayActions: {
    position: 'absolute', top: 52, right: spacing.md,
    flexDirection: 'row', gap: spacing.xs,
  },
  overlayBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  overlayBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: '#fff' },
  content: { padding: spacing.md, gap: spacing.md },
  recipeName: { fontSize: typography.size.xxl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  description: { fontSize: typography.size.md, color: colors.textSecondary, lineHeight: typography.size.md * 1.5 },
  metaRow: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  nutritionBox: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  nutritionTitle: {
    fontSize: typography.size.xs, fontWeight: typography.weight.semibold,
    color: colors.textDisabled, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  scaler: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm,
    borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start',
  },
  scalerLabel: { fontSize: typography.size.sm, color: colors.textSecondary },
  scalerBtn: {
    width: 28, height: 28, borderRadius: radius.full,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  scalerBtnText: { fontSize: 18, color: colors.textInverse, lineHeight: 22 },
  scalerValue: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.textPrimary, minWidth: 24, textAlign: 'center' },
  tabs: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: spacing.xs + 2, alignItems: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, color: colors.textSecondary },
  tabTextActive: { color: colors.textInverse },
  section: { gap: spacing.sm },
  emptyText: { color: colors.textDisabled, fontSize: typography.size.md, textAlign: 'center', paddingVertical: spacing.lg },
  ingredient: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 7 },
  ingredientText: { flex: 1, fontSize: typography.size.md, color: colors.textPrimary, lineHeight: typography.size.md * 1.5 },
  step: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.xs },
  stepNumber: { width: 28, height: 28, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  stepNumberText: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.textInverse },
  stepContent: { flex: 1, gap: spacing.xs },
  stepTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.textPrimary },
  stepText: { fontSize: typography.size.md, color: colors.textPrimary, lineHeight: typography.size.md * 1.6 },
  note: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
  noteTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.textPrimary },
  noteText: { fontSize: typography.size.md, color: colors.textSecondary, lineHeight: typography.size.md * 1.5 },
  commentInput: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end',
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  commentTextInput: {
    flex: 1, fontSize: typography.size.md, color: colors.textPrimary,
    minHeight: 36, paddingHorizontal: spacing.sm, paddingTop: spacing.xs,
  },
  commentSendBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  commentSendText: { color: colors.textInverse, fontWeight: typography.weight.semibold, fontSize: typography.size.sm },
  commentItem: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.xs,
  },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentAuthor: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primary },
  commentDate: { fontSize: typography.size.xs, color: colors.textDisabled },
  commentText: { fontSize: typography.size.md, color: colors.textPrimary, lineHeight: typography.size.md * 1.5 },
  assetsSection: { gap: spacing.sm, marginTop: spacing.sm },
  assetsSectionTitle: {
    fontSize: typography.size.xs, fontWeight: typography.weight.semibold,
    color: colors.textDisabled, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  assetItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  assetIcon: { fontSize: 18 },
  assetName: { flex: 1, fontSize: typography.size.md, color: colors.textPrimary },
  assetOpen: { fontSize: typography.size.sm, color: colors.primary, fontWeight: typography.weight.medium },
  deleteButton: { borderWidth: 1, borderColor: colors.error, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  deleteButtonText: { color: colors.error, fontSize: typography.size.md, fontWeight: typography.weight.medium },
  errorText: { color: colors.error, fontSize: typography.size.md },
  retryText: { color: colors.primary, fontSize: typography.size.md },
});
