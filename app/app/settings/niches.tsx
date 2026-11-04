import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { supabase } from '../../src/lib/supabase';
import {
  getCountries,
  getStatesByCountry,
  getCitiesByState,
  DEFAULT_NICHE_OFFERS,
  type DefaultNicheOffer,
} from '../../src/data/locations';

interface SearchPreset {
  id: string;
  name: string;
  countries: string[];
  states: string[];
  cities: string[];
  niches: string[];
  last_searched_at: string | null;
}

export default function LocationsAndNichesScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'locations' | 'niches'>('locations');
  const [loading, setLoading] = useState(false);

  // Cascading location state
  const countries = getCountries();
  const [selectedCountry, setSelectedCountry] = useState<string>('US');
  const availableStates = getStatesByCountry(selectedCountry);
  const [selectedState, setSelectedState] = useState<string>(availableStates[0]?.code ?? '');
  const availableCities = getCitiesByState(selectedCountry, selectedState);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<SearchPreset[]>([]);

  // Niches state
  const [niches, setNiches] = useState<DefaultNicheOffer[]>(DEFAULT_NICHE_OFFERS);
  const [editingNiche, setEditingNiche] = useState<string | null>(null);
  const [editedOfferText, setEditedOfferText] = useState('');

  useEffect(() => {
    fetchPresetsAndNiches();
  }, []);

  // Update selected state whenever selected country changes
  useEffect(() => {
    const states = getStatesByCountry(selectedCountry);
    const firstState = states[0]?.code ?? '';
    setSelectedState(firstState);
    setSelectedCities([]);
  }, [selectedCountry]);

  async function fetchPresetsAndNiches() {
    setLoading(true);
    try {
      // 1. Fetch presets
      const { data: presetData } = await supabase
        .from('search_presets')
        .select('*')
        .order('created_at', { ascending: false });

      if (presetData) {
        setPresets(presetData as unknown as SearchPreset[]);
      }

      // 2. Fetch niches from DB if present, else initialize with defaults
      const { data: nicheData } = await supabase
        .from('niche_offers')
        .select('*');

      if (nicheData && nicheData.length > 0) {
        setNiches((prev) =>
          prev.map((n) => {
            const dbMatch = nicheData.find((db: { niche: string }) => db.niche === n.niche);
            return dbMatch
              ? { ...n, offer_text: dbMatch.offer_text, enabled: dbMatch.enabled }
              : n;
          })
        );
      }
    } catch {
      // Fallback to local defaults
    } finally {
      setLoading(false);
    }
  }

  function toggleCitySelection(city: string) {
    if (selectedCities.includes(city)) {
      setSelectedCities(selectedCities.filter((c) => c !== city));
    } else {
      setSelectedCities([...selectedCities, city]);
    }
  }

  async function handleSavePreset() {
    if (selectedCities.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one city.');
      return;
    }
    const name = presetName.trim() || `${selectedCountry} - ${selectedState} (${selectedCities.length} cities)`;
    setLoading(true);
    try {
      const { error } = await supabase.from('search_presets').insert({
        name,
        countries: [selectedCountry],
        states: [selectedState],
        cities: selectedCities,
        niches: niches.filter((n) => n.enabled).map((n) => n.niche),
      });

      if (error) throw error;
      setPresetName('');
      setSelectedCities([]);
      await fetchPresetsAndNiches();
      Alert.alert('Saved', `Search Preset "${name}" created.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save preset';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePreset(id: string, name: string) {
    Alert.alert('Delete Preset', `Delete preset "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('search_presets').delete().eq('id', id);
          await fetchPresetsAndNiches();
        },
      },
    ]);
  }

  function handleStartEditNiche(n: DefaultNicheOffer) {
    setEditingNiche(n.niche);
    setEditedOfferText(n.offer_text);
  }

  async function handleSaveEditedNiche(nicheKey: string) {
    try {
      await supabase.from('niche_offers').upsert(
        {
          niche: nicheKey,
          offer_text: editedOfferText,
          enabled: true,
        },
        { onConflict: 'niche' }
      );

      setNiches((prev) =>
        prev.map((n) => (n.niche === nicheKey ? { ...n, offer_text: editedOfferText } : n))
      );
      setEditingNiche(null);
      Alert.alert('Updated', 'Offer template saved.');
    } catch {
      Alert.alert('Error', 'Failed to update offer.');
    }
  }

  async function handleToggleNicheEnabled(nicheKey: string, enabled: boolean) {
    setNiches((prev) =>
      prev.map((n) => (n.niche === nicheKey ? { ...n, enabled } : n))
    );
    try {
      await supabase.from('niche_offers').upsert(
        { niche: nicheKey, offer_text: niches.find((n) => n.niche === nicheKey)?.offer_text ?? '', enabled },
        { onConflict: 'niche' }
      );
    } catch {
      // Ignore
    }
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
        <Text style={styles.title}>Locations & Niche Offers</Text>
        <Text style={styles.subtitle}>
          Configure geographical areas and customize suggested offers for local business leads.
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'locations' && styles.tabBtnActive]}
          onPress={() => setActiveTab('locations')}
          accessibilityRole="tab"
          accessibilityLabel="Locations Tab"
          accessibilityState={{ selected: activeTab === 'locations' }}
        >
          <Text style={[styles.tabText, activeTab === 'locations' && styles.tabTextActive]}>
            📍 Target Locations
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'niches' && styles.tabBtnActive]}
          onPress={() => setActiveTab('niches')}
          accessibilityRole="tab"
          accessibilityLabel="Niches Tab"
          accessibilityState={{ selected: activeTab === 'niches' }}
        >
          <Text style={[styles.tabText, activeTab === 'niches' && styles.tabTextActive]}>
            💼 Niche Offers
          </Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />}

      {/* LOCATIONS TAB */}
      {activeTab === 'locations' && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Cascading Location Picker</Text>
          <Text style={styles.sectionSubtitle}>
            Select Country → State → Cities to build targeted search areas.
          </Text>

          {/* 1. Country Selector */}
          <Text style={styles.label}>1. Select Country</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {countries.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[styles.chip, selectedCountry === c.code && styles.chipActive]}
                onPress={() => setSelectedCountry(c.code)}
                accessibilityRole="button"
                accessibilityLabel={`Country ${c.name}`}
              >
                <Text style={[styles.chipText, selectedCountry === c.code && styles.chipTextActive]}>
                  {c.name} ({c.code})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 2. State Selector */}
          <Text style={styles.label}>2. Select State / Region</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {availableStates.map((s) => (
              <TouchableOpacity
                key={s.code}
                style={[styles.chip, selectedState === s.code && styles.chipActive]}
                onPress={() => {
                  setSelectedState(s.code);
                  setSelectedCities([]);
                }}
                accessibilityRole="button"
                accessibilityLabel={`State ${s.name}`}
              >
                <Text style={[styles.chipText, selectedState === s.code && styles.chipTextActive]}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 3. City Multi-Select */}
          <Text style={styles.label}>
            3. Select Cities ({selectedCities.length} selected)
          </Text>
          <View style={styles.citiesGrid}>
            {availableCities.map((city) => {
              const isSelected = selectedCities.includes(city);
              return (
                <TouchableOpacity
                  key={city}
                  style={[styles.cityChip, isSelected && styles.cityChipActive]}
                  onPress={() => toggleCitySelection(city)}
                  accessibilityRole="button"
                  accessibilityLabel={`City ${city}`}
                >
                  <Text style={[styles.cityChipText, isSelected && styles.cityChipTextActive]}>
                    {isSelected ? '✓ ' : '+ '}
                    {city}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Preset Name and Save */}
          <View style={styles.savePresetRow}>
            <TextInput
              style={styles.presetInput}
              placeholder="Preset name (optional)..."
              placeholderTextColor={colors.mutedForeground}
              value={presetName}
              onChangeText={setPresetName}
              accessibilityLabel="Preset name"
            />
            <TouchableOpacity
              style={styles.savePresetBtn}
              onPress={handleSavePreset}
              accessibilityRole="button"
              accessibilityLabel="Save search preset"
            >
              <Text style={styles.savePresetBtnText}>Save Preset</Text>
            </TouchableOpacity>
          </View>

          {/* Saved Presets List */}
          <View style={styles.savedPresetsSection}>
            <Text style={styles.subHeading}>Saved Search Presets ({presets.length})</Text>
            {presets.length === 0 ? (
              <Text style={styles.emptyText}>No presets saved yet. Create one above.</Text>
            ) : (
              presets.map((p) => (
                <View key={p.id} style={styles.presetCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.presetName}>{p.name}</Text>
                    <Text style={styles.presetMeta}>
                      Cities: {p.cities?.join(', ') || 'None'}
                    </Text>
                    <Text style={styles.presetMeta}>
                      Last searched: {p.last_searched_at ? p.last_searched_at.slice(0, 10) : 'Never'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeletePreset(p.id, p.name)}
                    style={styles.deletePresetBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete preset ${p.name}`}
                  >
                    <Text style={styles.deletePresetText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Attribution Badge */}
          <View style={styles.attributionCard}>
            <Text style={styles.attributionTitle}>Geographical Attribution</Text>
            <Text style={styles.attributionDesc}>
              Location data is credited to open geographical datasets under the MIT License. Map boundaries and points of interest provided by © OpenStreetMap contributors.
            </Text>
          </View>
        </View>
      )}

      {/* NICHES TAB */}
      {activeTab === 'niches' && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Niche Offer Templates</Text>
          <Text style={styles.sectionSubtitle}>
            Custom service offerings matched to local business types when discovered via OpenStreetMap.
          </Text>

          {niches.map((n) => {
            const isEditing = editingNiche === n.niche;
            return (
              <View key={n.niche} style={styles.nicheCard}>
                <View style={styles.nicheHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nicheName}>{n.name}</Text>
                    <Text style={styles.nicheTags}>OSM tags: {n.osm_tags.join(', ')}</Text>
                  </View>
                  <Switch
                    value={n.enabled}
                    onValueChange={(val) => handleToggleNicheEnabled(n.niche, val)}
                    accessibilityLabel={`Toggle niche ${n.name}`}
                  />
                </View>

                {isEditing ? (
                  <View style={styles.editNicheContainer}>
                    <TextInput
                      style={styles.editOfferInput}
                      value={editedOfferText}
                      onChangeText={setEditedOfferText}
                      multiline
                      accessibilityLabel={`Edit offer for ${n.name}`}
                    />
                    <View style={styles.editActionsRow}>
                      <TouchableOpacity
                        style={styles.saveEditBtn}
                        onPress={() => handleSaveEditedNiche(n.niche)}
                        accessibilityRole="button"
                        accessibilityLabel="Save offer text"
                      >
                        <Text style={styles.saveEditBtnText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cancelEditBtn}
                        onPress={() => setEditingNiche(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel edit"
                      >
                        <Text style={styles.cancelEditBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.offerTextRow}>
                    <Text style={styles.offerText}>💡 &quot;{n.offer_text}&quot;</Text>
                    <TouchableOpacity
                      onPress={() => handleStartEditNiche(n)}
                      style={styles.editOfferBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${n.name} offer`}
                    >
                      <Text style={styles.editOfferBtnText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 40 },
    header: { marginBottom: 16 },
    backButton: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: colors.muted, marginBottom: 12 },
    backButtonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
    subtitle: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
    tabRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: colors.muted },
    tabBtnActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 13, fontWeight: '600', color: colors.text },
    tabTextActive: { color: colors.primaryForeground },
    sectionCard: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
    sectionSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 },
    label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 10, marginBottom: 6 },
    chipsScroll: { flexDirection: 'row', marginBottom: 10 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.muted, marginRight: 8 },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.text },
    chipTextActive: { color: colors.primaryForeground },
    citiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
    cityChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    cityChipActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
    cityChipText: { fontSize: 12, color: colors.text },
    cityChipTextActive: { color: colors.primary, fontWeight: '700' },
    savePresetRow: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 16 },
    presetInput: { flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, fontSize: 13, color: colors.text },
    savePresetBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
    savePresetBtnText: { color: colors.primaryForeground, fontSize: 13, fontWeight: '600' },
    savedPresetsSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, marginTop: 10 },
    subHeading: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
    emptyText: { fontSize: 12, color: colors.mutedForeground, fontStyle: 'italic' },
    presetCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
    presetName: { fontSize: 13, fontWeight: '700', color: colors.text },
    presetMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    deletePresetBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.error + '20', borderRadius: 6 },
    deletePresetText: { fontSize: 11, color: colors.error, fontWeight: '600' },
    attributionCard: { backgroundColor: colors.background, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginTop: 14 },
    attributionTitle: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 2 },
    attributionDesc: { fontSize: 11, color: colors.mutedForeground, lineHeight: 16 },
    nicheCard: { backgroundColor: colors.background, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
    nicheHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    nicheName: { fontSize: 14, fontWeight: '700', color: colors.text },
    nicheTags: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
    offerTextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
    offerText: { flex: 1, fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 17 },
    editOfferBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.muted, borderRadius: 4 },
    editOfferBtnText: { fontSize: 11, fontWeight: '600', color: colors.primary },
    editNicheContainer: { gap: 8 },
    editOfferInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, fontSize: 12, color: colors.text, minHeight: 60 },
    editActionsRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
    saveEditBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    saveEditBtnText: { color: colors.primaryForeground, fontSize: 12, fontWeight: '600' },
    cancelEditBtn: { backgroundColor: colors.muted, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    cancelEditBtnText: { color: colors.text, fontSize: 12 },
  });
}
