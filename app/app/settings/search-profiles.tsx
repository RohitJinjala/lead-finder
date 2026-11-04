import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { supabase } from '../../src/lib/supabase';

interface SearchPlanData {
  keywords: string[];
  exclusions: string[];
  subreddits: string[];
  countries: string[];
  sources: Record<string, boolean>;
}

export default function SearchProfilesScreen() {
  const { colors } = useTheme();
  const [selectedModule, setSelectedModule] = useState<'web' | 'maps'>('web');
  const [brief, setBrief] = useState('React, React Native, Node.js, MERN, or .NET projects, budget above $500, US/UK/EU, no WordPress');
  const [loading, setLoading] = useState(false);
  const [activePlanVersion, setActivePlanVersion] = useState<number | null>(null);

  // Proposal Plan State
  const [plan, setPlan] = useState<SearchPlanData>({
    keywords: ['react', 'node', 'express', 'mern', 'react native', '.net', 'api'],
    exclusions: ['wordpress', 'php', 'intern', 'unpaid', 'equity only'],
    subreddits: ['forhire', 'hiring', 'freelance'],
    countries: ['US', 'UK', 'CA', 'EU', 'AU'],
    sources: {
      reddit: true,
      hackernews: true,
      remoteok: true,
      weworkremotely: true,
      remotive: true,
    },
  });

  // Inputs for adding new chips
  const [newKeyword, setNewKeyword] = useState('');
  const [newExclusion, setNewExclusion] = useState('');
  const [newSubreddit, setNewSubreddit] = useState('');

  useEffect(() => {
    fetchActivePlan();
  }, [selectedModule]);

  async function fetchActivePlan() {
    setLoading(true);
    try {
      // Find profile
      const { data: profile } = await supabase
        .from('search_profiles')
        .select('id, brief')
        .eq('module', selectedModule)
        .maybeSingle();

      if (profile) {
        setBrief(profile.brief);
        // Find approved plan
        const { data: approvedPlan } = await supabase
          .from('search_plans')
          .select('version, plan')
          .eq('profile_id', profile.id)
          .eq('approved', true)
          .order('version', { ascending: false })
          .maybeSingle();

        if (approvedPlan) {
          setActivePlanVersion(approvedPlan.version);
          setPlan(approvedPlan.plan as SearchPlanData);
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateProposal() {
    if (!brief.trim()) {
      Alert.alert('Error', 'Please enter a client brief first.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-plan', {
        body: { module: selectedModule, brief: brief.trim() },
      });

      if (error) throw error;
      if (data?.plan) {
        setPlan(data.plan);
        Alert.alert('Proposal Generated', 'Review the suggested chips below and tap Approve when ready.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate proposal';
      Alert.alert('Notice', `Using baseline plan: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprovePlan() {
    setLoading(true);
    try {
      // 1. Get or create search profile
      let profileId: string;
      const { data: existingProfile } = await supabase
        .from('search_profiles')
        .select('id')
        .eq('module', selectedModule)
        .maybeSingle();

      if (existingProfile) {
        profileId = existingProfile.id;
        await supabase
          .from('search_profiles')
          .update({ brief: brief.trim(), updated_at: new Date().toISOString() })
          .eq('id', profileId);
      } else {
        const { data: newProfile, error: profError } = await supabase
          .from('search_profiles')
          .insert({
            module: selectedModule,
            name: `${selectedModule.toUpperCase()} Profile`,
            brief: brief.trim(),
            active: true,
          })
          .select('id')
          .single();

        if (profError) throw profError;
        profileId = newProfile.id;
      }

      // 2. Compute next version number
      const nextVersion = (activePlanVersion ?? 0) + 1;

      // 3. Insert approved search plan
      const { data: savedPlan, error: planError } = await supabase
        .from('search_plans')
        .insert({
          profile_id: profileId,
          version: nextVersion,
          plan: plan,
          approved: true,
          approved_at: new Date().toISOString(),
        })
        .select('id, version')
        .single();

      if (planError) throw planError;

      // 4. Update user_settings pointer
      const updateField = selectedModule === 'web' ? 'web_approved_plan_id' : 'maps_approved_plan_id';
      await supabase
        .from('user_settings')
        .update({ [updateField]: savedPlan.id })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      setActivePlanVersion(savedPlan.version);
      Alert.alert('Plan Approved', `Plan v${savedPlan.version} is now active. The collector will use this plan.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve plan';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  function addChip(category: 'keywords' | 'exclusions' | 'subreddits', value: string, clearFn: (s: string) => void) {
    if (!value.trim()) return;
    const clean = value.trim().toLowerCase();
    if (!plan[category].includes(clean)) {
      setPlan({ ...plan, [category]: [...plan[category], clean] });
    }
    clearFn('');
  }

  function removeChip(category: 'keywords' | 'exclusions' | 'subreddits', item: string) {
    setPlan({
      ...plan,
      [category]: plan[category].filter((x) => x !== item),
    });
  }

  function toggleSource(src: string) {
    setPlan({
      ...plan,
      sources: {
        ...plan.sources,
        [src]: !plan.sources[src],
      },
    });
  }

  const styles = getStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Search Profiles & Plans</Text>
      <Text style={styles.screenSubtitle}>
        The collector only runs approved plans. Edit proposal chips and tap Approve to activate.
      </Text>

      {/* Module Switcher */}
      <View style={styles.moduleBar} accessibilityRole="tablist">
        <TouchableOpacity
          style={[styles.moduleTab, selectedModule === 'web' && styles.moduleTabActive]}
          onPress={() => setSelectedModule('web')}
          accessibilityRole="tab"
          accessibilityLabel="Web Module Plan"
        >
          <Text style={[styles.moduleTabText, selectedModule === 'web' && styles.moduleTabTextActive]}>
            Web Leads Plan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.moduleTab, selectedModule === 'maps' && styles.moduleTabActive]}
          onPress={() => setSelectedModule('maps')}
          accessibilityRole="tab"
          accessibilityLabel="Maps Module Plan"
        >
          <Text style={[styles.moduleTabText, selectedModule === 'maps' && styles.moduleTabTextActive]}>
            Maps Leads Plan
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Plan Status Banner */}
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>
          {activePlanVersion ? `🟢 Active Plan: Plan v${activePlanVersion}` : '⚠️ No Approved Plan'}
        </Text>
        <Text style={styles.statusDescription}>
          {activePlanVersion
            ? 'The collector is currently targeting leads using this approved plan.'
            : 'Without an approved plan, the collector will skip this module and save no leads.'}
        </Text>
      </View>

      {/* Profile Brief Editor */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Plain-Language Brief</Text>
        <TextInput
          style={styles.briefInput}
          value={brief}
          onChangeText={setBrief}
          multiline
          numberOfLines={3}
          placeholder="e.g. React/Node/MERN or .NET projects, budget above $500, US/UK/EU, no WordPress"
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel="Search Profile Brief"
        />

        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerateProposal}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Generate Query Proposal"
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.generateButtonText}>✨ Propose Query Filters</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Editable Chips Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Target Keywords (Must Match)</Text>
        <View style={styles.chipsContainer}>
          {plan.keywords.map((kw) => (
            <TouchableOpacity
              key={kw}
              style={styles.chip}
              onPress={() => removeChip('keywords', kw)}
              accessibilityLabel={`Remove keyword ${kw}`}
            >
              <Text style={styles.chipText}>{kw} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.addRow}>
          <TextInput
            style={styles.chipInput}
            value={newKeyword}
            onChangeText={setNewKeyword}
            placeholder="+ Add keyword..."
            placeholderTextColor={colors.mutedForeground}
            onSubmitEditing={() => addChip('keywords', newKeyword, setNewKeyword)}
            accessibilityLabel="Add Keyword"
          />
          <TouchableOpacity
            style={styles.addChipBtn}
            onPress={() => addChip('keywords', newKeyword, setNewKeyword)}
          >
            <Text style={styles.addChipBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Exclusion Keywords (Drop Immediately)</Text>
        <View style={styles.chipsContainer}>
          {plan.exclusions.map((ex) => (
            <TouchableOpacity
              key={ex}
              style={[styles.chip, styles.exclusionChip]}
              onPress={() => removeChip('exclusions', ex)}
              accessibilityLabel={`Remove exclusion ${ex}`}
            >
              <Text style={styles.exclusionChipText}>{ex} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.addRow}>
          <TextInput
            style={styles.chipInput}
            value={newExclusion}
            onChangeText={setNewExclusion}
            placeholder="+ Add negative keyword..."
            placeholderTextColor={colors.mutedForeground}
            onSubmitEditing={() => addChip('exclusions', newExclusion, setNewExclusion)}
            accessibilityLabel="Add Exclusion"
          />
          <TouchableOpacity
            style={styles.addChipBtn}
            onPress={() => addChip('exclusions', newExclusion, setNewExclusion)}
          >
            <Text style={styles.addChipBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {selectedModule === 'web' && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Subreddits</Text>
            <View style={styles.chipsContainer}>
              {plan.subreddits.map((sub) => (
                <TouchableOpacity
                  key={sub}
                  style={styles.chip}
                  onPress={() => removeChip('subreddits', sub)}
                  accessibilityLabel={`Remove subreddit ${sub}`}
                >
                  <Text style={styles.chipText}>r/{sub} ✕</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.addRow}>
              <TextInput
                style={styles.chipInput}
                value={newSubreddit}
                onChangeText={setNewSubreddit}
                placeholder="+ Add subreddit name..."
                placeholderTextColor={colors.mutedForeground}
                onSubmitEditing={() => addChip('subreddits', newSubreddit, setNewSubreddit)}
                accessibilityLabel="Add Subreddit"
              />
              <TouchableOpacity
                style={styles.addChipBtn}
                onPress={() => addChip('subreddits', newSubreddit, setNewSubreddit)}
              >
                <Text style={styles.addChipBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Active Web Sources</Text>
            {Object.keys(plan.sources).map((src) => (
              <View key={src} style={styles.sourceToggleRow}>
                <Text style={styles.sourceName}>{src.toUpperCase()}</Text>
                <Switch
                  value={Boolean(plan.sources[src])}
                  onValueChange={() => toggleSource(src)}
                  accessibilityLabel={`Toggle ${src} source`}
                />
              </View>
            ))}
          </View>
        </>
      )}

      {/* Approve Plan Button */}
      <TouchableOpacity
        style={styles.approveButton}
        onPress={handleApprovePlan}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Approve Search Plan"
      >
        <Text style={styles.approveButtonText}>
          ✓ Approve {selectedModule.toUpperCase()} Plan (Save as Plan v{(activePlanVersion ?? 0) + 1})
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 14 },
    screenTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
    screenSubtitle: { fontSize: 13, color: colors.mutedForeground },
    moduleBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    moduleTab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
    moduleTabActive: { backgroundColor: colors.primary },
    moduleTabText: { fontSize: 14, fontWeight: '600', color: colors.text },
    moduleTabTextActive: { color: '#ffffff' },
    statusCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      gap: 4,
    },
    statusTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    statusDescription: { fontSize: 12, color: colors.mutedForeground },
    section: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 8,
    },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
    briefInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 10,
      color: colors.text,
      fontSize: 13,
      textAlignVertical: 'top',
    },
    generateButton: {
      backgroundColor: colors.muted,
      paddingVertical: 10,
      borderRadius: 6,
      alignItems: 'center',
    },
    generateButtonText: { color: colors.text, fontWeight: '600', fontSize: 13 },
    chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
    },
    chipText: { color: '#ffffff', fontSize: 12, fontWeight: '500' },
    exclusionChip: { backgroundColor: '#fee2e2' },
    exclusionChipText: { color: '#b91c1c', fontSize: 12, fontWeight: '500' },
    addRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    chipInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      color: colors.text,
      fontSize: 13,
    },
    addChipBtn: {
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      justifyContent: 'center',
      borderRadius: 6,
    },
    addChipBtnText: { color: colors.text, fontSize: 12, fontWeight: '600' },
    sourceToggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sourceName: { fontSize: 13, fontWeight: '600', color: colors.text },
    approveButton: {
      backgroundColor: '#16a34a',
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 24,
    },
    approveButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  });
}

