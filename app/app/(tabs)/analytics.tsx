import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { supabase } from '../../src/lib/supabase';
import {
  type LeadAnalyticsItem,
  type DealAnalyticsItem,
  calculateKpis,
  aggregateFunnel,
  aggregateLeadsPerDay,
  aggregateByAttribute,
  aggregateScoreDistribution,
  aggregateAcceptedVsRejected,
  aggregateDealsOverTime,
  filterLeadsByModule,
  filterItemsByDateRange,
} from '../../src/utils/analytics';

type DateRange = 'today' | '7d' | '30d' | 'custom';
type ModuleFilter = 'all' | 'web' | 'maps';

export default function AnalyticsScreen() {
  const { colors } = useTheme();

  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('all');
  const [customDays, setCustomDays] = useState('14');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const [leads, setLeads] = useState<LeadAnalyticsItem[]>([]);
  const [deals, setDeals] = useState<DealAnalyticsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setErrorMsg(null);
      // Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, lead_code, module, source, found_at, status, scored, score, country, niche, reject_reason, deleted_at, archived_at')
        .order('found_at', { ascending: false });

      if (leadsError) {
        throw new Error(leadsError.message);
      }

      // Fetch deals
      const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select('id, lead_id, value, currency, payment_status, state, created_at, completed_at')
        .order('created_at', { ascending: false });

      if (dealsError) {
        throw new Error(dealsError.message);
      }

      const formattedLeads: LeadAnalyticsItem[] = ((leadsData as Record<string, unknown>[]) || []).map((l) => ({
        id: String(l.id || ''),
        lead_code: String(l.lead_code || ''),
        module: (l.module === 'maps' ? 'maps' : 'web') as 'web' | 'maps',
        source: String(l.source || ''),
        found_at: String(l.found_at || ''),
        status: (l.status as LeadAnalyticsItem['status']) || 'new',
        scored: Boolean(l.scored),
        score: l.score != null ? Number(l.score) : null,
        country: l.country ? String(l.country) : null,
        niche: l.niche ? String(l.niche) : null,
        reject_reason: l.reject_reason ? String(l.reject_reason) : null,
        deleted_at: l.deleted_at ? String(l.deleted_at) : null,
        archived_at: l.archived_at ? String(l.archived_at) : null,
      }));

      const formattedDeals: DealAnalyticsItem[] = ((dealsData as Record<string, unknown>[]) || []).map((d) => ({
        id: String(d.id || ''),
        lead_code: String(d.lead_id || ''),
        value: Number(d.value) || 0,
        currency: String(d.currency || 'USD'),
        payment_status: (d.payment_status as DealAnalyticsItem['payment_status']) || 'unpaid',
        completed: d.state === 'completed',
        completed_at: d.completed_at ? String(d.completed_at) : null,
        created_at: String(d.created_at || ''),
      }));

      setLeads(formattedLeads);
      setDeals(formattedDeals);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load analytics data';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Filter leads based on selected module and date range
  const customDaysNum = Math.max(1, parseInt(customDays, 10) || 14);
  const customStartDate = dateRange === 'custom'
    ? new Date(Date.now() - customDaysNum * 24 * 60 * 60 * 1000)
    : undefined;

  const moduleFilteredLeads = filterLeadsByModule(leads, moduleFilter);
  const filteredLeads = filterItemsByDateRange(
    moduleFilteredLeads,
    dateRange,
    { dateKey: 'found_at', customStart: customStartDate }
  );

  const filteredDeals = filterItemsByDateRange(
    deals,
    dateRange,
    { dateKey: 'created_at', customStart: customStartDate }
  );

  // Computations
  const kpis = calculateKpis(filteredLeads, filteredDeals);
  const funnel = aggregateFunnel(filteredLeads);
  const daysForBuckets = dateRange === 'today' ? 1 : dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : customDaysNum;
  const leadsPerDay = aggregateLeadsPerDay(filteredLeads, Math.min(daysForBuckets, 14));
  const sources = aggregateByAttribute(filteredLeads, 'source', 5);
  const countries = aggregateByAttribute(filteredLeads, 'country', 5);
  const niches = aggregateByAttribute(filteredLeads, 'niche', 5);
  const scoreDist = aggregateScoreDistribution(filteredLeads);
  const acceptedVsRejected = aggregateAcceptedVsRejected(filteredLeads);
  const dealsOverTime = aggregateDealsOverTime(filteredDeals, Math.min(daysForBuckets, 14));

  const maxDailyCount = Math.max(1, ...leadsPerDay.map((d) => d.count));
  const maxFunnelCount = Math.max(1, funnel.newCount, funnel.acceptableCount, funnel.contactedCount, funnel.repliedCount, funnel.wonCount);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Analytics Dashboard</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Pipeline performance and lead conversion metrics
        </Text>
      </View>

      {/* Module Selector */}
      <View
        style={[styles.filterRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="tablist"
        accessibilityLabel="Filter by module"
      >
        {(['all', 'web', 'maps'] as ModuleFilter[]).map((m) => {
          const isSelected = moduleFilter === m;
          const label = m === 'all' ? 'All Modules' : m === 'web' ? 'Web Leads' : 'Maps Leads';
          return (
            <TouchableOpacity
              key={m}
              style={[
                styles.filterTab,
                isSelected && { backgroundColor: colors.primary },
              ]}
              onPress={() => setModuleFilter(m)}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: isSelected ? colors.primaryForeground : colors.textSecondary },
                ]}
              >
                {m === 'all' ? 'Both' : m.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Date Range Selector */}
      <View
        style={[styles.filterRow, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 8 }]}
        accessibilityRole="tablist"
        accessibilityLabel="Filter by date range"
      >
        {(['today', '7d', '30d', 'custom'] as DateRange[]).map((r) => {
          const isSelected = dateRange === r;
          const label = r === 'today' ? 'Today' : r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'Custom';
          return (
            <TouchableOpacity
              key={r}
              style={[
                styles.filterTab,
                isSelected && { backgroundColor: colors.primary },
              ]}
              onPress={() => {
                setDateRange(r);
                setShowCustomInput(r === 'custom');
              }}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: isSelected ? colors.primaryForeground : colors.textSecondary },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Custom Days Input */}
      {showCustomInput && (
        <View style={[styles.customRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.customLabel, { color: colors.textSecondary }]}>Past days:</Text>
          <TextInput
            style={[styles.customInput, { color: colors.text, borderColor: colors.border }]}
            value={customDays}
            onChangeText={setCustomDays}
            keyboardType="number-pad"
            accessibilityLabel="Enter number of past days"
          />
        </View>
      )}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading analytics...</Text>
        </View>
      ) : errorMsg ? (
        <View style={[styles.errorCard, { backgroundColor: colors.surface, borderColor: colors.error }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>{errorMsg}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={fetchData}
            accessibilityLabel="Retry loading data"
            accessibilityRole="button"
          >
            <Text style={{ color: colors.primaryForeground, fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Key Numbers / KPIs Grid */}
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Useful-Lead Rate</Text>
              <Text style={[styles.kpiValue, { color: colors.text }]}>{kpis.usefulLeadRate}%</Text>
              <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>Acceptable or won</Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Reply Rate</Text>
              <Text style={[styles.kpiValue, { color: colors.text }]}>{kpis.replyRate}%</Text>
              <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>Replied / Contacted</Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Win Rate</Text>
              <Text style={[styles.kpiValue, { color: colors.text }]}>{kpis.winRate}%</Text>
              <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>Won / Total closed</Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Closed Revenue</Text>
              <Text style={[styles.kpiValue, { color: colors.success }]}>${kpis.totalRevenue.toLocaleString()}</Text>
              <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>Pipeline: ${kpis.totalPipeline.toLocaleString()}</Text>
            </View>
          </View>

          {/* Lead Status Funnel */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Lead Qualification Funnel</Text>
            <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>Progression across pipeline stages</Text>

            <View style={styles.funnelContainer}>
              {[
                { stage: 'New', count: funnel.newCount, color: colors.primary },
                { stage: 'Acceptable', count: funnel.acceptableCount, color: colors.score.medium },
                { stage: 'Contacted', count: funnel.contactedCount, color: '#8B5CF6' },
                { stage: 'Replied', count: funnel.repliedCount, color: '#EC4899' },
                { stage: 'Won', count: funnel.wonCount, color: colors.success },
              ].map((step) => {
                const widthPercent = Math.max(6, Math.round((step.count / maxFunnelCount) * 100));
                return (
                  <View
                    key={step.stage}
                    style={styles.funnelRow}
                    accessibilityLabel={`${step.stage}: ${step.count} leads`}
                  >
                    <Text style={[styles.funnelStage, { color: colors.text }]}>{step.stage}</Text>
                    <View style={styles.funnelBarTrack}>
                      <View
                        style={[
                          styles.funnelBarFill,
                          { width: `${widthPercent}%`, backgroundColor: step.color },
                        ]}
                      />
                    </View>
                    <Text style={[styles.funnelCount, { color: colors.text }]}>{step.count}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Leads Per Day */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Leads Found Per Day</Text>
            <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>Daily volume split by module</Text>

            <View style={styles.chartContainer}>
              {leadsPerDay.map((d) => {
                const barHeightPercent = Math.max(8, Math.round((d.count / maxDailyCount) * 100));
                const dayLabel = d.date.slice(5); // MM-DD
                return (
                  <View
                    key={d.date}
                    style={styles.barColumn}
                    accessibilityLabel={`${d.date}: ${d.count} total (${d.webCount} web, ${d.mapsCount} maps)`}
                  >
                    <Text style={[styles.barValueText, { color: colors.textSecondary }]}>{d.count}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { height: `${barHeightPercent}%`, backgroundColor: colors.primary },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barDateText, { color: colors.textSecondary }]}>{dayLabel}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Score Distribution */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Score Distribution</Text>
            <View style={styles.scoreRow}>
              <View style={[styles.scorePill, { backgroundColor: colors.score.high + '22', borderColor: colors.score.high }]}>
                <Text style={[styles.scorePillTitle, { color: colors.score.high }]}>High (75-100)</Text>
                <Text style={[styles.scorePillCount, { color: colors.score.high }]}>{scoreDist.high}</Text>
              </View>
              <View style={[styles.scorePill, { backgroundColor: colors.score.medium + '22', borderColor: colors.score.medium }]}>
                <Text style={[styles.scorePillTitle, { color: colors.score.medium }]}>Med (50-74)</Text>
                <Text style={[styles.scorePillCount, { color: colors.score.medium }]}>{scoreDist.medium}</Text>
              </View>
              <View style={[styles.scorePill, { backgroundColor: colors.score.low + '22', borderColor: colors.score.low }]}>
                <Text style={[styles.scorePillTitle, { color: colors.score.low }]}>Low (0-49)</Text>
                <Text style={[styles.scorePillCount, { color: colors.score.low }]}>{scoreDist.low}</Text>
              </View>
              <View style={[styles.scorePill, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[styles.scorePillTitle, { color: colors.mutedForeground }]}>Unscored</Text>
                <Text style={[styles.scorePillCount, { color: colors.mutedForeground }]}>{scoreDist.unscored}</Text>
              </View>
            </View>
          </View>

          {/* Accepted vs Rejected Comparison */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Accepted vs Rejected</Text>
            <View style={styles.ratioContainer}>
              <View style={[styles.ratioBox, { backgroundColor: colors.success + '15' }]}>
                <Text style={[styles.ratioTitle, { color: colors.success }]}>Accepted / In Pipeline</Text>
                <Text style={[styles.ratioNumber, { color: colors.success }]}>{acceptedVsRejected.accepted}</Text>
              </View>
              <View style={[styles.ratioBox, { backgroundColor: colors.error + '15' }]}>
                <Text style={[styles.ratioTitle, { color: colors.error }]}>Rejected</Text>
                <Text style={[styles.ratioNumber, { color: colors.error }]}>{acceptedVsRejected.rejected}</Text>
              </View>
              <View style={[styles.ratioBox, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.ratioTitle, { color: colors.primary }]}>Pending Review</Text>
                <Text style={[styles.ratioNumber, { color: colors.primary }]}>{acceptedVsRejected.pending}</Text>
              </View>
            </View>
          </View>

          {/* Top Sources */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Top Lead Sources</Text>
            {sources.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No sources found in range</Text>
            ) : (
              sources.map((s) => (
                <View key={s.label} style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: colors.text }]}>{s.label}</Text>
                  <Text style={[styles.breakdownValue, { color: colors.textSecondary }]}>
                    {s.count} ({s.percentage}%)
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Top Countries */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Geographic Distribution</Text>
            {countries.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No country data</Text>
            ) : (
              countries.map((c) => (
                <View key={c.label} style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: colors.text }]}>{c.label}</Text>
                  <Text style={[styles.breakdownValue, { color: colors.textSecondary }]}>
                    {c.count} ({c.percentage}%)
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Top Niches */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Top Niches</Text>
            {niches.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No niche data</Text>
            ) : (
              niches.map((n) => (
                <View key={n.label} style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: colors.text }]}>{n.label}</Text>
                  <Text style={[styles.breakdownValue, { color: colors.textSecondary }]}>
                    {n.count} ({n.percentage}%)
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Deal Value Over Time */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Deal Revenue Trend</Text>
            <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>Closed revenue over time</Text>

            <View style={styles.dealTimeline}>
              {dealsOverTime.map((item) => (
                <View key={item.date} style={styles.dealRow}>
                  <Text style={[styles.dealDate, { color: colors.textSecondary }]}>{item.date.slice(5)}</Text>
                  <Text style={[styles.dealRev, { color: colors.success }]}>${item.revenue.toLocaleString()}</Text>
                  <Text style={[styles.dealCum, { color: colors.mutedForeground }]}>
                    Cumul: ${item.cumulativeRevenue.toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  customLabel: {
    fontSize: 13,
    marginRight: 8,
  },
  customInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 60,
    textAlign: 'center',
    fontSize: 13,
  },
  loadingContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  kpiCard: {
    width: '48.5%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 11,
    marginTop: 2,
  },
  card: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  funnelContainer: {
    gap: 8,
  },
  funnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  funnelStage: {
    width: 80,
    fontSize: 12,
    fontWeight: '600',
  },
  funnelBarTrack: {
    flex: 1,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  funnelBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  funnelCount: {
    width: 32,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '600',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingTop: 16,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValueText: {
    fontSize: 10,
    marginBottom: 2,
  },
  barTrack: {
    width: 14,
    height: 70,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  barDateText: {
    fontSize: 9,
    marginTop: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  scorePill: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  scorePillTitle: {
    fontSize: 11,
    fontWeight: '600',
  },
  scorePillCount: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  ratioContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  ratioBox: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  ratioTitle: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  ratioNumber: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  breakdownLabel: {
    fontSize: 13,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  dealTimeline: {
    gap: 6,
    marginTop: 8,
  },
  dealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  dealDate: {
    fontSize: 12,
    width: 50,
  },
  dealRev: {
    fontSize: 12,
    fontWeight: '700',
    width: 70,
  },
  dealCum: {
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
});
