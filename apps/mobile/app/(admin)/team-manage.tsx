import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "../../src/components/ui/ScreenContainer";
import { AppInput } from "../../src/components/ui/AppInput";
import { AppButton } from "../../src/components/ui/AppButton";
import {
  getTechnician,
  updateTechnician,
  updateTechnicianStatus,
  resetTechnicianPassword,
  type UpdateTechnicianInput,
} from "../../src/lib/technicians-api";
import { colors } from "../../src/theme/colors";
import { spacing, radius } from "../../src/theme/spacing";

const editSchema = z.object({
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
});

type EditFormValues = z.infer<typeof editSchema>;

const passwordSchema = z
  .object({
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

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function ManageTechnicianScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const technicianQuery = useQuery({
    queryKey: ["technicians", "detail", id],
    queryFn: () => getTechnician(id),
    enabled: Boolean(id),
  });

  const technician = technicianQuery.data;

  const {
    control,
    handleSubmit,
    reset: resetEditForm,
    formState: { errors: editErrors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    values: {
      fullName: technician?.fullName ?? "",
      email: technician?.email ?? "",
      mobile: technician?.mobile ?? "",
    },
  });

  const {
    control: passwordControl,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const refreshTechnicianData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["technicians"] }),
      queryClient.invalidateQueries({ queryKey: ["technician"] }),
    ]);
  };

  const editMutation = useMutation({
    mutationFn: (input: UpdateTechnicianInput) => updateTechnician(id, input),
    onSuccess: async () => {
      await refreshTechnicianData();
      Alert.alert("Updated", "Technician details updated successfully.");
    },
    onError: (error: Error) => {
      Alert.alert(
        "Update failed",
        error.message || "Unable to update technician details.",
      );
    },
  });

  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => updateTechnicianStatus(id, isActive),
    onSuccess: async (_result, isActive) => {
      await refreshTechnicianData();
      Alert.alert(
        isActive ? "Account activated" : "Account deactivated",
        isActive
          ? "The technician can now sign in."
          : "The technician can no longer sign in.",
      );
    },
    onError: (error: Error) => {
      Alert.alert(
        "Status update failed",
        error.message || "Unable to change account status.",
      );
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (newPassword: string) =>
      resetTechnicianPassword(id, newPassword),
    onSuccess: async () => {
      resetPasswordForm();
      setShowPasswordForm(false);
      await refreshTechnicianData();
      Alert.alert(
        "Password reset",
        "The technician's password has been changed successfully.",
      );
    },
    onError: (error: Error) => {
      Alert.alert(
        "Password reset failed",
        error.message || "Unable to reset the password.",
      );
    },
  });

  const onSaveDetails = (values: EditFormValues) => {
    const input: UpdateTechnicianInput = {
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      mobile: values.mobile.trim() || null,
    };

    editMutation.mutate(input);
  };

  const onResetPassword = (values: PasswordFormValues) => {
    passwordMutation.mutate(values.password);
  };

  const confirmStatusChange = () => {
    if (!technician) return;

    const nextStatus = !technician.isActive;
    const action = nextStatus ? "activate" : "deactivate";

    Alert.alert(
      `${action === "activate" ? "Activate" : "Deactivate"} account?`,
      nextStatus
        ? "This technician will be able to sign in again."
        : "This technician will no longer be able to sign in. Their invoice history will be preserved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: nextStatus ? "Activate" : "Deactivate",
          style: nextStatus ? "default" : "destructive",
          onPress: () => statusMutation.mutate(nextStatus),
        },
      ],
    );
  };

  if (technicianQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.muted}>Loading technician...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (technicianQuery.isError || !technician) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Technician unavailable</Text>
        <Text style={styles.muted}>
          We couldn't load this technician. Check your connection and try again.
        </Text>
        <AppButton
          title="Retry"
          onPress={() => technicianQuery.refetch()}
          loading={technicianQuery.isFetching}
        />
        <AppButton
          title="Go back"
          variant="secondary"
          onPress={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  const isBusy =
    editMutation.isPending ||
    statusMutation.isPending ||
    passwordMutation.isPending;

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Manage Technician</Text>
          <Text style={styles.subtitle}>
            Update account information and security settings.
          </Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {technician.fullName.trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileText}>
              <Text style={styles.profileName}>{technician.fullName}</Text>
              <Text style={styles.profileEmail}>{technician.email}</Text>
            </View>
          </View>

          <View
            style={[
              styles.statusPill,
              technician.isActive ? styles.activePill : styles.inactivePill,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                technician.isActive ? styles.activeText : styles.inactiveText,
              ]}
            >
              {technician.isActive ? "Active account" : "Inactive account"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal information</Text>

          <Controller
            control={control}
            name="fullName"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppInput
                label="Full name"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="words"
                error={editErrors.fullName?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppInput
                label="Email address"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={editErrors.email?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="mobile"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppInput
                label="Mobile number"
                placeholder="Optional"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="phone-pad"
                error={editErrors.mobile?.message}
              />
            )}
          />

          <AppButton
            title="Save Changes"
            onPress={handleSubmit(onSaveDetails)}
            loading={editMutation.isPending}
            disabled={isBusy}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account status</Text>
          <Text style={styles.muted}>
            {technician.isActive
              ? "This technician currently has access to the application."
              : "This technician's access is currently disabled."}
          </Text>
          <AppButton
            title={
              technician.isActive ? "Deactivate Account" : "Activate Account"
            }
            variant={technician.isActive ? "danger" : "primary"}
            onPress={confirmStatusChange}
            loading={statusMutation.isPending}
            disabled={isBusy}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Password and security</Text>
          <Text style={styles.muted}>
            Set a new password for this technician. The new password must be
            shared with them securely.
          </Text>

          {!showPasswordForm ? (
            <AppButton
              title="Reset Password"
              variant="secondary"
              onPress={() => setShowPasswordForm(true)}
              disabled={isBusy}
            />
          ) : (
            <View style={styles.passwordForm}>
              <Controller
                control={passwordControl}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput
                    label="New password"
                    placeholder="Enter new password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={passwordErrors.password?.message}
                  />
                )}
              />

              <Controller
                control={passwordControl}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput
                    label="Confirm new password"
                    placeholder="Re-enter new password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={passwordErrors.confirmPassword?.message}
                  />
                )}
              />

              <Text style={styles.passwordHint}>
                Password must contain between 12 and 128 characters.
              </Text>

              <AppButton
                title="Save New Password"
                onPress={handlePasswordSubmit(onResetPassword)}
                loading={passwordMutation.isPending}
                disabled={isBusy}
              />

              <AppButton
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  resetPasswordForm();
                  setShowPasswordForm(false);
                }}
                disabled={passwordMutation.isPending}
              />
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Account created:{" "}
            {new Date(technician.createdAt).toLocaleDateString()}
          </Text>
          <AppButton
            title="Back to Team"
            variant="secondary"
            onPress={() => router.back()}
            disabled={isBusy}
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    minHeight: 180,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  header: {
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
  profileCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "700",
  },
  profileText: {
    flex: 1,
    gap: spacing.xs,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  profileEmail: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  activePill: {
    backgroundColor: colors.successLight,
  },
  inactivePill: {
    backgroundColor: colors.dangerLight,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  activeText: {
    color: colors.success,
  },
  inactiveText: {
    color: colors.danger,
  },
  section: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  passwordForm: {
    gap: spacing.lg,
  },
  passwordHint: {
    marginTop: -spacing.md,
    fontSize: 12,
    color: colors.textSecondary,
  },
  footer: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
