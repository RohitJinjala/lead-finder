import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import type { ThemeMode } from '../../src/types/theme';

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const router = useRouter();

  const themeOptions: Array<{ value: ThemeMode; label: string }> = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    section: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    sectionTitle: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    rowLabel: { fontSize: 16, color: colors.text },
    themeRow: { flexDirection: 'row', gap: 8 },
    themeChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.muted },
    themeChipActive: { backgroundColor: colors.primary },
    themeChipText: { color: colors.text, fontSize: 14 },
    themeChipTextActive: { color: colors.primaryForeground },
    navItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.muted },
    navItemText: { fontSize: 16, color: colors.text },
  });

  const navItems = [
    'Modules',
    'Secrets & Integrations',
    'Models',
    'Search Profiles',
    'Locations & Niches',
    'Alerts',
    'Data',
    'Collector Health',
    'About',
  ];

  const navLinks: Record<string, string> = {
    'Secrets & Integrations': '/settings/secrets',
    'Models': '/settings/models',
    'Search Profiles': '/settings/search-profiles',
    'Collector Health': '/settings/collector-health',
    'Account / Auth': '/auth',
  };

  function handleNav(item: string) {
    const route = navLinks[item];
    if (route) {
      router.push(route as never);
    }
  }

  return (
    <ScrollView style={styles.container} accessibilityLabel="Settings screen">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <Text style={[styles.rowLabel, { marginBottom: 8 }]}>Theme</Text>
        <View style={styles.themeRow}>
          {themeOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.themeChip, mode === opt.value && styles.themeChipActive]}
              onPress={() => void setMode(opt.value)}
              accessibilityRole="button"
              accessibilityLabel={`${opt.label} theme`}
              accessibilityState={{ selected: mode === opt.value }}
            >
              <Text style={[styles.themeChipText, mode === opt.value && styles.themeChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        {navItems.map((item) => (
          <TouchableOpacity
            key={item}
            style={styles.navItem}
            onPress={() => handleNav(item)}
            accessibilityRole="button"
            accessibilityLabel={item}
          >
            <Text style={styles.navItemText}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
