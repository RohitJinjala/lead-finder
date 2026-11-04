import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { supabase } from '../../src/lib/supabase';
import type { Lead } from '../../src/types/lead';

export default function CalendarScreen() {
  const { colors } = useTheme();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [viewMode, setViewMode] = useState<'month' | 'day'>('month');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLeadsForCalendar();
  }, []);

  async function fetchLeadsForCalendar() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .is('deleted_at', null)
        .order('found_at', { ascending: false });

      if (error) throw error;
      setLeads((data as unknown as Lead[]) ?? []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  // Leads due today
  const dueToday = leads.filter(
    (l) => l.follow_up_at && l.follow_up_at.slice(0, 10) === todayStr
  );

  // Selected date events
  const foundOnDate = leads.filter((l) => l.found_at && l.found_at.slice(0, 10) === selectedDate);
  const contactedOnDate = leads.filter((l) => l.contacted_at && l.contacted_at.slice(0, 10) === selectedDate);
  const dueOnDate = leads.filter((l) => l.follow_up_at && l.follow_up_at.slice(0, 10) === selectedDate);

  async function setQuickFollowUp(leadId: string, daysAhead: number) {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysAhead);
    try {
      await supabase
        .from('leads')
        .update({ follow_up_at: nextDate.toISOString() })
        .eq('id', leadId);
      await fetchLeadsForCalendar();
    } catch {
      // Ignore
    }
  }

  // Month grid helpers
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: Array<{ dayNumber: number; dateStr: string } | null> = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    calendarDays.push({ dayNumber: d, dateStr: `${year}-${mm}-${dd}` });
  }

  const styles = getStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header and View Mode Switcher */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.screenTitle}>Calendar & Schedule</Text>
          <Text style={styles.screenSubtitle}>
            Track found dates, client touchpoints, and scheduled follow-ups.
          </Text>
        </View>

        <View style={styles.viewToggleGroup}>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === 'month' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('month')}
            accessibilityRole="button"
            accessibilityLabel="Month View"
          >
            <Text style={[styles.viewToggleText, viewMode === 'month' && styles.viewToggleTextActive]}>
              Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === 'day' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('day')}
            accessibilityRole="button"
            accessibilityLabel="Day View"
          >
            <Text style={[styles.viewToggleText, viewMode === 'day' && styles.viewToggleTextActive]}>
              Day
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Due Today Section */}
      <View style={styles.dueTodayCard} accessibilityLabel="Due Today Section">
        <View style={styles.dueTodayHeader}>
          <Text style={styles.dueTodayTitle}>🚨 Due Today ({dueToday.length})</Text>
          <Text style={styles.todayDate}>{todayStr}</Text>
        </View>

        {dueToday.length === 0 ? (
          <Text style={styles.noDueText}>No follow-ups due today. You are all caught up!</Text>
        ) : (
          dueToday.map((item) => (
            <View key={item.id} style={styles.dueItem}>
              <View style={styles.dueInfo}>
                <Text style={styles.dueCode}>{item.lead_code}</Text>
                <Text style={styles.dueTitle} numberOfLines={1}>
                  {item.title || item.business_name}
                </Text>
              </View>

              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => setQuickFollowUp(item.id, 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Postpone 1 day"
                >
                  <Text style={styles.quickBtnText}>+1d</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => setQuickFollowUp(item.id, 3)}
                  accessibilityRole="button"
                  accessibilityLabel="Postpone 3 days"
                >
                  <Text style={styles.quickBtnText}>+3d</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Month View Grid */}
      {viewMode === 'month' && (
        <View style={styles.monthCard} accessibilityLabel="Month Calendar Grid">
          <View style={styles.monthHeaderRow}>
            <TouchableOpacity
              onPress={() => setCurrentMonth(new Date(year, month - 1, 1))}
              accessibilityRole="button"
              accessibilityLabel="Previous Month"
              style={styles.navArrowBtn}
            >
              <Text style={styles.navArrowText}>◀</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitleText}>{monthName}</Text>
            <TouchableOpacity
              onPress={() => setCurrentMonth(new Date(year, month + 1, 1))}
              accessibilityRole="button"
              accessibilityLabel="Next Month"
              style={styles.navArrowBtn}
            >
              <Text style={styles.navArrowText}>▶</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekDaysRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
              <Text key={w} style={styles.weekDayHeader}>{w}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarDays.map((cell, idx) => {
              if (!cell) {
                return <View key={`empty-${idx}`} style={styles.emptyDayCell} />;
              }
              const isSelected = cell.dateStr === selectedDate;
              const isToday = cell.dateStr === todayStr;
              const hasDue = leads.some((l) => l.follow_up_at?.slice(0, 10) === cell.dateStr);
              const hasTouch = leads.some((l) => l.contacted_at?.slice(0, 10) === cell.dateStr);

              return (
                <TouchableOpacity
                  key={cell.dateStr}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isToday && !isSelected && styles.dayCellToday,
                  ]}
                  onPress={() => setSelectedDate(cell.dateStr)}
                  accessibilityRole="button"
                  accessibilityLabel={`Date ${cell.dateStr}`}
                >
                  <Text
                    style={[
                      styles.dayCellText,
                      isSelected && styles.dayCellTextSelected,
                      isToday && !isSelected && styles.dayCellTextToday,
                    ]}
                  >
                    {cell.dayNumber}
                  </Text>
                  <View style={styles.indicatorRow}>
                    {hasDue && <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />}
                    {hasTouch && <View style={[styles.dot, { backgroundColor: '#3b82f6' }]} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Date Navigator Bar */}
      <View style={styles.dateBar}>
        <TouchableOpacity
          style={styles.dateNavBtn}
          onPress={() => {
            const prev = new Date(selectedDate);
            prev.setDate(prev.getDate() - 1);
            setSelectedDate(prev.toISOString().slice(0, 10));
          }}
          accessibilityRole="button"
          accessibilityLabel="Previous Day"
        >
          <Text style={styles.dateNavText}>◀ Prev</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateDisplayBtn}
          onPress={() => {
            setSelectedDate(todayStr);
            const d = new Date();
            setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
          }}
          accessibilityRole="button"
          accessibilityLabel="Jump to Today"
        >
          <Text style={styles.dateDisplayText}>
            {selectedDate === todayStr ? `Today (${selectedDate})` : selectedDate}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateNavBtn}
          onPress={() => {
            const next = new Date(selectedDate);
            next.setDate(next.getDate() + 1);
            setSelectedDate(next.toISOString().slice(0, 10));
          }}
          accessibilityRole="button"
          accessibilityLabel="Next Day"
        >
          <Text style={styles.dateNavText}>Next ▶</Text>
        </TouchableOpacity>
      </View>

      {/* Events on Selected Date */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <View style={styles.dayDetailsCard}>
          <Text style={styles.dayDetailsTitle}>Activity for {selectedDate}</Text>

          {/* Follow-ups Due */}
          <View style={styles.eventGroup}>
            <Text style={styles.groupHeading}>🔔 Follow-ups Scheduled ({dueOnDate.length})</Text>
            {dueOnDate.length === 0 ? (
              <Text style={styles.emptyEventText}>None scheduled.</Text>
            ) : (
              dueOnDate.map((l) => (
                <View key={l.id} style={styles.eventRow}>
                  <Text style={styles.eventCode}>{l.lead_code}</Text>
                  <Text style={styles.eventName}>{l.title || l.business_name}</Text>
                </View>
              ))
            )}
          </View>

          {/* Contacted */}
          <View style={styles.eventGroup}>
            <Text style={styles.groupHeading}>✉️ Contacted ({contactedOnDate.length})</Text>
            {contactedOnDate.length === 0 ? (
              <Text style={styles.emptyEventText}>None contacted.</Text>
            ) : (
              contactedOnDate.map((l) => (
                <View key={l.id} style={styles.eventRow}>
                  <Text style={styles.eventCode}>{l.lead_code}</Text>
                  <Text style={styles.eventName}>{l.title || l.business_name}</Text>
                </View>
              ))
            )}
          </View>

          {/* Leads Discovered */}
          <View style={styles.eventGroup}>
            <Text style={styles.groupHeading}>🔍 Leads Found ({foundOnDate.length})</Text>
            {foundOnDate.length === 0 ? (
              <Text style={styles.emptyEventText}>No leads discovered on this date.</Text>
            ) : (
              foundOnDate.map((l) => (
                <View key={l.id} style={styles.eventRow}>
                  <Text style={styles.eventCode}>{l.lead_code}</Text>
                  <Text style={styles.eventName}>{l.title || l.business_name}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 14 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    screenTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
    screenSubtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
    viewToggleGroup: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    viewToggleBtn: { paddingHorizontal: 12, paddingVertical: 6 },
    viewToggleBtnActive: { backgroundColor: colors.primary },
    viewToggleText: { fontSize: 13, fontWeight: '600', color: colors.text },
    viewToggleTextActive: { color: '#ffffff' },
    dueTodayCard: {
      backgroundColor: '#fef3c7',
      borderWidth: 1,
      borderColor: '#f59e0b',
      borderRadius: 10,
      padding: 14,
      gap: 10,
    },
    dueTodayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dueTodayTitle: { fontSize: 15, fontWeight: '700', color: '#92400e' },
    todayDate: { fontSize: 12, fontWeight: '600', color: '#b45309' },
    noDueText: { fontSize: 13, color: '#78350f' },
    dueItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#fffbeb',
      padding: 8,
      borderRadius: 6,
    },
    dueInfo: { flex: 1, gap: 2 },
    dueCode: { fontSize: 12, fontWeight: '700', color: '#92400e' },
    dueTitle: { fontSize: 13, color: '#78350f' },
    quickActions: { flexDirection: 'row', gap: 6 },
    quickBtn: {
      backgroundColor: '#fde68a',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    quickBtnText: { fontSize: 11, fontWeight: '700', color: '#92400e' },
    monthCard: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
    },
    monthHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    navArrowBtn: { padding: 6 },
    navArrowText: { fontSize: 16, color: colors.primary, fontWeight: '700' },
    monthTitleText: { fontSize: 16, fontWeight: '700', color: colors.text },
    weekDaysRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 4,
    },
    weekDayHeader: { fontSize: 11, fontWeight: '600', color: colors.mutedForeground, width: 36, textAlign: 'center' },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
    },
    dayCell: {
      width: '14.28%',
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      marginVertical: 2,
    },
    emptyDayCell: {
      width: '14.28%',
      height: 38,
      marginVertical: 2,
    },
    dayCellSelected: {
      backgroundColor: colors.primary,
    },
    dayCellToday: {
      borderWidth: 1,
      borderColor: colors.primary,
    },
    dayCellText: { fontSize: 12, color: colors.text, fontWeight: '500' },
    dayCellTextSelected: { color: '#ffffff', fontWeight: '700' },
    dayCellTextToday: { color: colors.primary, fontWeight: '700' },
    indicatorRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
    dot: { width: 4, height: 4, borderRadius: 2 },
    dateBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 6,
    },
    dateNavBtn: { paddingHorizontal: 12, paddingVertical: 6 },
    dateNavText: { fontSize: 13, fontWeight: '600', color: colors.primary },
    dateDisplayBtn: { paddingVertical: 6 },
    dateDisplayText: { fontSize: 14, fontWeight: '700', color: colors.text },
    dayDetailsCard: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 14,
    },
    dayDetailsTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    eventGroup: { gap: 6 },
    groupHeading: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
    emptyEventText: { fontSize: 12, color: colors.mutedForeground, fontStyle: 'italic', paddingLeft: 6 },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.background,
      padding: 8,
      borderRadius: 6,
    },
    eventCode: { fontSize: 12, fontWeight: '700', color: colors.primary },
    eventName: { fontSize: 13, color: colors.text, flex: 1 },
  });
}
