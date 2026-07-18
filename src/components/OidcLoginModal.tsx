import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { OIDC_LOGIN_PATH, OIDC_TOKEN_COOKIE_NAME } from '../lib/mealieApi';
import type { ProxyHeader } from '../lib/mealieApi';
import { colors, spacing, typography } from '../theme';

interface Props {
  serverUrl: string;
  proxyHeaders: ProxyHeader[];
  providerName: string;
  onSuccess: (token: string) => void;
  onCancel: () => void;
}

// Mealie's own SPA handles the entire OIDC exchange itself once the
// provider redirects back to {serverUrl}/login (see the comment above
// OIDC_LOGIN_PATH in mealieApi.ts) -- this just watches for the resulting
// cookie to appear, rather than reimplementing the exchange. Runs as a
// self-clearing interval (not a one-shot check) since the cookie only
// appears after an async XHR the SPA fires post-load, not at load time
// itself. Re-injected fresh on every page load by react-native-webview,
// which naturally covers the whole multi-domain redirect chain (provider's
// login page, then back to Mealie's own domain).
const POLL_SCRIPT = `
(function() {
  if (window.__mealieOidcPolling) return;
  window.__mealieOidcPolling = true;
  var attempts = 0;
  var interval = setInterval(function() {
    attempts++;
    var match = document.cookie.match(/(?:^|; )${OIDC_TOKEN_COOKIE_NAME.replace('.', '\\\\.')}=([^;]*)/);
    if (match) {
      clearInterval(interval);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token: decodeURIComponent(match[1]) }));
    } else if (attempts > 60) {
      clearInterval(interval);
    }
  }, 500);
})();
true;
`;

export default function OidcLoginModal({ serverUrl, proxyHeaders, providerName, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(true);
  const doneRef = useRef(false);

  const headersRecord: Record<string, string> = {};
  proxyHeaders.forEach(h => { if (h.name.trim()) headersRecord[h.name.trim()] = h.value; });

  const handleMessage = (event: WebViewMessageEvent) => {
    if (doneRef.current) return;
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === 'token' && data.token) {
        doneRef.current = true;
        onSuccess(data.token);
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
        <WebView
          source={{ uri: `${serverUrl}${OIDC_LOGIN_PATH}`, headers: headersRecord }}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavStateChange}
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
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background,
  },
});
