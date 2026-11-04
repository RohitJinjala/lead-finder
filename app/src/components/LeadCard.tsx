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
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  const [toastMessage, setToastMessage] = useState('Action applied');

  const styles = getStyles(colors);

  async function handleAction(newStatus: string, undoFn?: () => Promise<void>) {
    setActionLoading(true);
    try {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'contacted') {
        updates.contacted_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', lead.id);

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      if (undoFn) {
        setUndoAction(() => undoFn);
        setToastMessage(`Status changed to ${newStatus}`);
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
              setToastMessage(`Rejected: ${r}`);
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

  function handleContacted() {
    Alert.alert(
      'Mark as Contacted',
      `Mark ${lead.lead_code} · ${lead.title.slice(0, 60)} as Contacted?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Contacted',
          onPress: () => void handleAction('contacted', async () => {
            await supabase.from('leads').update({ status: lead.status, contacted_at: null }).eq('id', lead.id);
            onRefresh();
          }),
        },
      ]
    );
  }

  function handleWon() {
    Alert.alert(
      'Convert to Deal (Won)',
      `Mark ${lead.lead_code} · ${lead.title.slice(0, 60)} as Won and convert to Deal?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert to Won',
          onPress: async () => {
            setActionLoading(true);
            try {
              // 1. Update lead status
              await supabase.from('leads').update({ status: 'won' }).eq('id', lead.id);

              // 2. Insert into deals idempotently
              const clientName = lead.business_name || (lead.module === 'maps' ? 'Local Business' : 'Web Client');
              const { error: dealError } = await supabase.from('deals').upsert(
                {
                  lead_id: lead.id,
                  deal_code: lead.lead_code,
                  client: clientName,
                  project: lead.title.slice(0, 100),
                  value: lead.budget_amount ?? null,
                  currency: lead.currency ?? 'USD',
                  payment_status: 'unpaid',
                  state: 'live',
                  start_date: new Date().toISOString().slice(0, 10),
                  notes: lead.notes ?? null,
                },
                { onConflict: 'lead_id' }
              );

              if (dealError) throw dealError;

              setToastMessage(`Converted to Deal (${lead.lead_code})`);
              setShowUndo(true);
              const t = setTimeout(() => { setShowUndo(false); onRefresh(); }, 5000);
              setUndoTimeout(t);
              setUndoAction(() => async () => {
                await supabase.from('deals').delete().eq('lead_id', lead.id);
                await supabase.from('leads').update({ status: lead.status }).eq('id', lead.id);
                onRefresh();
              });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to convert to deal';
              Alert.alert('Error', msg);
            } finally {
              setActionLoading(false);
            }
          },
        },
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

  async function handleSetFollowUp(daysAhead: number | null) {
    setShowFollowUpPicker(false);
    setActionLoading(true);
    try {
      let targetIso: string | null = null;
      if (daysAhead !== null) {
        const d = new Date();
        d.setDate(d.getDate() + daysAhead);
        targetIso = d.toISOString();
      }
      await supabase.from('leads').update({ follow_up_at: targetIso }).eq('id', lead.id);
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  }

  function handleCopyDraft() {
    if (!lead.draft_line) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(lead.draft_line);
      Alert.alert('Copied', 'Opening draft line copied to clipboard.');
    } else {
      Alert.alert('Draft Opening Line', lead.draft_line);
    }
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
        <View style={styles.mapsContainer}>
          <View style={styles.metaRow}>
            <Text style={styles.metaText} accessibilityLabel={`Business: ${lead.business_name ?? ''}`}>🏢 {lead.business_name}</Text>
            {lead.city && <Text style={styles.metaText} accessibilityLabel={`City: ${lead.city}`}>📍 {lead.city}</Text>}
            <Text style={styles.attributionText} accessibilityLabel="Found via OpenStreetMap">
              Found via: OpenStreetMap
            </Text>
          </View>

          {lead.address && (
            <Text style={styles.addressText} accessibilityLabel={`Address: ${lead.address}`}>
              🏠 {lead.address}
            </Text>
          )}

          <View style={styles.statusPillsRow}>
            <View style={[styles.pillBadge, { backgroundColor: lead.website_status === 'none' ? colors.error + '20' : colors.warning + '20' }]}>
              <Text style={[styles.pillBadgeText, { color: lead.website_status === 'none' ? colors.error : colors.warning }]}>
                {lead.website_status === 'none' ? '🚫 No Website' : '📱 Social Only'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.verifiedChip, lead.verified_no_website && styles.verifiedChipActive]}
              onPress={async () => {
                await supabase.from('leads').update({ verified_no_website: !lead.verified_no_website }).eq('id', lead.id);
                onRefresh();
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: lead.verified_no_website }}
              accessibilityLabel="I verified no website"
            >
              <Text style={[styles.verifiedChipText, lead.verified_no_website && styles.verifiedChipTextActive]}>
                {lead.verified_no_website ? '✓ Verified No Website' : '☐ I verified no website'}
              </Text>
            </TouchableOpacity>
          </View>

          {lead.suggested_offer && (
            <Text style={styles.suggestedOfferText} accessibilityLabel={`Suggested offer: ${lead.suggested_offer}`}>
              💡 Suggested: {lead.suggested_offer}
            </Text>
          )}

          {/* Social and Verification Search Buttons */}
          <View style={styles.socialButtonsRow}>
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => openUrl(`https://www.google.com/search?q=${encodeURIComponent((lead.business_name || '') + ' ' + (lead.city || '') + ' facebook')}`)}
              accessibilityRole="link"
              accessibilityLabel="Find on Facebook"
            >
              <Text style={styles.socialBtnText}>FB Search</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => openUrl(`https://www.google.com/search?q=${encodeURIComponent((lead.business_name || '') + ' ' + (lead.city || '') + ' instagram')}`)}
              accessibilityRole="link"
              accessibilityLabel="Find on Instagram"
            >
              <Text style={styles.socialBtnText}>IG Search</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => openUrl(`https://www.google.com/search?q=${encodeURIComponent((lead.business_name || '') + ' ' + (lead.city || '') + ' linkedin')}`)}
              accessibilityRole="link"
              accessibilityLabel="Find on LinkedIn"
            >
              <Text style={styles.socialBtnText}>LinkedIn</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.socialBtn, { backgroundColor: colors.primary + '20' }]}
              onPress={() => openUrl(`https://www.google.com/search?q=${encodeURIComponent((lead.business_name || '') + ' ' + (lead.city || '') + ' official website')}`)}
              accessibilityRole="link"
              accessibilityLabel="Verify business on Google"
            >
              <Text style={[styles.socialBtnText, { color: colors.primary }]}>🔍 Verify</Text>
            </TouchableOpacity>
          </View>
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

      {/* Follow-up badge if set */}
      {lead.follow_up_at && (
        <Text style={styles.followUpText} accessibilityLabel={`Follow-up scheduled for: ${lead.follow_up_at.slice(0, 10)}`}>
          📅 Follow-up: {lead.follow_up_at.slice(0, 10)}
        </Text>
      )}

      {/* Found at */}
      <Text style={styles.timestamp} accessibilityLabel={`Found ${formatRelativeTime(lead.found_at)}`}>
        🕐 {formatRelativeTime(lead.found_at)}
      </Text>

      {/* Draft line */}
      {lead.draft_line && (
        <View style={styles.draftContainer}>
          <Text style={styles.draftLine} accessibilityLabel={`Draft opening: ${lead.draft_line}`}>
            ✏️ {lead.draft_line}
          </Text>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={handleCopyDraft}
            accessibilityRole="button"
            accessibilityLabel="Copy draft line"
          >
            <Text style={styles.copyButtonText}>Copy</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Follow-up quick picker */}
      {showFollowUpPicker && (
        <View style={styles.pickerRow}>
          <TouchableOpacity
            style={styles.pickerChip}
            onPress={() => void handleSetFollowUp(1)}
            accessibilityRole="button"
            accessibilityLabel="Follow up tomorrow"
          >
            <Text style={styles.pickerChipText}>+1 Day</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pickerChip}
            onPress={() => void handleSetFollowUp(3)}
            accessibilityRole="button"
            accessibilityLabel="Follow up in 3 days"
          >
            <Text style={styles.pickerChipText}>+3 Days</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pickerChip}
            onPress={() => void handleSetFollowUp(7)}
            accessibilityRole="button"
            accessibilityLabel="Follow up in 1 week"
          >
            <Text style={styles.pickerChipText}>+7 Days</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pickerChip, { backgroundColor: colors.muted }]}
            onPress={() => void handleSetFollowUp(null)}
            accessibilityRole="button"
            accessibilityLabel="Clear follow-up"
          >
            <Text style={[styles.pickerChipText, { color: colors.error }]}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        {lead.status !== 'acceptable' && lead.status !== 'won' && (
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
        {lead.status !== 'contacted' && lead.status !== 'won' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handleContacted}
            disabled={actionLoading}
            accessibilityRole="button"
            accessibilityLabel={`Mark lead ${lead.lead_code} as Contacted`}
          >
            <Text style={styles.actionButtonText}>Contacted</Text>
          </TouchableOpacity>
        )}
        {lead.status !== 'won' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#8B5CF6' }]}
            onPress={handleWon}
            disabled={actionLoading}
            accessibilityRole="button"
            accessibilityLabel={`Mark lead ${lead.lead_code} as Won`}
          >
            <Text style={styles.actionButtonText}>Won</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.secondary }]}
          onPress={() => setShowFollowUpPicker(!showFollowUpPicker)}
          accessibilityRole="button"
          accessibilityLabel={`Set follow up for ${lead.lead_code}`}
        >
          <Text style={[styles.actionButtonText, { color: colors.secondaryForeground }]}>
            {lead.follow_up_at ? 'Reschedule' : 'Follow-up'}
          </Text>
        </TouchableOpacity>
        {lead.status !== 'rejected' && lead.status !== 'won' && (
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
        <View style={styles.undoToast} accessibilityLiveRegion="polite" accessibilityLabel={`${toastMessage}. Tap Undo to reverse.`}>
          <Text style={styles.undoText}>{toastMessage}</Text>
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
    mapsContainer: { gap: 4, marginBottom: 6 },
    addressText: { fontSize: 12, color: colors.textSecondary },
    statusPillsRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginVertical: 4 },
    pillBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    pillBadgeText: { fontSize: 11, fontWeight: '700' },
    verifiedChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.muted },
    verifiedChipActive: { backgroundColor: colors.success + '20', borderColor: colors.success },
    verifiedChipText: { fontSize: 11, color: colors.textSecondary },
    verifiedChipTextActive: { color: colors.success, fontWeight: '700' },
    suggestedOfferText: { fontSize: 12, color: colors.text, fontStyle: 'italic', backgroundColor: colors.muted, padding: 6, borderRadius: 6, marginVertical: 4 },
    socialButtonsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginVertical: 4 },
    socialBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.muted },
    socialBtnText: { fontSize: 11, fontWeight: '600', color: colors.text },
    redFlagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
    redFlagChip: { backgroundColor: colors.error + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    redFlagText: { fontSize: 11, color: colors.error },
    followUpText: { fontSize: 12, color: colors.primary, fontWeight: '600', marginBottom: 4 },
    timestamp: { fontSize: 12, color: colors.mutedForeground, marginBottom: 4 },
    draftContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.muted, borderRadius: 6, padding: 8, marginBottom: 8 },
    draftLine: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', flex: 1 },
    copyButton: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.primary, borderRadius: 4, marginLeft: 8 },
    copyButtonText: { color: colors.primaryForeground, fontSize: 11, fontWeight: '600' },
    pickerRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
    pickerChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.primary + '20' },
    pickerChipText: { fontSize: 12, fontWeight: '600', color: colors.primary },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    actionButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    actionButtonText: { fontSize: 12, fontWeight: '600', color: '#fff' },
    undoToast: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, padding: 8, backgroundColor: colors.secondary, borderRadius: 6 },
    undoText: { color: colors.text, fontSize: 13 },
    undoButton: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  });
}
