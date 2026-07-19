import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import { OIDC_LOGIN_PATH } from '../lib/mealieApi';
import type { ProxyHeader } from '../lib/mealieApi';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  serverUrl: string;
  proxyHeaders: ProxyHeader[];
  providerName: string;
  onSuccess: (token: string) => void;
  onCancel: () => void;
}

// Detection strategy (v1.4.0, replacing the earlier document.cookie read
// that failed in the field): instead of trying to READ the auth cookie --
// which breaks whenever it's httpOnly, renamed, partitioned, or stored
// differently across Mealie versions (the backend stopped setting its own
// cookie in Nov 2025's #6601, so cookie mechanics genuinely differ between
// versions users run) -- ask the server. Mealie's get_current_user accepts
// the auth cookie in lieu of an Authorization header on every version
// checked (v2-era and current), so an in-page fetch of /api/auth/refresh
// with credentials attached succeeds exactly when the WebView holds a
// valid session, whatever form that session's cookie takes, and the JSON
// response hands us a fresh access_token that injected JS can always read.
//
// Both scripts are origin-guarded: they no-op on the identity provider's
// own pages mid-redirect, and only probe once the WebView is back on the
// Mealie origin.
function buildProbe(serverUrl: string, expectedOrigin: string, kind: 'poll' | 'manual'): string {
  return `
(function() {
  var notFound = function() {
    if ('${kind}' === 'manual') {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'not-found' }));
    }
  };
  if (window.location.origin !== ${JSON.stringify(expectedOrigin)}) { notFound(); return; }
  fetch(${JSON.stringify(serverUrl)} + '/api/auth/refresh', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (data && data.access_token) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token: data.access_token, via: '${kind}' }));
      } else {
        notFound();
      }
    })
    .catch(notFound);
})();
true;
`;
}

function buildPollScript(serverUrl: string, expectedOrigin: string): string {
  return `
(function() {
  if (window.__mealieOidcProbe) return;
  if (window.location.origin !== ${JSON.stringify(expectedOrigin)}) return;
  window.__mealieOidcProbe = true;
  var attempts = 0;
  var interval = setInterval(function() {
    attempts++;
    if (attempts > 90) { clearInterval(interval); return; }
    fetch(${JSON.stringify(serverUrl)} + '/api/auth/refresh', {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (data && data.access_token) {
          clearInterval(interval);
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token: data.access_token, via: 'poll' }));
        }
      })
      .catch(function() {});
  }, 2000);
})();
true;
`;
}

export default function OidcLoginModal({ serverUrl, proxyHeaders, providerName, onSuccess, onCancel }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const doneRef = useRef(false);
  const webViewRef = useRef<WebView>(null);

  // serverUrl may include a subpath (Mealie's SUB_PATH installs), so the
  // fetch above uses the full serverUrl as its base while the origin guard
  // compares only scheme+host+port, which is all location.origin carries.
  const expectedOrigin = useMemo(() => {
    try {
      return new URL(serverUrl).origin;
    } catch {
      return serverUrl;
    }
  }, [serverUrl]);

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
        Alert.alert(t('oidc.notSignedInTitle'), t('oidc.notSignedInMsg'));
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

  // Redundant with the poll script's own interval -- cheap insurance in
  // case that interval never got installed on a given page load for any
  // reason (e.g. a full-page reload racing the injection). Runs per load.
  const handleLoadEnd = () => {
    if (!doneRef.current) webViewRef.current?.injectJavaScript(buildProbe(serverUrl, expectedOrigin, 'poll'));
  };

  const handleManualCheck = () => {
    webViewRef.current?.injectJavaScript(buildProbe(serverUrl, expectedOrigin, 'manual'));
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.cancel}>{t('oidc.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{t('oidc.title', { provider: providerName })}</Text>
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
            injectedJavaScript={buildPollScript(serverUrl, expectedOrigin)}
            sharedCookiesEnabled
            startInLoadingState
          />
          {loading && (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          )}
        </View>
        {/* Manual fallback -- if the automatic detection above misses for
            any reason, this forces an immediate server-side session check
            instead of leaving the user stuck after they've signed in. */}
        <TouchableOpacity style={styles.manualCheckButton} onPress={handleManualCheck}>
          <Text style={styles.manualCheckText}>{t('oidc.manualContinue')}</Text>
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
