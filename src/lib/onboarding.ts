import AsyncStorage from '@react-native-async-storage/async-storage';

// Device-level flag (not per-account) — once the welcome screen has been
// dismissed, it should never show again, even after signing out and into a
// different server.
const HAS_SEEN_WELCOME_KEY = 'mealie_go.has_seen_welcome';

export async function getHasSeenWelcome(): Promise<boolean> {
  return (await AsyncStorage.getItem(HAS_SEEN_WELCOME_KEY)) === 'true';
}

export async function setHasSeenWelcome(): Promise<void> {
  await AsyncStorage.setItem(HAS_SEEN_WELCOME_KEY, 'true');
}
