import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useMealPlan } from '../hooks/useMealPlan';
import { api } from '../lib/mealieApi';
import { navigateToGuide } from '../navigation/navigateToGuide';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing, typography } from '../theme';
import type { MealPlanEntry, MealPlanEntryType, RecipeSummary } from '../types';

const MEAL_TYPES: MealPlanEntryType[] = ['breakfast', 'lunch', 'dinner', 'side'];
const MEAL_TYPE_KEYS: Record<MealPlanEntryType, string> = {
  breakfast: 'mealPlan.mealTypes.breakfast',
  lunch: 'mealPlan.mealTypes.lunch',
  dinner: 'mealPlan.mealTypes.dinner',
  side: 'mealPlan.mealTypes.side',
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function mondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

type AddMode = 'recipe' | 'note';

export default function MealPlanScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);

  const dayLabels = t('mealPlan.days', { returnObjects: true }) as string[];
  const mealTypeLabels = useMemo(
    () => MEAL_TYPES.reduce<Record<string, string>>((acc, type) => {
      acc[type] = t(MEAL_TYPE_KEYS[type]);
      return acc;
    }, {}),
    [t]
  );

  const today = new Date();
  const weekStart = addDays(mondayOfWeek(today), weekOffset * 7);
  const { entries, loading, error, refresh, addEntry, removeEntry } = useMealPlan(weekStart);

  const selectedDate = isoDate(addDays(weekStart, selectedDay));
  const dayEntries = entries.filter(e => e.date === selectedDate);
  const entriesByType = MEAL_TYPES.reduce<Record<string, MealPlanEntry[]>>((acc, type) => {
    acc[type] = dayEntries.filter(e => e.entryType === type);
    return acc;
  }, {} as Record<string, MealPlanEntry[]>);

  const [showAdd, setShowAdd] = useState(false);
  const [addMealType, setAddMealType] = useState<MealPlanEntryType>('dinner');
  const [addMode, setAddMode] = useState<AddMode>('recipe');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [searchResults, setSearchResults] = useState<RecipeSummary[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [adding, setAdding] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRecipeSearch = useCallback((term: string) => {
    setRecipeSearch(term);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!term.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await api.getRecipes({ search: term, perPage: 8 });
        setSearchResults(data.items);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  }, []);

  const openAdd = (mealType: MealPlanEntryType) => {
    setAddMealType(mealType);
    setAddMode('recipe');
    setRecipeSearch('');
    setSearchResults([]);
    setNoteText('');
    setShowAdd(true);
  };

  const handleAddRecipe = async (recipe: RecipeSummary) => {
    setAdding(true);
    try {
      await addEntry({ date: selectedDate, entryType: addMealType, recipeId: recipe.id });
      setShowAdd(false);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('mealPlan.genericAddError'));
    } finally {
      setAdding(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setAdding(true);
    try {
      await addEntry({ date: selectedDate, entryType: addMealType, title: noteText.trim() });
      setShowAdd(false);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('mealPlan.genericAddNoteError'));
    } finally {
      setAdding(false);
    }
  };

  const handleRandom = async () => {
    setAdding(true);
    try {
      const recipe = await api.getRandomRecipe();
      if (!recipe) { Alert.alert(t('mealPlan.noRecipesFoundAlert')); return; }
      await addEntry({ date: selectedDate, entryType: addMealType, recipeId: recipe.id });
      setShowAdd(false);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('mealPlan.genericRandomError'));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = (entry: MealPlanEntry) => {
    Alert.alert(
      t('mealPlan.removeFromPlanTitle'),
      t('mealPlan.removeFromPlanMsg', { name: entry.recipe?.name ?? entry.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('mealPlan.remove'), style: 'destructive', onPress: () => removeEntry(entry.id) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={() => setWeekOffset(w => w - 1)}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.weekLabel}>
            {weekOffset === 0 ? t('mealPlan.thisWeek') : weekOffset === 1 ? t('mealPlan.nextWeek') : weekOffset === -1 ? t('mealPlan.lastWeek') : isoDate(weekStart)}
          </Text>
          <TouchableOpacity onPress={() => setWeekOffset(w => w + 1)}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.headerSide}
          onPress={() => navigateToGuide(navigation, 'mealPlan')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.guideButtonText}>?</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayStrip} contentContainerStyle={styles.dayStripContent}>
        {dayLabels.map((day, i) => {
          const date = addDays(weekStart, i);
          const isToday = isoDate(date) === isoDate(today);
          const hasEntries = entries.some(e => e.date === isoDate(date));
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayButton, selectedDay === i && styles.dayButtonActive]}
              onPress={() => setSelectedDay(i)}
            >
              <Text style={[styles.dayLabel, selectedDay === i && styles.dayLabelActive]}>{day}</Text>
              <Text style={[styles.dayNum, selectedDay === i && styles.dayNumActive, isToday && selectedDay !== i && styles.dayNumToday]}>
                {date.getDate()}
              </Text>
              {hasEntries && <View style={[styles.dot, selectedDay === i && styles.dotActive]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh}><Text style={styles.retryText}>{t('common.retry')}</Text></TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.planList}>
          {MEAL_TYPES.map(type => (
            <View key={type} style={styles.mealSection}>
              <View style={styles.mealSectionHeader}>
                <Text style={styles.mealType}>{mealTypeLabels[type]}</Text>
                <TouchableOpacity style={styles.addMealBtn} onPress={() => openAdd(type)}>
                  <Text style={styles.addMealBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              {entriesByType[type].length === 0 ? (
                <TouchableOpacity style={styles.emptyMealSlot} onPress={() => openAdd(type)}>
                  <Text style={styles.emptyMealText}>{t('mealPlan.tapToAdd')}</Text>
                </TouchableOpacity>
              ) : entriesByType[type].map(entry => (
                <View key={entry.id} style={[styles.mealEntry, entry.recipeId ? null : styles.mealEntryNote]}>
                  <Text style={styles.mealName}>
                    {entry.recipe?.name ?? entry.title ?? t('mealPlan.untitled')}
                  </Text>
                  {!entry.recipeId && (
                    <Text style={styles.noteTag}>{t('mealPlan.noteTag')}</Text>
                  )}
                  <TouchableOpacity onPress={() => handleDelete(entry)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <View style={addStyles.container}>
          <View style={addStyles.header}>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Text style={addStyles.cancel}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={addStyles.title}>
              {mealTypeLabels[addMealType]} — {new Date(selectedDate + 'T12:00:00').toLocaleDateString(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={addStyles.modeRow}>
            <TouchableOpacity
              style={[addStyles.modeBtn, addMode === 'recipe' && addStyles.modeBtnActive]}
              onPress={() => setAddMode('recipe')}
            >
              <Text style={[addStyles.modeBtnText, addMode === 'recipe' && addStyles.modeBtnTextActive]}>{t('mealPlan.modeRecipe')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[addStyles.modeBtn, addMode === 'note' && addStyles.modeBtnActive]}
              onPress={() => setAddMode('note')}
            >
              <Text style={[addStyles.modeBtnText, addMode === 'note' && addStyles.modeBtnTextActive]}>{t('mealPlan.modeNote')}</Text>
            </TouchableOpacity>
          </View>

          {addMode === 'recipe' ? (
            <View style={addStyles.recipeMode}>
              <View style={addStyles.searchBar}>
                <Text style={addStyles.searchIcon}>🔍</Text>
                <TextInput
                  style={addStyles.searchInput}
                  value={recipeSearch}
                  onChangeText={handleRecipeSearch}
                  placeholder={t('mealPlan.searchPlaceholder')}
                  placeholderTextColor={colors.textDisabled}
                  autoFocus
                />
              </View>

              <TouchableOpacity style={addStyles.randomBtn} onPress={handleRandom} disabled={adding}>
                <Text style={addStyles.randomBtnText}>
                  {adding ? '…' : t('mealPlan.surpriseMe')}
                </Text>
              </TouchableOpacity>

              {searchLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={r => r.id}
                  contentContainerStyle={addStyles.resultsList}
                  ListEmptyComponent={
                    recipeSearch.trim()
                      ? <Text style={addStyles.emptyText}>{t('mealPlan.noRecipesFound')}</Text>
                      : <Text style={addStyles.emptyText}>{t('mealPlan.typeToSearch')}</Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={addStyles.resultItem}
                      onPress={() => handleAddRecipe(item)}
                      disabled={adding}
                    >
                      <Text style={addStyles.resultName} numberOfLines={1}>{item.name}</Text>
                      {item.totalTime ? <Text style={addStyles.resultMeta}>{item.totalTime}</Text> : null}
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          ) : (
            <View style={addStyles.noteMode}>
              <Text style={addStyles.noteLabel}>{t('mealPlan.noteTitleLabel')}</Text>
              <TextInput
                style={addStyles.noteInput}
                value={noteText}
                onChangeText={setNoteText}
                placeholder={t('mealPlan.notePlaceholder')}
                placeholderTextColor={colors.textDisabled}
                autoFocus
              />
              <TouchableOpacity
                style={[addStyles.addNoteBtn, (!noteText.trim() || adding) && { opacity: 0.5 }]}
                onPress={handleAddNote}
                disabled={!noteText.trim() || adding}
              >
                {adding
                  ? <ActivityIndicator color={colors.textInverse} />
                  : <Text style={addStyles.addNoteBtnText}>{t('mealPlan.addNoteButton')}</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 56 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  headerSide: { width: 28, alignItems: 'center' },
  guideButtonText: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.textDisabled },
  weekNav: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  navArrow: { fontSize: 28, color: colors.textSecondary, paddingHorizontal: spacing.sm },
  weekLabel: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  dayStrip: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
  dayStripContent: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, gap: spacing.xs },
  dayButton: { alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, minWidth: 44, gap: 2 },
  dayButtonActive: { backgroundColor: colors.primary },
  dayLabel: { fontSize: typography.size.xs, color: colors.textSecondary, fontWeight: typography.weight.medium },
  dayLabelActive: { color: colors.textInverse },
  dayNum: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.textPrimary },
  dayNumActive: { color: colors.textInverse },
  dayNumToday: { color: colors.primary },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary },
  dotActive: { backgroundColor: colors.textInverse },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  planList: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl },
  mealSection: { gap: spacing.sm },
  mealSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mealType: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  addMealBtn: { width: 26, height: 26, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addMealBtnText: { fontSize: 18, color: colors.textInverse, lineHeight: 22 },
  emptyMealSlot: { borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: spacing.sm + 2, alignItems: 'center' },
  emptyMealText: { fontSize: typography.size.sm, color: colors.textDisabled },
  mealEntry: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  mealEntryNote: { borderStyle: 'dashed', borderColor: colors.borderLight },
  mealName: { flex: 1, fontSize: typography.size.md, color: colors.textPrimary, fontWeight: typography.weight.medium },
  noteTag: { fontSize: typography.size.xs, color: colors.textSecondary, backgroundColor: colors.surfaceElevated, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  removeText: { color: colors.textDisabled, fontSize: 16 },
  errorText: { color: colors.error, fontSize: typography.size.md },
  retryText: { color: colors.primary, fontSize: typography.size.md },
});

const addStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  cancel: { fontSize: typography.size.md, color: colors.textSecondary, width: 60 },
  title: { flex: 1, fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.textPrimary, textAlign: 'center' },
  modeRow: { flexDirection: 'row', margin: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  modeBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  modeBtnActive: { backgroundColor: colors.primary },
  modeBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary },
  modeBtnTextActive: { color: colors.textInverse },
  recipeMode: { flex: 1, paddingHorizontal: spacing.md },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm, marginBottom: spacing.sm },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, paddingVertical: spacing.sm + 2, fontSize: typography.size.md, color: colors.textPrimary },
  randomBtn: { backgroundColor: colors.surfaceElevated, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.borderLight },
  randomBtnText: { fontSize: typography.size.sm, color: colors.primary, fontWeight: typography.weight.medium },
  resultsList: { paddingBottom: spacing.xxl },
  resultItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultName: { flex: 1, fontSize: typography.size.md, color: colors.textPrimary },
  resultMeta: { fontSize: typography.size.sm, color: colors.textDisabled },
  emptyText: { color: colors.textDisabled, textAlign: 'center', fontSize: typography.size.md, marginTop: spacing.xl },
  noteMode: { padding: spacing.md, gap: spacing.md },
  noteLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  noteInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: typography.size.md, color: colors.textPrimary },
  addNoteBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md + 2, alignItems: 'center' },
  addNoteBtnText: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.textInverse },
});
