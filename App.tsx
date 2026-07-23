import 'react-native-url-polyfill/auto';
import { useEffect, useState } from 'react';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import RootNavigator from './src/navigation/RootNavigator';
import { initI18n } from './src/i18n';

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);

  // Resources are bundled JSON (no network dependency) and the only async
  // step is an AsyncStorage read for a saved language preference, so this
  // resolves near-instantly -- still gated so no screen renders with
  // untranslated keys for a frame before i18n finishes initializing.
  // initI18n() is written to never reject, but this .catch() is a second
  // line of defense: since the entire app's first render is gated on this
  // promise settling, letting it hang or reject unhandled would mean a
  // permanent blank screen for every user, not just a missing translation.
  useEffect(() => {
    initI18n()
      .then(() => setI18nReady(true))
      .catch(() => setI18nReady(true));
  }, []);

  if (!i18nReady) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <FavoritesProvider>
          <SystemBars style={{ statusBar: 'light', navigationBar: 'light' }} />
          <RootNavigator />
        </FavoritesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
