
import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Invoice Management
      </Text>

      <Text style={styles.subtitle}>
        Welcome to your business invoice application.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Application Status
        </Text>

        <Text style={styles.status}>
          Mobile application is running
        </Text>
      </View>

      <Text style={styles.footer}>
        Version 1.0.0
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 24,
    justifyContent: "center"
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0F172A"
  },
  subtitle: {
    fontSize: 15,
    color: "#64748B",
    marginTop: 10
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 16,
    marginTop: 30,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A"
  },
  status: {
    color: "#15803D",
    marginTop: 12,
    fontSize: 14
  },
  footer: {
    marginTop: 30,
    color: "#94A3B8",
    fontSize: 12
  }
});
