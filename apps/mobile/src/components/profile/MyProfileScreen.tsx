import { useEffect, useState } from "react";

import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import { useRouter } from "expo-router";

import { AppButton } from "../ui/AppButton";
import { AppInput } from "../ui/AppInput";
import { ScreenContainer } from "../ui/ScreenContainer";

import {
  useChangeMyPassword,
  useMyProfile,
  useUpdateMyProfile,
} from "../../hooks/use-profile";

import { useOrganization } from "../../hooks/use-organization";

import { useAuthStore } from "../../stores/auth.store";

import { colors } from "../../theme/colors";
import { radius, spacing } from "../../theme/spacing";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? (
          <Text style={styles.sectionDescription}>{description}</Text>
        ) : null}
      </View>

      <View style={styles.fields}>{children}</View>
    </View>
  );
}

export function MyProfileScreen() {
  const router = useRouter();

  const clearLocalSession = useAuthStore((state) => state.clearLocalSession);

  const profileQuery = useMyProfile();
  const updateMutation = useUpdateMyProfile();
  const passwordMutation = useChangeMyPassword();
  const organizationQuery = useOrganization();

  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (profileQuery.data) {
      setFullName(profileQuery.data.fullName);
      setMobile(profileQuery.data.mobile ?? "");
    }
  }, [profileQuery.data]);

  async function handleSaveProfile() {
    if (fullName.trim().length < 2) {
      Alert.alert("Validation", "Enter your full name.");
      return;
    }

    if (mobile.trim().length > 20) {
      Alert.alert("Validation", "Mobile number is too long.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        fullName: fullName.trim(),
        mobile: mobile.trim() || null,
      });

      Alert.alert("Saved", "Your profile has been updated.");
    } catch (error) {
      Alert.alert(
        "Update failed",
        error instanceof Error
          ? error.message
          : "Unable to update your profile.",
      );
    }
  }

  async function handleChangePassword() {
    if (!currentPassword) {
      Alert.alert("Validation", "Enter your current password.");
      return;
    }

    if (newPassword.length < 12 || newPassword.length > 128) {
      Alert.alert(
        "Validation",
        "New password must contain between 12 and 128 characters.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Validation", "New passwords do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      Alert.alert(
        "Validation",
        "New password must be different from your current password.",
      );
      return;
    }

    try {
      await passwordMutation.mutateAsync({
        currentPassword,
        newPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      await clearLocalSession();

      Alert.alert(
        "Password changed",
        "Your password has been changed. Please sign in again.",
        [
          {
            text: "Sign in",
            onPress: () => router.replace("/(auth)/login"),
          },
        ],
        { cancelable: false },
      );
    } catch (error) {
      Alert.alert(
        "Password change failed",
        error instanceof Error
          ? error.message
          : "Unable to change your password.",
      );
    }
  }

  if (profileQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.muted}>Loading your profile...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <ScreenContainer>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to load your profile</Text>
          <Text style={styles.muted}>Check your connection and try again.</Text>
          <AppButton
            title="Retry"
            onPress={() => profileQuery.refetch()}
            loading={profileQuery.isFetching}
          />
        </View>
      </ScreenContainer>
    );
  }

  const profile = profileQuery.data;

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>
          Manage your personal account information and password.
        </Text>
      </View>

      <View style={styles.identityCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile.fullName.trim().charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.identityDetails}>
          <Text style={styles.identityName}>{profile.fullName}</Text>
          <Text style={styles.identityEmail}>{profile.email}</Text>
          <Text style={styles.role}>
            {profile.role === "admin" ? "Administrator" : "Technician"}
          </Text>
        </View>
      </View>

      <Section
        title="Personal information"
        description="Update your own contact details."
      >
        <AppInput
          label="Full name *"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
          autoCapitalize="words"
          maxLength={150}
        />

        <AppInput
          label="Email address"
          value={profile.email}
          editable={false}
        />

        <AppInput
          label="Mobile number"
          value={mobile}
          onChangeText={setMobile}
          placeholder="Enter mobile number"
          keyboardType="phone-pad"
          maxLength={20}
        />

        <AppInput
          label="Account role"
          value={profile.role === "admin" ? "Administrator" : "Technician"}
          editable={false}
        />

        <AppButton
          title="Save profile"
          onPress={handleSaveProfile}
          loading={updateMutation.isPending}
          disabled={updateMutation.isPending}
        />
      </Section>

      <Section
        title="Company information"
        description="Your organization details are managed by your administrator."
      >
        {organizationQuery.isLoading ? (
          <Text style={styles.muted}>Loading company information...</Text>
        ) : organizationQuery.data ? (
          <>
            <Text style={styles.identityName}>
              {organizationQuery.data.name}
            </Text>

            {organizationQuery.data.vendorCode ? (
              <Text style={styles.muted}>
                Company Vendor Code: {organizationQuery.data.vendorCode}
              </Text>
            ) : null}

            <Text style={styles.muted}>
              {[
                organizationQuery.data.addressLine1,
                organizationQuery.data.addressLine2,
                organizationQuery.data.city,
                organizationQuery.data.state,
                organizationQuery.data.postalCode,
                organizationQuery.data.country,
              ]
                .filter(Boolean)
                .join(", ") || "Company address not provided"}
            </Text>

            {organizationQuery.data.email ? (
              <Text style={styles.muted}>
                Email: {organizationQuery.data.email}
              </Text>
            ) : null}

            {organizationQuery.data.mobile ? (
              <Text style={styles.muted}>
                Mobile: {organizationQuery.data.mobile}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.muted}>
            Company information is currently unavailable.
          </Text>
        )}
      </Section>

      <Section
        title="Change password"
        description="Use your current password to set a new password."
      >
        <AppInput
          label="Current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={128}
        />

        <AppInput
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={128}
        />

        <AppInput
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={128}
        />

        <Text style={styles.passwordHint}>
          Use at least 12 characters. You will need to sign in again after
          changing your password.
        </Text>

        <AppButton
          title="Change password"
          onPress={handleChangePassword}
          loading={passwordMutation.isPending}
          disabled={passwordMutation.isPending}
        />
      </Section>

      <View style={styles.accountInfo}>
        <Text style={styles.accountInfoTitle}>Account information</Text>
        <Text style={styles.accountInfoText}>
          Email address, organization, role and account activation are managed
          by your administrator. Contact your administrator if these details
          need to be changed.
        </Text>
      </View>

      <AppButton
        title="Back to dashboard"
        variant="secondary"
        onPress={() => router.back()}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: colors.white,
    fontSize: 25,
    fontWeight: "800",
  },
  identityDetails: {
    flex: 1,
    gap: 3,
  },
  identityName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  identityEmail: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  role: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  sectionHeading: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  fields: {
    gap: spacing.lg,
  },
  passwordHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  accountInfo: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  accountInfoTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
  accountInfoText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  center: {
    flex: 1,
    minHeight: 260,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  muted: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    minHeight: 260,
    justifyContent: "center",
    gap: spacing.md,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
});
