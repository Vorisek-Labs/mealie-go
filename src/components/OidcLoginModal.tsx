import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { OIDC_LOGIN_PATH, OIDC_TOKEN_COOKIE_NAME } from '../lib/mealieApi';
import type { ProxyHeader } from '../lib/mealieApi';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  serverUrl: string;
  proxyHeaders: ProxyHeader[];
  providerName: string;
  onSuccess: (token: string) => void;
  onCancel: () => void;
}

// Reads the token cookie if present and posts it back; posts a
// 'not-found' message otherwise so the caller can tell "nothing there yet"
// apart from "never heard back at all". Some Nuxt useCookie configurations
// JSON-serialize a string value (wrapping it in literal quote characters)
// rather than storing it raw -- stripping any such wrapping quotes here is
// cheap insurance against a malformed Bearer token later.
function checkScript(reportKind: 'poll' | 'manual'): string {
  return `
(function() {
  var match = document.cookie.match(/(?:^|; )${OIDC_TOKEN_COOKIE_NAME.replace('.', '\\\\.')}=([^;]*)/);
  if (match) {
    var value = decodeURIComponent(match[1]);
    if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
      value = value.slice(1, -1);
    }
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token: value, via: '${reportKind}' }));
  } else if ('${reportKind}' === 'manual') {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'not-found' }));
  }
})();
true;
`;
}

// Mealie's own SPA handles the entire OIDC exchange itself once the
// provider redirects back to {serverUrl}/login (see the comment above
// OIDC_LOGIN_PATH in mealieApi.ts) -- this just watches for the resulting
// cookie to appear, rather than reimplementing the exchange. Runs as a
// self-clearing interval (not a one-shot check) since the cookie only
// appears after an async XHR the SPA fires post-load, not at load time
// itself. Re-injected fresh on every page load by react-native-webview,
// which naturally covers the whole multi-domain redirect chain (provider's
// login page, then back to Mealie's own domain). Not fully reliable in
// practice (see the manual fallback button below) -- a real user's report
// (2026-07-18, Authentik) showed the SPA's own login completing while this
// polling never fired, root cause not yet confirmed.
const POLL_SCRIPT = `
(function() {
  if (window.__mealieOidcPolling) return;
  window.__mealieOidcPolling = true;
  var attempts = 0;
  var interval = setInterval(function() {
    attempts++;
    if (attempts > 120) { clearInterval(interval); return; }
    var match = document.cookie.match(/(?:^|; )${OIDC_TOKEN_COOKIE_NAME.replace('.', '\\\\.')}=([^;]*)/);
    if (match) {
      clearInterval(interval);
      var value = decodeURIComponent(match[1]);
      if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
        value = value.slice(1, -1);
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token: value, via: 'poll' }));
    }
  }, 500);
})();
true;
`;

export default function OidcLoginModal({ serverUrl, proxyHeaders, providerName, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(true);
  const doneRef = useRef(false);
  const webViewRef = useRef<WebView>(null);

  const headersRecord: Record<string, string> = {};
  proxyHeaders.forEach(h => { if (h.name.trim()) headersRecord[h.name.trim()] = h.value; });

  const handleMessage = (event: WebViewMessageEvent) => {
    if (doneRef.current) return;
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === 'token' && data.token) {
        doneRef.current = true;
        onSuccess(data.token);
      } else if (data?.type === 'not-found') {
        Alert.alert(
          'Not signed in yet',
          'Finish signing in above, then tap "I\'ve signed in" again.'
        );
      }
    } catch {
      // Ignore malformed messages -- nothing else posts to this bridge.
    }
  };

  // Mealie's login page redirects to itself with ?direct=1 when its own
  // OIDC exchange fails (see login.vue's oidcAuthenticate catch block) --
  // treat that as a clear failure signal instead of leaving the WebView
  // open forever with no token ever arriving.
  const handleNavStateChange = (nav: WebViewNavigation) => {
    setLoading(nav.loading);
    if (!doneRef.current && /[?&]direct=1(&|$)/.test(nav.url)) {
      doneRef.current = true;
      onCancel();
    }
  };

  // Redundant with POLL_SCRIPT's own interval -- cheap insurance in case
  // that interval never got set up on a given page load for any reason
  // (e.g. a full-page reload racing the injection). Runs on every load.
  const handleLoadEnd = () => {
    if (!doneRef.current) webViewRef.current?.injectJavaScript(checkScript('poll'));
  };

  const handleManualCheck = () => {
    webViewRef.current?.injectJavaScript(checkScript('manual'));
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>Log in with {providerName}</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.webviewWrapper}>
          <WebView
            ref={webViewRef}
            style={styles.webview}
            source={{ uri: `${serverUrl}${OIDC_LOGIN_PATH}`, headers: headersRecord }}
            onMessage={handleMessage}
            onNavigationStateChange={handleNavStateChange}
            onLoadEnd={handleLoadEnd}
            injectedJavaScript={POLL_SCRIPT}
            sharedCookiesEnabled
            startInLoadingState
          />
          {loading && (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          )}
        </View>
        {/* Manual fallback -- if the automatic detection above misses the
            cookie for any reason, this lets the user force a check instead
            of being stuck once they've actually finished signing in. Always
            visible/tappable, independent of the loading overlay above. */}
        <TouchableOpacity style={styles.manualCheckButton} onPress={handleManualCheck}>
          <Text style={styles.manualCheckText}>I've signed in — Continue</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cancel: { fontSize: typography.size.md, color: colors.textSecondary, width: 60 },
  title: { flex: 1, textAlign: 'center', fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.textPrimary },
  webviewWrapper: { flex: 1 },
  webview: { flex: 1 },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background,
  },
  manualCheckButton: {
    margin: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center',
  },
  manualCheckText: {
    color: colors.primary, fontWeight: typography.weight.semibold, fontSize: typography.size.md,
  },
});
