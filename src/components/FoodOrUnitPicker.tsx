import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing, typography } from '../theme';

interface PickableItem {
  id?: string;
  name: string;
}

interface Props<T extends PickableItem> {
  visible: boolean;
  title: string;
  initialQuery: string;
  search: (query: string) => Promise<T[]>;
  create: (name: string) => Promise<T>;
  onSelect: (item: T, wasCreated: boolean) => void;
  onClose: () => void;
}

// Reused for both Foods and Units in the ingredient-parse review flow --
// lets you either pick an existing one (search-as-you-type, matching
// Mealie's own autocomplete during ingredient review) or create a brand
// new one on the spot when the parser found a term with no match at all.
export default function FoodOrUnitPicker<T extends PickableItem>({
  visible, title, initialQuery, search, create, onSelect, onClose,
}: Props<T>) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) setQuery(initialQuery);
  }, [visible, initialQuery]);

  useEffect(() => {
    if (!visible) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await search(query));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, query]);

  const exactMatch = results.some(r => r.name.toLowerCase() === query.trim().toLowerCase());

  const handleCreate = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const created = await create(trimmed);
      onSelect(created, true);
    } catch {
      // Leave the picker open on failure so the user can retry or search instead.
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={{ width: 60 }} />
        </View>

        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={t('common.searchOrTypeNew')}
          placeholderTextColor={colors.textDisabled}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
        />

        {!exactMatch && query.trim().length > 0 && (
          <TouchableOpacity style={styles.createRow} onPress={handleCreate} disabled={creating}>
            {creating
              ? <ActivityIndicator color={colors.primary} size="small" />
              : <Text style={styles.createRowText}>{t('common.createOption', { name: query.trim() })}</Text>
            }
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : (
          <ScrollView contentContainerStyle={styles.resultsList}>
            {results.map(item => (
              <TouchableOpacity
                key={item.id ?? item.name}
                style={styles.resultItem}
                onPress={() => onSelect(item, false)}
              >
                <Text style={styles.resultName}>{item.name}</Text>
              </TouchableOpacity>
            ))}
            {!loading && results.length === 0 && (
              <Text style={styles.emptyText}>{t('common.noMatchesCreateNew')}</Text>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cancel: { fontSize: typography.size.md, color: colors.textSecondary, width: 60 },
  title: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.textPrimary },
  input: {
    margin: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontSize: typography.size.md, color: colors.textPrimary,
  },
  createRow: {
    marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary,
    paddingVertical: spacing.sm + 2, alignItems: 'center',
  },
  createRowText: { color: colors.primary, fontWeight: typography.weight.semibold, fontSize: typography.size.md },
  resultsList: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  resultItem: {
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  resultName: { fontSize: typography.size.md, color: colors.textPrimary },
  emptyText: { color: colors.textDisabled, textAlign: 'center', fontSize: typography.size.md, marginTop: spacing.xl },
});
