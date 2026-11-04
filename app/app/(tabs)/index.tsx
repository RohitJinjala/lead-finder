import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useState } from 'react';
import { useTheme } from '../../src/hooks/useTheme';
import { useLeads, type LeadFilters } from '../../src/hooks/useLeads';
import { LeadCard } from '../../src/components/LeadCard';
import type { LeadModule } from '../../src/types/lead';

type Tab = 'all' | 'acceptable' | 'rejected' | 'trash';
type ModuleFilter = LeadModule | 'both';

export default function LeadsScreen() {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('both');
  const [search, setSearch] = useState('');

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

  return (
    <View style={styles.container} accessibilityLabel="Leads screen">
      {/* Module switcher */}
      <View style={styles.moduleBar} accessibilityRole="tablist" accessibilityLabel="Module filter">
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
            <LeadCard lead={item} onRefresh={refetch} />
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
      padding: 8,
      gap: 8,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
