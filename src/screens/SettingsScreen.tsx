import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getUnitSystemPreference, setUnitSystemPreference } from '../lib/unitConversion';
import type { UnitSystemPreference } from '../lib/unitConversion';
import { navigateToGuide } from '../navigation/navigateToGuide';
import { SUPPORTED_LANGUAGES, setLanguage } from '../i18n';
import type { LanguageCode } from '../i18n';
import { colors, radius, spacing, typography } from '../theme';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { user, serverUrl, logout } = useAuth();
  const navigation = useNavigation();
  const [unitSystem, setUnitSystem] = useState<UnitSystemPreference>('original');
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  useEffect(() => { getUnitSystemPreference().then(setUnitSystem); }, []);

  const chooseUnitSystem = async (pref: UnitSystemPreference) => {
    setUnitSystem(pref);
    await setUnitSystemPreference(pref);
  };

  const chooseLanguage = async (code: LanguageCode) => {
    setShowLanguagePicker(false);
    await setLanguage(code);
  };

  const currentLanguageLabel = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language)?.label
    ?? SUPPORTED_LANGUAGES[0].label;

  const handleLogout = () => {
    Alert.alert(t('settings.signOutTitle'), t('settings.signOutConfirm'), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('settings.signOut'), style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>{t('settings.title')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('settings.account')}</Text>
        <View style={styles.card}>
          <Row label={t('settings.username')} value={user?.username ?? '—'} />
          {user?.fullName ? <Row label={t('settings.name')} value={user.fullName} /> : null}
          {user?.email ? <Row label={t('settings.email')} value={user.email} /> : null}
          {user?.admin ? <Row label={t('settings.role')} value={t('settings.admin')} /> : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('settings.server')}</Text>
        <View style={styles.card}>
          <Row label={t('settings.url')} value={serverUrl || '—'} mono />
          {user?.group ? <Row label={t('settings.group')} value={user.group} /> : null}
          {user?.household ? <Row label={t('settings.household')} value={user.household} /> : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('settings.preferences')}</Text>
        <View style={styles.card}>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>{t('settings.ingredientUnits')}</Text>
            <View style={styles.segmented}>
              <TouchableOpacity
                style={[styles.segment, unitSystem === 'original' && styles.segmentActive]}
                onPress={() => chooseUnitSystem('original')}
              >
                <Text style={[styles.segmentText, unitSystem === 'original' && styles.segmentTextActive]}>
                  {t('settings.asWritten')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, unitSystem === 'metric' && styles.segmentActive]}
                onPress={() => chooseUnitSystem('metric')}
              >
                <Text style={[styles.segmentText, unitSystem === 'metric' && styles.segmentTextActive]}>
                  {t('settings.metric')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.prefRow} onPress={() => setShowLanguagePicker(v => !v)}>
            <Text style={styles.prefLabel}>{t('settings.language')}</Text>
            <Text style={styles.languageValue}>{currentLanguageLabel} ›</Text>
          </TouchableOpacity>
          {showLanguagePicker && (
            <View style={styles.languageList}>
              {SUPPORTED_LANGUAGES.map(lang => (
                <TouchableOpacity
                  key={lang.code}
                  style={styles.languageRow}
                  onPress={() => chooseLanguage(lang.code)}
                >
                  <Text style={[styles.languageRowText, lang.code === i18n.language && styles.languageRowTextActive]}>
                    {lang.label}
                  </Text>
                  {lang.code === i18n.language ? <Text style={styles.languageCheck}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('settings.help')}</Text>
        <TouchableOpacity style={styles.card} onPress={() => navigateToGuide(navigation)}>
          <View style={styles.guideRow}>
            <Text style={styles.guideText}>{t('settings.guideLink')}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('settings.app')}</Text>
        <View style={styles.card}>
          <Row label={t('settings.version')} value={Constants.expoConfig?.version ?? '1.0.0'} />
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
        <Text style={styles.signOutText}>{t('settings.signOut')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, mono && rowStyles.mono]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  label: { width: 90, fontSize: typography.size.md, color: colors.textSecondary },
  value: { flex: 1, fontSize: typography.size.md, color: colors.textPrimary, textAlign: 'right' },
  mono: { fontFamily: 'monospace', fontSize: typography.size.sm },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 56, paddingBottom: spacing.xxl, gap: spacing.lg },
  pageTitle: {
    fontSize: typography.size.xxl, fontWeight: typography.weight.bold,
    color: colors.textPrimary, paddingHorizontal: spacing.md,
  },
  section: { gap: spacing.xs, paddingHorizontal: spacing.md },
  sectionLabel: {
    fontSize: typography.size.sm, fontWeight: typography.weight.semibold,
    color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  prefRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
  },
  prefLabel: { fontSize: typography.size.md, color: colors.textSecondary },
  segmented: {
    flexDirection: 'row', backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md, padding: 3, borderWidth: 1, borderColor: colors.border,
  },
  segment: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, color: colors.textSecondary },
  segmentTextActive: { color: colors.textInverse },
  languageValue: { fontSize: typography.size.md, color: colors.textSecondary },
  languageList: { paddingBottom: spacing.sm },
  languageRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.xs,
  },
  languageRowText: { fontSize: typography.size.md, color: colors.textSecondary },
  languageRowTextActive: { color: colors.textPrimary, fontWeight: typography.weight.semibold },
  languageCheck: { color: colors.primary, fontSize: typography.size.md },
  guideRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
  },
  guideText: { fontSize: typography.size.md, color: colors.textPrimary },
  chevron: { fontSize: typography.size.lg, color: colors.textDisabled },
  signOutButton: {
    marginHorizontal: spacing.md, borderWidth: 1, borderColor: colors.error,
    borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center',
  },
  signOutText: { color: colors.error, fontSize: typography.size.md, fontWeight: typography.weight.medium },
});
