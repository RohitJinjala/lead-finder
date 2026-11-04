import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { supabase } from '../../src/lib/supabase';
import type { Lead } from '../../src/types/lead';

interface DealRow {
  id: string;
  lead_id: string;
  deal_code: string;
  client: string;
  project: string;
  value: number | null;
  currency: string;
  start_date: string | null;
  deadline: string | null;
  payment_status: string;
  state: string;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = Array.isArray(val) ? val.join(';') : String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

export function leadsToCsv(leads: Lead[]): string {
  const headers = [
    'lead_code',
    'module',
    'source',
    'source_url',
    'title',
    'status',
    'score',
    'reason',
    'tags',
    'service_match',
    'budget_amount',
    'currency',
    'country',
    'business_name',
    'niche',
    'city',
    'phone',
    'found_at',
    'contacted_at',
    'follow_up_at',
  ];

  const rows = leads.map((l) => [
    escapeCsvField(l.lead_code),
    escapeCsvField(l.module),
    escapeCsvField(l.source),
    escapeCsvField(l.source_url),
    escapeCsvField(l.title),
    escapeCsvField(l.status),
    escapeCsvField(l.score),
    escapeCsvField(l.reason),
    escapeCsvField(l.tags),
    escapeCsvField(l.service_match),
    escapeCsvField(l.budget_amount),
    escapeCsvField(l.currency),
    escapeCsvField(l.country),
    escapeCsvField(l.business_name),
    escapeCsvField(l.niche),
    escapeCsvField(l.city),
    escapeCsvField(l.phone),
    escapeCsvField(l.found_at),
    escapeCsvField(l.contacted_at),
    escapeCsvField(l.follow_up_at),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function dealsToCsv(deals: DealRow[]): string {
  const headers = [
    'deal_code',
    'client',
    'project',
    'value',
    'currency',
    'payment_status',
    'state',
    'start_date',
    'deadline',
    'created_at',
    'completed_at',
    'notes',
  ];

  const rows = deals.map((d) => [
    escapeCsvField(d.deal_code),
    escapeCsvField(d.client),
    escapeCsvField(d.project),
    escapeCsvField(d.value),
    escapeCsvField(d.currency),
    escapeCsvField(d.payment_status),
    escapeCsvField(d.state),
    escapeCsvField(d.start_date),
    escapeCsvField(d.deadline),
    escapeCsvField(d.created_at),
    escapeCsvField(d.completed_at),
    escapeCsvField(d.notes),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export default function DataScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const styles = getStyles(colors);

  async function handleExportLeads() {
    setExporting(true);
    setStatusMessage('Fetching leads...');
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('found_at', { ascending: false });

      if (error) throw error;
      const leads = (data as Lead[]) ?? [];
      const csv = leadsToCsv(leads);
      const filename = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;

      await deliverCsv(csv, filename, `Exported ${leads.length} leads.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      Alert.alert('Error', msg);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportDeals() {
    setExporting(true);
    setStatusMessage('Fetching deals...');
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const deals = (data as DealRow[]) ?? [];
      const csv = dealsToCsv(deals);
      const filename = `deals_export_${new Date().toISOString().slice(0, 10)}.csv`;

      await deliverCsv(csv, filename, `Exported ${deals.length} deals.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      Alert.alert('Error', msg);
    } finally {
      setExporting(false);
    }
  }

  async function deliverCsv(csv: string, filename: string, successMsg: string) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatusMessage(successMsg);
      Alert.alert('Download Started', successMsg);
    } else {
      await Share.share({
        title: filename,
        message: csv,
      });
      setStatusMessage(successMsg);
    }
  }

  async function handlePurgeTrash() {
    Alert.alert(
      'Purge Trash',
      'Permanently delete leads in Trash older than 30 days? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge Old Trash',
          style: 'destructive',
          onPress: async () => {
            setCleaning(true);
            try {
              const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
              const { error } = await supabase
                .from('leads')
                .delete()
                .not('deleted_at', 'is', null)
                .lte('deleted_at', thirtyDaysAgo);

              if (error) throw error;
              Alert.alert('Success', 'Trash older than 30 days has been purged.');
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to purge trash';
              Alert.alert('Error', msg);
            } finally {
              setCleaning(false);
            }
          },
        },
      ]
    );
  }

  async function handleArchiveOldRejected() {
    Alert.alert(
      'Archive Old Rejected Leads',
      'Archive rejected leads older than 30 days? They will be hidden from default views.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            setCleaning(true);
            try {
              const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
              const { error } = await supabase
                .from('leads')
                .update({ archived_at: new Date().toISOString() })
                .eq('status', 'rejected')
                .is('archived_at', null)
                .lte('found_at', thirtyDaysAgo);

              if (error) throw error;
              Alert.alert('Success', 'Rejected leads older than 30 days have been archived.');
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to archive leads';
              Alert.alert('Error', msg);
            } finally {
              setCleaning(false);
            }
          },
        },
      ]
    );
  }

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
        <Text style={styles.title}>Data & Retention</Text>
        <Text style={styles.subtitle}>
          Export your qualified leads and closed deals, review retention policies, or run cleanup.
        </Text>
      </View>

      {/* Export Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Export (CSV)</Text>
        <Text style={styles.sectionDescription}>
          Download a complete snapshot of your leads or deals. On web, this downloads directly to your device. On mobile, this opens the native share sheet.
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.primaryButton, exporting && styles.buttonDisabled]}
            onPress={handleExportLeads}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel="Export all leads to CSV"
          >
            {exporting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>📥 Export Leads CSV</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, exporting && styles.buttonDisabled]}
            onPress={handleExportDeals}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel="Export all deals to CSV"
          >
            <Text style={styles.secondaryButtonText}>📊 Export Deals CSV</Text>
          </TouchableOpacity>
        </View>

        {statusMessage && (
          <Text style={styles.statusText} accessibilityLiveRegion="polite">
            {statusMessage}
          </Text>
        )}
      </View>

      {/* Retention Policy Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Retention & Safety</Text>
        <Text style={styles.sectionDescription}>
          The system maintains database cleanliness and protects your storage limits through automated policies:
        </Text>

        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>🗑️ Trash Lifecycle (30 Days)</Text>
          <Text style={styles.policyBody}>
            When a lead is deleted, it is soft-deleted to Trash. It remains fully restorable for 30 days. After 30 days, it is purged permanently during daily cleanup.
          </Text>
        </View>

        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>📁 Rejected Leads Archive (30 Days)</Text>
          <Text style={styles.policyBody}>
            Rejected leads older than 30 days are automatically archived. They are excluded from regular searches and tabs, but preserved for model scoring calibration.
          </Text>
        </View>

        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>✂️ Text Ingestion Guard (4,000 chars)</Text>
          <Text style={styles.policyBody}>
            Raw post and feed content is strictly trimmed to 4,000 characters before saving. Prompts and models never parse excess payload.
          </Text>
        </View>
      </View>

      {/* Maintenance Cleanup Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual Maintenance</Text>
        <Text style={styles.sectionDescription}>
          These operations normally run once daily via the collector, but you can trigger them manually if needed:
        </Text>

        <View style={styles.maintenanceRow}>
          <TouchableOpacity
            style={[styles.dangerButton, cleaning && styles.buttonDisabled]}
            onPress={handlePurgeTrash}
            disabled={cleaning}
            accessibilityRole="button"
            accessibilityLabel="Purge trash older than 30 days"
          >
            <Text style={styles.dangerButtonText}>Purge Trash (&gt;30d)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.outlineButton, cleaning && styles.buttonDisabled]}
            onPress={handleArchiveOldRejected}
            disabled={cleaning}
            accessibilityRole="button"
            accessibilityLabel="Archive rejected leads older than 30 days"
          >
            <Text style={styles.outlineButtonText}>Archive Old Rejected (&gt;30d)</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    section: { backgroundColor: colors.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
    sectionDescription: { fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 },
    buttonRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    primaryButton: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    buttonText: { color: colors.primaryForeground, fontSize: 14, fontWeight: '600' },
    secondaryButton: { backgroundColor: colors.secondary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    secondaryButtonText: { color: colors.secondaryForeground, fontSize: 14, fontWeight: '600' },
    buttonDisabled: { opacity: 0.6 },
    statusText: { fontSize: 13, color: colors.primary, marginTop: 10, fontWeight: '600' },
    policyCard: { backgroundColor: colors.background, padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
    policyTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },
    policyBody: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
    maintenanceRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    dangerButton: { backgroundColor: colors.error + '20', borderWidth: 1, borderColor: colors.error, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
    dangerButtonText: { color: colors.error, fontSize: 13, fontWeight: '600' },
    outlineButton: { backgroundColor: colors.muted, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
    outlineButtonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  });
}
