import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { recipeImageUrl } from '../lib/mealieApi';
import { colors, radius, spacing, typography } from '../theme';
import type { RecipeSummary } from '../types';

interface Props {
  recipe: RecipeSummary;
  onPress: () => void;
}

export default function RecipeCard({ recipe, onPress }: Props) {
  const { serverUrl } = useAuth();
  const [imgError, setImgError] = useState(false);
  const imgUri = recipe.image && serverUrl && !imgError
    ? recipeImageUrl(serverUrl, recipe.slug)
    : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {imgUri ? (
        <Image
          source={{ uri: imgUri }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderIcon}>🍽️</Text>
        </View>
      )}
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
