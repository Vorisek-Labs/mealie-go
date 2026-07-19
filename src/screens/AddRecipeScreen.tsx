import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/mealieApi';
import { colors, radius, spacing, typography } from '../theme';
import type { RecipesStackParams } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RecipesStackParams, 'AddRecipe'>;
};

type Mode = 'url' | 'manual' | 'image';

export default function AddRecipeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [parseAfterImport, setParseAfterImport] = useState(true);
  const [images, setImages] = useState<string[]>([]);

  const handleImportUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) { Alert.alert(t('addRecipe.enterUrlAlert')); return; }
    setLoading(true);
    try {
      const slug = await api.createRecipeFromUrl(trimmed);
      // Matches Mealie's own web app: a freshly imported recipe opens
      // straight into the editor for review, not the read-only detail view.
      navigation.replace('RecipeEdit', { slug, name: t('addRecipe.importedRecipeName'), autoParse: parseAfterImport });
    } catch (e) {
      Alert.alert(t('addRecipe.importFailedTitle'), e instanceof Error ? e.message : t('addRecipe.genericUrlImportError'));
      setLoading(false);
    }
  };

  const handleCreateManual = async () => {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert(t('addRecipe.enterNameAlert')); return; }
    setLoading(true);
    try {
      const slug = await api.createRecipe(trimmed);
      navigation.replace('RecipeEdit', { slug, name: trimmed });
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('addRecipe.genericCreateError'));
    } finally {
      setLoading(false);
    }
  };

  const addImageFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('addRecipe.cameraPermissionTitle'), t('addRecipe.cameraPermissionMsg'));
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
      Alert.alert(t('addRecipe.cameraPermissionTitle'), t('addRecipe.libraryPermissionMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsMultipleSelection: true });
    if (result.canceled || !result.assets?.length) return;
    setImages(prev => [...prev, ...result.assets.map(a => a.uri)]);
  };

  const removeImage = (uri: string) => setImages(prev => prev.filter(u => u !== uri));

  const handleCreateFromImages = async () => {
    if (images.length === 0) { Alert.alert(t('addRecipe.addPhotoAlert')); return; }
    setLoading(true);
    try {
      const slug = await api.createRecipeFromImages(images);
      navigation.replace('RecipeEdit', { slug, name: t('addRecipe.importedRecipeName'), autoParse: parseAfterImport });
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (/not enabled/i.test(message) || /openai/i.test(message)) {
        Alert.alert(t('addRecipe.aiNotAvailableTitle'), t('addRecipe.aiNotAvailableMsg'));
      } else {
        Alert.alert(t('addRecipe.importFailedTitle'), message || t('addRecipe.genericImageImportError'));
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
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('addRecipe.title')}</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'url' && styles.modeButtonActive]}
            onPress={() => setMode('url')}
          >
            <Text style={[styles.modeButtonText, mode === 'url' && styles.modeButtonTextActive]}>
              {t('addRecipe.modeUrl')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'image' && styles.modeButtonActive]}
            onPress={() => setMode('image')}
          >
            <Text style={[styles.modeButtonText, mode === 'image' && styles.modeButtonTextActive]}>
              {t('addRecipe.modeImage')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'manual' && styles.modeButtonActive]}
            onPress={() => setMode('manual')}
          >
            <Text style={[styles.modeButtonText, mode === 'manual' && styles.modeButtonTextActive]}>
              {t('addRecipe.modeManual')}
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'url' && (
          <View style={styles.form}>
            <Text style={styles.hint}>
              {t('addRecipe.urlHint')}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t('addRecipe.urlPlaceholder')}
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
                : <Text style={styles.buttonText}>{t('addRecipe.importButton')}</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {mode === 'image' && (
          <View style={styles.form}>
            <Text style={styles.hint}>
              {t('addRecipe.imageHint')}
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
                <Text style={styles.imageBtnText}>{t('addRecipe.takePhoto')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageBtn} onPress={addImagesFromLibrary}>
                <Text style={styles.imageBtnText}>{t('addRecipe.choosePhotos')}</Text>
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
                : <Text style={styles.buttonText}>{t('addRecipe.createButton')}</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {mode === 'manual' && (
          <View style={styles.form}>
            <Text style={styles.hint}>
              {t('addRecipe.manualHint')}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t('addRecipe.namePlaceholder')}
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
                : <Text style={styles.buttonText}>{t('addRecipe.createButton')}</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ParseToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity style={styles.parseRow} onPress={() => onChange(!value)} activeOpacity={0.7}>
      <Text style={styles.parseLabel}>{t('addRecipe.parseAfterImport')}</Text>
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
