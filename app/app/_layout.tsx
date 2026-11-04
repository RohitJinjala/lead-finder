import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeContext, useThemeProvider } from '../src/hooks/useTheme';
import { View } from 'react-native';

export default function RootLayout() {
  const themeProvider = useThemeProvider();

  if (!themeProvider.isLoaded) {
    return <View style={{ flex: 1 }} />;
  }

  return (
    <ThemeContext.Provider value={themeProvider}>
      <SafeAreaProvider>
        <StatusBar style={themeProvider.isDark ? 'light' : 'dark'} />
        <Slot />
      </SafeAreaProvider>
    </ThemeContext.Provider>
  );
}
