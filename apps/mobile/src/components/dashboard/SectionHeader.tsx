import { StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme/colors";

interface Props {
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, action, onAction }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {action ? (
        <Text onPress={onAction} style={styles.action}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  action: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 13,
  },
});
