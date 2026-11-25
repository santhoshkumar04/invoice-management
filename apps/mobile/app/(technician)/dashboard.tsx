import { StyleSheet, Text, View, Pressable } from "react-native";

import { useRouter } from "expo-router";

import {
  FilePlus2,
  History,
  UserRound,
  LogOut,
  ChevronRight,
} from "lucide-react-native";

import { ScreenContainer } from "../../src/components/ui/ScreenContainer";

import { StatCard } from "../../src/components/dashboard/StatCard";

import { SectionHeader } from "../../src/components/dashboard/SectionHeader";

import { useAuthStore } from "../../src/stores/auth.store";

import { colors } from "../../src/theme/colors";
import { radius } from "../../src/theme/spacing";

export default function TechnicianDashboard() {
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const handleLogout = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{user?.fullName}</Text>
          <Text style={styles.role}>Technician</Text>
        </View>

        <Pressable
          style={styles.profile}
          onPress={() => router.push("/(technician)/profile")}
        >
          <UserRound color={colors.primary} size={23} />
        </Pressable>
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerLabel}>YOUR WORKSPACE</Text>

        <Text style={styles.bannerTitle}>Manage your invoices</Text>

        <Text style={styles.bannerSubtitle}>
          Create invoices and keep track of your own billing history.
        </Text>
      </View>

      <Pressable
        style={styles.createButton}
        onPress={() => router.push("/(technician)/create-invoice")}
      >
        <View style={styles.createIcon}>
          <FilePlus2 color={colors.white} size={27} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.createTitle}>Create new invoice</Text>
          <Text style={styles.createSubtitle}>
            Start preparing a customer invoice
          </Text>
        </View>

        <ChevronRight color={colors.white} />
      </Pressable>

      <SectionHeader title="My activity" />

      <View style={styles.stats}>
        <StatCard title="My invoices" value="—" subtitle="Awaiting live data" />

        <StatCard title="This month" value="—" subtitle="Awaiting live data" />
      </View>

      <SectionHeader title="Quick access" />

      <Pressable
        style={styles.action}
        onPress={() => router.push("/(technician)/history")}
      >
        <History color={colors.primary} size={23} />
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>My invoice history</Text>
          <Text style={styles.actionSubtitle}>
            View invoices created by you
          </Text>
        </View>
        <ChevronRight color={colors.textSecondary} />
      </Pressable>

      <Pressable onPress={handleLogout} style={styles.logout}>
        <LogOut color={colors.danger} size={19} />
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  name: {
    fontSize: 23,
    fontWeight: "800",
    color: colors.text,
  },
  role: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  profile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    padding: 22,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    gap: 8,
  },
  bannerLabel: {
    color: "#D8E4FF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  bannerTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "800",
  },
  bannerSubtitle: {
    color: "#E2EAFF",
    fontSize: 13,
    lineHeight: 20,
  },
  createButton: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  createIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#FFFFFF30",
    alignItems: "center",
    justifyContent: "center",
  },
  createTitle: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 15,
  },
  createSubtitle: {
    color: "#D8E4FF",
    fontSize: 11,
    marginTop: 4,
  },
  stats: {
    flexDirection: "row",
    gap: 12,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 17,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
  actionSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 15,
  },
  logoutText: {
    color: colors.danger,
    fontWeight: "700",
  },
});
