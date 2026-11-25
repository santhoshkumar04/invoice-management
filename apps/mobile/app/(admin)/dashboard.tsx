import { StyleSheet, Text, View, Pressable } from "react-native";

import { useRouter } from "expo-router";

import {
  FileText,
  Users,
  Settings,
  LogOut,
  Receipt,
  UserRound,
} from "lucide-react-native";

import { ScreenContainer } from "../../src/components/ui/ScreenContainer";

import { StatCard } from "../../src/components/dashboard/StatCard";

import { SectionHeader } from "../../src/components/dashboard/SectionHeader";

import { useAuthStore } from "../../src/stores/auth.store";

import { colors } from "../../src/theme/colors";
import { radius } from "../../src/theme/spacing";

export default function AdminDashboard() {
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
          <Text style={styles.greeting}>Good day,</Text>
          <Text style={styles.name}>{user?.fullName ?? "Administrator"}</Text>
          <Text style={styles.role}>Administrator</Text>
        </View>

        <Pressable
          onPress={() => router.push("/(admin)/profile")}
          style={styles.profile}
        >
          <UserRound color={colors.primary} size={23} />
        </Pressable>
      </View>

      <View style={styles.banner}>
        <View>
          <Text style={styles.bannerLabel}>BUSINESS OVERVIEW</Text>
          <Text style={styles.bannerTitle}>Invoice management</Text>
          <Text style={styles.bannerSubtitle}>
            Manage your business billing in one place.
          </Text>
        </View>
        <Receipt color={colors.white} size={35} />
      </View>

      <SectionHeader title="Overview" />

      <View style={styles.stats}>
        <StatCard
          title="Total invoices"
          value="—"
          subtitle="Awaiting live data"
        />

        <StatCard
          title="Total billed"
          value="—"
          subtitle="Awaiting live data"
        />

        <StatCard title="Outstanding" value="—" subtitle="Awaiting live data" />

        <StatCard title="Customers" value="—" subtitle="Awaiting live data" />
      </View>

      <SectionHeader title="Management" />

      <View style={styles.actions}>
        <Action
          icon={<FileText color={colors.primary} />}
          title="Invoices"
          subtitle="View and manage invoices"
          onPress={() => router.push("/(admin)/invoices")}
        />

        <Action
          icon={<Users color={colors.primary} />}
          title="Customers"
          subtitle="Manage customer information"
          onPress={() => router.push("/(admin)/customers")}
        />

        <Action
          icon={<Users color={colors.primary} />}
          title="Team"
          subtitle="Manage technicians"
          onPress={() => router.push("/(admin)/team")}
        />

        <Action
          icon={<Settings color={colors.primary} />}
          title="Settings"
          subtitle="Business profile and preferences"
          onPress={() => router.push("/(admin)/settings")}
        />
      </View>

      <Pressable onPress={handleLogout} style={styles.logout}>
        <LogOut color={colors.danger} size={19} />
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScreenContainer>
  );
}

function Action({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.action}>
      <View style={styles.actionIcon}>{icon}</View>

      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    backgroundColor: colors.primary,
    padding: 22,
    borderRadius: radius.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerLabel: {
    color: "#D8E4FF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  bannerTitle: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 8,
  },
  bannerSubtitle: {
    color: "#E2EAFF",
    fontSize: 12,
    marginTop: 5,
  },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actions: {
    gap: 10,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  actionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
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
