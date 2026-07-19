import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useCookbooks } from '../hooks/useCookbooks';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing, typography } from '../theme';
import type { Cookbook } from '../types';
import type { CookbooksStackParams } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<CookbooksStackParams, 'CookbooksList'>;
};

export default function CookbooksScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { cookbooks, loading, error, refresh, createCookbook, updateCookbook, deleteCookbook } = useCookbooks();

  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<Cookbook | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setIsPublic(false);
    setShowEditor(true);
  };

  const openEdit = (cookbook: Cookbook) => {
    setEditing(cookbook);
    setName(cookbook.name);
    setDescription(cookbook.description ?? '');
    setIsPublic(cookbook.public);
    setShowEditor(true);
  };

  const handleLongPress = (cookbook: Cookbook) => {
    Alert.alert(cookbook.name, undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('cookbooks.edit'), onPress: () => openEdit(cookbook) },
      {
        text: t('cookbooks.delete'),
        style: 'destructive',
        onPress: () => Alert.alert(t('cookbooks.deleteCookbookTitle'), t('cookbooks.deleteCookbookMsg', { name: cookbook.name }), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('cookbooks.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteCookbook(cookbook.id);
              } catch (e) {
                Alert.alert(t('common.error'), e instanceof Error ? e.message : t('cookbooks.genericDeleteError'));
              }
            },
          },
        ]),
      },
    ]);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSaving(true);
    try {
      const data = {
        name: trimmedName,
        description: description.trim(),
        public: isPublic,
        position: editing?.position ?? 1,
      };
      if (editing) {
        await updateCookbook(editing.id, data);
      } else {
        await createCookbook(data);
      }
      setShowEditor(false);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('cookbooks.genericSaveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('cookbooks.title')}</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreate}>
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
          <TouchableOpacity onPress={refresh}><Text style={styles.retryText}>{t('common.retry')}</Text></TouchableOpacity>
        </View>
      ) : cookbooks.length === 0 ? (
        <EmptyState icon="📖" title={t('cookbooks.emptyTitle')} subtitle={t('cookbooks.emptySubtitle')} />
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
              onLongPress={() => handleLongPress(item)}
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

      <Modal visible={showEditor} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editing ? t('cookbooks.editTitle') : t('cookbooks.newTitle')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('cookbooks.namePlaceholder')}
              placeholderTextColor={colors.textDisabled}
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              placeholder={t('cookbooks.descriptionPlaceholder')}
              placeholderTextColor={colors.textDisabled}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.publicRow} onPress={() => setIsPublic(prev => !prev)}>
              <View style={[styles.checkbox, isPublic && styles.checkboxChecked]}>
                {isPublic ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.publicLabel}>{t('cookbooks.publicLabel')}</Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEditor(false)}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, (saving || !name.trim()) && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={saving || !name.trim()}
              >
                {saving
                  ? <ActivityIndicator color={colors.textInverse} size="small" />
                  : <Text style={styles.modalConfirmText}>{editing ? t('cookbooks.save') : t('cookbooks.create')}</Text>
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
  modalTextarea: { minHeight: 72, paddingTop: spacing.sm },
  publicRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: colors.textInverse, fontSize: 14, fontWeight: typography.weight.bold },
  publicLabel: { flex: 1, fontSize: typography.size.sm, color: colors.textSecondary },
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
