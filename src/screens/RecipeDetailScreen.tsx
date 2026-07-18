import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, Share,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { useRecipeMedia } from '../hooks/useRecipeMedia';
import { api, recipeAssetUrl, recipeImageSource } from '../lib/mealieApi';
import CookModeModal from '../components/CookModeModal';
import { displayCookTime, formatTimeText } from '../lib/timeEstimate';
import {
  convertToMetric, convertInstructionTemperatures, scaleFreeformIngredientText,
  getUnitSystemPreference, setUnitSystemPreference,
} from '../lib/unitConversion';
import type { UnitSystemPreference } from '../lib/unitConversion';
import { colors, radius, spacing, typography } from '../theme';
import type { Recipe, RecipeComment, RecipeShareToken, ShoppingList } from '../types';
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

function formatQty(qty: number): string {
  if (qty === Math.floor(qty)) return String(Math.floor(qty));
  return parseFloat(qty.toFixed(2)).toString();
}


function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildRecipePdfHtml(recipe: Recipe, imageTag: string): string {
  const ingredients = recipe.recipeIngredient
    .map(ing => `<li>${escapeHtml(ing.display ?? ing.originalText ?? '')}</li>`)
    .join('');
  const steps = recipe.recipeInstructions
    .map((step, i) => `<li><strong>${i + 1}.</strong> ${step.title ? `<strong>${escapeHtml(step.title)}</strong> — ` : ''}${escapeHtml(step.text)}</li>`)
    .join('');
  const notes = recipe.notes
    .map(n => `<div class="note">${n.title ? `<strong>${escapeHtml(n.title)}</strong><br/>` : ''}${escapeHtml(n.text)}</div>`)
    .join('');
  const prepTime = formatTimeText(recipe.prepTime);
  const cookTime = displayCookTime(recipe);
  const totalTime = formatTimeText(recipe.totalTime);
  const meta = [
    prepTime ? `Prep: ${escapeHtml(prepTime)}` : '',
    cookTime ? `Cook: ${escapeHtml(cookTime)}` : '',
    totalTime ? `Total: ${escapeHtml(totalTime)}` : '',
    recipe.recipeYield ? `Yield: ${escapeHtml(recipe.recipeYield)}` : '',
    recipe.recipeServings ? `Serves: ${escapeHtml(formatQty(recipe.recipeServings))}` : '',
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 24px; }
          h1 { font-size: 24px; margin-bottom: 4px; }
          .meta { color: #555; font-size: 13px; margin-bottom: 16px; }
          .description { margin-bottom: 16px; }
          h2 { font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 24px; }
          li { margin-bottom: 6px; line-height: 1.4; }
          .note { background: #f5f5f5; padding: 10px; border-radius: 6px; margin-bottom: 8px; }
        </style>
      </head>
      <body>
        ${imageTag}
        <h1>${escapeHtml(recipe.name ?? '')}</h1>
        ${meta ? `<div class="meta">${meta}</div>` : ''}
        ${recipe.description ? `<div class="description">${escapeHtml(recipe.description)}</div>` : ''}
        ${ingredients ? `<h2>Ingredients</h2><ul>${ingredients}</ul>` : ''}
        ${steps ? `<h2>Instructions</h2><ol style="list-style:none;padding-left:0;">${steps}</ol>` : ''}
        ${notes ? `<h2>Notes</h2>${notes}` : ''}
      </body>
    </html>
  `;
}

export default function RecipeDetailScreen({ navigation, route }: Props) {
  const { slug, name } = route.params;
  const { serverUrl, token, user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('ingredients');
  const {
    imageUploading, attachmentUploading, imgError, setImgError,
    handlePickImage, handleAddAttachment,
  } = useRecipeMedia(
    slug,
    image => setRecipe(prev => prev ? { ...prev, image } : prev),
    asset => setRecipe(prev => prev ? { ...prev, assets: [...prev.assets, asset] } : prev),
  );
  const [unitSystem, setUnitSystem] = useState<UnitSystemPreference>('original');

  const [servings, setServings] = useState(1);
  const [originalServings, setOriginalServings] = useState(1);

  const [comments, setComments] = useState<RecipeComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentSending, setCommentSending] = useState(false);

  const [rating, setRating] = useState(0);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTokens, setShareTokens] = useState<RecipeShareToken[]>([]);
  const [shareTokensLoading, setShareTokensLoading] = useState(false);
  const [creatingToken, setCreatingToken] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [showListPicker, setShowListPicker] = useState(false);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [listPickerLoading, setListPickerLoading] = useState(false);
  const [addingToListId, setAddingToListId] = useState<string | null>(null);

  const [showCookMode, setShowCookMode] = useState(false);

  const scale = servings / (originalServings || 1);

  // Shared by the Ingredients tab and Cook Mode, so both show the exact
  // same scaled/unit-converted text without recomputing it twice.
  //
  // Rebuilds each line fresh from its structured quantity/unit/food fields
  // instead of string-replacing inside the pre-existing display text —
  // matching how Mealie's own frontend scales ingredients. The old
  // string-replace approach silently did nothing whenever the stored
  // quantity's string form didn't exactly match what was embedded in the
  // display text (e.g. quantity 0.5 but text says "1/2").
  //
  // `quantity` is falsy-checked, not null-checked: Mealie defaults it to 0
  // (not null) when no structured amount was captured, same pattern as
  // recipeServings defaulting to 0. Treating 0 as "a real quantity to scale"
  // produced a bogus "0" prefix on every ingredient of an unstructured
  // recipe. For those, the actual amount is often only in `note` or
  // `originalText` — best-effort scale a leading number in that text
  // instead of leaving it static or showing it wrapped in a stray "(...)".
  const ingredientDisplayLines = useMemo(() => {
    if (!recipe) return [];
    return recipe.recipeIngredient.map(ing => {
      if (ing.disableAmount || !ing.quantity) {
        const structuredParts = [
          ing.unit?.abbreviation ?? ing.unit?.name ?? '',
          ing.food?.name ?? '',
        ].filter(Boolean);
        const rawText = ing.display ?? ing.originalText ?? (
          structuredParts.length > 0
            ? [...structuredParts, ing.note ? `(${ing.note})` : ''].filter(Boolean).join(' ')
            : (ing.note ?? '')
        );
        return ing.disableAmount ? rawText : scaleFreeformIngredientText(rawText, scale, unitSystem === 'metric');
      }

      const scaledQty = ing.quantity * scale;
      let qtyText = formatQty(scaledQty);
      let unitLabel = ing.unit?.abbreviation || ing.unit?.name || '';

      if (unitSystem === 'metric') {
        const converted = convertToMetric(scaledQty, ing.unit);
        if (converted) {
          qtyText = formatQty(converted.quantity);
          unitLabel = converted.unitLabel;
        }
      }

      return [qtyText, unitLabel, ing.food?.name ?? '', ing.note ? `(${ing.note})` : '']
        .filter(Boolean).join(' ');
    });
  }, [recipe, scale, unitSystem]);

  const cookModeSteps = useMemo(() => {
    if (!recipe) return [];
    return recipe.recipeInstructions.map(step => ({
      title: step.title,
      text: unitSystem === 'metric' ? convertInstructionTemperatures(step.text) : step.text,
    }));
  }, [recipe, unitSystem]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRecipe(slug);
      setRecipe(data);
      // Matches Mealie's own scale-basis logic (RecipePageScale.vue): prefer
      // recipeServings, fall back to recipeYieldQuantity. recipeYield (the
      // freeform "8 jars, 0.5 pints each" text) is a display-only field and
      // was never a servings count.
      const base = data.recipeServings || data.recipeYieldQuantity || 1;
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

  useEffect(() => { getUnitSystemPreference().then(setUnitSystem); }, []);

  const toggleUnitSystem = async () => {
    const next = unitSystem === 'metric' ? 'original' : 'metric';
    setUnitSystem(next);
    await setUnitSystemPreference(next);
  };

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

  const loadShareTokens = useCallback(async () => {
    if (!recipe) return;
    setShareTokensLoading(true);
    try {
      setShareTokens(await api.getShareTokens(recipe.id));
    } catch {
      setShareTokens([]);
    } finally {
      setShareTokensLoading(false);
    }
  }, [recipe]);

  const openShareModal = () => {
    setShowShareModal(true);
    loadShareTokens();
  };

  const shareTokenLink = (tokenId: string) =>
    `${serverUrl}/g/${user?.groupSlug ?? 'home'}/shared/r/${tokenId}`;

  const handleCreateShareToken = async () => {
    if (!recipe) return;
    setCreatingToken(true);
    try {
      const created = await api.createShareToken(recipe.id);
      setShareTokens(prev => [...prev, created]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create share link');
    } finally {
      setCreatingToken(false);
    }
  };

  const handleShareToken = async (tokenId: string) => {
    try {
      await Share.share({
        title: recipe?.name,
        message: `${recipe?.name} — ${shareTokenLink(tokenId)}`,
      });
    } catch {}
  };

  const handleDeleteShareToken = async (tokenId: string) => {
    try {
      await api.deleteShareToken(tokenId);
      setShareTokens(prev => prev.filter(t => t.id !== tokenId));
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not remove share link');
    }
  };

  const handleExportPdf = async () => {
    if (!recipe) return;
    setExportingPdf(true);
    try {
      let imageTag = '';
      if (recipe.image) {
        try {
          const res = await fetch(recipeImageSource(serverUrl, token, recipe.id, recipe.image).uri, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const blob = await res.blob();
          const dataUri: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          imageTag = `<img src="${dataUri}" style="width:100%;max-height:320px;object-fit:cover;border-radius:8px;margin-bottom:16px;" />`;
        } catch {
          // Image is a nice-to-have in the export — proceed without it if it fails to load.
        }
      }

      const html = buildRecipePdfHtml(recipe, imageTag);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('Exported', `PDF saved to ${uri}`);
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Could not export this recipe');
    } finally {
      setExportingPdf(false);
    }
  };

  const openListPicker = async () => {
    if (!recipe) return;
    setShowListPicker(true);
    setListPickerLoading(true);
    try {
      const data = await api.getShoppingLists();
      setShoppingLists(data.items);
    } catch {
      setShoppingLists([]);
    } finally {
      setListPickerLoading(false);
    }
  };

  const handleAddToList = async (list: ShoppingList) => {
    if (!recipe) return;
    setAddingToListId(list.id);
    try {
      await api.addRecipesToShoppingList(list.id, [recipe.id]);
      setShowListPicker(false);
      Alert.alert('Added', `Added ingredients to "${list.name}".`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not add to that list');
    } finally {
      setAddingToListId(null);
    }
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
    if (!recipe) return;
    Linking.openURL(recipeAssetUrl(serverUrl, recipe.id, fileName)).catch(() =>
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

  const imgSrc = recipe.image && serverUrl && !imgError
    ? recipeImageSource(serverUrl, token, recipe.id, recipe.image)
    : null;
  const favorite = isFavorite(recipe.id);
  // Hides the scaler only when truly nothing could change — every ingredient
  // is explicitly marked as having no amount at all (disableAmount). Anything
  // else is potentially scalable: either via a structured quantity, or via
  // scaleFreeformIngredientText's best-effort text scaling in ingredientDisplayLines.
  const hasScalableIngredients = recipe.recipeIngredient.some(i => !i.disableAmount);
  const prepTimeDisplay = formatTimeText(recipe.prepTime);
  const cookTimeDisplay = displayCookTime(recipe);
  const totalTimeDisplay = formatTimeText(recipe.totalTime);

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

        {imageUploading && (
          <View style={styles.heroUploadOverlay}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cameraButton}
          onPress={handlePickImage}
          disabled={imageUploading}
        >
          <Text style={styles.cameraButtonText}>📷</Text>
        </TouchableOpacity>

        <View style={styles.overlayActions}>
          <TouchableOpacity style={styles.overlayBtn} onPress={() => toggleFavorite(recipe.id, slug)}>
            <Text style={styles.overlayBtnText}>{favorite ? '♥ Saved' : '♡ Favorite'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.overlayBtn}
            onPress={() => navigation.navigate('RecipeEdit', { slug, name: recipe.name })}
          >
            <Text style={styles.overlayBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.overlayBtn} onPress={openShareModal}>
            <Text style={styles.overlayBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.overlayBtn} onPress={handleExportPdf} disabled={exportingPdf}>
            {exportingPdf
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.overlayBtnText}>PDF</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.recipeName}>{recipe.name}</Text>

          {(prepTimeDisplay || cookTimeDisplay || totalTimeDisplay || recipe.recipeYield || recipe.recipeServings) && (
            <View style={styles.metaRow}>
              {prepTimeDisplay ? <MetaStat label="Prep" value={prepTimeDisplay} /> : null}
              {cookTimeDisplay ? <MetaStat label="Cook" value={cookTimeDisplay} /> : null}
              {totalTimeDisplay ? <MetaStat label="Total" value={totalTimeDisplay} /> : null}
              {recipe.recipeYield ? <MetaStat label="Yield" value={recipe.recipeYield} /> : null}
              {recipe.recipeServings ? <MetaStat label="Serves" value={formatQty(recipe.recipeServings)} /> : null}
            </View>
          )}

          <StarRating rating={rating} onRate={handleRate} />

          {recipe.description ? (
            <Text style={styles.description}>{recipe.description}</Text>
          ) : null}

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
              <View style={styles.ingredientToolbar}>
                {hasScalableIngredients && (
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
                <TouchableOpacity style={styles.unitToggle} onPress={toggleUnitSystem}>
                  <Text style={styles.unitToggleText}>
                    {unitSystem === 'metric' ? 'Metric' : 'Original units'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.addToListBtn} onPress={openListPicker}>
                <Text style={styles.addToListBtnText}>🛒 Add Ingredients to Shopping List</Text>
              </TouchableOpacity>
              {ingredientDisplayLines.length === 0 ? (
                <Text style={styles.emptyText}>No ingredients listed</Text>
              ) : ingredientDisplayLines.map((displayText, i) => (
                <View key={i}>
                  {recipe.recipeIngredient[i]?.title ? (
                    <Text style={styles.ingredientSectionTitle}>{recipe.recipeIngredient[i].title}</Text>
                  ) : null}
                  <View style={styles.ingredient}>
                    <View style={styles.bullet} />
                    <Text style={styles.ingredientText}>{displayText}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'steps' && (
            <View style={styles.section}>
              {recipe.recipeInstructions.length > 0 && (
                <TouchableOpacity style={styles.addToListBtn} onPress={() => setShowCookMode(true)}>
                  <Text style={styles.addToListBtnText}>👨‍🍳 Start Cooking</Text>
                </TouchableOpacity>
              )}
              {recipe.recipeInstructions.length === 0 ? (
                <Text style={styles.emptyText}>No instructions listed</Text>
              ) : recipe.recipeInstructions.map((step, i) => (
                <View key={i} style={styles.step}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    {step.title ? <Text style={styles.stepTitle}>{step.title}</Text> : null}
                    <Text style={styles.stepText}>
                      {unitSystem === 'metric' ? convertInstructionTemperatures(step.text) : step.text}
                    </Text>
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

          <View style={styles.assetsSection}>
            <View style={styles.assetsSectionHeader}>
              <Text style={styles.assetsSectionTitle}>ATTACHMENTS</Text>
              <TouchableOpacity onPress={handleAddAttachment} disabled={attachmentUploading}>
                {attachmentUploading
                  ? <ActivityIndicator color={colors.primary} size="small" />
                  : <Text style={styles.assetAddText}>+ Add</Text>
                }
              </TouchableOpacity>
            </View>
            {recipe.assets && recipe.assets.length > 0 ? recipe.assets.map((asset, i) => (
              <TouchableOpacity
                key={i}
                style={styles.assetItem}
                onPress={() => openAsset(asset.fileName)}
              >
                <Text style={styles.assetIcon}>📎</Text>
                <Text style={styles.assetName} numberOfLines={1}>{asset.name || asset.fileName}</Text>
                <Text style={styles.assetOpen}>Open ›</Text>
              </TouchableOpacity>
            )) : (
              <Text style={styles.emptyText}>No attachments yet</Text>
            )}
          </View>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Recipe</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showShareModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={shareStyles.container}>
          <View style={shareStyles.header}>
            <TouchableOpacity onPress={() => setShowShareModal(false)}>
              <Text style={shareStyles.close}>Close</Text>
            </TouchableOpacity>
            <Text style={shareStyles.title}>Share Recipe</Text>
            <View style={{ width: 50 }} />
          </View>

          <TouchableOpacity
            style={shareStyles.newLinkBtn}
            onPress={handleCreateShareToken}
            disabled={creatingToken}
          >
            {creatingToken
              ? <ActivityIndicator color={colors.textInverse} size="small" />
              : <Text style={shareStyles.newLinkBtnText}>+ New Share Link</Text>
            }
          </TouchableOpacity>

          {shareTokensLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : shareTokens.length === 0 ? (
            <Text style={styles.emptyText}>No share links yet — friends without an account can view this recipe with one.</Text>
          ) : (
            <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
              {shareTokens.map(t => (
                <View key={t.id} style={shareStyles.tokenRow}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => handleShareToken(t.id)}>
                    <Text style={shareStyles.tokenExpiry}>
                      Expires {new Date(t.expiresAt).toLocaleDateString()}
                    </Text>
                    <Text style={shareStyles.tokenLink} numberOfLines={1}>{shareTokenLink(t.id)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleShareToken(t.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={shareStyles.tokenAction}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteShareToken(t.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={[shareStyles.tokenAction, { color: colors.error }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      <Modal
        visible={showListPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowListPicker(false)}
      >
        <View style={listPickerStyles.overlay}>
          <View style={listPickerStyles.content}>
            <Text style={listPickerStyles.title}>Add to Shopping List</Text>
            {listPickerLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : shoppingLists.length === 0 ? (
              <Text style={styles.emptyText}>No shopping lists yet — create one in the Shopping tab first.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {shoppingLists.map(list => (
                  <TouchableOpacity
                    key={list.id}
                    style={listPickerStyles.listRow}
                    onPress={() => handleAddToList(list)}
                    disabled={addingToListId !== null}
                  >
                    <Text style={listPickerStyles.listName}>{list.name}</Text>
                    {addingToListId === list.id
                      ? <ActivityIndicator color={colors.primary} size="small" />
                      : <Text style={listPickerStyles.chevron}>›</Text>
                    }
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={listPickerStyles.cancelBtn} onPress={() => setShowListPicker(false)}>
              <Text style={listPickerStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CookModeModal
        visible={showCookMode}
        onClose={() => setShowCookMode(false)}
        recipeName={recipe.name}
        steps={cookModeSteps}
        ingredientLines={ingredientDisplayLines.map((text, i) => ({ text, title: recipe.recipeIngredient[i]?.title ?? undefined }))}
      />
    </View>
  );
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={metaStyles.container}>
      <View style={metaStyles.valueBox}>
        <Text style={metaStyles.value}>{value}</Text>
      </View>
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
  // justifyContent: 'flex-end' anchors each stat's label to the bottom of
  // the row regardless of how many lines its value wraps to (e.g. "15
  // minutes" vs "4 hours 5 minutes") — otherwise labels for shorter values
  // sit higher than labels for values that wrap to two lines.
  container: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  // Fixed-height box (two lines' worth) so a one-line value ("15 minutes")
  // centers vertically against a two-line value ("4 hours 5 minutes")
  // instead of sitting flush with its bottom line.
  valueBox: { minHeight: 18 * 2, justifyContent: 'center' },
  value: { fontSize: typography.size.md, lineHeight: 18, fontWeight: typography.weight.semibold, color: colors.textPrimary, textAlign: 'center' },
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
  heroUploadOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 260,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  backButton: {
    position: 'absolute', top: 52, left: spacing.md,
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  backButtonText: { fontSize: 24, color: '#fff', lineHeight: 30 },
  cameraButton: {
    position: 'absolute', top: 52, right: spacing.md,
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraButtonText: { fontSize: 16 },
  overlayActions: {
    position: 'absolute', bottom: spacing.md, right: spacing.md, left: spacing.md,
    flexDirection: 'row', gap: spacing.xs, justifyContent: 'flex-end', flexWrap: 'wrap',
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
  ingredientToolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
  },
  unitToggle: {
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
  },
  unitToggleText: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, color: colors.primary },
  addToListBtn: {
    borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.md,
    paddingVertical: spacing.sm + 2, alignItems: 'center', backgroundColor: colors.surface,
  },
  addToListBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.primary },
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
  ingredientSectionTitle: {
    fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.textPrimary,
    marginTop: spacing.md, marginBottom: spacing.xs,
  },
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
  assetsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  assetsSectionTitle: {
    fontSize: typography.size.xs, fontWeight: typography.weight.semibold,
    color: colors.textDisabled, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  assetAddText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.primary },
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

const shareStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  close: { fontSize: typography.size.md, color: colors.textSecondary, width: 50 },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  newLinkBtn: {
    margin: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  newLinkBtnText: { color: colors.textInverse, fontWeight: typography.weight.semibold, fontSize: typography.size.md },
  tokenRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  tokenExpiry: { fontSize: typography.size.xs, color: colors.textDisabled },
  tokenLink: { fontSize: typography.size.sm, color: colors.textPrimary, marginTop: 2 },
  tokenAction: { fontSize: typography.size.sm, color: colors.primary, fontWeight: typography.weight.medium },
});

const listPickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  content: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    width: '85%', gap: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  listRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  listName: { fontSize: typography.size.md, color: colors.textPrimary },
  chevron: { fontSize: 20, color: colors.textDisabled },
  cancelBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  cancelBtnText: { color: colors.textSecondary, fontSize: typography.size.md },
});
