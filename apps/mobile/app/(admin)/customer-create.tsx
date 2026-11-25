import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { ScreenContainer } from "../../src/components/ui/ScreenContainer";
import { AppInput } from "../../src/components/ui/AppInput";
import { AppButton } from "../../src/components/ui/AppButton";
import { useCreateCustomer } from "../../src/hooks/use-customers";
import type { CreateCustomerInput } from "../../src/lib/customers-api";
import { colors } from "../../src/theme/colors";
import { radius, spacing } from "../../src/theme/spacing";

const customerSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, "Customer name must be at least 2 characters")
    .max(200, "Customer name cannot exceed 200 characters"),

  companyName: z.string().max(200, "Company name cannot exceed 200 characters"),
  contactPerson: z
    .string()
    .max(150, "Contact person cannot exceed 150 characters"),

  email: z
    .string()
    .trim()
    .max(255, "Email cannot exceed 255 characters")
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Enter a valid email address",
    ),

  mobile: z.string().max(20, "Mobile number cannot exceed 20 characters"),

  addressLine1: z.string().max(250, "Address cannot exceed 250 characters"),
  addressLine2: z.string().max(250, "Address cannot exceed 250 characters"),

  city: z.string().max(100, "City cannot exceed 100 characters"),
  district: z.string().max(100, "District cannot exceed 100 characters"),
  state: z.string().max(100, "State cannot exceed 100 characters"),
  stateCode: z.string().max(10, "State code cannot exceed 10 characters"),
  postalCode: z.string().max(10, "Postal code cannot exceed 10 characters"),
  country: z.string().trim().min(1, "Country is required").max(100),

  gstin: z.string().max(15, "GSTIN cannot exceed 15 characters"),
  pan: z.string().max(10, "PAN cannot exceed 10 characters"),
  vendorCode: z.string().max(50, "Vendor code cannot exceed 50 characters"),
  notes: z.string(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

const defaultValues: CustomerFormValues = {
  customerName: "",
  companyName: "",
  contactPerson: "",
  email: "",
  mobile: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  state: "",
  stateCode: "",
  postalCode: "",
  country: "India",
  gstin: "",
  pan: "",
  vendorCode: "",
  notes: "",
};

function optionalValue(value: string): string | null {
  return value.trim() || null;
}

export default function CreateCustomerScreen() {
  const createMutation = useCreateCustomer();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    mode: "onBlur",
    defaultValues,
  });

  const onSubmit = (values: CustomerFormValues) => {
    const input: CreateCustomerInput = {
      customerName: values.customerName.trim(),
      companyName: optionalValue(values.companyName),
      contactPerson: optionalValue(values.contactPerson),
      email: optionalValue(values.email)?.toLowerCase() ?? null,
      mobile: optionalValue(values.mobile),
      addressLine1: optionalValue(values.addressLine1),
      addressLine2: optionalValue(values.addressLine2),
      city: optionalValue(values.city),
      district: optionalValue(values.district),
      state: optionalValue(values.state),
      stateCode: optionalValue(values.stateCode),
      postalCode: optionalValue(values.postalCode),
      country: values.country.trim(),
      gstin: optionalValue(values.gstin)?.toUpperCase() ?? null,
      pan: optionalValue(values.pan)?.toUpperCase() ?? null,
      vendorCode: optionalValue(values.vendorCode),
      notes: optionalValue(values.notes),
    };

    createMutation.mutate(input, {
      onSuccess: () => {
        Alert.alert(
          "Customer created",
          "The customer has been added successfully.",
          [{ text: "OK", onPress: () => router.back() }],
        );
      },
      onError: (error: Error) => {
        Alert.alert(
          "Unable to create customer",
          error.message || "Something went wrong. Please try again.",
        );
      },
    });
  };

  function field(
    name: keyof CustomerFormValues,
    label: string,
    placeholder: string,
    options: {
      keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
      autoCapitalize?: "none" | "sentences" | "words" | "characters";
      multiline?: boolean;
    } = {},
  ) {
    return (
      <Controller
        key={name}
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <AppInput
            label={label}
            placeholder={placeholder}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType={options.keyboardType ?? "default"}
            autoCapitalize={options.autoCapitalize ?? "sentences"}
            autoCorrect={false}
            multiline={options.multiline}
            error={errors[name]?.message}
          />
        )}
      />
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            disabled={createMutation.isPending}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>Add Customer</Text>
            <Text style={styles.subtitle}>
              Enter customer and billing information.
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Customer information</Text>
          <Text style={styles.infoDescription}>
            Only the customer name is required. You can add the remaining
            details now or update them later.
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Basic information</Text>

          {field("customerName", "Customer name *", "Enter customer name")}
          {field("companyName", "Company name", "Enter company name")}
          {field("contactPerson", "Contact person", "Enter contact person")}

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Contact information</Text>

          {field("email", "Email address", "customer@example.com", {
            keyboardType: "email-address",
            autoCapitalize: "none",
          })}
          {field("mobile", "Mobile number", "Enter mobile number", {
            keyboardType: "phone-pad",
          })}

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Billing address</Text>

          {field("addressLine1", "Address line 1", "Building, street, area")}
          {field("addressLine2", "Address line 2", "Landmark, locality")}
          {field("city", "City", "Enter city")}
          {field("district", "District", "Enter district")}
          {field("state", "State", "Enter state")}
          {field("stateCode", "State code", "Enter state code", {
            autoCapitalize: "characters",
          })}
          {field("postalCode", "Postal code", "Enter postal code", {
            keyboardType: "numeric",
          })}
          {field("country", "Country *", "India")}

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Tax and business details</Text>

          {field("gstin", "GSTIN", "Enter GSTIN", {
            autoCapitalize: "characters",
          })}
          {field("pan", "PAN", "Enter PAN", {
            autoCapitalize: "characters",
          })}
          {field("vendorCode", "Vendor code", "Enter vendor code", {
            autoCapitalize: "characters",
          })}

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Additional information</Text>

          {field("notes", "Notes", "Enter additional customer notes", {
            multiline: true,
          })}

          <View style={styles.actions}>
            <AppButton
              title="Create Customer"
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
        </ScrollView>
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
    fontSize: 30,
    color: colors.text,
    lineHeight: 35,
  },
  headerText: {
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
  scroll: {
    flex: 1,
  },
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  actions: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
});
