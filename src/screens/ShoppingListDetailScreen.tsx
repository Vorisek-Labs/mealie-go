import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, StyleSheet, Text,
  TextInput, TouchableOpacity, View, ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useShoppingListDetail } from '../hooks/useShoppingLists';
import { api } from '../lib/mealieApi';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing, typography } from '../theme';
import type { ShoppingListItem } from '../types';
import type { ShoppingStackParams } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<ShoppingStackParams, 'ShoppingListDetail'>;
  route: RouteProp<ShoppingStackParams, 'ShoppingListDetail'>;
};

function mondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d;
}
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

type GroupedSection = { label: { id: string; name: string; color?: string } | null; items: ShoppingListItem[] };

export default function ShoppingListDetailScreen({ navigation, route }: Props) {
  const { listId, listName } = route.params;
  const {
    list, labels, loading, error, refresh,
    addItem, toggleItem, deleteItem,
    generateFromMealPlan, mergeDuplicates, duplicateCount,
  } = useShoppingListDetail(listId);

  const [newItem, setNewItem] = useState('');
  const [newQty, setNewQty] = useState('');
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleAdd = async () => {
    const note = newItem.trim();
    if (!note) return;
    const qty = parseFloat(newQty) || undefined;
    setAdding(true);
    try {
      await addItem(note, qty);
      setNewItem('');
      setNewQty('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not add item');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = (item: ShoppingListItem) => {
    Alert.alert('Remove item', `Remove "${item.display ?? item.note ?? item.food?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteItem(item.id) },
    ]);
  };

  const handleGenerateFromMealPlan = async () => {
    const now = new Date();
    const start = mondayOfWeek(now);
    const end = addDays(start, 6);
    setGenerating(true);
    try {
      await generateFromMealPlan(isoDate(start), isoDate(end));
      Alert.alert('Done', "This week's meal plan ingredients were added.");
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not generate from meal plan');
    } finally {
      setGenerating(false);
    }
  };

  const handleMergeDuplicates = async () => {
    Alert.alert('Merge duplicates', `Remove ${duplicateCount} duplicate item${duplicateCount > 1 ? 's' : ''}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Merge',
        style: 'destructive',
        onPress: async () => {
          const removed = await mergeDuplicates();
          if (removed) Alert.alert('Done', `Removed ${removed} duplicate${removed > 1 ? 's' : ''}.`);
        },
      },
    ]);
  };

  const unchecked = list?.listItems.filter(i => !i.checked) ?? [];
  const checked = list?.listItems.filter(i => i.checked) ?? [];
  const total = list?.listItems.length ?? 0;
  const done = checked.length;

  // Group unchecked by label
  const buildGroups = (): GroupedSection[] => {
    if (!list || labels.length === 0) {
      return [{ label: null, items: unchecked }];
    }
    const byLabel: Record<string, ShoppingListItem[]> = {};
    unchecked.forEach(item => {
      const key = item.labelId ?? '_none';
      if (!byLabel[key]) byLabel[key] = [];
      byLabel[key].push(item);
    });
    const groups: GroupedSection[] = [];
    labels.forEach(label => {
      if (byLabel[label.id]?.length > 0) {
        groups.push({ label, items: byLabel[label.id] });
      }
    });
    if (byLabel['_none']?.length > 0) {
      groups.push({ label: null, items: byLabel['_none'] });
    }
    return groups;
  };

  const groups = buildGroups();
  const hasLabels = labels.length > 0;

  const renderItem = (item: ShoppingListItem) => {
    const label = item.display ?? item.note ?? item.food?.name ?? 'Item';
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => toggleItem(item)}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
          {item.checked && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[styles.itemText, item.checked && styles.itemTextChecked]}>{label}</Text>
        {item.quantity ? (
          <Text style={styles.itemQty}>×{item.quantity}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={1}>{listName}</Text>
          {total > 0 && <Text style={styles.progress}>{done}/{total} done</Text>}
        </View>
        <View style={{ width: 32 }} />
      </View>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionBtn, generating && { opacity: 0.6 }]}
          onPress={handleGenerateFromMealPlan}
          disabled={generating}
        >
          {generating
            ? <ActivityIndicator color={colors.textInverse} size="small" />
            : <Text style={styles.actionBtnText}>🗓 From Meal Plan</Text>
          }
        </TouchableOpacity>
        {duplicateCount > 0 && (
          <TouchableOpacity style={styles.mergeBtn} onPress={handleMergeDuplicates}>
            <Text style={styles.mergeBtnText}>Merge {duplicateCount} dupes</Text>
          </TouchableOpacity>
        )}
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
      ) : total === 0 ? (
        <EmptyState icon="🛒" title="List is empty" subtitle="Add items below" />
      ) : (
        <ScrollView contentContainerStyle={styles.list} style={{ flex: 1 }}>
          {hasLabels ? (
            groups.map((group, gi) => (
              <View key={gi}>
                {group.label && (
                  <View style={styles.labelHeader}>
                    {group.label.color && (
                      <View style={[styles.labelDot, { backgroundColor: group.label.color }]} />
                    )}
                    <Text style={styles.labelName}>{group.label.name}</Text>
                  </View>
                )}
                {group.items.map(item => (
                  <View key={item.id}>{renderItem(item)}</View>
                ))}
              </View>
            ))
          ) : (
            unchecked.map(item => (
              <View key={item.id}>{renderItem(item)}</View>
            ))
          )}

          {checked.length > 0 && (
            <>
              <Text style={styles.divider}>Checked ({checked.length})</Text>
              {checked.map(item => (
                <View key={item.id}>{renderItem(item)}</View>
              ))}
            </>
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      <View style={styles.addBar}>
        <TextInput
          style={styles.addQtyInput}
          placeholder="Qty"
          placeholderTextColor={colors.textDisabled}
          value={newQty}
          onChangeText={setNewQty}
          keyboardType="numeric"
          returnKeyType="next"
        />
        <TextInput
          style={styles.addInput}
          placeholder="Add item…"
          placeholderTextColor={colors.textDisabled}
          value={newItem}
          onChangeText={setNewItem}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addSubmit, adding && styles.buttonDisabled]}
          onPress={handleAdd}
          disabled={adding}
        >
          {adding
            ? <ActivityIndicator color={colors.textInverse} size="small" />
            : <Text style={styles.addSubmitText}>Add</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 56 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  back: { fontSize: 28, color: colors.textSecondary, width: 32 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  progress: { fontSize: typography.size.sm, color: colors.textSecondary },
  actionBar: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, flexWrap: 'wrap' },
  actionBtn: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionBtnText: { fontSize: typography.size.sm, color: colors.textPrimary, fontWeight: typography.weight.medium },
  mergeBtn: { backgroundColor: colors.surfaceElevated, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderWidth: 1, borderColor: colors.warning },
  mergeBtnText: { fontSize: typography.size.sm, color: colors.warning, fontWeight: typography.weight.medium },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  list: { paddingBottom: 80 },
  labelHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, backgroundColor: colors.background },
  labelDot: { width: 8, height: 8, borderRadius: 4 },
  labelName: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  checkbox: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { fontSize: 14, color: colors.textInverse, fontWeight: typography.weight.bold },
  itemText: { flex: 1, fontSize: typography.size.md, color: colors.textPrimary },
  itemTextChecked: { color: colors.textDisabled, textDecorationLine: 'line-through' },
  itemQty: { fontSize: typography.size.sm, color: colors.textSecondary },
  divider: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background },
  addBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  addQtyInput: { width: 52, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, fontSize: typography.size.md, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, textAlign: 'center' },
  addInput: { flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.size.md, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  addSubmit: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.6 },
  addSubmitText: { color: colors.textInverse, fontWeight: typography.weight.semibold, fontSize: typography.size.md },
  errorText: { color: colors.error, fontSize: typography.size.md },
  retryText: { color: colors.primary, fontSize: typography.size.md },
});
