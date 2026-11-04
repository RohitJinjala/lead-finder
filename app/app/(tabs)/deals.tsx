import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { supabase } from '../../src/lib/supabase';

interface Deal {
  id: string;
  lead_id: string;
  deal_code: string;
  client: string;
  project: string;
  value: number | null;
  currency: string;
  start_date: string | null;
  deadline: string | null;
  payment_status: 'unpaid' | 'partial' | 'paid';
  state: 'live' | 'completed';
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

export default function DealsScreen() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<'live' | 'completed'>('live');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [undoToast, setUndoToast] = useState<string | null>(null);

  useEffect(() => {
    fetchDeals();
  }, [tab]);

  async function fetchDeals() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('state', tab)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeals((data as Deal[]) ?? []);
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setUndoToast(msg);
    setTimeout(() => {
      setUndoToast(null);
    }, 4000);
  }

  function handleMarkComplete(deal: Deal) {
    const isUnpaid = deal.payment_status !== 'paid';

    const buttons: Array<{ text: string; style?: 'cancel' | 'default' | 'destructive'; onPress?: () => void }> = [
      { text: 'Cancel', style: 'cancel' },
    ];

    if (isUnpaid) {
      buttons.push({
        text: 'Complete & Mark Paid',
        onPress: async () => {
          setLoading(true);
          try {
            const { error } = await supabase
              .from('deals')
              .update({
                state: 'completed',
                payment_status: 'paid',
                completed_at: new Date().toISOString(),
              })
              .eq('id', deal.id);

            if (error) throw error;
            await fetchDeals();
            showToast(`Marked ${deal.deal_code} as Completed & Paid`);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to update deal';
            Alert.alert('Error', msg);
          } finally {
            setLoading(false);
          }
        },
      });
    }

    buttons.push({
      text: 'Mark Complete',
      onPress: async () => {
        setLoading(true);
        try {
          const { error } = await supabase
            .from('deals')
            .update({
              state: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', deal.id);

          if (error) throw error;
          await fetchDeals();
          showToast(`Marked ${deal.deal_code} as Completed`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to update deal';
          Alert.alert('Error', msg);
        } finally {
          setLoading(false);
        }
      },
    });

    Alert.alert(
      'Complete Deal',
      `Mark "${deal.deal_code} · ${deal.project}" as Completed?${isUnpaid ? ' (Optional: mark final payment received)' : ''}`,
      buttons
    );
  }

  const filteredDeals = deals.filter((d) => {
    if (paymentFilter === 'all') return true;
    return d.payment_status === paymentFilter;
  });

  const totalValue = filteredDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);

  const styles = getStyles(colors);

  return (
    <View style={styles.container} accessibilityLabel="Deals Screen">
      {/* Undo Toast */}
      {undoToast && (
        <View style={styles.undoToast} accessibilityLiveRegion="polite">
          <Text style={styles.undoToastText}>{undoToast}</Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabBar} accessibilityRole="tablist" accessibilityLabel="Deals state tabs">
        <TouchableOpacity
          style={[styles.tab, tab === 'live' && styles.tabActive]}
          onPress={() => setTab('live')}
          accessibilityRole="tab"
          accessibilityLabel="Live Deals Tab"
          accessibilityState={{ selected: tab === 'live' }}
        >
          <Text style={[styles.tabText, tab === 'live' && styles.tabTextActive]}>Live Deals</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, tab === 'completed' && styles.tabActive]}
          onPress={() => setTab('completed')}
          accessibilityRole="tab"
          accessibilityLabel="Completed Deals Tab"
          accessibilityState={{ selected: tab === 'completed' }}
        >
          <Text style={[styles.tabText, tab === 'completed' && styles.tabTextActive]}>Completed</Text>
        </TouchableOpacity>
      </View>

      {/* Summary KPI Bar */}
      <View style={styles.summaryBar}>
        <View>
          <Text style={styles.summaryLabel}>
            {tab === 'live' ? 'Pipeline Value' : 'Closed Revenue'}
          </Text>
          <Text style={styles.summaryVal}>
            ${totalValue.toLocaleString()} ({filteredDeals.length} deals)
          </Text>
        </View>

        {/* Payment Filter Chips */}
        <View style={styles.chipRow}>
          {['all', 'unpaid', 'partial', 'paid'].map((pf) => (
            <TouchableOpacity
              key={pf}
              style={[styles.filterChip, paymentFilter === pf && styles.filterChipActive]}
              onPress={() => setPaymentFilter(pf)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  paymentFilter === pf && styles.filterChipTextActive,
                ]}
              >
                {pf.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Deals List */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : filteredDeals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {tab === 'live' ? 'No live deals currently.' : 'No completed deals yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredDeals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.dealCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.dealCode}>{item.deal_code}</Text>
                  <Text style={styles.projectTitle}>{item.project}</Text>
                  <Text style={styles.clientName}>Client: {item.client}</Text>
                </View>

                <View style={styles.valueCol}>
                  <Text style={styles.dealValue}>
                    {item.value ? `${item.currency} ${item.value.toLocaleString()}` : 'Custom'}
                  </Text>
                  <View
                    style={[
                      styles.paymentBadge,
                      item.payment_status === 'paid' && styles.badgePaid,
                      item.payment_status === 'partial' && styles.badgePartial,
                      item.payment_status === 'unpaid' && styles.badgeUnpaid,
                    ]}
                  >
                    <Text style={styles.paymentBadgeText}>{item.payment_status.toUpperCase()}</Text>
                  </View>
                </View>
              </View>

              {item.notes && <Text style={styles.notesText}>{item.notes}</Text>}

              <View style={styles.cardFooter}>
                <Text style={styles.dateText}>
                  {item.deadline ? `Deadline: ${item.deadline}` : `Started: ${item.start_date || item.created_at.slice(0, 10)}`}
                </Text>

                {item.state === 'live' && (
                  <TouchableOpacity
                    style={styles.completeBtn}
                    onPress={() => handleMarkComplete(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Mark deal ${item.deal_code} complete`}
                  >
                    <Text style={styles.completeBtnText}>✓ Complete Deal</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    undoToast: {
      backgroundColor: colors.primary,
      padding: 10,
      margin: 10,
      borderRadius: 8,
      alignItems: 'center',
    },
    undoToastText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabText: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground },
    tabTextActive: { color: colors.primary },
    summaryBar: {
      padding: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
    },
    summaryLabel: { fontSize: 12, color: colors.mutedForeground, fontWeight: '500' },
    summaryVal: { fontSize: 18, fontWeight: '700', color: colors.text },
    chipRow: { flexDirection: 'row', gap: 6 },
    filterChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: colors.muted,
    },
    filterChipActive: { backgroundColor: colors.primary },
    filterChipText: { fontSize: 10, fontWeight: '700', color: colors.text },
    filterChipTextActive: { color: '#ffffff' },
    list: { padding: 14, gap: 12 },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyText: { color: colors.mutedForeground, fontSize: 14 },
    dealCard: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    dealCode: { fontSize: 12, fontWeight: '700', color: colors.primary },
    projectTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
    clientName: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    valueCol: { alignItems: 'flex-end', gap: 4 },
    dealValue: { fontSize: 15, fontWeight: '700', color: colors.text },
    paymentBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    badgePaid: { backgroundColor: '#dcfce7' },
    badgePartial: { backgroundColor: '#fef3c7' },
    badgeUnpaid: { backgroundColor: '#fee2e2' },
    paymentBadgeText: { fontSize: 10, fontWeight: '700', color: colors.text },
    notesText: { fontSize: 12, color: colors.mutedForeground, fontStyle: 'italic' },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    dateText: { fontSize: 11, color: colors.mutedForeground },
    completeBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
    },
    completeBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  });
}
