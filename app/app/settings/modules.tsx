import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { supabase } from '../../src/lib/supabase';

interface UserSettings {
  id: string;
  web_module_enabled: boolean;
  maps_module_enabled: boolean;
  scoring_cap_per_run: number;
  alert_threshold: number;
}

export default function ModulesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [webEnabled, setWebEnabled] = useState(true);
  const [mapsEnabled, setMapsEnabled] = useState(true);
  const [scoringCap, setScoringCap] = useState(40);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      if (data) {
        const s = data as unknown as UserSettings;
        setWebEnabled(s.web_module_enabled);
        setMapsEnabled(s.maps_module_enabled);
        setScoringCap(s.scoring_cap_per_run || 40);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(updates: Partial<UserSettings>) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .update(updates)
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
      Alert.alert('Saved', 'Module configuration updated successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update settings';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  function handleToggleWeb(val: boolean) {
    setWebEnabled(val);
    void saveSettings({ web_module_enabled: val });
  }

  function handleToggleMaps(val: boolean) {
    setMapsEnabled(val);
    void saveSettings({ maps_module_enabled: val });
  }

  const styles = getStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to settings"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Modules Configuration</Text>
        <Text style={styles.subtitle}>
          Enable or disable lead collection modules and configure per-run processing limits.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <>
          {/* Web Module Card */}
          <View style={styles.moduleCard}>
            <View style={styles.cardHeader}>
              <View style={styles.titleGroup}>
                <Text style={styles.cardIcon}>📡</Text>
                <View>
                  <Text style={styles.cardTitle}>Web Leads Module</Text>
                  <Text style={styles.cardStatus}>
                    {webEnabled ? 'Active & Collecting' : 'Disabled'}
                  </Text>
                </View>
              </View>
              <Switch
                value={webEnabled}
                onValueChange={handleToggleWeb}
                disabled={saving}
                accessibilityLabel="Toggle Web Leads Module"
              />
            </View>

            <Text style={styles.cardDescription}>
              Monitors public freelance feeds: Reddit (r/forhire, r/hiring, r/freelance), Hacker News monthly threads, RemoteOK, We Work Remotely, and Remotive.
            </Text>

            <View style={styles.linkRow}>
              <TouchableOpacity
                style={styles.cardLinkBtn}
                onPress={() => router.push('/settings/models?module=web' as never)}
                accessibilityRole="button"
                accessibilityLabel="Configure Web AI Models"
              >
                <Text style={styles.cardLinkText}>Configure Web AI Chain →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardLinkBtn}
                onPress={() => router.push('/settings/search-profiles' as never)}
                accessibilityRole="button"
                accessibilityLabel="Edit Web Search Profiles"
              >
                <Text style={styles.cardLinkText}>Search Profiles & Plans →</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Maps Module Card */}
          <View style={styles.moduleCard}>
            <View style={styles.cardHeader}>
              <View style={styles.titleGroup}>
                <Text style={styles.cardIcon}>🗺️</Text>
                <View>
                  <Text style={styles.cardTitle}>Maps Leads Module</Text>
                  <Text style={styles.cardStatus}>
                    {mapsEnabled ? 'Active & Collecting' : 'Disabled'}
                  </Text>
                </View>
              </View>
              <Switch
                value={mapsEnabled}
                onValueChange={handleToggleMaps}
                disabled={saving}
                accessibilityLabel="Toggle Maps Leads Module"
              />
            </View>

            <Text style={styles.cardDescription}>
              Discovers high-potential local businesses using OpenStreetMap that have no website or only social media pages. Matches custom niche offers.
            </Text>

            <View style={styles.linkRow}>
              <TouchableOpacity
                style={styles.cardLinkBtn}
                onPress={() => router.push('/settings/models?module=maps' as never)}
                accessibilityRole="button"
                accessibilityLabel="Configure Maps AI Models"
              >
                <Text style={styles.cardLinkText}>Configure Maps AI Chain →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardLinkBtn}
                onPress={() => router.push('/settings/niches' as never)}
                accessibilityRole="button"
                accessibilityLabel="Locations and Niches"
              >
                <Text style={styles.cardLinkText}>Locations & Niches →</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Scoring Limit Configuration */}
          <View style={styles.moduleCard}>
            <Text style={styles.cardTitle}>AI Scoring Cap Per Run</Text>
            <Text style={styles.cardDescription}>
              Limits the maximum number of AI scoring API requests per 30-minute collector run to protect rate limits and free tier quotas.
            </Text>

            <View style={styles.capChipsRow}>
              {[20, 40, 60, 100].map((cap) => (
                <TouchableOpacity
                  key={cap}
                  style={[styles.capChip, scoringCap === cap && styles.capChipActive]}
                  onPress={() => {
                    setScoringCap(cap);
                    void saveSettings({ scoring_cap_per_run: cap });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Set cap to ${cap} leads`}
                >
                  <Text style={[styles.capChipText, scoringCap === cap && styles.capChipTextActive]}>
                    {cap} leads
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 40 },
    header: { marginBottom: 20 },
    backButton: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: colors.muted, marginBottom: 12 },
    backButtonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
    subtitle: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
    moduleCard: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardIcon: { fontSize: 24 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    cardStatus: { fontSize: 12, color: colors.mutedForeground },
    cardDescription: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 },
    linkRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
    cardLinkBtn: { backgroundColor: colors.muted, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
    cardLinkText: { fontSize: 12, fontWeight: '600', color: colors.primary },
    capChipsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    capChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.muted },
    capChipActive: { backgroundColor: colors.primary },
    capChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
    capChipTextActive: { color: colors.primaryForeground },
  });
}

