import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
  api, login, saveServerUrl, saveToken, saveAccount, removeAccount, getSavedAccounts,
  saveProxyHeaders, getSavedProxyHeadersForServer, saveProxyHeadersForServer, removeSavedProxyHeadersForServer,
  getAppInfo, isOldMealieVersion,
} from '../../lib/mealieApi';
import type { SavedAccount, ProxyHeader, AppInfo } from '../../lib/mealieApi';
import OidcLoginModal from '../../components/OidcLoginModal';
import { colors, radius, spacing, typography } from '../../theme';

export default function ConnectScreen() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showServerDrop, setShowServerDrop] = useState(false);
  const [showUserDrop, setShowUserDrop] = useState(false);
  const [showProxySection, setShowProxySection] = useState(false);
  const [proxyHeaders, setProxyHeaders] = useState<ProxyHeader[]>([]);
  const [rememberProxyHeaders, setRememberProxyHeaders] = useState(true);
  // What the entered server actually supports -- null means unknown/unreachable,
  // which fails open to the password fields (today's default behavior) rather
  // than hiding them on a network hiccup or an older server without this route.
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [showOidcModal, setShowOidcModal] = useState(false);
  const [showApiTokenSection, setShowApiTokenSection] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    getSavedAccounts().then(setSavedAccounts);
  }, []);

  const usernameOptions = savedAccounts
    .filter(a => a.serverUrl === serverUrl.trim().replace(/\/$/, ''))
    .map(a => a.username);

  // Tells us whether to show password fields, an OIDC button, or both --
  // fails soft to null (password fields shown) on an empty/invalid URL, an
  // unreachable server, or an older Mealie version without this route, so
  // this never blocks the login path that already worked before it existed.
  const checkAppInfo = async (url: string) => {
    const trimmed = url.trim().replace(/\/$/, '');
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setAppInfo(null);
      return;
    }
    setAppInfo(await getAppInfo(trimmed, proxyHeaders.filter(h => h.name.trim())));
  };

  const selectServer = (url: string) => {
    setServerUrl(url);
    setShowServerDrop(false);
    const matches = savedAccounts.filter(a => a.serverUrl === url);
    if (matches.length === 1) {
      setUsername(matches[0].username);
      setPassword(matches[0].password);
    } else {
      setUsername('');
      setPassword('');
      setTimeout(() => usernameRef.current?.focus(), 100);
    }
    getSavedProxyHeadersForServer(url).then(saved => {
      if (saved.length > 0) {
        setProxyHeaders(saved);
        setRememberProxyHeaders(true);
        setShowProxySection(true);
      }
    });
    checkAppInfo(url);
  };

  const addProxyHeader = () => setProxyHeaders(hs => [...hs, { name: '', value: '' }]);

  const updateProxyHeader = (index: number, field: keyof ProxyHeader, value: string) =>
    setProxyHeaders(hs => hs.map((h, i) => (i === index ? { ...h, [field]: value } : h)));

  const removeProxyHeader = (index: number) =>
    setProxyHeaders(hs => hs.filter((_, i) => i !== index));

  const toggleProxySection = () => {
    setShowProxySection(s => {
      const next = !s;
      if (next && proxyHeaders.length === 0) setProxyHeaders([{ name: '', value: '' }]);
      return next;
    });
  };

  const selectUsername = (user: string) => {
    setUsername(user);
    setShowUserDrop(false);
    const match = savedAccounts.find(
      a => a.serverUrl === serverUrl.trim().replace(/\/$/, '') && a.username === user
    );
    if (match) {
      setPassword(match.password);
      setTimeout(() => passwordRef.current?.focus(), 100);
    }
  };

  const handleConnect = async () => {
    const url = serverUrl.trim().replace(/\/$/, '');
    const user = username.trim();
    const pass = password;

    if (!url || !user || !pass) {
      Alert.alert(t('connect.missingFieldsTitle'), t('connect.missingFieldsMsg'));
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert(t('connect.invalidUrlTitle'), t('connect.invalidUrlMsg'));
      return;
    }

    const activeProxyHeaders = proxyHeaders.filter(h => h.name.trim());

    setLoading(true);
    try {
      // The resolved serverUrl may differ from what was entered — e.g. the
      // server force-redirects to the other scheme (see login()'s comment).
      const { token, serverUrl: resolvedUrl } = await login(url, user, pass, activeProxyHeaders);
      await Promise.all([saveServerUrl(resolvedUrl), saveToken(token), saveProxyHeaders(activeProxyHeaders)]);
      const profile = await api.getSelf();
      if (remember) {
        await saveAccount({ serverUrl: resolvedUrl, username: user, password: pass });
      } else {
        // Someone may have saved this exact account from an earlier login —
        // turning "remember" off now should actually forget it, not just
        // skip re-saving it.
        await removeAccount(resolvedUrl, user);
      }
      if (rememberProxyHeaders && activeProxyHeaders.length > 0) {
        await saveProxyHeadersForServer(resolvedUrl, activeProxyHeaders);
      } else {
        await removeSavedProxyHeadersForServer(resolvedUrl);
      }
      await signIn(resolvedUrl, token, profile);
    } catch (e) {
      Alert.alert(t('connect.connectionFailedTitle'), e instanceof Error ? e.message : t('connect.genericConnectError'));
    } finally {
      setLoading(false);
    }
  };

  // Mirrors the tail of handleConnect -- no password/remember-account step
  // since there's no password here, but proxy headers and the server URL
  // still need to be persisted the same way. Shared by the OIDC WebView
  // flow and the pasted-API-token flow: both end the same way, with a
  // bearer token that api.getSelf() validates.
  const completeTokenSignIn = async (token: string) => {
    setShowOidcModal(false);
    const url = serverUrl.trim().replace(/\/$/, '');
    const activeProxyHeaders = proxyHeaders.filter(h => h.name.trim());

    setLoading(true);
    try {
      await Promise.all([saveServerUrl(url), saveToken(token), saveProxyHeaders(activeProxyHeaders)]);
      const profile = await api.getSelf();
      if (rememberProxyHeaders && activeProxyHeaders.length > 0) {
        await saveProxyHeadersForServer(url, activeProxyHeaders);
      } else {
        await removeSavedProxyHeadersForServer(url);
      }
      await signIn(url, token, profile);
    } catch (e) {
      Alert.alert(t('connect.connectionFailedTitle'), e instanceof Error ? e.message : t('connect.genericSignInError'));
    } finally {
      setLoading(false);
    }
  };

  const handleApiTokenSignIn = () => {
    const url = serverUrl.trim().replace(/\/$/, '');
    const tok = apiToken.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert(t('connect.invalidUrlTitle'), t('connect.invalidUrlMsg'));
      return;
    }
    if (!tok) return;
    completeTokenSignIn(tok);
  };

  const uniqueServers = [...new Set(savedAccounts.map(a => a.serverUrl))];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>🥘</Text>
          <Text style={styles.title}>{t('connect.title')}</Text>
          <Text style={styles.subtitle}>{t('connect.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          {/* Server URL */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('connect.serverUrlLabel')}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder={t('connect.serverUrlPlaceholder')}
                placeholderTextColor={colors.textDisabled}
                value={serverUrl}
                onChangeText={v => { setServerUrl(v); setShowServerDrop(false); setAppInfo(null); }}
                onFocus={() => setShowServerDrop(uniqueServers.length > 0)}
                onBlur={() => checkAppInfo(serverUrl)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                autoComplete="url"
                returnKeyType="next"
                onSubmitEditing={() => usernameRef.current?.focus()}
              />
              {uniqueServers.length > 0 && (
                <TouchableOpacity
                  style={styles.dropArrow}
                  onPress={() => setShowServerDrop(s => !s)}
                >
                  <Text style={styles.dropArrowText}>{showServerDrop ? '▲' : '▼'}</Text>
                </TouchableOpacity>
              )}
            </View>
            {showServerDrop && uniqueServers.length > 0 && (
              <View style={styles.dropdown}>
                {uniqueServers.map(url => (
                  <TouchableOpacity
                    key={url}
                    style={styles.dropItem}
                    onPress={() => selectServer(url)}
                  >
                    <Text style={styles.dropItemText} numberOfLines={1}>{url}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {appInfo && isOldMealieVersion(appInfo.version) && (
            <Text style={styles.oldVersionWarning}>
              {t('connect.oldVersionWarning', { version: appInfo.version })}
            </Text>
          )}

          {/* Username / Password -- hidden only once we've confirmed the
              server disallows password login; unknown/unreachable fails
              open to showing them, same as before this check existed. */}
          {appInfo?.allowPasswordLogin !== false && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>{t('connect.usernameLabel')}</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    ref={usernameRef}
                    style={styles.input}
                    placeholder={t('connect.usernamePlaceholder')}
                    placeholderTextColor={colors.textDisabled}
                    value={username}
                    onChangeText={v => { setUsername(v); setShowUserDrop(false); }}
                    onFocus={() => setShowUserDrop(usernameOptions.length > 0)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                  {usernameOptions.length > 0 && (
                    <TouchableOpacity
                      style={styles.dropArrow}
                      onPress={() => setShowUserDrop(s => !s)}
                    >
                      <Text style={styles.dropArrowText}>{showUserDrop ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {showUserDrop && usernameOptions.length > 0 && (
                  <View style={styles.dropdown}>
                    {usernameOptions.map(user => (
                      <TouchableOpacity
                        key={user}
                        style={styles.dropItem}
                        onPress={() => selectUsername(user)}
                      >
                        <Text style={styles.dropItemText}>{user}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t('connect.passwordLabel')}</Text>
                <TextInput
                  ref={passwordRef}
                  style={styles.inputFull}
                  placeholder={t('connect.passwordPlaceholder')}
                  placeholderTextColor={colors.textDisabled}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  returnKeyType="go"
                  onSubmitEditing={handleConnect}
                />
              </View>
            </>
          )}

          {appInfo?.enableOidc && (
            <TouchableOpacity
              style={[styles.oidcButton, loading && styles.buttonDisabled]}
              onPress={() => setShowOidcModal(true)}
              disabled={loading}
            >
              <Text style={styles.oidcButtonText}>{t('connect.oidcButton', { provider: appInfo.oidcProviderName || 'SSO' })}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.proxyToggleRow}
            onPress={toggleProxySection}
            activeOpacity={0.7}
          >
            <Text style={styles.proxyToggleText}>
              {showProxySection ? '▾' : '▸'} {t('connect.proxyToggle')}
            </Text>
          </TouchableOpacity>

          {showProxySection && (
            <View style={styles.proxySection}>
              <Text style={styles.proxyHint}>
                {t('connect.proxyHint')}
              </Text>
              {proxyHeaders.map((h, i) => (
                <View key={i} style={styles.proxyRow}>
                  <TextInput
                    style={[styles.proxyInput, styles.proxyNameInput]}
                    placeholder={t('connect.proxyHeaderNamePlaceholder')}
                    placeholderTextColor={colors.textDisabled}
                    value={h.name}
                    onChangeText={v => updateProxyHeader(i, 'name', v)}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TextInput
                    style={[styles.proxyInput, styles.proxyValueInput]}
                    placeholder={t('connect.proxyHeaderValuePlaceholder')}
                    placeholderTextColor={colors.textDisabled}
                    value={h.value}
                    onChangeText={v => updateProxyHeader(i, 'value', v)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                  />
                  <TouchableOpacity style={styles.proxyRemove} onPress={() => removeProxyHeader(i)}>
                    <Text style={styles.proxyRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.proxyAddButton} onPress={addProxyHeader}>
                <Text style={styles.proxyAddText}>{t('connect.addHeader')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRememberProxyHeaders(r => !r)}
                activeOpacity={0.7}
              >
                <Text style={styles.rememberLabel}>{t('connect.rememberHeaders')}</Text>
                <Switch
                  value={rememberProxyHeaders}
                  onValueChange={setRememberProxyHeaders}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.proxyToggleRow}
            onPress={() => setShowApiTokenSection(s => !s)}
            activeOpacity={0.7}
          >
            <Text style={styles.proxyToggleText}>
              {showApiTokenSection ? '▾' : '▸'} {t('connect.apiTokenToggle')}
            </Text>
          </TouchableOpacity>

          {showApiTokenSection && (
            <View style={styles.proxySection}>
              <Text style={styles.proxyHint}>{t('connect.apiTokenHint')}</Text>
              <TextInput
                style={styles.inputFull}
                placeholder={t('connect.apiTokenPlaceholder')}
                placeholderTextColor={colors.textDisabled}
                value={apiToken}
                onChangeText={setApiToken}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
              />
              <TouchableOpacity
                style={[styles.oidcButton, loading && styles.buttonDisabled]}
                onPress={handleApiTokenSignIn}
                disabled={loading || !apiToken.trim()}
              >
                <Text style={styles.oidcButtonText}>{t('connect.apiTokenButton')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {appInfo?.allowPasswordLogin !== false && (
            <>
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRemember(r => !r)}
                activeOpacity={0.7}
              >
                <Text style={styles.rememberLabel}>{t('connect.rememberAccount')}</Text>
                <Switch
                  value={remember}
                  onValueChange={setRemember}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.textPrimary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleConnect}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={colors.textInverse} />
                  : <Text style={styles.buttonText}>{t('connect.connectButton')}</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </View>

        {appInfo?.allowPasswordLogin !== false ? (
          <Text style={styles.hint}>
            {remember ? t('connect.rememberedHint') : t('connect.notRememberedHint')}
          </Text>
        ) : appInfo?.enableOidc ? (
          <Text style={styles.hint}>{t('connect.oidcRequiredHint')}</Text>
        ) : null}
      </ScrollView>

      {showOidcModal && (
        <OidcLoginModal
          serverUrl={serverUrl.trim().replace(/\/$/, '')}
          proxyHeaders={proxyHeaders.filter(h => h.name.trim())}
          providerName={appInfo?.oidcProviderName || 'SSO'}
          onSuccess={completeTokenSignIn}
          onCancel={() => setShowOidcModal(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    fontSize: 64,
  },
  title: {
    fontSize: typography.size.display,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.size.lg,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  inputFull: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  dropArrow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  dropArrowText: {
    fontSize: 11,
    color: colors.textDisabled,
  },
  dropdown: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  dropItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropItemText: {
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  oldVersionWarning: {
    fontSize: typography.size.sm,
    color: colors.warning,
    lineHeight: typography.size.sm * 1.5,
  },
  proxyToggleRow: {
    paddingVertical: spacing.xs,
  },
  proxyToggleText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
  proxySection: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  proxyHint: {
    fontSize: typography.size.xs,
    color: colors.textDisabled,
    lineHeight: typography.size.xs * 1.5,
  },
  proxyRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  proxyInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: typography.size.sm,
    color: colors.textPrimary,
  },
  proxyNameInput: {
    flex: 1,
  },
  proxyValueInput: {
    flex: 1.3,
  },
  proxyRemove: {
    padding: spacing.xs,
  },
  proxyRemoveText: {
    fontSize: typography.size.md,
    color: colors.textDisabled,
  },
  proxyAddButton: {
    alignSelf: 'flex-start',
  },
  proxyAddText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  rememberLabel: {
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  oidcButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  oidcButtonText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textInverse,
  },
  hint: {
    fontSize: typography.size.sm,
    color: colors.textDisabled,
    textAlign: 'center',
    lineHeight: typography.size.sm * 1.6,
  },
});
