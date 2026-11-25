import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";

import { QueryProvider } from "../src/providers/QueryProvider";
import { useAuthStore } from "../src/stores/auth.store";
import { colors } from "../src/theme/colors";

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();

  const { user, isAuthenticated, isInitialized, initialize } =
    useAuthStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitialized) return;

    const firstSegment = segments[0];

    if (!isAuthenticated) {
      if (firstSegment !== "(auth)") {
        router.replace("/(auth)/login");
      }
      return;
    }

    if (!user) return;

    if (firstSegment === "(auth)") {
      router.replace(
        user.role === "admin"
          ? "/(admin)/dashboard"
          : "/(technician)/dashboard",
      );
      return;
    }

    if (firstSegment === "(admin)" && user.role !== "admin") {
      router.replace("/(technician)/dashboard");
      return;
    }

    if (firstSegment === "(technician)" && user.role !== "technician") {
      router.replace("/(admin)/dashboard");
    }
  }, [isInitialized, isAuthenticated, user, segments, router]);

  return (
    <>
      <StatusBar style="dark" />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(technician)" />
        <Stack.Screen name="invoice/[id]" />
        <Stack.Screen name="invoice-pdf-preview" />
      </Stack>

      {!isInitialized && (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 1000,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryProvider>
      <RootNavigator />
    </QueryProvider>
  );
}
