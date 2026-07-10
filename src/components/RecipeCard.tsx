import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { recipeImageSource } from '../lib/mealieApi';
import { colors, radius, spacing, typography } from '../theme';
import type { RecipeSummary } from '../types';

interface Props {
  recipe: RecipeSummary;
  onPress: () => void;
}

export default function RecipeCard({ recipe, onPress }: Props) {
  const { serverUrl, token } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [imgError, setImgError] = useState(false);
  const imgSrc = recipe.image && serverUrl && !imgError
    ? recipeImageSource(serverUrl, token, recipe.id, recipe.image)
    : null;
  const favorite = isFavorite(recipe.id);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {imgSrc ? (
        <Image
          source={imgSrc}
          style={styles.image}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderIcon}>🍽️</Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.favoriteButton}
        onPress={() => toggleFavorite(recipe.id, recipe.slug)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.favoriteIcon}>{favorite ? '♥' : '♡'}</Text>
      </TouchableOpacity>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{recipe.name}</Text>
        {recipe.description ? (
          <Text style={styles.description} numberOfLines={2}>{recipe.description}</Text>
        ) : null}
        <View style={styles.meta}>
          {recipe.totalTime ? (
            <Text style={styles.metaText}>⏱ {recipe.totalTime}</Text>
          ) : null}
          {recipe.recipeCategory?.length > 0 ? (
            <Text style={styles.metaText}>{recipe.recipeCategory[0].name}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    height: 96,
  },
  image: {
    width: 96,
    height: 96,
  },
  imagePlaceholder: {
    width: 96,
    height: 96,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderIcon: {
    fontSize: 28,
  },
  favoriteButton: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteIcon: {
    fontSize: 15,
    color: '#fff',
  },
  info: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'space-between',
  },
  name: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    lineHeight: typography.size.md * 1.3,
  },
  description: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: typography.size.sm * 1.4,
  },
  meta: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metaText: {
    fontSize: typography.size.xs,
    color: colors.textDisabled,
  },
});
