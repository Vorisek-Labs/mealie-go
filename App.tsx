import 'react-native-url-polyfill/auto';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      <FavoritesProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </FavoritesProvider>
    </AuthProvider>
  );
}
