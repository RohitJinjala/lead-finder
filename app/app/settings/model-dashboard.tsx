import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { supabase } from '../../src/lib/supabase';

interface ModelStatusEntry {
  model_id: string;
  name: string;
  module: 'web' | 'maps';
  provider: string;
  status: 'available' | 'cooling_down' | 'limit_reached' | 'invalid_key' | 'disabled';
  requests_today: number;
  daily_limit: number | null;
  errors_today: number;
  leads_scored_today: number;
  resets_at: string | null;
  limit_hit_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
}

export default function ModelDashboardScreen() {
  const { colors } = useTheme();
  const [selectedModule, setSelectedModule] = useState<'web' | 'maps'>('web');
  const [models, setModels] = useState<ModelStatusEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, [selectedModule]);

  async function fetchDashboard() {
    setRefreshing(true);
    try {
      // Fetch models with status
      const { data: chain } = await supabase
        .from('model_chain')
        .select('*')
        .eq('module', selectedModule)
        .order('priority', { ascending: true });

      const { data: statusList } = await supabase
        .from('model_status')
        .select('*');

      const statusMap = new Map((statusList ?? []).map((s) => [s.model_id, s]));

      const combined: ModelStatusEntry[] = (chain ?? []).map((c) => {
        const s = statusMap.get(c.id);
        return {
          model_id: c.id,
          name: c.name,
          module: c.module,
          provider: c.provider,
          status: s?.status ?? (c.enabled ? 'available' : 'disabled'),
          requests_today: s?.requests_today ?? 0,
          daily_limit: c.daily_limit ?? null,
          errors_today: s?.errors_today ?? 0,
          leads_scored_today: s?.leads_scored_today ?? 0,
          resets_at: s?.resets_at ?? null,
          limit_hit_at: s?.limit_hit_at ?? null,
          last_error: s?.last_error ?? null,
          consecutive_failures: s?.consecutive_failures ?? 0,
        };
      });

      setModels(combined);
    } catch {
      // Fallback
    } finally {
      setRefreshing(false);
    }
  }

  const styles = getStyles(colors);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchDashboard} />}
    >
      <Text style={styles.screenTitle}>Model Health & Usage</Text>
      <Text style={styles.screenSubtitle}>
        Real-time telemetry, rate limit tracking, and failure counters.
      </Text>

      {/* Module Switcher */}
      <View style={styles.moduleBar} accessibilityRole="tablist">
        <TouchableOpacity
          style={[styles.moduleTab, selectedModule === 'web' && styles.moduleTabActive]}
          onPress={() => setSelectedModule('web')}
          accessibilityRole="tab"
          accessibilityLabel="Web Module Models"
        >
          <Text style={[styles.moduleTabText, selectedModule === 'web' && styles.moduleTabTextActive]}>
            Web Module
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.moduleTab, selectedModule === 'maps' && styles.moduleTabActive]}
          onPress={() => setSelectedModule('maps')}
          accessibilityRole="tab"
          accessibilityLabel="Maps Module Models"
        >
          <Text style={[styles.moduleTabText, selectedModule === 'maps' && styles.moduleTabTextActive]}>
            Maps Module
          </Text>
        </TouchableOpacity>
      </View>

      {models.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No models configured for this module.</Text>
        </View>
      ) : (
        models.map((m) => (
          <View key={m.model_id} style={styles.card}>
            <View style={styles.header}>
              <View>
                <Text style={styles.name}>{m.name}</Text>
                <Text style={styles.provider}>{m.provider.toUpperCase()}</Text>
              </View>

              <View
                style={[
                  styles.badge,
                  m.status === 'available' && styles.badgeAvailable,
                  m.status === 'cooling_down' && styles.badgeCooling,
                  m.status === 'limit_reached' && styles.badgeLimit,
                  m.status === 'invalid_key' && styles.badgeInvalid,
                  m.status === 'disabled' && styles.badgeDisabled,
                ]}
              >
                <Text style={styles.badgeText}>{m.status.toUpperCase()}</Text>
              </View>
            </View>

            {/* Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricBox}>
                <Text style={styles.metricVal}>
                  {m.requests_today}
                  {m.daily_limit ? ` / ${m.daily_limit}` : ''}
                </Text>
                <Text style={styles.metricLabel}>Requests Today</Text>
              </View>

              <View style={styles.metricBox}>
                <Text style={styles.metricVal}>{m.leads_scored_today}</Text>
                <Text style={styles.metricLabel}>Leads Scored</Text>
              </View>

              <View style={styles.metricBox}>
                <Text style={[styles.metricVal, m.errors_today > 0 && styles.errorText]}>
                  {m.errors_today}
                </Text>
                <Text style={styles.metricLabel}>Errors Today</Text>
              </View>

              <View style={styles.metricBox}>
                <Text style={styles.metricVal}>{m.consecutive_failures}</Text>
                <Text style={styles.metricLabel}>Consecutive Fails</Text>
              </View>
            </View>

            {/* Reset / Cooldown details */}
            {m.resets_at && (
              <Text style={styles.resetText}>
                Cooldown / Reset at: {new Date(m.resets_at).toLocaleTimeString()}
              </Text>
            )}

            {/* Last scrubbed error */}
            {m.last_error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorLabel}>Last Error:</Text>
                <Text style={styles.errorMessage}>{m.last_error}</Text>
              </View>
            )}
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
    screenTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
    screenSubtitle: { fontSize: 13, color: colors.mutedForeground },
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
    emptyCard: {
      padding: 24,
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyText: { color: colors.mutedForeground, fontSize: 13 },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 14,
      gap: 12,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    name: { fontSize: 16, fontWeight: '700', color: colors.text },
    provider: { fontSize: 12, color: colors.mutedForeground },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgeAvailable: { backgroundColor: '#dcfce7' },
    badgeCooling: { backgroundColor: '#fef3c7' },
    badgeLimit: { backgroundColor: '#fed7aa' },
    badgeInvalid: { backgroundColor: '#fee2e2' },
    badgeDisabled: { backgroundColor: colors.muted },
    badgeText: { fontSize: 11, fontWeight: '700', color: colors.text },
    metricsGrid: { flexDirection: 'row', gap: 8 },
    metricBox: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 8,
      alignItems: 'center',
    },
    metricVal: { fontSize: 15, fontWeight: '700', color: colors.text },
    metricLabel: { fontSize: 10, color: colors.mutedForeground, textAlign: 'center', marginTop: 2 },
    errorText: { color: '#b91c1c' },
    resetText: { fontSize: 12, color: colors.mutedForeground, fontStyle: 'italic' },
    errorBox: {
      backgroundColor: '#fee2e2',
      borderRadius: 6,
      padding: 8,
      gap: 2,
    },
    errorLabel: { fontSize: 11, fontWeight: '700', color: '#991b1b' },
    errorMessage: { fontSize: 11, color: '#7f1d1d' },
  });
}

