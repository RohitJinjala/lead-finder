import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
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
        <SafeAreaView
          edges={['top']}
          style={{ flex: 1, backgroundColor: themeProvider.colors.background }}
        >
          <StatusBar style={themeProvider.isDark ? 'light' : 'dark'} />
          <Slot />
        </SafeAreaView>
      </SafeAreaProvider>
    </ThemeContext.Provider>
  );
}
