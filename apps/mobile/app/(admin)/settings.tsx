import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";

import { router } from "expo-router";



import { ArrowLeft } from "lucide-react-native";

import { AppButton } from "../../src/components/ui/AppButton";
import { AppInput } from "../../src/components/ui/AppInput";
import { ScreenContainer } from "../../src/components/ui/ScreenContainer";

import {
  useOrganization,
  useUpdateOrganization,
} from "../../src/hooks/use-organization";

import type {
  Organization,
  UpdateOrganizationInput,
} from "../../src/lib/organizations-api";

import { ApiError } from "../../src/lib/api-client";

import { colors } from "../../src/theme/colors";
import { radius, spacing } from "../../src/theme/spacing";

type FormState = {
  name: string;
  businessDescription: string;
  logoUrl: string;
  vendorCode: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  state: string;
  stateCode: string;
  postalCode: string;
  country: string;

  email: string;
  mobile: string;

  gstin: string;
  pan: string;

  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;

  authorizedSignatory: string;
  invoiceFooter: string;
};

const emptyForm: FormState = {
  name: "",
  businessDescription: "",
  logoUrl: "",
  vendorCode: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  state: "",
  stateCode: "",
  postalCode: "",
  country: "India",

  email: "",
  mobile: "",

  gstin: "",
  pan: "",

  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",

  authorizedSignatory: "",
  invoiceFooter: "",
};

function toFormState(organization: Organization): FormState {
  return {
    name: organization.name ?? "",
    businessDescription: organization.businessDescription ?? "",
    logoUrl: organization.logoUrl ?? "",
    vendorCode: organization.vendorCode ?? "",
    addressLine1: organization.addressLine1 ?? "",
    addressLine2: organization.addressLine2 ?? "",
    city: organization.city ?? "",
    district: organization.district ?? "",
    state: organization.state ?? "",
    stateCode: organization.stateCode ?? "",
    postalCode: organization.postalCode ?? "",
    country: organization.country ?? "India",

    email: organization.email ?? "",
    mobile: organization.mobile ?? "",

    gstin: organization.gstin ?? "",
    pan: organization.pan ?? "",

    bankName: organization.bankName ?? "",
    bankAccountName: organization.bankAccountName ?? "",
    bankAccountNumber: organization.bankAccountNumber ?? "",
    bankIfsc: organization.bankIfsc ?? "",

    authorizedSignatory: organization.authorizedSignatory ?? "",
    invoiceFooter: organization.invoiceFooter ?? "",
  };
}

function toUpdateInput(form: FormState): UpdateOrganizationInput {
  const nullable = (value: string) => value.trim() || null;

  return {
    name: form.name.trim(),
    businessDescription: nullable(form.businessDescription),
    logoUrl: nullable(form.logoUrl),
    vendorCode: nullable(form.vendorCode),
    addressLine1: nullable(form.addressLine1),
    addressLine2: nullable(form.addressLine2),
    city: nullable(form.city),
    district: nullable(form.district),
    state: nullable(form.state),
    stateCode: nullable(form.stateCode),
    postalCode: nullable(form.postalCode),
    country: form.country.trim() || "India",

    email: nullable(form.email),
    mobile: nullable(form.mobile),

    gstin: nullable(form.gstin)?.toUpperCase() ?? null,
    pan: nullable(form.pan)?.toUpperCase() ?? null,

    bankName: nullable(form.bankName),
    bankAccountName: nullable(form.bankAccountName),
    bankAccountNumber: nullable(form.bankAccountNumber),
    bankIfsc: nullable(form.bankIfsc)?.toUpperCase() ?? null,

    authorizedSignatory: nullable(form.authorizedSignatory),
    invoiceFooter: nullable(form.invoiceFooter),
  };
}

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

export default function SettingsScreen() {
  const organizationQuery = useOrganization();
  const updateMutation = useUpdateOrganization();

  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (organizationQuery.data) {
      setForm(toFormState(organizationQuery.data));
    }
  }, [organizationQuery.data]);

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert("Validation", "Company name is required.");
      return;
    }

    if (form.stateCode.trim() && !/^\d{2}$/.test(form.stateCode.trim())) {
      Alert.alert("Validation", "State code must contain exactly two digits.");
      return;
    }

    try {
      await updateMutation.mutateAsync(toUpdateInput(form));

      Alert.alert("Saved", "Company profile has been updated successfully.");
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Unable to update company profile. Please try again.";

      Alert.alert("Update failed", message);
    }
  }

  if (organizationQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading company profile...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (organizationQuery.isError) {
    return (
      <ScreenContainer>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to load company profile</Text>
          <Text style={styles.errorDescription}>
            Check your connection and try again.
          </Text>
          <AppButton
            title="Retry"
            onPress={() => organizationQuery.refetch()}
            loading={organizationQuery.isFetching}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Company Profile</Text>
        <Text style={styles.subtitle}>
          Manage the company information displayed on your invoices.
        </Text>
      </View>

      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={21} color={colors.text} />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.title}>Add Technician</Text>
          <Text style={styles.subtitle}>
            Create a technician account for your organization.
          </Text>
        </View>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          Changes apply to newly created invoices. Previously saved invoice
          snapshots retain their original company details.
        </Text>
      </View>

      <Section
        title="Company information"
        description="Your registered business identity."
      >
        <AppInput
          label="Company name *"
          value={form.name}
          onChangeText={(value) => updateField("name", value)}
          placeholder="Enter company name"
          maxLength={200}
        />

        <AppInput
          label="Business description"
          value={form.businessDescription}
          onChangeText={(value) => updateField("businessDescription", value)}
          placeholder="e.g. Electrical and maintenance services"
          maxLength={200}
        />

        <AppInput
          label="Company Vendor Code"
          value={form.vendorCode}
          onChangeText={(value) => updateField("vendorCode", value)}
          placeholder="Enter company vendor code"
          maxLength={50}
          autoCapitalize="characters"
        />

        <AppInput
          label="Company logo URL"
          value={form.logoUrl}
          onChangeText={(value) => updateField("logoUrl", value)}
          placeholder="https://example.com/logo.png"
          autoCapitalize="none"
          keyboardType="url"
        />
      </Section>

      <Section
        title="Address"
        description="Used in the company address section of invoices."
      >
        <AppInput
          label="Address line 1"
          value={form.addressLine1}
          onChangeText={(value) => updateField("addressLine1", value)}
          maxLength={250}
        />

        <AppInput
          label="Address line 2"
          value={form.addressLine2}
          onChangeText={(value) => updateField("addressLine2", value)}
          maxLength={250}
        />

        <AppInput
          label="City"
          value={form.city}
          onChangeText={(value) => updateField("city", value)}
          maxLength={100}
        />

        <AppInput
          label="District"
          value={form.district}
          onChangeText={(value) => updateField("district", value)}
          maxLength={100}
        />

        <AppInput
          label="State"
          value={form.state}
          onChangeText={(value) => updateField("state", value)}
          maxLength={100}
        />

        <AppInput
          label="State code (2 digits)"
          value={form.stateCode}
          onChangeText={(value) => updateField("stateCode", value)}
          placeholder="e.g. 33"
          keyboardType="number-pad"
          maxLength={2}
        />

        <AppInput
          label="Postal code"
          value={form.postalCode}
          onChangeText={(value) => updateField("postalCode", value)}
          keyboardType="number-pad"
          maxLength={10}
        />

        <AppInput
          label="Country"
          value={form.country}
          onChangeText={(value) => updateField("country", value)}
          maxLength={100}
        />
      </Section>

      <Section
        title="Contact information"
        description="Contact details shown on invoices."
      >
        <AppInput
          label="Email"
          value={form.email}
          onChangeText={(value) => updateField("email", value)}
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={255}
        />

        <AppInput
          label="Mobile number"
          value={form.mobile}
          onChangeText={(value) => updateField("mobile", value)}
          keyboardType="phone-pad"
          maxLength={20}
        />
      </Section>

      <Section
        title="Tax information"
        description="GST is optional. Complete these details before creating GST invoices."
      >
        <AppInput
          label="GSTIN"
          value={form.gstin}
          onChangeText={(value) => updateField("gstin", value.toUpperCase())}
          autoCapitalize="characters"
          maxLength={15}
          placeholder="15-character GSTIN"
        />

        <AppInput
          label="PAN"
          value={form.pan}
          onChangeText={(value) => updateField("pan", value.toUpperCase())}
          autoCapitalize="characters"
          maxLength={10}
          placeholder="10-character PAN"
        />
      </Section>

      <Section
        title="Bank details"
        description="Displayed in the payment information section of invoices."
      >
        <AppInput
          label="Bank name"
          value={form.bankName}
          onChangeText={(value) => updateField("bankName", value)}
          maxLength={150}
        />

        <AppInput
          label="Account holder name"
          value={form.bankAccountName}
          onChangeText={(value) => updateField("bankAccountName", value)}
          maxLength={150}
        />

        <AppInput
          label="Account number"
          value={form.bankAccountNumber}
          onChangeText={(value) => updateField("bankAccountNumber", value)}
          keyboardType="number-pad"
          maxLength={50}
        />

        <AppInput
          label="IFSC code"
          value={form.bankIfsc}
          onChangeText={(value) => updateField("bankIfsc", value.toUpperCase())}
          autoCapitalize="characters"
          maxLength={11}
          placeholder="11-character IFSC"
        />
      </Section>

      <Section
        title="Invoice preferences"
        description="Signatory and footer printed at the bottom of invoices."
      >
        <AppInput
          label="Authorized signatory"
          value={form.authorizedSignatory}
          onChangeText={(value) => updateField("authorizedSignatory", value)}
          maxLength={150}
        />

        <AppInput
          label="Invoice footer"
          value={form.invoiceFooter}
          onChangeText={(value) => updateField("invoiceFooter", value)}
          placeholder="Thank you for your business"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={styles.multiline}
          maxLength={5000}
        />
      </Section>

      <View style={styles.saveContainer}>
        <AppButton
          title="Save company profile"
          onPress={handleSave}
          loading={updateMutation.isPending}
          disabled={updateMutation.isPending}
        />
      </View>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
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
  notice: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeText: {
    color: colors.primaryDark,
    fontSize: 13,
    lineHeight: 19,
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
  multiline: {
    height: 110,
    paddingTop: spacing.md,
  },
  saveContainer: {
    paddingTop: spacing.sm,
  },
  center: {
    flex: 1,
    minHeight: 260,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  loadingText: {
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
  errorDescription: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
