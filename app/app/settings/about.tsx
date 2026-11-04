import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';

export default function AboutScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  function openLink(url: string) {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      void Linking.openURL(url);
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
        <Text style={styles.title}>About & Legal Credits</Text>
        <Text style={styles.subtitle}>
          Information, open data credits, and third-party license compliance.
        </Text>
      </View>

      {/* App Info Card */}
      <View style={styles.card}>
        <Text style={styles.appName}>Lead Finder</Text>
        <Text style={styles.version}>Version 1.0.0 (Personal Freelance Pipeline)</Text>
        <Text style={styles.description}>
          An autonomous, zero-outreach freelance lead qualification and conversion application. Finds web requests and maps-based local business leads, scores them via private AI model chains, and enables full deal tracking.
        </Text>
      </View>

      {/* OpenStreetMap Attribution */}
      <View style={styles.card}>
        <Text style={styles.cardHeading}>🗺️ OpenStreetMap Data</Text>
        <Text style={styles.cardBody}>
          Maps Leads are discovered through open OpenStreetMap data via the Overpass API.
        </Text>
        <Text style={styles.attributionBadge}>
          © OpenStreetMap contributors
        </Text>
        <TouchableOpacity
          onPress={() => openLink('https://www.openstreetmap.org/copyright')}
          style={styles.linkButton}
          accessibilityRole="link"
          accessibilityLabel="Open OpenStreetMap copyright page"
        >
          <Text style={styles.linkText}>View OSM License & Copyright →</Text>
        </TouchableOpacity>
      </View>

      {/* Geographic Datasets */}
      <View style={styles.card}>
        <Text style={styles.cardHeading}>🌍 Geographical Datasets</Text>
        <Text style={styles.cardBody}>
          Target country, state, and city boundaries are derived from open geographical databases released under the MIT License.
        </Text>
        <Text style={styles.licenseNotice}>
          Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction.
        </Text>
      </View>

      {/* Zero Auto-Outreach Guarantee */}
      <View style={styles.card}>
        <Text style={styles.cardHeading}>🛡️ Ethical Operating Policy</Text>
        <Text style={styles.cardBody}>
          Lead Finder adheres to strict non-invasive boundaries:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Zero automated outreach (no auto-apply, auto-DM, auto-email, or robo-calling).</Text>
          <Text style={styles.bulletItem}>• Zero scraping of prohibited commercial networks (Upwork, LinkedIn, Fiverr, Google Maps HTML pages).</Text>
          <Text style={styles.bulletItem}>• All client communication is conducted manually and personally by the owner.</Text>
          <Text style={styles.bulletItem}>• Zero secrets stored in client storage, logs, or git commits.</Text>
        </View>
      </View>
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
    card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
    appName: { fontSize: 18, fontWeight: '800', color: colors.text },
    version: { fontSize: 12, color: colors.primary, fontWeight: '600', marginBottom: 8 },
    description: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    cardHeading: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6 },
    cardBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 8 },
    attributionBadge: { fontSize: 13, fontWeight: '700', color: colors.text, backgroundColor: colors.muted, padding: 8, borderRadius: 6, textAlign: 'center', marginVertical: 6 },
    linkButton: { marginTop: 4 },
    linkText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
    licenseNotice: { fontSize: 11, color: colors.mutedForeground, fontStyle: 'italic', lineHeight: 16, marginTop: 4 },
    bulletList: { gap: 6, marginTop: 4 },
    bulletItem: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  });
}
