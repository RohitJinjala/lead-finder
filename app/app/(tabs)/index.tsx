import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { useTheme } from '../../src/hooks/useTheme';
import { useLeads, type LeadFilters } from '../../src/hooks/useLeads';
import { LeadCard } from '../../src/components/LeadCard';
import type { LeadModule } from '../../src/types/lead';
import { supabase } from '../../src/lib/supabase';

type Tab = 'all' | 'acceptable' | 'rejected' | 'trash';
type ModuleFilter = LeadModule | 'both';

export default function LeadsScreen() {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('both');
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [undoToast, setUndoToast] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<(() => Promise<void>) | null>(null);

  const filters: LeadFilters = {
    tab: activeTab,
    module: moduleFilter,
    search: search.trim() || undefined,
  };

  const { leads, loading, error, refetch } = useLeads(filters);

  const styles = getStyles(colors);

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'acceptable', label: 'Acceptable' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'trash', label: 'Trash' },
  ];

  const modules: Array<{ key: ModuleFilter; label: string }> = [
    { key: 'both', label: 'Both' },
    { key: 'web', label: 'Web' },
    { key: 'maps', label: 'Maps' },
  ];

  function toggleSelectMode() {
    setSelectMode(!selectMode);
    setSelectedIds(new Set());
  }

  function toggleLeadSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(leads.map((l) => l.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  function showToastWithUndo(msg: string, undoFn: () => Promise<void>) {
    setUndoToast(msg);
    setUndoAction(() => undoFn);
    setTimeout(() => {
      setUndoToast(null);
      setUndoAction(null);
    }, 5000);
  }

  function handleBulkReject() {
    const targetLeads = leads.filter((l) => selectedIds.has(l.id));
    if (targetLeads.length === 0) return;

    const listText = targetLeads
      .map((l) => `• ${l.lead_code} · ${l.title.slice(0, 45)}`)
      .join('\n');

    Alert.alert(
      `Reject ${targetLeads.length} leads?`,
      `Are you sure you want to reject the following ${targetLeads.length} leads?\n\n${listText}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            const previousStatuses = new Map(targetLeads.map((l) => [l.id, l.status]));
            const targetIdsArray = Array.from(selectedIds);

            await supabase
              .from('leads')
              .update({ status: 'rejected' })
              .in('id', targetIdsArray);

            setSelectedIds(new Set());
            setSelectMode(false);
            refetch();

            showToastWithUndo(`Rejected ${targetLeads.length} leads`, async () => {
              for (const [id, prevStatus] of previousStatuses.entries()) {
                await supabase.from('leads').update({ status: prevStatus }).eq('id', id);
              }
              refetch();
            });
          },
        },
      ]
    );
  }

  function handleBulkAccept() {
    const targetLeads = leads.filter((l) => selectedIds.has(l.id));
    if (targetLeads.length === 0) return;

    const listText = targetLeads
      .map((l) => `• ${l.lead_code} · ${l.title.slice(0, 45)}`)
      .join('\n');

    Alert.alert(
      `Accept ${targetLeads.length} leads?`,
      `Move the following ${targetLeads.length} leads to Acceptable?\n\n${listText}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            const previousStatuses = new Map(targetLeads.map((l) => [l.id, l.status]));
            const targetIdsArray = Array.from(selectedIds);

            await supabase
              .from('leads')
              .update({ status: 'acceptable' })
              .in('id', targetIdsArray);

            setSelectedIds(new Set());
            setSelectMode(false);
            refetch();

            showToastWithUndo(`Accepted ${targetLeads.length} leads`, async () => {
              for (const [id, prevStatus] of previousStatuses.entries()) {
                await supabase.from('leads').update({ status: prevStatus }).eq('id', id);
              }
              refetch();
            });
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container} accessibilityLabel="Leads screen">
      {/* Undo Toast */}
      {undoToast && (
        <View style={styles.undoToast} accessibilityLiveRegion="polite">
          <Text style={styles.undoToastText}>{undoToast}</Text>
          {undoAction && (
            <TouchableOpacity
              onPress={() => {
                const action = undoAction;
                setUndoToast(null);
                setUndoAction(null);
                void action();
              }}
              accessibilityRole="button"
              accessibilityLabel="Undo bulk action"
            >
              <Text style={styles.undoButtonText}>Undo</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Module switcher & Select Mode toggle */}
      <View style={styles.moduleBar} accessibilityRole="tablist" accessibilityLabel="Module filter">
        <View style={styles.moduleChipsRow}>
          {modules.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.moduleChip, moduleFilter === m.key && styles.moduleChipActive]}
              onPress={() => setModuleFilter(m.key)}
              accessibilityRole="tab"
              accessibilityLabel={`${m.label} module`}
              accessibilityState={{ selected: moduleFilter === m.key }}
            >
              <Text style={[styles.moduleChipText, moduleFilter === m.key && styles.moduleChipTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.selectToggleBtn, selectMode && styles.selectToggleBtnActive]}
          onPress={toggleSelectMode}
          accessibilityRole="button"
          accessibilityLabel={selectMode ? 'Cancel selection' : 'Select multiple leads'}
        >
          <Text style={[styles.selectToggleText, selectMode && styles.selectToggleTextActive]}>
            {selectMode ? 'Done' : 'Select'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bulk actions bar when in select mode */}
      {selectMode && (
        <View style={styles.bulkActionBar} accessibilityLabel="Bulk actions bar">
          <Text style={styles.bulkSelectedCount}>
            {selectedIds.size} of {leads.length} selected
          </Text>
          <View style={styles.bulkButtonsRow}>
            {selectedIds.size < leads.length ? (
              <TouchableOpacity style={styles.bulkActionSmallBtn} onPress={selectAll}>
                <Text style={styles.bulkActionSmallText}>All</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.bulkActionSmallBtn} onPress={deselectAll}>
                <Text style={styles.bulkActionSmallText}>None</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.bulkActionButton, { backgroundColor: colors.success }, selectedIds.size === 0 && styles.btnDisabled]}
              onPress={handleBulkAccept}
              disabled={selectedIds.size === 0}
              accessibilityRole="button"
              accessibilityLabel="Accept selected leads"
            >
              <Text style={styles.bulkActionText}>Accept ({selectedIds.size})</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkActionButton, { backgroundColor: colors.error }, selectedIds.size === 0 && styles.btnDisabled]}
              onPress={handleBulkReject}
              disabled={selectedIds.size === 0}
              accessibilityRole="button"
              accessibilityLabel="Reject selected leads"
            >
              <Text style={styles.bulkActionText}>Reject ({selectedIds.size})</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Search box */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search by ID or keywords..."
        placeholderTextColor={colors.mutedForeground}
        value={search}
        onChangeText={setSearch}
        accessibilityLabel="Search leads"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      {/* Tabs */}
      <View style={styles.tabBar} accessibilityRole="tablist" accessibilityLabel="Lead status tabs">
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
            accessibilityRole="tab"
            accessibilityLabel={`${t.label} tab`}
            accessibilityState={{ selected: activeTab === t.key }}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lead list */}
      {error ? (
        <View style={styles.centerContent} accessibilityLiveRegion="polite">
          <Text style={styles.errorText} accessibilityRole="alert">Failed to load leads: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch} accessibilityRole="button" accessibilityLabel="Retry loading leads">
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.centerContent} accessibilityLiveRegion="polite">
          <Text style={styles.mutedText} accessibilityLabel="Loading leads">Loading...</Text>
        </View>
      ) : leads.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.mutedText} accessibilityLabel="No leads found">
            {activeTab === 'trash' ? 'Trash is empty.' : 'No leads found.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LeadCard
              lead={item}
              onRefresh={refetch}
              selectable={selectMode}
              selected={selectedIds.has(item.id)}
              onToggleSelect={() => toggleLeadSelection(item.id)}
            />
          )}
          contentContainerStyle={styles.list}
          accessibilityLabel="Leads list"
        />
      )}
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    moduleBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 8,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    moduleChipsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    moduleChip: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.muted,
    },
    moduleChipActive: {
      backgroundColor: colors.primary,
    },
    moduleChipText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
    },
    moduleChipTextActive: {
      color: colors.primaryForeground,
    },
    selectToggleBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    selectToggleBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    selectToggleText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    selectToggleTextActive: {
      color: colors.primaryForeground,
    },
    bulkActionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.muted,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    bulkSelectedCount: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    bulkButtonsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    bulkActionSmallBtn: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 4,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bulkActionSmallText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    bulkActionButton: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
    },
    bulkActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#fff',
    },
    btnDisabled: {
      opacity: 0.4,
    },
    undoToast: {
      position: 'absolute',
      top: 10,
      left: 20,
      right: 20,
      zIndex: 100,
      backgroundColor: '#1E293B',
      padding: 12,
      borderRadius: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    undoToastText: {
      color: '#F8FAFC',
      fontSize: 14,
      fontWeight: '500',
    },
    undoButtonText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 14,
      marginLeft: 12,
    },
    searchInput: {
      margin: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      fontSize: 15,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabText: {
      color: colors.mutedForeground,
      fontSize: 14,
      fontWeight: '500',
    },
    tabTextActive: {
      color: colors.primary,
    },
    list: {
      padding: 8,
    },
    centerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    errorText: {
      color: colors.error,
      fontSize: 15,
      textAlign: 'center',
      marginBottom: 12,
    },
    mutedText: {
      color: colors.mutedForeground,
      fontSize: 15,
    },
    retryButton: {
      marginTop: 12,
      paddingHorizontal: 24,
      paddingVertical: 10,
      backgroundColor: colors.primary,
      borderRadius: 8,
    },
    retryButtonText: {
      color: colors.primaryForeground,
      fontWeight: '600',
    },
  });
}
