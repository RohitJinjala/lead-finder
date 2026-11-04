import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { supabase } from '../../src/lib/supabase';

interface SecretMeta {
  name: string;
  kind: string;
  module: string | null;
  masked_preview: string;
  status: 'not_set' | 'valid' | 'invalid' | 'rate_limited';
  last_tested_at?: string;
  last_used_at?: string;
}

export default function SecretsScreen() {
  const { colors } = useTheme();
  const [secrets, setSecrets] = useState<SecretMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [undoToast, setUndoToast] = useState<string | null>(null);

  // New Secret Modal / Form State
  const [secretName, setSecretName] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const secretKind = 'api_key';
  const [secretModule, setSecretModule] = useState<'web' | 'maps' | 'both'>('web');
  const [showAddForm, setShowAddForm] = useState(false);

  // Telegram Specific
  const [telegramChatId, setTelegramChatId] = useState('');
  const [detectedChats, setDetectedChats] = useState<Array<{ id: string; title?: string; username?: string }>>([]);
  const [alertThreshold, setAlertThreshold] = useState('75');
  const [quietHoursStart, setQuietHoursStart] = useState('23:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');

  useEffect(() => {
    fetchSecrets();
    fetchUserSettings();
  }, []);

  async function fetchSecrets() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('secret_meta')
        .select('*')
        .order('name');
      if (error) throw error;
      setSecrets(data ?? []);
    } catch {
      // Offline or mock
    } finally {
      setLoading(false);
    }
  }

  async function fetchUserSettings() {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .maybeSingle();
      if (data) {
        if (data.alert_threshold) setAlertThreshold(String(data.alert_threshold));
        if (data.quiet_hours) {
          setQuietHoursStart(data.quiet_hours.start ?? '23:00');
          setQuietHoursEnd(data.quiet_hours.end ?? '08:00');
        }
      }
    } catch {
      // Ignore
    }
  }

  function showToast(msg: string) {
    setUndoToast(msg);
    setTimeout(() => {
      setUndoToast(null);
    }, 4000);
  }

  async function executeSaveSecret(name: string) {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('save-secret', {
        body: {
          name,
          value: secretValue.trim(),
          kind: secretKind,
          module: secretModule === 'both' ? null : secretModule,
        },
      });

      if (error) throw error;

      setShowAddForm(false);
      setSecretName('');
      setSecretValue('');
      await fetchSecrets();
      showToast(`Saved secret ${name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save secret';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  function handleSaveSecret() {
    if (!secretName.trim() || !secretValue.trim()) {
      Alert.alert('Error', 'Please provide both a secret name and a key value.');
      return;
    }

    const name = secretName.trim().toUpperCase();
    const existing = secrets.some((s) => s.name === name);

    if (existing) {
      Alert.alert(
        'Replace Secret',
        `Replace existing secret ${name}? The existing key value will be overwritten.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            onPress: () => void executeSaveSecret(name),
          },
        ]
      );
      return;
    }

    void executeSaveSecret(name);
  }

  function handleDelete(secret: SecretMeta) {
    Alert.alert(
      'Delete Secret',
      `Delete secret ${secret.name}? Any model or integration relying on it will stop working.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase.functions.invoke('delete-secret', {
                body: { name: secret.name },
              });
              if (error) throw error;
              await fetchSecrets();
              showToast(`Deleted ${secret.name}`);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to delete secret';
              Alert.alert('Error', msg);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  async function handleTestSecret(secret: SecretMeta) {
    setLoading(true);
    try {
      const isTg = secret.name.includes('TELEGRAM');
      const { data, error } = await supabase.functions.invoke('test-secret', {
        body: {
          name: secret.name,
          test_type: isTg ? 'telegram' : 'ai_model',
        },
      });

      if (error) throw error;
      Alert.alert('Test Result', `Status: ${data?.status}\n${data?.message ?? ''}`);
      await fetchSecrets();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test request failed';
      Alert.alert('Test Error', msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleDetectTelegramChat() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-telegram-chat');
      if (error) throw error;

      const chats = data?.chats ?? [];
      setDetectedChats(chats);
      if (chats.length === 0) {
        Alert.alert('No Chats Detected', 'Please send a message to your Telegram bot first, then tap Detect Chat again.');
      } else if (chats.length === 1) {
        setTelegramChatId(chats[0].id);
        Alert.alert('Chat Detected', `Selected chat: ${chats[0].title || chats[0].username || chats[0].id}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to detect chats';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTelegramTest() {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-telegram-test', {
        body: { chat_id: telegramChatId.trim() },
      });
      if (error) throw error;
      Alert.alert('Success', 'Test notification sent to Telegram.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send test alert';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  const styles = getStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Secrets & Integrations</Text>
      <Text style={styles.screenSubtitle}>
        Write-only dynamic secrets. Values are never returned or stored in plain text.
      </Text>

      {/* Undo Toast */}
      {undoToast && (
        <View style={styles.undoToast} accessibilityLiveRegion="polite">
          <Text style={styles.undoToastText}>{undoToast}</Text>
        </View>
      )}

      {/* AI Model Keys Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>AI Model Keys</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddForm(!showAddForm)}
            accessibilityRole="button"
            accessibilityLabel="Add Secret"
          >
            <Text style={styles.addButtonText}>{showAddForm ? 'Cancel' : '+ Add Key'}</Text>
          </TouchableOpacity>
        </View>

        {showAddForm && (
          <View style={styles.formCard}>
            <Text style={styles.formLabel}>Secret Name (e.g. GROQ_API_KEY)</Text>
            <TextInput
              style={styles.input}
              value={secretName}
              onChangeText={setSecretName}
              placeholder="PROVIDER_API_KEY"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              accessibilityLabel="Secret Name"
            />

            <Text style={styles.formLabel}>Secret Value (Write-Only)</Text>
            <TextInput
              style={styles.input}
              value={secretValue}
              onChangeText={setSecretValue}
              placeholder="Paste secret key here"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              accessibilityLabel="Secret Value"
            />

            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.chip, secretModule === 'web' && styles.chipActive]}
                onPress={() => setSecretModule('web')}
              >
                <Text style={styles.chipText}>Web Module</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, secretModule === 'maps' && styles.chipActive]}
                onPress={() => setSecretModule('maps')}
              >
                <Text style={styles.chipText}>Maps Module</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, secretModule === 'both' && styles.chipActive]}
                onPress={() => setSecretModule('both')}
              >
                <Text style={styles.chipText}>Both Modules</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveSecret}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Save Secret"
            >
              <Text style={styles.saveButtonText}>Save Secret</Text>
            </TouchableOpacity>
          </View>
        )}

        {secrets.filter((s) => s.kind !== 'telegram').length === 0 ? (
          <Text style={styles.emptyText}>No AI keys configured yet.</Text>
        ) : (
          secrets
            .filter((s) => s.kind !== 'telegram')
            .map((s) => (
              <View key={s.name} style={styles.secretItem}>
                <View style={styles.secretInfo}>
                  <Text style={styles.secretName}>{s.name}</Text>
                  <Text style={styles.secretMasked}>{s.masked_preview}</Text>
                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        s.status === 'valid' && styles.statusValid,
                        s.status === 'invalid' && styles.statusInvalid,
                        s.status === 'rate_limited' && styles.statusRateLimited,
                      ]}
                    >
                      <Text style={styles.statusText}>{s.status}</Text>
                    </View>
                    {s.last_tested_at && (
                      <Text style={styles.testedText}>
                        Tested: {new Date(s.last_tested_at).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleTestSecret(s)}
                    accessibilityRole="button"
                    accessibilityLabel={`Test secret ${s.name}`}
                  >
                    <Text style={styles.actionButtonText}>Test</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDelete(s)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete secret ${s.name}`}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
        )}
      </View>

      {/* Telegram Alerts Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Telegram Alerts</Text>
        <Text style={styles.hintText}>
          Instant alerts for leads with score at or above your threshold.
        </Text>

        <Text style={styles.formLabel}>Telegram Chat ID</Text>
        <TextInput
          style={styles.input}
          value={telegramChatId}
          onChangeText={setTelegramChatId}
          placeholder="e.g. 123456789"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="numeric"
          accessibilityLabel="Telegram Chat ID"
        />

        <View style={styles.row}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleDetectTelegramChat}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Detect Telegram Chat"
          >
            <Text style={styles.secondaryButtonText}>Detect Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleSendTelegramTest}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Send Telegram Test"
          >
            <Text style={styles.secondaryButtonText}>Send Test</Text>
          </TouchableOpacity>
        </View>

        {detectedChats.length > 1 && (
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>Multiple chats found, select one:</Text>
            {detectedChats.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.chatChoice}
                onPress={() => setTelegramChatId(c.id)}
              >
                <Text style={styles.chatChoiceText}>
                  {c.title || c.username || c.id} ({c.id})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.rowInputs}>
          <View style={styles.halfCol}>
            <Text style={styles.formLabel}>Alert Score Threshold</Text>
            <TextInput
              style={styles.input}
              value={alertThreshold}
              onChangeText={setAlertThreshold}
              placeholder="75"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              accessibilityLabel="Alert Score Threshold"
            />
          </View>

          <View style={styles.halfCol}>
            <Text style={styles.formLabel}>Quiet Hours (Start - End)</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.quarterInput]}
                value={quietHoursStart}
                onChangeText={setQuietHoursStart}
                placeholder="23:00"
                placeholderTextColor={colors.mutedForeground}
              />
              <TextInput
                style={[styles.input, styles.quarterInput]}
                value={quietHoursEnd}
                onChangeText={setQuietHoursEnd}
                placeholder="08:00"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Push Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Push Notifications</Text>
        <Text style={styles.hintText}>
          Native Expo Push placeholder (feature-flagged extra for future EAS build).
        </Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Feature Flag: Optional / Disabled</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 16 },
    screenTitle: { fontSize: 24, fontWeight: '700', color: colors.text },
    screenSubtitle: { fontSize: 13, color: colors.mutedForeground, marginBottom: 8 },
    undoToast: {
      backgroundColor: colors.primary,
      padding: 10,
      borderRadius: 8,
      alignItems: 'center',
    },
    undoToastText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
    section: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      gap: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    addButton: {
      backgroundColor: colors.muted,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    addButtonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    formCard: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      gap: 8,
    },
    formLabel: { fontSize: 12, fontWeight: '600', color: colors.text },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: colors.text,
      fontSize: 14,
    },
    row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    rowInputs: { flexDirection: 'row', gap: 12 },
    halfCol: { flex: 1, gap: 6 },
    quarterInput: { flex: 1 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: colors.muted,
    },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 12, color: colors.text },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: 10,
      borderRadius: 6,
      alignItems: 'center',
      marginTop: 4,
    },
    saveButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
    emptyText: { color: colors.mutedForeground, fontSize: 13, fontStyle: 'italic' },
    secretItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    secretInfo: { gap: 4, flex: 1 },
    secretName: { fontSize: 14, fontWeight: '700', color: colors.text },
    secretMasked: { fontSize: 13, fontFamily: 'monospace', color: colors.mutedForeground },
    statusRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    statusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: colors.muted,
    },
    statusValid: { backgroundColor: '#dcfce7' },
    statusInvalid: { backgroundColor: '#fee2e2' },
    statusRateLimited: { backgroundColor: '#fef3c7' },
    statusText: { fontSize: 11, fontWeight: '600', color: colors.text },
    testedText: { fontSize: 11, color: colors.mutedForeground },
    actionRow: { flexDirection: 'row', gap: 6 },
    actionButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.muted,
    },
    actionButtonText: { fontSize: 12, color: colors.text, fontWeight: '500' },
    deleteButton: { backgroundColor: '#fee2e2' },
    deleteButtonText: { fontSize: 12, color: '#b91c1c', fontWeight: '500' },
    hintText: { fontSize: 12, color: colors.mutedForeground },
    secondaryButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingVertical: 8,
      alignItems: 'center',
    },
    secondaryButtonText: { fontSize: 13, fontWeight: '500', color: colors.text },
    pickerBox: {
      backgroundColor: colors.muted,
      borderRadius: 6,
      padding: 8,
      gap: 6,
    },
    pickerTitle: { fontSize: 12, fontWeight: '600', color: colors.text },
    chatChoice: { paddingVertical: 4 },
    chatChoiceText: { fontSize: 12, color: colors.primary, textDecorationLine: 'underline' },
  });
}
