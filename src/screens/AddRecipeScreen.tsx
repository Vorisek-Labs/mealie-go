import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/mealieApi';
import { colors, radius, spacing, typography } from '../theme';
import type { RecipesStackParams } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RecipesStackParams, 'AddRecipe'>;
};

type Mode = 'url' | 'manual' | 'image';

export default function AddRecipeScreen({ navigation }: Props) {
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [parseAfterImport, setParseAfterImport] = useState(true);
  const [images, setImages] = useState<string[]>([]);

  const handleImportUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) { Alert.alert('Enter a URL'); return; }
    setLoading(true);
    try {
      const slug = await api.createRecipeFromUrl(trimmed);
      // Matches Mealie's own web app: a freshly imported recipe opens
      // straight into the editor for review, not the read-only detail view.
      navigation.replace('RecipeEdit', { slug, name: 'Imported Recipe', autoParse: parseAfterImport });
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

  const addImageFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow access to your camera to photograph a recipe.');
      return;
    }
    // mediaTypes must be explicit -- see useRecipeMedia.ts for why (camera
    // otherwise launches in video-capable mode, which needs the RECORD_AUDIO
    // permission this app deliberately doesn't have, and dies immediately).
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    setImages(prev => [...prev, result.assets[0].uri]);
  };

  const addImagesFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow access to your photos to pick a recipe image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsMultipleSelection: true });
    if (result.canceled || !result.assets?.length) return;
    setImages(prev => [...prev, ...result.assets.map(a => a.uri)]);
  };

  const removeImage = (uri: string) => setImages(prev => prev.filter(u => u !== uri));

  const handleCreateFromImages = async () => {
    if (images.length === 0) { Alert.alert('Add at least one photo'); return; }
    setLoading(true);
    try {
      const slug = await api.createRecipeFromImages(images);
      navigation.replace('RecipeEdit', { slug, name: 'Imported Recipe', autoParse: parseAfterImport });
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (/not enabled/i.test(message) || /openai/i.test(message)) {
        Alert.alert(
          'AI image parsing not available',
          "Your Mealie server doesn't have an AI provider configured, so it can't read recipes from photos. Ask whoever administers your server to set one up in Group Settings, or add this recipe manually or from a URL instead."
        );
      } else {
        Alert.alert('Import failed', message || 'Could not create a recipe from these photos.');
      }
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
            style={[styles.modeButton, mode === 'image' && styles.modeButtonActive]}
            onPress={() => setMode('image')}
          >
            <Text style={[styles.modeButtonText, mode === 'image' && styles.modeButtonTextActive]}>
              From Photo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'manual' && styles.modeButtonActive]}
            onPress={() => setMode('manual')}
          >
            <Text style={[styles.modeButtonText, mode === 'manual' && styles.modeButtonTextActive]}>
              Manually
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'url' && (
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
            <ParseToggle value={parseAfterImport} onChange={setParseAfterImport} />
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
        )}

        {mode === 'image' && (
          <View style={styles.form}>
            <Text style={styles.hint}>
              Photograph or pick photos of a recipe (a cookbook page, a handwritten card, several
              pages of one recipe) and Mealie will read it into a new recipe. This needs an AI
              provider configured on your Mealie server — if yours doesn't have one, use Import
              URL or Manually instead.
            </Text>

            {images.length > 0 && (
              <View style={styles.thumbRow}>
                {images.map(uri => (
                  <View key={uri} style={styles.thumbWrap}>
                    <Image source={{ uri }} style={styles.thumb} />
                    <TouchableOpacity style={styles.thumbRemove} onPress={() => removeImage(uri)}>
                      <Text style={styles.thumbRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.imageBtnRow}>
              <TouchableOpacity style={styles.imageBtn} onPress={addImageFromCamera}>
                <Text style={styles.imageBtnText}>📷 Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageBtn} onPress={addImagesFromLibrary}>
                <Text style={styles.imageBtnText}>🖼 Choose Photos</Text>
              </TouchableOpacity>
            </View>

            <ParseToggle value={parseAfterImport} onChange={setParseAfterImport} />

            <TouchableOpacity
              style={[styles.button, (loading || images.length === 0) && styles.buttonDisabled]}
              onPress={handleCreateFromImages}
              disabled={loading || images.length === 0}
            >
              {loading
                ? <ActivityIndicator color={colors.textInverse} />
                : <Text style={styles.buttonText}>Create Recipe</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {mode === 'manual' && (
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

function ParseToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity style={styles.parseRow} onPress={() => onChange(!value)} activeOpacity={0.7}>
      <Text style={styles.parseLabel}>Parse ingredients after import</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.textPrimary}
      />
    </TouchableOpacity>
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
  parseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  parseLabel: {
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumbWrap: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: typography.weight.bold,
  },
  imageBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  imageBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  imageBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
  },
});
