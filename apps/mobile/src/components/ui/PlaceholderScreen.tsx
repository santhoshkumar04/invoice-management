import { StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "./ScreenContainer";
import { colors } from "../../theme/colors";

export function PlaceholderScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <ScreenContainer contentStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Text style={styles.note}>
          This feature will be implemented in a later phase.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 18,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  note: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 8,
  },
});
