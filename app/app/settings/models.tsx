import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { supabase } from '../../src/lib/supabase';
import { useRouter, useLocalSearchParams } from 'expo-router';

interface ModelItem {
  id: string;
  module: 'web' | 'maps';
  name: string;
  provider: string;
  base_url: string;
  model_id: string;
  secret_name: string;
  priority: number;
  enabled: boolean;
  daily_limit: number | null;
  reset_tz: string;
  reset_hour: number;
}

interface SecretOption {
  name: string;
  masked_preview: string;
  status: string;
}

const PROVIDER_PRESETS: Record<string, { base_url: string; default_model: string; default_secret: string }> = {
  groq: {
    base_url: 'https://api.groq.com/openai/v1',
    default_model: 'llama-3.3-70b-versatile',
    default_secret: 'GROQ_API_KEY',
  },
  gemini: {
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    default_model: 'gemini-2.5-flash',
    default_secret: 'GEMINI_API_KEY',
  },
  nvidia: {
    base_url: 'https://integrate.api.nvidia.com/v1',
    default_model: 'meta/llama-3.1-70b-instruct',
    default_secret: 'NVIDIA_API_KEY',
  },
  mistral: {
    base_url: 'https://api.mistral.ai/v1',
    default_model: 'mistral-small-latest',
    default_secret: 'MISTRAL_API_KEY',
  },
  openrouter: {
    base_url: 'https://openrouter.ai/api/v1',
    default_model: 'anthropic/claude-3.5-haiku',
    default_secret: 'OPENROUTER_API_KEY',
  },
  custom: {
    base_url: '',
    default_model: '',
    default_secret: 'CUSTOM_API_KEY',
  },
};

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim().length > 0) return msg;
  }
  return fallback;
}

function looksLikeRawApiKey(val: string): boolean {
  const trimmed = val.trim();
  return (
    trimmed.startsWith('sk-') ||
    trimmed.startsWith('gsk_') ||
    trimmed.startsWith('AIza') ||
    trimmed.startsWith('nvapi-') ||
    trimmed.length > 40
  );
}

export default function ModelsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ module?: string }>();
  const initialModule = params.module === 'maps' ? 'maps' : 'web';

  const [selectedModule, setSelectedModule] = useState<'web' | 'maps'>(initialModule);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [savedSecrets, setSavedSecrets] = useState<SecretOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingForm, setTestingForm] = useState(false);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [formTestResult, setFormTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('groq');
  const [baseUrl, setBaseUrl] = useState(PROVIDER_PRESETS['groq']?.base_url ?? '');
  const [modelId, setModelId] = useState(PROVIDER_PRESETS['groq']?.default_model ?? '');
  const [secretName, setSecretName] = useState(PROVIDER_PRESETS['groq']?.default_secret ?? 'GROQ_API_KEY');
  const [apiKey, setApiKey] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');

  useEffect(() => {
    fetchModels();
    fetchSavedSecrets();
  }, [selectedModule]);

  async function fetchModels() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('model_chain')
        .select('*')
        .eq('module', selectedModule)
        .order('priority', { ascending: true });
      if (error) throw error;
      setModels(data ?? []);
    } catch {
      // Mock / offline fallback
    } finally {
      setLoading(false);
    }
  }

  async function fetchSavedSecrets() {
    try {
      const { data, error } = await supabase
        .from('secret_meta')
        .select('name, masked_preview, status')
        .order('name');
      if (!error && data) {
        setSavedSecrets((data as SecretOption[]).filter((s) => !s.name.includes('TELEGRAM')));
      }
    } catch {
      // Ignore if offline or mocked
    }
  }

  function handleProviderSelect(prov: string) {
    setProvider(prov);
    setFormTestResult(null);
    const preset = PROVIDER_PRESETS[prov];
    if (preset) {
      if (prov !== 'custom') {
        setBaseUrl(preset.base_url);
        setModelId(preset.default_model);
      }
      setSecretName(preset.default_secret);
    }
  }

  async function handleTestFormModel() {
    const cleanBaseUrl = baseUrl.trim().replace(/\/+$/, '');
    const cleanModelId = modelId.trim();
    const cleanSecretName = secretName.trim().toUpperCase();
    const cleanApiKey = apiKey.trim();

    if (!cleanBaseUrl || !cleanModelId) {
      Alert.alert('Missing Info', 'Enter Base URL and Model Name first.');
      return;
    }

    if (!cleanApiKey && !cleanSecretName) {
      Alert.alert('Missing API Key', 'Paste an API Key or select a saved Secret Name to test.');
      return;
    }

    setTestingForm(true);
    setFormTestResult(null);
    try {
      if (cleanApiKey) {
        // Direct 1-token OpenAI-compatible test with the pasted API key (not stored in plain text)
        const res = await fetch(`${cleanBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cleanApiKey}`,
          },
          body: JSON.stringify({
            model: cleanModelId,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1,
          }),
        });

        if (res.ok) {
          setFormTestResult({ ok: true, message: `Working! ${cleanModelId} responded (HTTP ${res.status}).` });
        } else if (res.status === 401 || res.status === 403) {
          setFormTestResult({ ok: false, message: `Invalid API Key (HTTP ${res.status}).` });
        } else if (res.status === 429) {
          setFormTestResult({ ok: false, message: 'Rate limited (HTTP 429). Key is valid, quota reached.' });
        } else {
          let detail = '';
          try {
            const errJson = await res.json();
            detail = errJson?.error?.message ? `: ${String(errJson.error.message).slice(0, 120)}` : '';
          } catch {
            // ignore
          }
          setFormTestResult({ ok: false, message: `Failed (HTTP ${res.status})${detail}` });
        }
      } else {
        // Test using already-saved secret via Edge Function
        const { data, error } = await supabase.functions.invoke('test-secret', {
          body: {
            name: cleanSecretName,
            test_type: 'ai_model',
            base_url: cleanBaseUrl,
            model_id: cleanModelId,
          },
        });
        if (error) throw error;
        const ok = data?.status === 'valid';
        setFormTestResult({
          ok,
          message: `${ok ? 'Working!' : 'Failed:'} ${data?.status ?? 'unknown'} — ${data?.message ?? ''}`,
        });
      }
    } catch (err: unknown) {
      setFormTestResult({
        ok: false,
        message: getErrorMessage(err, 'Network or endpoint error while testing model.'),
      });
    } finally {
      setTestingForm(false);
    }
  }

  async function handleAddModel() {
    const cleanName = name.trim();
    const cleanBaseUrl = baseUrl.trim().replace(/\/+$/, '');
    const cleanModelId = modelId.trim();
    const cleanSecretName = secretName.trim().toUpperCase();
    const cleanApiKey = apiKey.trim();

    if (!cleanName || !cleanBaseUrl || !cleanModelId || !cleanSecretName) {
      Alert.alert('Error', 'Please fill in Friendly Name, Base URL, Model Name, and Secret Name.');
      return;
    }

    if (looksLikeRawApiKey(cleanSecretName)) {
      Alert.alert(
        'Check Secret Name',
        'It looks like you pasted your API key into "Secret Name". Put a short name like GROQ_API_KEY in Secret Name, and paste the actual key in the "API Key" box below.'
      );
      return;
    }

    setLoading(true);
    try {
      // If user pasted an API key directly in the form, save it securely first
      if (cleanApiKey) {
        const { error: secretErr } = await supabase.functions.invoke('save-secret', {
          body: {
            name: cleanSecretName,
            value: cleanApiKey,
            kind: 'api_key',
            module: selectedModule,
          },
        });
        if (secretErr) throw secretErr;
      }

      const nextPriority = models.length > 0 ? Math.max(...models.map((m) => m.priority)) + 1 : 1;
      const { error } = await supabase.from('model_chain').insert({
        module: selectedModule,
        name: cleanName,
        provider,
        base_url: cleanBaseUrl,
        model_id: cleanModelId,
        secret_name: cleanSecretName,
        priority: nextPriority,
        enabled: true,
        daily_limit: dailyLimit ? parseInt(dailyLimit, 10) : null,
        reset_tz: 'Asia/Kolkata',
        reset_hour: 0,
      });

      if (error) throw error;
      setShowAddForm(false);
      setName('');
      setApiKey('');
      setDailyLimit('');
      setFormTestResult(null);
      await fetchModels();
      await fetchSavedSecrets();
      Alert.alert('Saved', `${cleanName} added to ${selectedModule} chain.`);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Failed to add model');
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleEnabled(model: ModelItem) {
    try {
      const { error } = await supabase
        .from('model_chain')
        .update({ enabled: !model.enabled })
        .eq('id', model.id);
      if (error) throw error;
      await fetchModels();
    } catch (err: unknown) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to update model status'));
    }
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= models.length) return;

    const currentModel = models[index];
    const targetModel = models[targetIndex];
    if (!currentModel || !targetModel) return;

    const currentPriority = currentModel.priority;
    const targetPriority = targetModel.priority;

    try {
      await supabase.from('model_chain').update({ priority: targetPriority }).eq('id', currentModel.id);
      await supabase.from('model_chain').update({ priority: currentPriority }).eq('id', targetModel.id);
      await fetchModels();
    } catch (err: unknown) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to reorder models'));
    }
  }

  function handleDelete(model: ModelItem) {
    Alert.alert('Delete Model', `Remove ${model.name} from ${selectedModule} model chain?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('model_chain').delete().eq('id', model.id);
            if (error) throw error;
            await fetchModels();
          } catch (err: unknown) {
            Alert.alert('Error', getErrorMessage(err, 'Failed to delete model'));
          }
        },
      },
    ]);
  }

  async function handleTestModel(model: ModelItem) {
    setTestingModelId(model.id);
    try {
      const { data, error } = await supabase.functions.invoke('test-secret', {
        body: {
          name: model.secret_name,
          test_type: 'ai_model',
          base_url: model.base_url.replace(/\/+$/, ''),
          model_id: model.model_id,
        },
      });
      if (error) throw error;
      const isOk = data?.status === 'valid';
      Alert.alert(
        isOk ? 'Model Working ✅' : 'Model Check Failed ❌',
        `Model: ${model.model_id}\nSecret: ${model.secret_name}\nStatus: ${data?.status ?? 'unknown'}\n${data?.message ?? ''}`
      );
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Test failed. Check that the secret exists and Edge Functions are deployed.');
      Alert.alert('Test Failed ❌', msg);
    } finally {
      setTestingModelId(null);
    }
  }

  const styles = getStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.screenTitle}>AI Model Chain</Text>
          <Text style={styles.screenSubtitle}>
            Prioritized chain with automatic fallback and cooldown management.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.dashboardButton}
          onPress={() => router.push('/settings/model-dashboard' as never)}
          accessibilityRole="button"
          accessibilityLabel="Open Model Dashboard"
        >
          <Text style={styles.dashboardButtonText}>📊 Dashboard</Text>
        </TouchableOpacity>
      </View>

      {/* Module Switcher */}
      <View style={styles.moduleBar} accessibilityRole="tablist">
        <TouchableOpacity
          style={[styles.moduleTab, selectedModule === 'web' && styles.moduleTabActive]}
          onPress={() => setSelectedModule('web')}
          accessibilityRole="tab"
          accessibilityLabel="Web Models"
        >
          <Text style={[styles.moduleTabText, selectedModule === 'web' && styles.moduleTabTextActive]}>
            Web Module
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.moduleTab, selectedModule === 'maps' && styles.moduleTabActive]}
          onPress={() => setSelectedModule('maps')}
          accessibilityRole="tab"
          accessibilityLabel="Maps Models"
        >
          <Text style={[styles.moduleTabText, selectedModule === 'maps' && styles.moduleTabTextActive]}>
            Maps Module
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add Model Form */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Configured Models ({models.length})</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddForm(!showAddForm)}
          accessibilityRole="button"
          accessibilityLabel="Add Model to Chain"
        >
          <Text style={styles.addButtonText}>{showAddForm ? 'Cancel' : '+ Add Model'}</Text>
        </TouchableOpacity>
      </View>

      {showAddForm && (
        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Provider Preset</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
            {Object.keys(PROVIDER_PRESETS).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.presetChip, provider === p && styles.presetChipActive]}
                onPress={() => handleProviderSelect(p)}
              >
                <Text style={[styles.presetChipText, provider === p && styles.presetChipTextActive]}>
                  {p.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.formLabel}>Friendly Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Primary Groq Llama"
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel="Model Friendly Name"
          />

          <Text style={styles.formLabel}>Base URL (OpenAI-compatible endpoint)</Text>
          <TextInput
            style={styles.input}
            value={baseUrl}
            onChangeText={(val) => {
              setBaseUrl(val);
              setFormTestResult(null);
            }}
            placeholder="https://api.groq.com/openai/v1"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            accessibilityLabel="Base URL"
          />

          <Text style={styles.formLabel}>Model Name (Exact model string for API)</Text>
          <TextInput
            style={styles.input}
            value={modelId}
            onChangeText={(val) => {
              setModelId(val);
              setFormTestResult(null);
            }}
            placeholder="e.g. llama-3.3-70b-versatile or gemini-2.5-flash"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            accessibilityLabel="Model ID"
          />

          <Text style={styles.formLabel}>Secret Name (Key Label in Vault)</Text>
          {savedSecrets.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
              {savedSecrets.map((s) => (
                <TouchableOpacity
                  key={s.name}
                  style={[styles.presetChip, secretName.toUpperCase() === s.name && styles.presetChipActive]}
                  onPress={() => setSecretName(s.name)}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      secretName.toUpperCase() === s.name && styles.presetChipTextActive,
                    ]}
                  >
                    {s.name} ({s.masked_preview})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <TextInput
            style={styles.input}
            value={secretName}
            onChangeText={setSecretName}
            placeholder="e.g. GROQ_API_KEY"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            accessibilityLabel="Secret Name"
          />

          <Text style={styles.formLabel}>API Key (Paste key to save securely, or leave blank if already saved)</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={(val) => {
              setApiKey(val);
              setFormTestResult(null);
            }}
            placeholder="Paste API key here (write-only)"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoCapitalize="none"
            accessibilityLabel="API Key"
          />

          <Text style={styles.formLabel}>Daily Request Limit (optional)</Text>
          <TextInput
            style={styles.input}
            value={dailyLimit}
            onChangeText={setDailyLimit}
            placeholder="e.g. 500"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            accessibilityLabel="Daily Request Limit"
          />

          {formTestResult && (
            <View style={[styles.testBanner, formTestResult.ok ? styles.testBannerOk : styles.testBannerErr]}>
              <Text style={formTestResult.ok ? styles.testTextOk : styles.testTextErr}>
                {formTestResult.message}
              </Text>
            </View>
          )}

          <View style={styles.formActionRow}>
            <TouchableOpacity
              style={styles.testFormButton}
              onPress={handleTestFormModel}
              disabled={testingForm || loading}
              accessibilityRole="button"
              accessibilityLabel="Test Model Configuration"
            >
              <Text style={styles.testFormButtonText}>
                {testingForm ? 'Testing...' : '🧪 Test Model'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, { flex: 1 }]}
              onPress={handleAddModel}
              disabled={loading || testingForm}
              accessibilityRole="button"
              accessibilityLabel="Save Model"
            >
              <Text style={styles.saveButtonText}>Add Model to Chain</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Model List */}
      {models.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No models configured for this module yet.</Text>
        </View>
      ) : (
        models.map((m, index) => (
          <View key={m.id} style={styles.modelCard}>
            <View style={styles.modelHeader}>
              <View style={styles.priorityBadge}>
                <Text style={styles.priorityText}>#{index + 1}</Text>
              </View>
              <View style={styles.modelTitleCol}>
                <Text style={styles.modelName}>{m.name}</Text>
                <Text style={styles.modelMeta}>
                  {m.provider.toUpperCase()} · {m.model_id}
                </Text>
                <Text style={styles.modelSecret}>Key: {m.secret_name}</Text>
              </View>

              <Switch
                value={m.enabled}
                onValueChange={() => handleToggleEnabled(m)}
                accessibilityLabel={`Toggle ${m.name}`}
              />
            </View>

            <View style={styles.modelFooter}>
              {/* Up / Down Reorder Buttons */}
              <View style={styles.reorderGroup}>
                <TouchableOpacity
                  style={[styles.arrowButton, index === 0 && styles.disabledButton]}
                  onPress={() => handleMove(index, 'up')}
                  disabled={index === 0}
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${m.name} up`}
                >
                  <Text style={styles.arrowText}>▲ Up</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.arrowButton, index === models.length - 1 && styles.disabledButton]}
                  onPress={() => handleMove(index, 'down')}
                  disabled={index === models.length - 1}
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${m.name} down`}
                >
                  <Text style={styles.arrowText}>▼ Down</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modelActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleTestModel(m)}
                  disabled={testingModelId === m.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Test ${m.name}`}
                >
                  <Text style={styles.actionText}>
                    {testingModelId === m.id ? 'Testing...' : 'Test Model'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDelete(m)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${m.name}`}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 14 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    screenTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
    screenSubtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
    dashboardButton: {
      backgroundColor: colors.muted,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    dashboardButtonText: { fontSize: 13, fontWeight: '600', color: colors.text },
    moduleBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    moduleTab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
    moduleTabActive: { backgroundColor: colors.primary },
    moduleTabText: { fontSize: 14, fontWeight: '600', color: colors.text },
    moduleTabTextActive: { color: '#ffffff' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    addButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    addButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
    formCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      gap: 8,
    },
    formLabel: { fontSize: 12, fontWeight: '600', color: colors.text },
    presetRow: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
    presetChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: colors.muted,
    },
    presetChipActive: { backgroundColor: colors.primary },
    presetChipText: { fontSize: 11, fontWeight: '600', color: colors.text },
    presetChipTextActive: { color: '#ffffff' },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: colors.text,
      fontSize: 13,
    },
    testBanner: {
      borderRadius: 6,
      padding: 10,
      marginTop: 2,
    },
    testBannerOk: { backgroundColor: '#dcfce7' },
    testBannerErr: { backgroundColor: '#fee2e2' },
    testTextOk: { color: '#166534', fontSize: 12, fontWeight: '600' },
    testTextErr: { color: '#b91c1c', fontSize: 12, fontWeight: '600' },
    formActionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    testFormButton: {
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    testFormButtonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: 10,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
    emptyCard: {
      padding: 24,
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyText: { color: colors.mutedForeground, fontSize: 13 },
    modelCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      gap: 10,
    },
    modelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    priorityBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    priorityText: { fontSize: 12, fontWeight: '700', color: colors.text },
    modelTitleCol: { flex: 1, gap: 2 },
    modelName: { fontSize: 15, fontWeight: '700', color: colors.text },
    modelMeta: { fontSize: 12, color: colors.mutedForeground },
    modelSecret: { fontSize: 11, fontFamily: 'monospace', color: colors.mutedForeground },
    modelFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    reorderGroup: { flexDirection: 'row', gap: 6 },
    arrowButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      backgroundColor: colors.muted,
    },
    disabledButton: { opacity: 0.3 },
    arrowText: { fontSize: 11, fontWeight: '600', color: colors.text },
    modelActions: { flexDirection: 'row', gap: 6 },
    actionButton: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 4,
      backgroundColor: colors.muted,
    },
    actionText: { fontSize: 12, color: colors.text, fontWeight: '500' },
    deleteButton: { backgroundColor: '#fee2e2' },
    deleteText: { fontSize: 12, color: '#b91c1c', fontWeight: '500' },
  });
}
