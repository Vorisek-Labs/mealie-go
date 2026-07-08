import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing, typography } from '../theme';

export default function SettingsScreen() {
  const { user, serverUrl, logout } = useAuth();

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
  signOutButton: {
    marginHorizontal: spacing.md, borderWidth: 1, borderColor: colors.error,
    borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center',
  },
  signOutText: { color: colors.error, fontSize: typography.size.md, fontWeight: typography.weight.medium },
});
