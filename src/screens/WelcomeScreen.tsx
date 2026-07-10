import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { setHasSeenWelcome } from '../lib/onboarding';
import { colors, radius, spacing, typography } from '../theme';
import type { RootStackParams } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParams, 'Welcome'>;
};

export default function WelcomeScreen({ navigation }: Props) {
  const [busy, setBusy] = useState(false);

  const handleContinue = async () => {
    setBusy(true);
    await setHasSeenWelcome();
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  const handleViewGuide = async () => {
    setBusy(true);
    await setHasSeenWelcome();
    navigation.reset({ index: 1, routes: [{ name: 'MainTabs' }, { name: 'Guide', params: undefined }] });
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🍽️</Text>
        <Text style={styles.title}>Welcome to Mealie Go</Text>
        <Text style={styles.subtitle}>
          Browse recipes, plan meals, and manage shopping lists — all connected to your own
          Mealie server. Here's a quick look at what you can do.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleViewGuide} disabled={busy}>
          <Text style={styles.primaryBtnText}>View Quick Guide</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleContinue} disabled={busy}>
          <Text style={styles.secondaryBtnText}>Continue to App</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.background,
    justifyContent: 'space-between', padding: spacing.lg, paddingTop: spacing.xxl * 2, paddingBottom: spacing.xl,
  },
  content: { alignItems: 'center', gap: spacing.md },
  icon: { fontSize: 64 },
  title: { fontSize: typography.size.xxl, fontWeight: typography.weight.bold, color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    fontSize: typography.size.md, color: colors.textSecondary, textAlign: 'center',
    lineHeight: typography.size.md * 1.5, paddingHorizontal: spacing.md,
  },
  actions: { gap: spacing.sm },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.md + 2, alignItems: 'center',
  },
  primaryBtnText: { color: colors.textInverse, fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
  secondaryBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: spacing.md + 2, alignItems: 'center',
  },
  secondaryBtnText: { color: colors.textSecondary, fontSize: typography.size.md, fontWeight: typography.weight.medium },
});
