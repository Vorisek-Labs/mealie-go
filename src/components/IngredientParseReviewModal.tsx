import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/mealieApi';
import { colors, radius, spacing, typography } from '../theme';
import FoodOrUnitPicker from './FoodOrUnitPicker';
import type { ParsedIngredient, RecipeFood, RecipeIngredient, RecipeUnit } from '../types';

// Matches Mealie's own RecipePageParseDialog.vue -- an ingredient only gets
// pulled into the one-by-one review step if its average confidence is below
// this, or the parser found no matching Food/Unit in the server's database.
const CONFIDENCE_THRESHOLD = 0.85;

interface Props {
  visible: boolean;
  ingredientLines: string[];
  onCancel: () => void;
  onComplete: (result: RecipeIngredient[]) => void;
}

function formatQty(qty: number): string {
  if (qty === Math.floor(qty)) return String(Math.floor(qty));
  return parseFloat(qty.toFixed(2)).toString();
}

export function formatIngredientPreview(ing: RecipeIngredient): string {
  if (ing.disableAmount) return ing.display ?? ing.originalText ?? ing.note ?? '';
  return [
    ing.quantity != null ? formatQty(ing.quantity) : '',
    ing.unit?.abbreviation ?? ing.unit?.name ?? '',
    ing.food?.name ?? '',
    ing.note ? `(${ing.note})` : '',
  ].filter(Boolean).join(' ');
}

type Phase = 'loading' | 'review' | 'reorder' | 'error';
type PickerField = 'food' | 'unit';

// Full replication of Mealie's ingredient-parsing review flow: parse via
// the server's "nlp" parser (bundled, no AI provider needed), step through
// only the ingredients that need a human look (low confidence or an
// unmatched Food/Unit), letting the user accept, keep as plain text, pick
// an existing Food/Unit, or create a new one on the spot -- then a final
// reorder-and-confirm pass over everything before saving. Reordering uses
// up/down buttons rather than drag gestures (no new native dependency),
// same end result as Mealie's drag-to-reorder step.
export default function IngredientParseReviewModal({ visible, ingredientLines, onCancel, onComplete }: Props) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [parsed, setParsed] = useState<ParsedIngredient[]>([]);
  const [reviewQueue, setReviewQueue] = useState<number[]>([]);
  const [reviewPos, setReviewPos] = useState(0);
  const [resolved, setResolved] = useState<RecipeIngredient[]>([]);
  const [picker, setPicker] = useState<{ field: PickerField; initialQuery: string } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPhase('loading');
    setReviewPos(0);
    api.parseIngredients(ingredientLines)
      .then(result => {
        const needsReview = result
          .map((p, i) => ({ p, i }))
          .filter(({ p }) =>
            (p.confidence.average ?? 0) < CONFIDENCE_THRESHOLD
            || !p.ingredient.food?.id
            || !p.ingredient.unit?.id
          )
          .map(({ i }) => i);
        setParsed(result);
        setResolved(result.map(p => p.ingredient));
        setReviewQueue(needsReview);
        setPhase(needsReview.length > 0 ? 'review' : 'reorder');
      })
      .catch(e => {
        setErrorMsg(e instanceof Error ? e.message : t('ingredientReview.genericParseError'));
        setPhase('error');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const currentIdx: number | undefined = reviewQueue[reviewPos];
  const currentParsed = currentIdx != null ? parsed[currentIdx] : null;
  const currentIngredient = currentIdx != null ? resolved[currentIdx] : null;

  const updateCurrentField = (field: PickerField, value: RecipeFood | RecipeUnit) => {
    if (currentIdx == null) return;
    setResolved(prev => prev.map((ing, i) => i === currentIdx ? { ...ing, [field]: value } : ing));
  };

  const updateCurrentNote = (value: string) => {
    if (currentIdx == null) return;
    setResolved(prev => prev.map((ing, i) => i === currentIdx ? { ...ing, note: value } : ing));
  };

  const advanceReview = (accept: boolean) => {
    if (currentIdx == null) return;
    if (!accept) {
      const original = parsed[currentIdx]?.input ?? '';
      setResolved(prev => prev.map((ing, i) => i === currentIdx
        ? { note: original, originalText: original, disableAmount: true }
        : ing
      ));
    } else {
      setResolved(prev => prev.map((ing, i) => i === currentIdx ? { ...ing, disableAmount: false } : ing));
    }
    const nextPos = reviewPos + 1;
    if (nextPos >= reviewQueue.length) {
      setPhase('reorder');
    } else {
      setReviewPos(nextPos);
    }
  };

  const handlePickerSelect = (item: RecipeFood | RecipeUnit, wasCreated: boolean) => {
    if (!picker || currentIdx == null || !currentParsed) return;
    const field = picker.field;
    const originalGuess = field === 'food' ? currentParsed.ingredient.food?.name : currentParsed.ingredient.unit?.name;
    const hadNoMatch = field === 'food' ? !currentParsed.ingredient.food?.id : !currentParsed.ingredient.unit?.id;

    updateCurrentField(field, item);
    setPicker(null);

    // Best-effort: the parser's guessed word had no match at all, and the
    // user picked an EXISTING item under a different name -- remember that
    // guessed word as an alias for next time, same learning Mealie's own
    // dialog offers via a separate step, just triggered automatically here.
    if (!wasCreated && hadNoMatch && item.id && originalGuess && originalGuess.toLowerCase() !== item.name.toLowerCase()) {
      const alreadyHasAlias = item.aliases?.some(a => a.name.toLowerCase() === originalGuess.toLowerCase());
      if (!alreadyHasAlias) {
        const updated = { ...item, aliases: [...(item.aliases ?? []), { name: originalGuess }] };
        (field === 'food' ? api.updateFood(item.id, updated) : api.updateUnit(item.id, updated)).catch(() => {});
      }
    }
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    setResolved(prev => {
      const next = [...prev];
      const swapWith = index + direction;
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });
  };

  const removeRow = (index: number) => {
    setResolved(prev => prev.filter((_, i) => i !== index));
  };

  const renderFieldRow = (label: string, field: PickerField, value?: RecipeFood | RecipeUnit) => {
    const matched = !!value?.id;
    const guessedName = value?.name;
    return (
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.fieldValue}>
          {matched ? (
            <Text style={styles.matchedText}>{t('ingredientReview.matchedText', { name: guessedName })}</Text>
          ) : guessedName ? (
            <Text style={styles.unmatchedText}>{t('ingredientReview.unmatchedText', { name: guessedName })}</Text>
          ) : (
            <Text style={styles.noneText}>{t('ingredientReview.noneDetected')}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.fieldActionBtn}
          onPress={() => setPicker({ field, initialQuery: guessedName ?? '' })}
        >
          <Text style={styles.fieldActionText}>
            {matched ? t('ingredientReview.changeButton') : guessedName ? t('ingredientReview.resolveButton') : t('ingredientReview.addButton')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.cancel}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('ingredientReview.title')}</Text>
          <View style={{ width: 60 }} />
        </View>

        {phase === 'loading' && (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>{t('ingredientReview.parsingText')}</Text>
          </View>
        )}

        {phase === 'error' && (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity onPress={onCancel}>
              <Text style={styles.retryText}>{t('ingredientReview.close')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'review' && currentParsed && currentIngredient && (
          <View style={styles.reviewContainer}>
            <Text style={styles.progressText}>
              {t('ingredientReview.progressText', { current: reviewPos + 1, total: reviewQueue.length })}
            </Text>
            <View style={styles.reviewCard}>
              <Text style={styles.originalLabel}>{t('ingredientReview.originalLabel')}</Text>
              <Text style={styles.originalText}>{currentParsed.input}</Text>

              <Text style={styles.confidenceText}>
                {t('ingredientReview.confidenceText', { percent: Math.round((currentParsed.confidence.average ?? 0) * 100) })}
              </Text>

              <View style={styles.divider} />

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{t('ingredientReview.quantityLabel')}</Text>
                <Text style={styles.fieldValueText}>{currentIngredient.quantity ?? '—'}</Text>
              </View>
              {renderFieldRow(t('ingredientReview.unitLabel'), 'unit', currentIngredient.unit)}
              {renderFieldRow(t('ingredientReview.foodLabel'), 'food', currentIngredient.food)}
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{t('ingredientReview.noteLabel')}</Text>
                <TextInput
                  style={styles.noteInput}
                  value={currentIngredient.note ?? ''}
                  onChangeText={updateCurrentNote}
                  placeholder={t('ingredientReview.notePlaceholder')}
                  placeholderTextColor={colors.textDisabled}
                />
              </View>
            </View>

            <View style={styles.reviewActions}>
              <TouchableOpacity style={styles.keepTextBtn} onPress={() => advanceReview(false)}>
                <Text style={styles.keepTextBtnText}>{t('ingredientReview.keepAsText')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => advanceReview(true)}>
                <Text style={styles.acceptBtnText}>{t('ingredientReview.acceptContinue')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {phase === 'reorder' && (
          <>
            <Text style={styles.reorderHint}>{t('ingredientReview.reorderHint')}</Text>
            <ScrollView contentContainerStyle={styles.reorderList}>
              {resolved.map((ing, i) => (
                <View key={i} style={styles.reorderRow}>
                  <View style={styles.reorderMoveBtns}>
                    <TouchableOpacity onPress={() => moveRow(i, -1)} disabled={i === 0} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Text style={[styles.moveBtnText, i === 0 && styles.moveBtnDisabled]}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveRow(i, 1)} disabled={i === resolved.length - 1} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Text style={[styles.moveBtnText, i === resolved.length - 1 && styles.moveBtnDisabled]}>▼</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.reorderText} numberOfLines={2}>{formatIngredientPreview(ing)}</Text>
                  <TouchableOpacity onPress={() => removeRow(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.saveBtn} onPress={() => onComplete(resolved)}>
              <Text style={styles.saveBtnText}>{t('ingredientReview.saveButton', { count: resolved.length })}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {picker && (
        <FoodOrUnitPicker
          visible
          title={picker.field === 'food' ? t('ingredientReview.pickFoodTitle') : t('ingredientReview.pickUnitTitle')}
          initialQuery={picker.initialQuery}
          search={async (q: string) => {
            const data = picker.field === 'food' ? await api.getFoods(q) : await api.getUnits(q);
            return data.items;
          }}
          create={(name: string) => picker.field === 'food' ? api.createFood({ name }) : api.createUnit({ name })}
          onSelect={handlePickerSelect}
          onClose={() => setPicker(null)}
        />
      )}
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  loadingText: { color: colors.textSecondary, fontSize: typography.size.md },
  errorText: { color: colors.error, fontSize: typography.size.md, textAlign: 'center' },
  retryText: { color: colors.primary, fontSize: typography.size.md, fontWeight: typography.weight.medium },
  reviewContainer: { flex: 1, padding: spacing.md, gap: spacing.md },
  progressText: {
    fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.textDisabled,
    textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center',
  },
  reviewCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: spacing.sm,
  },
  originalLabel: { fontSize: typography.size.xs, color: colors.textDisabled, textTransform: 'uppercase', letterSpacing: 0.8 },
  originalText: { fontSize: typography.size.lg, color: colors.textPrimary, fontWeight: typography.weight.semibold },
  confidenceText: { fontSize: typography.size.sm, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  fieldLabel: { width: 70, fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  fieldValue: { flex: 1 },
  fieldValueText: { flex: 1, fontSize: typography.size.md, color: colors.textPrimary },
  noteInput: {
    flex: 1, fontSize: typography.size.md, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
  },
  matchedText: { fontSize: typography.size.md, color: colors.success, fontWeight: typography.weight.medium },
  unmatchedText: { fontSize: typography.size.md, color: colors.warning, fontWeight: typography.weight.medium },
  noneText: { fontSize: typography.size.md, color: colors.textDisabled },
  fieldActionBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
  },
  fieldActionText: { fontSize: typography.size.xs, color: colors.primary, fontWeight: typography.weight.semibold },
  reviewActions: { flexDirection: 'row', gap: spacing.sm },
  keepTextBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  keepTextBtnText: { color: colors.textSecondary, fontWeight: typography.weight.medium, fontSize: typography.size.md },
  acceptBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  acceptBtnText: { color: colors.textInverse, fontWeight: typography.weight.semibold, fontSize: typography.size.md },
  reorderHint: {
    fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center',
    paddingHorizontal: spacing.md, paddingTop: spacing.md,
  },
  reorderList: { padding: spacing.md, gap: spacing.sm },
  reorderRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.sm,
  },
  reorderMoveBtns: { gap: 2 },
  moveBtnText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  moveBtnDisabled: { color: colors.textDisabled },
  reorderText: { flex: 1, fontSize: typography.size.md, color: colors.textPrimary },
  removeText: { fontSize: 16, color: colors.textDisabled },
  saveBtn: {
    margin: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.md + 2, alignItems: 'center',
  },
  saveBtnText: { color: colors.textInverse, fontWeight: typography.weight.semibold, fontSize: typography.size.lg },
});
