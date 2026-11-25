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

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim().length > 0) return msg;
  }
  return fallback;
}

export default function ModulesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [webEnabled, setWebEnabled] = useState(true);
  const [mapsEnabled, setMapsEnabled] = useState(true);
  const [scoringCap, setScoringCap] = useState(40);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const s = data as unknown as UserSettings;
        setSettingsId(s.id);
        setWebEnabled(s.web_module_enabled);
        setMapsEnabled(s.maps_module_enabled);
        setScoringCap(s.scoring_cap_per_run || 40);
      }
    } catch (err: unknown) {
      setLoadError(getErrorMessage(err, 'Could not load settings. Make sure you are signed in as owner.'));
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(
    updates: Partial<UserSettings>,
    revert: () => void
  ) {
    setSaving(true);
    try {
      let targetId = settingsId;

      if (!targetId) {
        const { data: existing, error: fetchErr } = await supabase
          .from('user_settings')
          .select('id')
          .limit(1)
          .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (existing && typeof (existing as { id?: unknown }).id === 'string') {
          targetId = (existing as { id: string }).id;
          setSettingsId(targetId);
        }
      }

      if (targetId) {
        const { data: updatedRows, error } = await supabase
          .from('user_settings')
          .update(updates)
          .eq('id', targetId)
          .select('id');

        if (error) throw error;
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error(
            'Permission denied or settings row missing. Please sign in and claim owner access in Settings.'
          );
        }
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('user_settings')
          .insert({
            web_module_enabled: updates.web_module_enabled ?? webEnabled,
            maps_module_enabled: updates.maps_module_enabled ?? mapsEnabled,
            scoring_cap_per_run: updates.scoring_cap_per_run ?? scoringCap,
          })
          .select('id')
          .single();

        if (insertErr) throw insertErr;
        if (inserted && typeof (inserted as { id?: unknown }).id === 'string') {
          setSettingsId((inserted as { id: string }).id);
        }
      }

      Alert.alert('Saved', 'Module configuration updated successfully.');
    } catch (err: unknown) {
      revert();
      const msg = getErrorMessage(err, 'Failed to update settings');
      Alert.alert('Save Failed', msg);
    } finally {
      setSaving(false);
    }
  }

  function handleToggleWeb(val: boolean) {
    const prev = webEnabled;
    setWebEnabled(val);
    void saveSettings({ web_module_enabled: val }, () => setWebEnabled(prev));
  }

  function handleToggleMaps(val: boolean) {
    const prev = mapsEnabled;
    setMapsEnabled(val);
    void saveSettings({ maps_module_enabled: val }, () => setMapsEnabled(prev));
  }

  function handleSelectCap(cap: number) {
    const prev = scoringCap;
    setScoringCap(cap);
    void saveSettings({ scoring_cap_per_run: cap }, () => setScoringCap(prev));
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

      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{loadError}</Text>
        </View>
      )}

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
                  onPress={() => handleSelectCap(cap)}
                  disabled={saving}
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
    errorBanner: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 14 },
    errorBannerText: { color: '#b91c1c', fontSize: 13, fontWeight: '500' },
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
