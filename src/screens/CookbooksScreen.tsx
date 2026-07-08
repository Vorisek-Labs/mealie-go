import React from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCookbooks } from '../hooks/useCookbooks';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing, typography } from '../theme';
import type { CookbooksStackParams } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<CookbooksStackParams, 'CookbooksList'>;
};

export default function CookbooksScreen({ navigation }: Props) {
  const { cookbooks, loading, error, refresh } = useCookbooks();

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cookbooks</Text>
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
      ) : cookbooks.length === 0 ? (
        <EmptyState icon="📖" title="No cookbooks yet" subtitle="Create cookbooks in Mealie to organize your recipes" />
      ) : (
        <FlatList
          data={cookbooks}
          keyExtractor={item => item.id}
          onRefresh={refresh}
          refreshing={loading}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('CookbookDetail', { slug: item.slug, name: item.name })}
              activeOpacity={0.75}
            >
              <Text style={styles.cardIcon}>📖</Text>
              <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 56 },
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  title: { fontSize: typography.size.xxl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  grid: { padding: spacing.md, paddingBottom: spacing.xxl },
  row: { gap: spacing.sm },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardIcon: { fontSize: 32 },
  cardName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  cardDesc: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: typography.size.sm * 1.4,
  },
  errorText: { color: colors.error, fontSize: typography.size.md },
  retryText: { color: colors.primary, fontSize: typography.size.md },
});
