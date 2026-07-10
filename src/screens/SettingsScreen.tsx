import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getUnitSystemPreference, setUnitSystemPreference } from '../lib/unitConversion';
import type { UnitSystemPreference } from '../lib/unitConversion';
import { navigateToGuide } from '../navigation/navigateToGuide';
import { colors, radius, spacing, typography } from '../theme';

export default function SettingsScreen() {
  const { user, serverUrl, logout } = useAuth();
  const navigation = useNavigation();
  const [unitSystem, setUnitSystem] = useState<UnitSystemPreference>('original');

  useEffect(() => { getUnitSystemPreference().then(setUnitSystem); }, []);

  const chooseUnitSystem = async (pref: UnitSystemPreference) => {
    setUnitSystem(pref);
    await setUnitSystemPreference(pref);
  };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Disconnect from this Mealie server?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <Row label="Username" value={user?.username ?? '—'} />
          {user?.fullName ? <Row label="Name" value={user.fullName} /> : null}
          {user?.email ? <Row label="Email" value={user.email} /> : null}
          {user?.admin ? <Row label="Role" value="Admin" /> : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Server</Text>
        <View style={styles.card}>
          <Row label="URL" value={serverUrl || '—'} mono />
          {user?.group ? <Row label="Group" value={user.group} /> : null}
          {user?.household ? <Row label="Household" value={user.household} /> : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.card}>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Ingredient Units</Text>
            <View style={styles.segmented}>
              <TouchableOpacity
                style={[styles.segment, unitSystem === 'original' && styles.segmentActive]}
                onPress={() => chooseUnitSystem('original')}
              >
                <Text style={[styles.segmentText, unitSystem === 'original' && styles.segmentTextActive]}>
                  As Written
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, unitSystem === 'metric' && styles.segmentActive]}
                onPress={() => chooseUnitSystem('metric')}
              >
                <Text style={[styles.segmentText, unitSystem === 'metric' && styles.segmentTextActive]}>
                  Metric
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Help</Text>
        <TouchableOpacity style={styles.card} onPress={() => navigateToGuide(navigation)}>
          <View style={styles.guideRow}>
            <Text style={styles.guideText}>How to Use Mealie Go</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>App</Text>
        <View style={styles.card}>
          <Row label="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
        <Text style={styles.signOutText}>Sign Out</Text>
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
