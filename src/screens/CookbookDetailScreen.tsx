import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, FlatList } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, NavigationProp } from '@react-navigation/native';
import { useCookbookRecipes } from '../hooks/useCookbooks';
import RecipeCard from '../components/RecipeCard';
import EmptyState from '../components/EmptyState';
import { colors, spacing, typography } from '../theme';
import type { CookbooksStackParams, MainTabParams } from '../navigation/RootNavigator';
import type { RecipeSummary } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<CookbooksStackParams, 'CookbookDetail'>;
  route: RouteProp<CookbooksStackParams, 'CookbookDetail'>;
};

export default function CookbookDetailScreen({ navigation, route }: Props) {
  const { slug, name } = route.params;
  const { recipes, loading, error, refresh } = useCookbookRecipes(slug);
  const tabNavigation = useNavigation<NavigationProp<MainTabParams>>();

  const openRecipe = (item: RecipeSummary) => {
    tabNavigation.navigate('Recipes', {
      screen: 'RecipeDetail',
      params: { slug: item.slug, name: item.name },
    } as never);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      ) : recipes.length === 0 ? (
        <EmptyState icon="📖" title="No recipes" subtitle="Add recipes to this cookbook in Mealie" />
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={item => item.id}
          onRefresh={refresh}
          refreshing={loading}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              onPress={() => openRecipe(item)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 56 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm,
  },
  back: { fontSize: 28, color: colors.textSecondary, width: 32 },
  title: { flex: 1, fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary, textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  list: { paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  errorText: { color: colors.error, fontSize: typography.size.md },
  retryText: { color: colors.primary, fontSize: typography.size.md },
});
