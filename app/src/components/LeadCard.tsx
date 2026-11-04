import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, Platform } from 'react-native';
import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import type { Lead } from '../types/lead';
import { supabase } from '../lib/supabase';

interface LeadCardProps {
  lead: Lead;
  onRefresh: () => void;
}

function getScoreColor(score: number | null, colors: ReturnType<typeof useTheme>['colors']): string {
  if (score === null) return colors.mutedForeground;
  if (score >= 75) return colors.score.high;
  if (score >= 50) return colors.score.medium;
  return colors.score.low;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function LeadCard({ lead, onRefresh }: LeadCardProps) {
  const { colors } = useTheme();
  const [actionLoading, setActionLoading] = useState(false);
  const [undoTimeout, setUndoTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [undoAction, setUndoAction] = useState<(() => Promise<void>) | null>(null);

  const styles = getStyles(colors);

  async function handleAction(newStatus: string, undoFn?: () => Promise<void>) {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus, ...(newStatus === 'contacted' ? { contacted_at: new Date().toISOString() } : {}) })
        .eq('id', lead.id);

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      if (undoFn) {
        setUndoAction(() => undoFn);
        setShowUndo(true);
        const t = setTimeout(() => {
          setShowUndo(false);
          setUndoAction(null);
          onRefresh();
        }, 5000);
        setUndoTimeout(t);
      } else {
        onRefresh();
      }
    } finally {
      setActionLoading(false);
    }
  }

  function handleAccept() {
    Alert.alert(
      'Accept Lead',
      `Move ${lead.lead_code} · ${lead.title.slice(0, 60)} to Acceptable?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () => void handleAction('acceptable', async () => {
            await supabase.from('leads').update({ status: 'new' }).eq('id', lead.id);
            onRefresh();
          }),
        },
      ]
    );
  }

  function handleReject() {
    const reasons = ['Low budget', 'Spam', 'Wrong skill', 'Full-time only', 'Other'];
    Alert.alert(
      'Reject Lead',
      `Reject ${lead.lead_code} · ${lead.title.slice(0, 60)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        ...reasons.map((r) => ({
          text: r,
          onPress: () => void (async () => {
            setActionLoading(true);
            try {
              await supabase.from('leads').update({ status: 'rejected', reject_reason: r }).eq('id', lead.id);
              setShowUndo(true);
              const t = setTimeout(() => { setShowUndo(false); onRefresh(); }, 5000);
              setUndoTimeout(t);
              setUndoAction(() => async () => {
                await supabase.from('leads').update({ status: 'new', reject_reason: null }).eq('id', lead.id);
                onRefresh();
              });
            } finally {
              setActionLoading(false);
            }
          })(),
        })),
      ]
    );
  }

  function handleDelete() {
    Alert.alert(
      'Delete Lead',
      `Move ${lead.lead_code} to Trash? You can restore it within 30 days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void handleAction(lead.status, async () => {
            await supabase.from('leads').update({ deleted_at: null }).eq('id', lead.id);
            onRefresh();
          }),
        },
      ]
    );
  }

  const scoreColor = getScoreColor(lead.score, colors);

  function openUrl(url: string) {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      void Linking.openURL(url);
    }
  }

  return (
    <View style={styles.card} accessibilityLabel={`Lead ${lead.lead_code}: ${lead.title}`}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.leadCode} accessibilityLabel={`Lead code ${lead.lead_code}`}>{lead.lead_code}</Text>
        <View style={[styles.statusBadge, { backgroundColor: colors.statusBadge[lead.status] }]}>
          <Text style={styles.statusBadgeText}>{lead.status}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2} accessibilityLabel={`Title: ${lead.title}`}>
        {lead.title}
      </Text>

      {/* Score row */}
      <View style={styles.scoreRow}>
        {lead.scored ? (
          <>
            <Text style={[styles.score, { color: scoreColor }]} accessibilityLabel={`Score: ${lead.score}`}>
              ⭐ {lead.score}/100
            </Text>
            {lead.reason && (
              <Text style={styles.reason} numberOfLines={1} accessibilityLabel={`Reason: ${lead.reason}`}>
                {lead.reason}
              </Text>
            )}
          </>
        ) : (
          <Text style={[styles.score, { color: colors.mutedForeground }]} accessibilityLabel="Unscored">
            Unscored
          </Text>
        )}
      </View>

      {/* Scored by badge */}
      {lead.scored_by && (
        <Text style={styles.scoredBy} accessibilityLabel={`Scored by: ${lead.scored_by}${lead.is_fallback ? ' (fallback)' : ''}`}>
          🤖 Scored by: {lead.scored_by}{lead.is_fallback ? ' (fallback)' : ''}
        </Text>
      )}
      {!lead.scored && lead.tags?.includes('Unscored') && (
        <Text style={[styles.scoredBy, { color: colors.warning }]} accessibilityLabel="Unscored — will retry">
          ⚠️ Unscored — will retry
        </Text>
      )}

      {/* Module-specific fields */}
      {lead.module === 'web' && (
        <View style={styles.metaRow}>
          <Text style={styles.metaText} accessibilityLabel={`Source: ${lead.source}`}>📡 {lead.source}</Text>
          {lead.country && <Text style={styles.metaText} accessibilityLabel={`Country: ${lead.country}`}>🌍 {lead.country}</Text>}
          {lead.budget_signal !== 'none' && lead.budget_amount && (
            <Text style={styles.metaText} accessibilityLabel={`Budget: ${lead.currency ?? ''} ${lead.budget_amount}`}>
              💰 {lead.currency} {lead.budget_amount}
            </Text>
          )}
        </View>
      )}

      {lead.module === 'maps' && (
        <View style={styles.metaRow}>
          <Text style={styles.metaText} accessibilityLabel={`Business: ${lead.business_name ?? ''}`}>🏢 {lead.business_name}</Text>
          {lead.city && <Text style={styles.metaText} accessibilityLabel={`City: ${lead.city}`}>📍 {lead.city}</Text>}
          <Text style={styles.attributionText} accessibilityLabel="Found via OpenStreetMap">
            Found via: OpenStreetMap
          </Text>
        </View>
      )}

      {/* Red flags */}
      {lead.red_flags && lead.red_flags.length > 0 && (
        <View style={styles.redFlagsRow} accessibilityLabel={`Red flags: ${lead.red_flags.join(', ')}`}>
          {lead.red_flags.map((flag) => (
            <View key={flag} style={styles.redFlagChip}>
              <Text style={styles.redFlagText}>⚠️ {flag.replace(/_/g, ' ')}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Found at */}
      <Text style={styles.timestamp} accessibilityLabel={`Found ${formatRelativeTime(lead.found_at)}`}>
        🕐 {formatRelativeTime(lead.found_at)}
      </Text>

      {/* Draft line */}
      {lead.draft_line && (
        <Text style={styles.draftLine} accessibilityLabel={`Draft opening: ${lead.draft_line}`}>
          ✏️ {lead.draft_line}
        </Text>
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        {lead.status !== 'acceptable' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.success }]}
            onPress={handleAccept}
            disabled={actionLoading}
            accessibilityRole="button"
            accessibilityLabel={`Accept lead ${lead.lead_code}`}
          >
            <Text style={styles.actionButtonText}>Accept</Text>
          </TouchableOpacity>
        )}
        {lead.status !== 'rejected' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error }]}
            onPress={handleReject}
            disabled={actionLoading}
            accessibilityRole="button"
            accessibilityLabel={`Reject lead ${lead.lead_code}`}
          >
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
        )}
        {lead.source_url && lead.module === 'web' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.secondary }]}
            onPress={() => openUrl(lead.source_url)}
            accessibilityRole="link"
            accessibilityLabel={`Open post for lead ${lead.lead_code}`}
          >
            <Text style={[styles.actionButtonText, { color: colors.secondaryForeground }]}>View Post</Text>
          </TouchableOpacity>
        )}
        {lead.module === 'maps' && lead.whatsapp_url && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#25D366' }]}
            onPress={() => openUrl(lead.whatsapp_url!)}
            accessibilityRole="link"
            accessibilityLabel={`WhatsApp ${lead.business_name ?? 'business'}`}
          >
            <Text style={styles.actionButtonText}>WhatsApp</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.muted }]}
          onPress={handleDelete}
          disabled={actionLoading}
          accessibilityRole="button"
          accessibilityLabel={`Delete lead ${lead.lead_code}`}
        >
          <Text style={[styles.actionButtonText, { color: colors.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Undo toast */}
      {showUndo && (
        <View style={styles.undoToast} accessibilityLiveRegion="polite" accessibilityLabel="Action performed. Tap Undo to reverse.">
          <Text style={styles.undoText}>Action applied</Text>
          <TouchableOpacity
            onPress={() => {
              if (undoTimeout) clearTimeout(undoTimeout);
              setShowUndo(false);
              if (undoAction) void undoAction();
            }}
            accessibilityRole="button"
            accessibilityLabel="Undo action"
          >
            <Text style={styles.undoButton}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    leadCode: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground, letterSpacing: 0.5 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    statusBadgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
    title: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 6 },
    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    score: { fontSize: 14, fontWeight: '700' },
    reason: { fontSize: 13, color: colors.textSecondary, flex: 1 },
    scoredBy: { fontSize: 12, color: colors.mutedForeground, marginBottom: 4 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    metaText: { fontSize: 12, color: colors.textSecondary },
    attributionText: { fontSize: 11, color: colors.mutedForeground, fontStyle: 'italic' },
    redFlagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
    redFlagChip: { backgroundColor: colors.error + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    redFlagText: { fontSize: 11, color: colors.error },
    timestamp: { fontSize: 12, color: colors.mutedForeground, marginBottom: 4 },
    draftLine: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 8, padding: 8, backgroundColor: colors.muted, borderRadius: 6 },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    actionButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    actionButtonText: { fontSize: 13, fontWeight: '600', color: '#fff' },
    undoToast: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, padding: 8, backgroundColor: colors.secondary, borderRadius: 6 },
    undoText: { color: colors.text, fontSize: 13 },
    undoButton: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  });
}
