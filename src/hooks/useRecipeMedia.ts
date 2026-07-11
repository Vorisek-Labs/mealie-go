import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../lib/mealieApi';
import type { RecipeAsset } from '../types';

// Shared by RecipeDetailScreen and RecipeEditScreen so photo/attachment
// upload works identically in both places -- previously this only existed
// on the detail screen, so a recipe just created manually had no way to
// get a photo without leaving the editor first.
export function useRecipeMedia(
  slug: string,
  onImageUpdated: (image: string) => void,
  onAssetAdded: (asset: RecipeAsset) => void,
) {
  const [imageUploading, setImageUploading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [imgError, setImgError] = useState(false);

  const pickImage = async (source: 'camera' | 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', `Allow access to your ${source === 'camera' ? 'camera' : 'photos'} to update this image.`);
      return;
    }

    const result = source === 'camera'
      // mediaTypes must be explicit -- without it, the camera launches in its
      // default photo+video-capable mode, which needs RECORD_AUDIO (deliberately
      // stripped from this app's manifest as unused), and the camera activity
      // dies immediately instead of opening.
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;

    setImageUploading(true);
    try {
      const { image } = await api.updateRecipeImage(slug, result.assets[0].uri);
      onImageUpdated(image);
      setImgError(false);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not update the recipe photo');
    } finally {
      setImageUploading(false);
    }
  };

  const handlePickImage = () => {
    Alert.alert('Recipe Photo', "Update this recipe's photo", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take Photo', onPress: () => pickImage('camera') },
      { text: 'Choose from Library', onPress: () => pickImage('library') },
    ]);
  };

  const handleAddAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;

    const picked = result.assets[0];
    const baseName = picked.name.replace(/\.[^./\\]+$/, '') || 'attachment';

    setAttachmentUploading(true);
    try {
      const asset = await api.uploadRecipeAsset(slug, picked.uri, baseName);
      onAssetAdded(asset);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not add attachment');
    } finally {
      setAttachmentUploading(false);
    }
  };

  return {
    imageUploading, attachmentUploading, imgError, setImgError,
    handlePickImage, handleAddAttachment,
  };
}
