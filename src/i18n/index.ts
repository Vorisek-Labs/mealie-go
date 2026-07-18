import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import es from './locales/es.json';
import zh from './locales/zh.json';
import hi from './locales/hi.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';
import bn from './locales/bn.json';
import ru from './locales/ru.json';
import pt from './locales/pt.json';
import ur from './locales/ur.json';

const LANGUAGE_KEY = 'mealie_go.language';

// The 10 most-spoken languages worldwide (by total speakers) -- this is a
// pilot covering ConnectScreen + SettingsScreen only; the rest of the app's
// ~15 screens still need their strings extracted. AI-translated, not yet
// reviewed by native speakers -- treat as a starting point, not final copy.
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'ru', label: 'Русский' },
  { code: 'pt', label: 'Português' },
  { code: 'ur', label: 'اردو' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

// Arabic and Urdu -- if the current language is one of these, the app
// should be laid out right-to-left. Actually flipping layout direction
// (I18nManager.forceRTL) requires an app restart to take effect in React
// Native, so this is exported for callers to act on, not applied silently.
export const RTL_LANGUAGES: LanguageCode[] = ['ar', 'ur'];

const resources = {
  en: { translation: en },
  zh: { translation: zh },
  hi: { translation: hi },
  es: { translation: es },
  fr: { translation: fr },
  ar: { translation: ar },
  bn: { translation: bn },
  ru: { translation: ru },
  pt: { translation: pt },
  ur: { translation: ur },
};

function isSupported(code: string): code is LanguageCode {
  return SUPPORTED_LANGUAGES.some(l => l.code === code);
}

function deviceLanguage(): LanguageCode {
  const tag = Localization.getLocales()[0]?.languageCode ?? 'en';
  return isSupported(tag) ? tag : 'en';
}

export async function getSavedLanguage(): Promise<LanguageCode | null> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    return saved && isSupported(saved) ? saved : null;
  } catch {
    return null;
  }
}

// Call once at app startup, before rendering anything that uses useTranslation.
// Must never reject -- App.tsx gates the entire app's first render on this
// resolving, so a rejection here would mean a permanent blank screen for
// every user, not just a missing translation.
export async function initI18n(): Promise<LanguageCode> {
  let initial: LanguageCode = 'en';
  try {
    initial = (await getSavedLanguage()) ?? deviceLanguage();
  } catch {
    // deviceLanguage()/Localization failed -- fall back to English rather
    // than blocking startup.
  }
  try {
    await i18n.use(initReactI18next).init({
      resources,
      lng: initial,
      fallbackLng: 'en',
      interpolation: { escapeValue: false }, // React already escapes
    });
  } catch {
    // Even if i18next itself fails to initialize, let the app proceed --
    // useTranslation() falls back to returning raw keys rather than crashing.
  }
  return initial;
}

export async function setLanguage(code: LanguageCode): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, code);
  await i18n.changeLanguage(code);
}

export default i18n;
