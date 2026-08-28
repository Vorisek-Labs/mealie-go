import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import i18n from '../i18n';

export type SaveOutcome = 'saved' | 'shared' | 'cancelled';

/**
 * Write a file the app has produced (a PDF export, a downloaded recipe image)
 * somewhere the user can actually find it again.
 *
 * Android uses the Storage Access Framework: the system directory picker, then a
 * real file written into whatever folder was chosen (Downloads, Drive, an SD
 * card). That's a genuine download — the share sheet is not, which is the whole
 * point of this helper. It also needs no storage permission, since the user
 * granting access to a folder IS the permission.
 *
 * iOS has no user-visible filesystem to write into, so the share sheet — whose
 * "Save to Files" action is the platform's equivalent — stays the right answer
 * there. Returns which of the two actually happened so callers can word their
 * confirmation honestly instead of claiming "saved" on a share.
 */
export async function saveFileToDevice(
  localUri: string,
  fileName: string,
  mimeType: string,
): Promise<SaveOutcome> {
  if (Platform.OS !== 'android') {
    await shareFile(localUri, mimeType);
    return 'shared';
  }

  const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  // The user dismissed the folder picker — not an error, just a no.
  if (!permission.granted) return 'cancelled';

  // SAF appends the extension itself, derived from the mime type, so passing
  // "recipe.pdf" here would produce "recipe.pdf.pdf".
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'file';
  const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
    permission.directoryUri, baseName, mimeType,
  );
  const contents = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await FileSystem.writeAsStringAsync(destUri, contents, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return 'saved';
}

export async function shareFile(localUri: string, mimeType: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localUri, { mimeType });
    return;
  }
  Alert.alert(i18n.t('common.saveFailedTitle'), i18n.t('common.sharingUnavailable'));
}

/**
 * Ask whether to save or share, then do it. Android only gets the choice —
 * on iOS "save" and "share" are the same share sheet, so offering both would be
 * two buttons that do the identical thing.
 *
 * Not a React component, so it reads the raw i18n instance directly (the same
 * pattern lib/timeEstimate.ts uses) — and reads it per call, never at module
 * load, so the strings follow the app's current language.
 */
export function promptSaveOrShare(localUri: string, fileName: string, mimeType: string): void {
  const run = async (action: () => Promise<SaveOutcome | void>) => {
    try {
      const outcome = await action();
      if (outcome === 'saved') {
        Alert.alert(i18n.t('common.savedTitle'), i18n.t('common.savedMsg'));
      }
    } catch (e) {
      Alert.alert(
        i18n.t('common.saveFailedTitle'),
        e instanceof Error ? e.message : i18n.t('common.saveFailedMsg'),
      );
    }
  };

  if (Platform.OS !== 'android') {
    run(() => shareFile(localUri, mimeType));
    return;
  }

  Alert.alert(i18n.t('common.saveOrShareTitle'), undefined, [
    { text: i18n.t('common.saveToDevice'), onPress: () => run(() => saveFileToDevice(localUri, fileName, mimeType)) },
    { text: i18n.t('common.share'), onPress: () => run(() => shareFile(localUri, mimeType)) },
    { text: i18n.t('common.cancel'), style: 'cancel' },
  ]);
}
