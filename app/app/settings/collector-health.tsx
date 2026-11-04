import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { supabase } from '../../src/lib/supabase';

interface RunEntry {
  id: string;
  started_at: string;
  finished_at: string;
  found: number;
  new: number;
  scored: number;
  unscored: number;
  errors: number;
  per_source_results: Array<{
    source: string;
    fetched: number;
    inserted: number;
    skipped_dedupe: number;
    skipped_filter: number;
    errors: number;
    error_message: string | null;
  }> | null;
  models_used: Record<string, number> | null;
}

export default function CollectorHealthScreen() {
  const { colors } = useTheme();
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);

  useEffect(() => {
    fetchHealthData();
  }, []);

  async function fetchHealthData() {
    setRefreshing(true);
    try {
      const { data: runData } = await supabase
        .from('collector_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);

      setRuns(runData ?? []);

      // Check model status for missing or invalid keys
      const { data: statusList } = await supabase
        .from('model_status')
        .select('model_id, status')
        .eq('status', 'invalid_key');

      if (statusList && statusList.length > 0) {
        setMissingKeys(statusList.map((s) => s.model_id));
      } else {
        setMissingKeys([]);
      }
    } catch {
      // Offline fallback
    } finally {
      setRefreshing(false);
    }
  }

  const styles = getStyles(colors);
  const latestRun = runs[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchHealthData} />}
    >
      <Text style={styles.screenTitle}>Collector Health & Runs</Text>
      <Text style={styles.screenSubtitle}>
        Automated collection runs every 30 minutes via GitHub Actions.
      </Text>

      {/* Warning Banners if any keys invalid */}
      {missingKeys.length > 0 && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningTitle}>⚠️ Invalid or Missing API Keys</Text>
          <Text style={styles.warningText}>
            {missingKeys.length} model(s) reported invalid keys. Please visit Settings &gt; Secrets to update them.
          </Text>
        </View>
      )}

      {/* Latest Run Card */}
      {latestRun ? (
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.cardTitle}>Latest Run</Text>
            <Text style={styles.timeText}>
              {new Date(latestRun.started_at).toLocaleString()}
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{latestRun.found}</Text>
              <Text style={styles.statLabel}>Found</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{latestRun.new}</Text>
              <Text style={styles.statLabel}>New Saved</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{latestRun.scored}</Text>
              <Text style={styles.statLabel}>Scored</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{latestRun.unscored}</Text>
              <Text style={styles.statLabel}>Unscored</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, latestRun.errors > 0 && styles.errorText]}>
                {latestRun.errors}
              </Text>
              <Text style={styles.statLabel}>Errors</Text>
            </View>
          </View>

          {/* Per-source results */}
          {latestRun.per_source_results && latestRun.per_source_results.length > 0 && (
            <View style={styles.subSection}>
              <Text style={styles.subTitle}>Per-Source Breakdown</Text>
              {latestRun.per_source_results.map((sr) => (
                <View key={sr.source} style={styles.sourceRow}>
                  <Text style={styles.sourceName}>{sr.source.toUpperCase()}</Text>
                  <Text style={styles.sourceStats}>
                    {sr.fetched} fetched · {sr.inserted} new · {sr.skipped_dedupe} dupes
                  </Text>
                  {sr.error_message && (
                    <Text style={styles.errorMsg}>{sr.error_message}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No collector runs recorded yet.</Text>
        </View>
      )}

      {/* History List */}
      <Text style={styles.historyTitle}>Run History (Last 10)</Text>
      {runs.slice(1).map((r) => (
        <View key={r.id} style={styles.historyItem}>
          <View>
            <Text style={styles.historyTime}>
              {new Date(r.started_at).toLocaleTimeString()} · {new Date(r.started_at).toLocaleDateString()}
            </Text>
            <Text style={styles.historySummary}>
              +{r.new} new leads · {r.scored} scored · {r.errors} errors
            </Text>
          </View>
          <View style={styles.statusIndicator}>
            <Text style={r.errors > 0 ? styles.errDot : styles.okDot}>
              {r.errors > 0 ? '⚠️' : '✓'}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 14 },
    screenTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
    screenSubtitle: { fontSize: 13, color: colors.mutedForeground },
    warningBanner: {
      backgroundColor: '#fee2e2',
      borderWidth: 1,
      borderColor: '#ef4444',
      borderRadius: 8,
      padding: 12,
      gap: 4,
    },
    warningTitle: { fontSize: 13, fontWeight: '700', color: '#991b1b' },
    warningText: { fontSize: 12, color: '#7f1d1d' },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 14,
      gap: 12,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    timeText: { fontSize: 12, color: colors.mutedForeground },
    statsGrid: { flexDirection: 'row', gap: 6 },
    statBox: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 8,
      alignItems: 'center',
    },
    statVal: { fontSize: 15, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 10, color: colors.mutedForeground, marginTop: 2 },
    errorText: { color: '#dc2626' },
    subSection: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
    subTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
    sourceRow: { paddingVertical: 4 },
    sourceName: { fontSize: 12, fontWeight: '700', color: colors.text },
    sourceStats: { fontSize: 11, color: colors.mutedForeground },
    errorMsg: { fontSize: 11, color: '#dc2626', marginTop: 2 },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      alignItems: 'center',
    },
    emptyText: { color: colors.mutedForeground, fontSize: 13 },
    historyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8 },
    historyItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
    },
    historyTime: { fontSize: 13, fontWeight: '600', color: colors.text },
    historySummary: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    statusIndicator: { padding: 4 },
    okDot: { fontSize: 16, color: '#16a34a' },
    errDot: { fontSize: 16, color: '#dc2626' },
  });
}

