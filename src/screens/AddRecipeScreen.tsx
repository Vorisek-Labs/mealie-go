import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../lib/mealieApi';
import { colors, radius, spacing, typography } from '../theme';
import type { RecipesStackParams } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RecipesStackParams, 'AddRecipe'>;
};

type Mode = 'url' | 'manual';

export default function AddRecipeScreen({ navigation }: Props) {
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImportUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) { Alert.alert('Enter a URL'); return; }
    setLoading(true);
    try {
      const slug = await api.createRecipeFromUrl(trimmed);
      navigation.replace('RecipeDetail', { slug, name: 'Imported Recipe' });
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Could not import recipe from URL.');
      setLoading(false);
    }
  };

  const handleCreateManual = async () => {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('Enter a recipe name'); return; }
    setLoading(true);
    try {
      const slug = await api.createRecipe(trimmed);
      navigation.replace('RecipeEdit', { slug, name: trimmed });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create recipe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add Recipe</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'url' && styles.modeButtonActive]}
            onPress={() => setMode('url')}
          >
            <Text style={[styles.modeButtonText, mode === 'url' && styles.modeButtonTextActive]}>
              Import URL
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'manual' && styles.modeButtonActive]}
            onPress={() => setMode('manual')}
          >
            <Text style={[styles.modeButtonText, mode === 'manual' && styles.modeButtonTextActive]}>
              Create Manually
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'url' ? (
          <View style={styles.form}>
            <Text style={styles.hint}>
              Paste a URL from any recipe website and Mealie will automatically import it.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="https://www.example.com/recipe/..."
              placeholderTextColor={colors.textDisabled}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleImportUrl}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.textInverse} />
                : <Text style={styles.buttonText}>Import Recipe</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.hint}>
              Create a blank recipe and fill in the details on your Mealie server or here later.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Recipe name"
              placeholderTextColor={colors.textDisabled}
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleCreateManual}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.textInverse} />
                : <Text style={styles.buttonText}>Create Recipe</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  cancelText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    width: 60,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
  },
  modeButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
  },
  modeButtonTextActive: {
    color: colors.textInverse,
  },
  form: {
    gap: spacing.md,
  },
  hint: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: typography.size.sm * 1.6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textInverse,
  },
});
