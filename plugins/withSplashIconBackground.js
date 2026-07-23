const { withAndroidStyles } = require('@expo/config-plugins');

// Fixed 2026-07-22: a brief white flash/corners appears during app launch
// instead of the app's dark background. Two rounds of fixes targeting the
// splash ICON's own background attribute didn't resolve it (see below for
// why those were still worth keeping), which points at a second, separate
// cause: neither `AppTheme` nor `Theme.App.SplashScreen` ever set
// `android:windowBackground` explicitly. `AppTheme` extends
// `Theme.EdgeToEdge` -> `Theme.AppCompat.DayNight.NoActionBar`, whose
// DEFAULT window background follows the DEVICE's system light/dark
// setting -- independent of this app's own `userInterfaceStyle: "dark"`,
// which doesn't force AppCompat's DayNight resolution. On a device with a
// light system theme, that default is white, and Android briefly shows the
// raw window background during Activity/window creation before any View
// content (including the splash icon) paints over it -- exactly matching
// "brief white corners, gone in under a second." Forcing
// `android:windowBackground` explicitly on both themes removes the
// dependency on that system-level default entirely.
//
// Kept from the earlier (necessary but insufficient) fix: the splash
// icon's OWN background is a genuinely separate mechanism from
// `windowBackground` above, split across two OS-version-dependent
// attributes:
//   - `android:windowSplashScreenIconBackgroundColor` -- the real native
//     Android framework attribute (API 31+), used by actual Android 12+
//     devices via the OS's own android.window.SplashScreen.
//   - `windowSplashScreenIconBackgroundColor` (no `android:` prefix) -- a
//     separate custom attr defined by the androidx.core.splashscreen
//     COMPAT library (confirmed directly in its attrs.xml + the oval
//     `icon_background.xml` drawable that reads it), used only on its
//     pre-API-31 fallback rendering path.
// Both default to white/system-default when unset, and expo-splash-screen's
// config plugin schema (plugin/build/types.d.ts) exposes neither.
//
// IMPORTANT ordering gotcha: multiple plugins registering the same mod type
// (withAndroidStyles here) compose in REVERSE of their app.json array
// order -- the LAST-registered withAndroidStyles action actually runs
// FIRST. Confirmed by instrumenting both plugins: this one, though listed
// after "expo-splash-screen" in app.json, ran BEFORE it and only saw a
// partial/intermediate style block, which expo-splash-screen's own plugin
// then fully rebuilt from scratch afterward (a filter-and-replace, not a
// merge), discarding this plugin's addition. Fix: this plugin must be
// listed BEFORE "expo-splash-screen" in app.json's plugins array so it
// actually executes AFTER it and sees the final style block. If this
// stops working again after touching plugin order, check that first.
module.exports = function withSplashIconBackground(config) {
  return withAndroidStyles(config, config => {
    const { style = [] } = config.modResults.resources;

    const splashTheme = style.find(s => s.$.name === 'Theme.App.SplashScreen');
    if (splashTheme) {
      splashTheme.item = splashTheme.item ?? [];
      const iconBgNames = ['android:windowSplashScreenIconBackgroundColor', 'windowSplashScreenIconBackgroundColor'];
      for (const name of [...iconBgNames, 'android:windowBackground']) {
        if (!splashTheme.item.some(i => i.$.name === name)) {
          splashTheme.item.push({ $: { name }, _: '@color/splashscreen_background' });
        }
      }
    }

    const appTheme = style.find(s => s.$.name === 'AppTheme');
    if (appTheme) {
      appTheme.item = appTheme.item ?? [];
      if (!appTheme.item.some(i => i.$.name === 'android:windowBackground')) {
        appTheme.item.push({ $: { name: 'android:windowBackground' }, _: '@color/splashscreen_background' });
      }
    }

    return config;
  });
};
