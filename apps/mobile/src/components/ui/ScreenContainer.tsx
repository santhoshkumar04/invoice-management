import { ScrollView, StyleSheet, View, ViewStyle } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../theme/colors";

interface Props {
  children: React.ReactNode;
  contentStyle?: ViewStyle;
}

export function ScreenContainer({ children, contentStyle }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, contentStyle]}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    gap: 16,
  },
});
