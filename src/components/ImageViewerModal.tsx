import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// The legacy entry point is the supported one for this API in SDK 57 — its
// downloadAsync takes request headers, which the new File API does not expose
// as directly, and Mealie's media endpoints are all Bearer-authenticated.
import * as FileSystem from 'expo-file-system/legacy';
import { promptSaveOrShare } from '../lib/saveFile';
import { colors, radius, spacing, typography } from '../theme';

export interface ViewableImage {
  // Same { uri, headers } shape the rest of the app uses for Mealie media —
  // these endpoints 401 without the Authorization header, which is exactly why
  // handing a bare URL to the browser (what attachments used to do) was unreliable.
  uri: string;
  headers?: Record<string, string>;
  // Filename used when saving. Falls back to something sane if absent.
  fileName?: string;
}

interface Props {
  visible: boolean;
  image: ViewableImage | null;
  onClose: () => void;
}

export default function ImageViewerModal({ visible, image, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  // Tracked as "which URI finished" rather than a boolean reset on open.
  // A boolean reset in onShow deadlocked the spinner for the recipe hero image:
  // it's already in RN's image cache (it's rendered on the screen behind this
  // modal), so it loaded and fired onLoadEnd BEFORE onShow ran, and onShow then
  // re-armed a spinner that nothing would ever clear. Attachments hid the bug
  // because they've never been rendered before, so they always load after
  // onShow. Deriving from the URI has no ordering assumption at all, and resets
  // by itself whenever a different image is opened.
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const [failedUri, setFailedUri] = useState<string | null>(null);

  const failed = !!image && failedUri === image.uri;
  const loading = !!image && !failed && loadedUri !== image.uri;

  const handleSave = async () => {
    if (!image || saving) return;
    setSaving(true);
    try {
      const name = safeFileName(image.fileName);
      const target = `${FileSystem.cacheDirectory}${name}`;
      // Downloads with auth headers into the app's own cache, then hands the
      // local file to the share sheet — that's where "Save to Files"/Downloads
      // lives. Same approach the recipe PDF export already uses.
      const { uri } = await FileSystem.downloadAsync(image.uri, target, { headers: image.headers });
      // Same save-or-share choice as the PDF export: this button reads as a
      // download, so it needs to be able to actually download.
      promptSaveOrShare(uri, name, mimeTypeForName(name));
    } catch (e) {
      Alert.alert(
        t('recipeDetail.imageSaveFailedTitle'),
        e instanceof Error ? e.message : t('recipeDetail.imageSaveFailedMsg'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Tapping the backdrop dismisses. It sits under the toolbar so the
            buttons stay tappable. */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}>
          <View style={styles.imageWrap}>
            {image && !failed && (
              <Image
                source={{ uri: image.uri, headers: image.headers }}
                style={styles.image}
                // contain, not cover: the point of this screen is seeing the
                // WHOLE image, which the cropped hero thumbnail never shows.
                resizeMode="contain"
                onLoadEnd={() => setLoadedUri(image.uri)}
                onError={() => setFailedUri(image.uri)}
              />
            )}
            {loading && !failed && (
              <ActivityIndicator color={colors.primary} size="large" style={styles.spinner} />
            )}
            {failed && <Text style={styles.failedText}>{t('recipeDetail.imageLoadFailed')}</Text>}
          </View>
        </TouchableOpacity>

        {/* Full-screen modal: this toolbar is against the physical top edge
            under edge-to-edge, so it needs the inset applied by hand. */}
        <View style={[styles.toolbar, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity style={styles.button} onPress={onClose} hitSlop={HIT_SLOP}>
            <Text style={styles.buttonText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={handleSave}
            disabled={saving || failed}
            hitSlop={HIT_SLOP}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.buttonText}>⤓</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

// The Storage Access Framework derives the saved file's extension from the mime
// type, so a wrong type here produces a file the gallery won't open.
function mimeTypeForName(name: string): string {
  const ext = (/\.([a-zA-Z0-9]+)$/.exec(name)?.[1] ?? '').toLowerCase();
  const known: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif',
  };
  return known[ext] ?? 'image/jpeg';
}

// Mealie asset names come from user-supplied uploads, and this string becomes a
// real path segment in the cache directory — strip anything that could escape it.
function safeFileName(name?: string): string {
  const cleaned = (name ?? '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
  return cleaned || `image-${Date.now()}.jpg`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  imageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  spinner: { position: 'absolute' },
  failedText: { color: colors.textSecondary, fontSize: typography.size.md, padding: spacing.xl, textAlign: 'center' },
  toolbar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
  },
  button: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontSize: 20, lineHeight: 24 },
});
