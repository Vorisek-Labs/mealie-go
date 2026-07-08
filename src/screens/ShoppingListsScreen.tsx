import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useShoppingLists } from '../hooks/useShoppingLists';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing, typography } from '../theme';
import type { ShoppingStackParams } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<ShoppingStackParams, 'ShoppingLists'>;
};

export default function ShoppingListsScreen({ navigation }: Props) {
  const { lists, loading, error, refresh, createList, deleteList } = useShoppingLists();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createList(name);
      setNewName('');
      setShowCreate(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create list');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete list', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteList(id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Shopping</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowCreate(true)}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
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
      ) : lists.length === 0 ? (
        <EmptyState icon="🛒" title="No shopping lists" subtitle="Tap + to create your first list" />
      ) : (
        <FlatList
          data={lists}
          keyExtractor={item => item.id}
          onRefresh={refresh}
          refreshing={loading}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listCard}
              onPress={() => navigation.navigate('ShoppingListDetail', { listId: item.id, listName: item.name })}
              onLongPress={() => handleDelete(item.id, item.name)}
              activeOpacity={0.75}
            >
              <Text style={styles.listIcon}>🛒</Text>
              <Text style={styles.listName}>{item.name}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={showCreate} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Shopping List</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="List name"
              placeholderTextColor={colors.textDisabled}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              onSubmitEditing={handleCreate}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowCreate(false); setNewName(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, creating && styles.buttonDisabled]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating
                  ? <ActivityIndicator color={colors.textInverse} size="small" />
                  : <Text style={styles.modalConfirmText}>Create</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 56 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  title: { fontSize: typography.size.xxl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  addButton: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  addButtonText: { fontSize: 22, color: colors.textInverse, lineHeight: 28 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  listCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.md,
  },
  listIcon: { fontSize: 22 },
  listName: { flex: 1, fontSize: typography.size.lg, fontWeight: typography.weight.medium, color: colors.textPrimary },
  chevron: { fontSize: 20, color: colors.textDisabled },
  errorText: { color: colors.error, fontSize: typography.size.md },
  retryText: { color: colors.primary, fontSize: typography.size.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  modalContent: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, width: '85%', gap: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  modalTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  modalInput: {
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: typography.size.md, color: colors.textPrimary,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalCancel: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center',
  },
  modalCancelText: { color: colors.textSecondary, fontSize: typography.size.md },
  modalConfirm: {
    flex: 1, backgroundColor: colors.primary,
    borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  modalConfirmText: { color: colors.textInverse, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
});
