import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Hash,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  UserRound,
} from "lucide-react-native";

import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "../../src/components/ui/ScreenContainer";
import { AppInput } from "../../src/components/ui/AppInput";
import { AppButton } from "../../src/components/ui/AppButton";
import {
  createTechnician,
  type CreateTechnicianInput,
} from "../../src/lib/technicians-api";
import { colors } from "../../src/theme/colors";
import { spacing, radius } from "../../src/theme/spacing";

const technicianSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(150, "Full name cannot exceed 150 characters"),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .max(255, "Email cannot exceed 255 characters"),
    mobile: z
      .string()
      .trim()
      .max(20, "Mobile number cannot exceed 20 characters"),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(128, "Password cannot exceed 128 characters"),
    confirmPassword: z.string().min(1, "Please confirm the password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type TechnicianFormValues = z.infer<typeof technicianSchema>;

export default function CreateTechnicianScreen() {
  const queryClient = useQueryClient();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TechnicianFormValues>({
    resolver: zodResolver(technicianSchema),
    mode: "onBlur",
    defaultValues: {
      fullName: "",
      email: "",
      mobile: "",
      password: "",
      confirmPassword: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateTechnicianInput) => createTechnician(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["technicians"],
      });

      Alert.alert(
        "Technician created",
        "The technician account has been created successfully.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );
    },
    onError: (error: Error) => {
      Alert.alert(
        "Unable to create technician",
        error.message || "Something went wrong. Please try again.",
      );
    },
  });

  const onSubmit = (values: TechnicianFormValues) => {
    const input: CreateTechnicianInput = {
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      mobile: values.mobile.trim() || null,
      password: values.password,
    };

    createMutation.mutate(input);
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={21} color={colors.text} />
          </Pressable>

          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Add Technician</Text>
            <Text style={styles.subtitle}>
              Create a technician account for your organization.
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Technician account</Text>
          <Text style={styles.infoDescription}>
            The new technician will be able to sign in using the email address
            and password you provide.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Personal information</Text>

          <Controller
            control={control}
            name="fullName"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppInput
                label="Full name"
                placeholder="Enter technician's full name"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="words"
                error={errors.fullName?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppInput
                label="Email address"
                placeholder="technician@example.com"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.email?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="mobile"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppInput
                label="Mobile number (optional)"
                placeholder="Enter mobile number"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="phone-pad"
                error={errors.mobile?.message}
              />
            )}
          />

          <View style={styles.sectionDivider} />

          <Text style={styles.sectionTitle}>Login credentials</Text>

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppInput
                label="Password"
                placeholder="Enter a password"
                isPassword
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.password?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppInput
                label="Confirm password"
                placeholder="Re-enter the password"
                value={value}
                isPassword
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.confirmPassword?.message}
              />
            )}
          />

          <Text style={styles.passwordHint}>
            Password must contain between 12 and 128 characters.
          </Text>

          <View style={styles.actions}>
            <AppButton
              title="Create Technician"
              onPress={handleSubmit(onSubmit)}
              loading={createMutation.isPending}
              disabled={createMutation.isPending}
            />

            <AppButton
              title="Cancel"
              variant="secondary"
              onPress={() => router.back()}
              disabled={createMutation.isPending}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: 32,
    lineHeight: 36,
    color: colors.text,
    marginTop: -4,
  },
  headerTextContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: 23,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  infoCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    gap: spacing.xs,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  infoDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  form: {
    gap: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  passwordContainer: {
    position: "relative",
  },
  passwordToggle: {
    position: "absolute",
    right: spacing.md,
    top: 39,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    zIndex: 1,
  },
  passwordToggleText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 13,
  },
  passwordHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -spacing.md,
  },
  actions: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
});
