import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import {
  api, login, saveServerUrl, saveToken, saveAccount, removeAccount, getSavedAccounts,
  saveProxyHeaders, getSavedProxyHeadersForServer, saveProxyHeadersForServer, removeSavedProxyHeadersForServer,
} from '../../lib/mealieApi';
import type { SavedAccount, ProxyHeader } from '../../lib/mealieApi';
import { colors, radius, spacing, typography } from '../../theme';

export default function ConnectScreen() {
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
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    getSavedAccounts().then(setSavedAccounts);
  }, []);

  const usernameOptions = savedAccounts
    .filter(a => a.serverUrl === serverUrl.trim().replace(/\/$/, ''))
    .map(a => a.username);

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
      Alert.alert('Missing fields', 'Please fill in all three fields.');
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('Invalid URL', 'Server URL must start with http:// or https://');
      return;
    }

    const activeProxyHeaders = proxyHeaders.filter(h => h.name.trim());

    setLoading(true);
    try {
      const token = await login(url, user, pass, activeProxyHeaders);
      await Promise.all([saveServerUrl(url), saveToken(token), saveProxyHeaders(activeProxyHeaders)]);
      const profile = await api.getSelf();
      if (remember) {
        await saveAccount({ serverUrl: url, username: user, password: pass });
      } else {
        // Someone may have saved this exact account from an earlier login —
        // turning "remember" off now should actually forget it, not just
        // skip re-saving it.
        await removeAccount(url, user);
      }
      if (rememberProxyHeaders && activeProxyHeaders.length > 0) {
        await saveProxyHeadersForServer(url, activeProxyHeaders);
      } else {
        await removeSavedProxyHeadersForServer(url);
      }
      await signIn(url, token, profile);
    } catch (e) {
      Alert.alert('Connection failed', e instanceof Error ? e.message : 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
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
          <Text style={styles.title}>Mealie Go</Text>
          <Text style={styles.subtitle}>Connect to your Mealie server</Text>
        </View>

        <View style={styles.form}>
          {/* Server URL */}
          <View style={styles.field}>
            <Text style={styles.label}>Server URL</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="http://192.168.1.x:9925"
                placeholderTextColor={colors.textDisabled}
                value={serverUrl}
                onChangeText={v => { setServerUrl(v); setShowServerDrop(false); }}
                onFocus={() => setShowServerDrop(uniqueServers.length > 0)}
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

          {/* Username */}
          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputRow}>
              <TextInput
                ref={usernameRef}
                style={styles.input}
                placeholder="your username"
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

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              ref={passwordRef}
              style={styles.inputFull}
              placeholder="your password"
              placeholderTextColor={colors.textDisabled}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={handleConnect}
            />
          </View>

          <TouchableOpacity
            style={styles.proxyToggleRow}
            onPress={toggleProxySection}
            activeOpacity={0.7}
          >
            <Text style={styles.proxyToggleText}>
              {showProxySection ? '▾' : '▸'} Using a proxy header?
            </Text>
          </TouchableOpacity>

          {showProxySection && (
            <View style={styles.proxySection}>
              <Text style={styles.proxyHint}>
                For servers behind Cloudflare Access, Authelia, or an API-key reverse proxy —
                these headers are sent with every request, including sign-in.
              </Text>
              {proxyHeaders.map((h, i) => (
                <View key={i} style={styles.proxyRow}>
                  <TextInput
                    style={[styles.proxyInput, styles.proxyNameInput]}
                    placeholder="Header name"
                    placeholderTextColor={colors.textDisabled}
                    value={h.name}
                    onChangeText={v => updateProxyHeader(i, 'name', v)}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TextInput
                    style={[styles.proxyInput, styles.proxyValueInput]}
                    placeholder="Header value"
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
                <Text style={styles.proxyAddText}>+ Add header</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRememberProxyHeaders(r => !r)}
                activeOpacity={0.7}
              >
                <Text style={styles.rememberLabel}>Remember these headers</Text>
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
            style={styles.rememberRow}
            onPress={() => setRemember(r => !r)}
            activeOpacity={0.7}
          >
            <Text style={styles.rememberLabel}>Remember this account</Text>
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
              : <Text style={styles.buttonText}>Connect</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          {remember
            ? "Your username and password are encrypted and saved on this device so you don't have to re-enter them."
            : "This account won't be saved — you'll need to re-enter your credentials next time."}
        </Text>
      </ScrollView>
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
