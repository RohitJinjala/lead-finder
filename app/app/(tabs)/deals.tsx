import { View, Text } from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';

export default function DealsScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.mutedForeground }}>Deals</Text>
    </View>
  );
}
