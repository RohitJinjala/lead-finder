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
import { useRouter } from 'expo-router';

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

const PROVIDER_PRESETS: Record<string, { base_url: string; default_model: string }> = {
  groq: { base_url: 'https://api.groq.com/openai/v1', default_model: 'llama-3.3-70b-versatile' },
  gemini: { base_url: 'https://generativelanguage.googleapis.com/v1beta/openai', default_model: 'gemini-1.5-flash' },
  nvidia: { base_url: 'https://integrate.api.nvidia.com/v1', default_model: 'meta/llama-3.1-70b-instruct' },
  mistral: { base_url: 'https://api.mistral.ai/v1', default_model: 'mistral-small-latest' },
  openrouter: { base_url: 'https://openrouter.ai/api/v1', default_model: 'anthropic/claude-3.5-haiku' },
  custom: { base_url: '', default_model: '' },
};

export default function ModelsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [selectedModule, setSelectedModule] = useState<'web' | 'maps'>('web');
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('groq');
  const [baseUrl, setBaseUrl] = useState(PROVIDER_PRESETS['groq']?.base_url ?? '');
  const [modelId, setModelId] = useState(PROVIDER_PRESETS['groq']?.default_model ?? '');
  const [secretName, setSecretName] = useState('GROQ_API_KEY');
  const [dailyLimit, setDailyLimit] = useState('');

  useEffect(() => {
    fetchModels();
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

  function handleProviderSelect(prov: string) {
    setProvider(prov);
    const preset = PROVIDER_PRESETS[prov];
    if (preset) {
      if (prov !== 'custom') {
        setBaseUrl(preset.base_url);
        setModelId(preset.default_model);
      }
    }
  }

  async function handleAddModel() {
    if (!name.trim() || !baseUrl.trim() || !modelId.trim() || !secretName.trim()) {
      Alert.alert('Error', 'Please fill in all required model fields.');
      return;
    }

    setLoading(true);
    try {
      const nextPriority = models.length > 0 ? Math.max(...models.map((m) => m.priority)) + 1 : 1;
      const { error } = await supabase.from('model_chain').insert({
        module: selectedModule,
        name: name.trim(),
        provider,
        base_url: baseUrl.trim(),
        model_id: modelId.trim(),
        secret_name: secretName.trim().toUpperCase(),
        priority: nextPriority,
        enabled: true,
        daily_limit: dailyLimit ? parseInt(dailyLimit, 10) : null,
        reset_tz: 'Asia/Kolkata',
        reset_hour: 0,
      });

      if (error) throw error;
      setShowAddForm(false);
      setName('');
      setDailyLimit('');
      await fetchModels();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add model';
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
    } catch {
      // Ignore
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
    } catch {
      // Ignore
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
            await supabase.from('model_chain').delete().eq('id', model.id);
            await fetchModels();
          } catch {
            // Ignore
          }
        },
      },
    ]);
  }

  async function handleTestModel(model: ModelItem) {
    Alert.alert('Testing Model', `Sent test request to ${model.name}...`);
    try {
      const { data, error } = await supabase.functions.invoke('test-secret', {
        body: {
          name: model.secret_name,
          test_type: 'ai_model',
          base_url: model.base_url,
          model_id: model.model_id,
        },
      });
      if (error) throw error;
      Alert.alert('Result', `Status: ${data?.status}\n${data?.message ?? 'OK'}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test failed';
      Alert.alert('Error', msg);
    }
  }

  const styles = getStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <View>
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

          <Text style={styles.formLabel}>Base URL</Text>
          <TextInput
            style={styles.input}
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder="https://api.provider.com/v1"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            accessibilityLabel="Base URL"
          />

          <Text style={styles.formLabel}>Model ID</Text>
          <TextInput
            style={styles.input}
            value={modelId}
            onChangeText={setModelId}
            placeholder="model-identifier"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            accessibilityLabel="Model ID"
          />

          <Text style={styles.formLabel}>Secret Name (from Secrets)</Text>
          <TextInput
            style={styles.input}
            value={secretName}
            onChangeText={setSecretName}
            placeholder="PROVIDER_API_KEY"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            accessibilityLabel="Secret Name"
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

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleAddModel}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Save Model"
          >
            <Text style={styles.saveButtonText}>Add Model to Chain</Text>
          </TouchableOpacity>
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
                  accessibilityRole="button"
                  accessibilityLabel={`Test ${m.name}`}
                >
                  <Text style={styles.actionText}>Test</Text>
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
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: 10,
      borderRadius: 6,
      alignItems: 'center',
      marginTop: 4,
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
