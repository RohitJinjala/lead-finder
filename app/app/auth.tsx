import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useTheme } from '../src/hooks/useTheme';
import { supabase } from '../src/lib/supabase';
import type { User } from '@supabase/supabase-js';

export default function AuthScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        checkOwnerStatus();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        checkOwnerStatus();
      } else {
        setIsOwner(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkOwnerStatus() {
    try {
      const { data, error } = await supabase.rpc('is_owner');
      if (error) throw error;
      setIsOwner(Boolean(data));
    } catch {
      setIsOwner(false);
    }
  }

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setMessage({ text: 'Please enter both email and password.', type: 'error' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setMessage({ text: 'Signed in successfully.', type: 'success' });
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Failed to sign in.';
      setMessage({ text: errMessage, type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleClaimOwner() {
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.rpc('claim_owner');
      if (error) throw error;

      if (data === true) {
        setIsOwner(true);
        setMessage({ text: 'Congratulations! You are now the registered owner.', type: 'success' });
      } else {
        setIsOwner(false);
        setMessage({ text: 'Owner has already been claimed by another account.', type: 'error' });
      }
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Failed to claim owner.';
      setMessage({ text: errMessage, type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setMessage({ text: 'Signed out.', type: 'info' });
    } finally {
      setLoading(false);
    }
  }

  const styles = getStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Security Warning Banner */}
      <View style={styles.warningBanner} accessibilityRole="alert" accessibilityLabel="Security banner">
        <Text style={styles.warningTitle}>⚠️ Security Notice: Public Sign-ups</Text>
        <Text style={styles.warningBody}>
          Disable public sign-ups in your Supabase Dashboard under Authentication &gt; Providers &gt; Email &gt; Enable Sign Ups (toggle OFF) after creating your owner account to keep this personal app private.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Lead Finder Account</Text>
        <Text style={styles.subtitle}>Personal qualification pipeline & lead tracker</Text>

        {user ? (
          <View style={styles.userSection}>
            <Text style={styles.userEmail} accessibilityLabel={`Signed in as ${user.email}`}>
              Signed in as: <Text style={styles.bold}>{user.email}</Text>
            </Text>

            <View style={styles.badgeRow}>
              <Text style={styles.badgeLabel}>Status:</Text>
              <View
                style={[
                  styles.badge,
                  isOwner ? styles.badgeSuccess : styles.badgeMuted,
                ]}
              >
                <Text style={styles.badgeText}>
                  {isOwner === true ? 'Verified Owner' : isOwner === false ? 'Non-Owner' : 'Checking...'}
                </Text>
              </View>
            </View>

            {isOwner === false && (
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.disabledButton]}
                onPress={handleClaimOwner}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Claim ownership of this Lead Finder instance"
              >
                <Text style={styles.primaryButtonText}>Claim Ownership</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleSignOut}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Sign out of account"
            >
              <Text style={styles.secondaryButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="owner@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Email input"
            />

            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••••••"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              accessibilityLabel="Password input"
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleSignIn}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Sign in with email and password"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {message && (
          <View
            style={[
              styles.messageBox,
              message.type === 'error' && styles.errorBox,
              message.type === 'success' && styles.successBox,
            ]}
            accessibilityRole="alert"
          >
            <Text
              style={[
                styles.messageText,
                message.type === 'error' && styles.errorText,
                message.type === 'success' && styles.successText,
              ]}
            >
              {message.text}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
      alignItems: 'center',
    },
    warningBanner: {
      width: '100%',
      maxWidth: 480,
      backgroundColor: '#fef3c7',
      borderColor: '#f59e0b',
      borderWidth: 1,
      borderRadius: 8,
      padding: 14,
      marginBottom: 20,
    },
    warningTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#92400e',
      marginBottom: 4,
    },
    warningBody: {
      fontSize: 12,
      lineHeight: 18,
      color: '#78350f',
    },
    card: {
      width: '100%',
      maxWidth: 480,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 24,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginBottom: 20,
    },
    form: {
      gap: 12,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 14,
      marginBottom: 12,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    disabledButton: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '600',
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 10,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
    },
    userSection: {
      gap: 12,
    },
    userEmail: {
      fontSize: 14,
      color: colors.text,
    },
    bold: {
      fontWeight: '700',
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    badgeLabel: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    badgeSuccess: {
      backgroundColor: '#dcfce7',
    },
    badgeMuted: {
      backgroundColor: colors.muted,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    messageBox: {
      marginTop: 16,
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.muted,
    },
    errorBox: {
      backgroundColor: '#fee2e2',
    },
    successBox: {
      backgroundColor: '#dcfce7',
    },
    messageText: {
      fontSize: 13,
      color: colors.text,
    },
    errorText: {
      color: '#b91c1c',
    },
    successText: {
      color: '#15803d',
    },
  });
}

