import { useState } from "react";

import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";

import { useRouter } from "expo-router";

import { LockKeyhole, ReceiptText } from "lucide-react-native";

import { AppButton } from "../../src/components/ui/AppButton";
import { AppInput } from "../../src/components/ui/AppInput";
import { ScreenContainer } from "../../src/components/ui/ScreenContainer";

import { useAuthStore } from "../../src/stores/auth.store";

import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";

export default function LoginScreen() {
  const router = useRouter();

  const { signIn, isLoading } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing information", "Enter your email and password.");
      return;
    }

    try {
      const normalizedEmail = email.trim().toLowerCase();

      await signIn(normalizedEmail, password);

      const user = useAuthStore.getState().user;

      if (user?.role === "admin") {
        router.replace("/(admin)/dashboard");
      } else if (user?.role === "technician") {
        router.replace("/(technician)/dashboard");
      }
    } catch (error) {
      Alert.alert(
        "Login failed",
        error instanceof Error
          ? error.message
          : "Unable to log in. Please try again.",
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logo}>
            <ReceiptText size={38} color={colors.primary} />
          </View>

          <View style={styles.heading}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to manage your invoices.
            </Text>
          </View>

          <View style={styles.form}>
            <AppInput
              label="Email address"
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />

            <AppInput
              label="Password"
              isPassword
              placeholder="Enter your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <AppButton
              title="Sign in"
              onPress={handleLogin}
              loading={isLoading}
              disabled={!email.trim() || !password}
            />
          </View>

          <View style={styles.footer}>
            <LockKeyhole size={15} color={colors.textSecondary} />
            <Text style={styles.footerText}>
              Secure access to your business account
            </Text>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 26,
    paddingVertical: 30,
    gap: 28,
  },

  logo: {
    width: 76,
    height: 76,
    backgroundColor: colors.primaryLight,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },

  heading: {
    alignItems: "center",
    gap: spacing.sm,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
  },

  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
  },

  form: {
    gap: 20,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  footerText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
