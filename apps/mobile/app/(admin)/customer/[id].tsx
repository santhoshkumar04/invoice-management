import { useLocalSearchParams, router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
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

import {
  useCustomer,
  useUpdateCustomerStatus,
} from "../../../src/hooks/use-customers";
import { ScreenContainer } from "../../../src/components/ui/ScreenContainer";
import { AppButton } from "../../../src/components/ui/AppButton";
import type { Customer } from "../../../src/lib/customers-api";
import { colors } from "../../../src/theme/colors";
import { radius } from "../../../src/theme/spacing";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>{icon}</View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>
          {value?.trim() || "Not provided"}
        </Text>
      </View>
    </View>
  );
}

function CustomerProfile({ customer }: { customer: Customer }) {
  const address = [
    customer.addressLine1,
    customer.addressLine2,
    customer.city,
    customer.district,
    customer.state,
    customer.stateCode ? `State code: ${customer.stateCode}` : null,
    customer.postalCode,
    customer.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {getInitials(customer.customerName)}
          </Text>
        </View>

        <Text style={styles.customerName}>{customer.customerName}</Text>

        <Text style={styles.companyName}>
          {customer.companyName || "Individual customer"}
        </Text>

        <View
          style={[
            styles.statusBadge,
            customer.isActive ? styles.activeBadge : styles.inactiveBadge,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: customer.isActive
                  ? colors.success
                  : colors.danger,
              },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              {
                color: customer.isActive ? colors.success : colors.danger,
              },
            ]}
          >
            {customer.isActive ? "Active" : "Inactive"}
          </Text>
        </View>

        {customer.vendorCode ? (
          <Text style={styles.vendorCode}>
            Vendor code: {customer.vendorCode}
          </Text>
        ) : null}
      </View>

      <DetailSection title="Contact information">
        <DetailRow
          icon={<UserRound size={19} color={colors.textSecondary} />}
          label="Contact person"
          value={customer.contactPerson}
        />
        <DetailRow
          icon={<Mail size={19} color={colors.textSecondary} />}
          label="Email address"
          value={customer.email}
        />
        <DetailRow
          icon={<Phone size={19} color={colors.textSecondary} />}
          label="Mobile number"
          value={customer.mobile}
        />
      </DetailSection>

      <DetailSection title="Billing address">
        <DetailRow
          icon={<MapPin size={19} color={colors.textSecondary} />}
          label="Full address"
          value={address}
        />
      </DetailSection>

      <DetailSection title="Tax and business details">
        <DetailRow
          icon={<Building2 size={19} color={colors.textSecondary} />}
          label="GSTIN"
          value={customer.gstin}
        />
        <DetailRow
          icon={<Hash size={19} color={colors.textSecondary} />}
          label="PAN"
          value={customer.pan}
        />
        <DetailRow
          icon={<Hash size={19} color={colors.textSecondary} />}
          label="Vendor code"
          value={customer.vendorCode}
        />
      </DetailSection>

      <DetailSection title="Additional information">
        <DetailRow
          icon={<CalendarDays size={19} color={colors.textSecondary} />}
          label="Created"
          value={formatDate(customer.createdAt)}
        />
        <DetailRow
          icon={<CalendarDays size={19} color={colors.textSecondary} />}
          label="Last updated"
          value={formatDate(customer.updatedAt)}
        />
        <View style={styles.notesContainer}>
          <Text style={styles.detailLabel}>Notes</Text>
          <Text style={styles.notesText}>
            {customer.notes?.trim() || "No additional notes"}
          </Text>
        </View>
      </DetailSection>

      <View style={styles.idContainer}>
        <Text style={styles.detailLabel}>Customer ID</Text>
        <Text selectable style={styles.idText}>
          {customer.id}
        </Text>
      </View>
    </>
  );
}

export default function CustomerDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const customerId = typeof params.id === "string" ? params.id : "";

  const customerQuery = useCustomer(customerId);
  const statusMutation = useUpdateCustomerStatus();

  const handleToggleCustomerStatus = (customer: Customer) => {
    const nextStatus = !customer.isActive;

    const action = nextStatus ? "activate" : "deactivate";

    Alert.alert(
      `${nextStatus ? "Activate" : "Deactivate"} customer?`,
      nextStatus
        ? "This customer will become available for normal customer operations again."
        : "This customer will become inactive and unavailable to technicians. Existing invoice records will be preserved.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: nextStatus ? "Activate" : "Deactivate",
          style: nextStatus ? "default" : "destructive",
          onPress: () => {
            statusMutation.mutate(
              {
                id: customer.id,
                isActive: nextStatus,
              },
              {
                onSuccess: () => {
                  Alert.alert(
                    "Customer updated",
                    `Customer has been ${nextStatus ? "activated" : "deactivated"} successfully.`,
                  );
                },
                onError: (error: Error) => {
                  Alert.alert(
                    "Unable to update customer status",
                    error.message || "Something went wrong. Please try again.",
                  );
                },
              },
            );
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={21} color={colors.text} />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.title}>Customer details</Text>
          <Text style={styles.subtitle}>Complete customer profile</Text>
        </View>

        <Pressable
          onPress={() => void customerQuery.refetch()}
          disabled={customerQuery.isFetching || !customerId}
          style={styles.refreshButton}
          accessibilityRole="button"
          accessibilityLabel="Refresh customer details"
        >
          {customerQuery.isFetching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <RefreshCw size={19} color={colors.primary} />
          )}
        </Pressable>
      </View>

      {!customerId ? (
        <View style={styles.stateCard}>
          <Text style={styles.errorTitle}>Invalid customer</Text>
          <Text style={styles.stateText}>
            A valid customer ID was not provided.
          </Text>
          <AppButton title="Go back" onPress={() => router.back()} />
        </View>
      ) : customerQuery.isPending ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>Loading customer details...</Text>
        </View>
      ) : customerQuery.isError ? (
        <View style={styles.stateCard}>
          <Text style={styles.errorTitle}>Unable to load customer</Text>
          <Text style={styles.stateText}>
            {customerQuery.error instanceof Error
              ? customerQuery.error.message
              : "Something went wrong. Please try again."}
          </Text>
          <AppButton
            title="Try again"
            onPress={() => void customerQuery.refetch()}
          />
          <AppButton
            title="Go back"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      ) : customerQuery.data ? (
        <>
          <CustomerProfile customer={customerQuery.data} />

          <AppButton
            title="Edit Customer"
            onPress={() =>
              router.push({
                pathname: "/(admin)/customer-edit",
                params: { id: customerQuery.data.id },
              })
            }
          />

          <AppButton
            title={
              customerQuery.data.isActive
                ? "Deactivate Customer"
                : "Activate Customer"
            }
            variant="secondary"
            loading={statusMutation.isPending}
            disabled={statusMutation.isPending}
            onPress={() => handleToggleCustomerStatus(customerQuery.data)}
          />

          <AppButton
            title="Back to customers"
            variant="secondary"
            onPress={() => router.back()}
          />
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 43,
    height: 43,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  profileCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 22,
    gap: 9,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
  },
  customerName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  companyName: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 3,
  },
  activeBadge: {
    backgroundColor: colors.successLight,
  },
  inactiveBadge: {
    backgroundColor: colors.dangerLight,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  vendorCode: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  sectionContent: {
    gap: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  detailText: {
    flex: 1,
    gap: 4,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
    fontWeight: "600",
  },
  notesContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 7,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
  },
  idContainer: {
    padding: 13,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: 6,
  },
  idText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  stateCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 22,
    alignItems: "center",
    gap: 14,
  },
  stateText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.danger,
  },
});
