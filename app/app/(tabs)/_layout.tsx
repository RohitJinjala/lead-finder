import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/hooks/useTheme';

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStatusBarHeight: 0,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Leads',
          tabBarAccessibilityLabel: 'Leads tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={String(color)} accessibilityLabel="Leads" />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarAccessibilityLabel: 'Calendar tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={String(color)} accessibilityLabel="Calendar" />
          ),
        }}
      />
      <Tabs.Screen
        name="deals"
        options={{
          title: 'Deals',
          tabBarAccessibilityLabel: 'Deals tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase" size={size} color={String(color)} accessibilityLabel="Deals" />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarAccessibilityLabel: 'Analytics tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart" size={size} color={String(color)} accessibilityLabel="Analytics" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={String(color)} accessibilityLabel="Settings" />
          ),
        }}
      />
    </Tabs>
  );
}
