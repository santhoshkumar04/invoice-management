import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Search,
  Plus,
  Users,
  Mail,
  Phone,
  MapPin,
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
  UserRound,
  Hash,
} from "lucide-react-native";

import { router } from "expo-router";

import { useCustomers, useCustomer } from "../../src/hooks/use-customers";

import type {
  Customer,
  CustomerStatusFilter,
} from "../../src/lib/customers-api";

import { useAuthStore } from "../../src/stores/auth.store";

import { ScreenContainer } from "../../src/components/ui/ScreenContainer";
import { AppInput } from "../../src/components/ui/AppInput";
import { AppButton } from "../../src/components/ui/AppButton";

import { colors } from "../../src/theme/colors";
import { radius, spacing } from "../../src/theme/spacing";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: {
  label: string;
  value: CustomerStatusFilter;
}[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "All", value: "all" },
];

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CustomersScreen() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CustomerStatusFilter>("active");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );

  // Technicians must only see active customers.
  const effectiveStatus: CustomerStatusFilter = isAdmin ? status : "active";

  const customersQuery = useCustomers({
    page,
    limit: PAGE_SIZE,
    search: search.trim(),
    status: effectiveStatus,
  });

  const detailQuery = useCustomer(selectedCustomerId ?? "");

  const customers = customersQuery.data?.items ?? [];
  const pagination = customersQuery.data?.pagination;

  const totalPages = Math.max(pagination?.totalPages ?? 1, 1);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: CustomerStatusFilter) => {
    setStatus(value);
    setPage(1);
  };

  const handleRefresh = async () => {
    await customersQuery.refetch();
  };

  const handleAddCustomer = () => {
    router.push("/(admin)/customer-create");
  };

  const handleOpenCustomer = (customer: Customer) => {
    router.push({
      pathname: "/(admin)/customer/[id]",
      params: { id: customer.id },
    });
  };

  const handleCloseDetails = () => {
    setSelectedCustomerId(null);
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>ORGANIZATION</Text>

          <Text style={styles.title}>Customers</Text>

          <Text style={styles.subtitle}>
            Manage your organization's customer information.
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Users size={25} color={colors.primary} />
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <Users size={23} color={colors.white} />
        </View>

        <View style={styles.summaryContent}>
          <Text style={styles.summaryLabel}>TOTAL CUSTOMERS</Text>

          <Text style={styles.summaryValue}>
            {pagination ? pagination.total : "—"}
          </Text>
        </View>

        {isAdmin && (
          <Pressable
            onPress={handleAddCustomer}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.pressed,
            ]}
          >
            <Plus size={19} color={colors.white} />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={19} color={colors.textSecondary} />

        <View style={styles.searchInput}>
          <AppInput
            label="Search customers"
            placeholder="Name, company, email or mobile"
            value={search}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Admin status filters */}
      {isAdmin && (
        <View style={styles.filterContainer}>
          {STATUS_OPTIONS.map((option) => {
            const selected = status === option.value;

            return (
              <Pressable
                key={option.value}
                onPress={() => handleStatusChange(option.value)}
                style={[
                  styles.filterButton,
                  selected && styles.filterButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    selected && styles.filterTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Section heading */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            {isAdmin
              ? status === "active"
                ? "Active customers"
                : status === "inactive"
                  ? "Inactive customers"
                  : "All customers"
              : "Customers"}
          </Text>

          <Text style={styles.sectionSubtitle}>
            {pagination
              ? `${pagination.total} customer records`
              : "Customer directory"}
          </Text>
        </View>

        <Pressable
          onPress={handleRefresh}
          style={styles.refreshButton}
          disabled={customersQuery.isFetching}
        >
          {customersQuery.isFetching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.refreshText}>Refresh</Text>
          )}
        </Pressable>
      </View>

      {/* Loading */}
      {customersQuery.isPending ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text style={styles.stateText}>Loading customers...</Text>
        </View>
      ) : customersQuery.isError ? (
        /* Error */
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Unable to load customers</Text>

          <Text style={styles.errorText}>
            {customersQuery.error instanceof Error
              ? customersQuery.error.message
              : "Something went wrong. Please try again."}
          </Text>

          <AppButton
            title="Try again"
            onPress={() => void customersQuery.refetch()}
          />
        </View>
      ) : customers.length === 0 ? (
        /* Empty */
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Users size={30} color={colors.primary} />
          </View>

          <Text style={styles.emptyTitle}>
            {search.trim()
              ? "No customers found"
              : status === "inactive"
                ? "No inactive customers"
                : "No customers yet"}
          </Text>

          <Text style={styles.emptyText}>
            {search.trim()
              ? "Try another customer name, company, email or mobile number."
              : status === "inactive"
                ? "There are no inactive customer records."
                : "Customer records will appear here once they are added."}
          </Text>

          {isAdmin && !search.trim() && status !== "inactive" && (
            <AppButton title="Add customer" onPress={handleAddCustomer} />
          )}
        </View>
      ) : (
        <>
          {/* Customer list */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={
                  customersQuery.isFetching && !customersQuery.isPending
                }
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {customers.map((customer) => (
              <Pressable
                key={customer.id}
                onPress={() => handleOpenCustomer(customer)}
                style={({ pressed }) => [
                  styles.customerCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.customerTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {getInitials(customer.customerName)}
                    </Text>
                  </View>

                  <View style={styles.customerInfo}>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {customer.customerName}
                    </Text>

                    <Text style={styles.customerCompany} numberOfLines={1}>
                      {customer.companyName || "Individual customer"}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      customer.isActive
                        ? styles.activeBadge
                        : styles.inactiveBadge,
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
                          color: customer.isActive
                            ? colors.success
                            : colors.danger,
                        },
                      ]}
                    >
                      {customer.isActive ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.customerBottom}>
                  <View style={styles.mobileInfo}>
                    <Phone size={14} color={colors.textSecondary} />

                    <Text style={styles.mobileText}>
                      {customer.mobile || "No mobile"}
                    </Text>
                  </View>

                  <Text style={styles.viewDetails}>View details {"›"}</Text>
                </View>

                {customer.vendorCode ? (
                  <View style={styles.vendorCode}>
                    <Hash size={12} color={colors.textSecondary} />

                    <Text style={styles.vendorCodeText}>
                      {customer.vendorCode}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>

          {/* Pagination */}
          <View style={styles.pagination}>
            <Text style={styles.paginationText}>
              Page {pagination?.page ?? page} of {totalPages}
            </Text>

            <View style={styles.paginationActions}>
              <Pressable
                onPress={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                style={[
                  styles.pageButton,
                  page <= 1 && styles.pageButtonDisabled,
                ]}
              >
                <ChevronLeft
                  size={19}
                  color={page <= 1 ? colors.textSecondary : colors.primary}
                />
              </Pressable>

              <Pressable
                onPress={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages}
                style={[
                  styles.pageButton,
                  page >= totalPages && styles.pageButtonDisabled,
                ]}
              >
                <ChevronRight
                  size={19}
                  color={
                    page >= totalPages ? colors.textSecondary : colors.primary
                  }
                />
              </Pressable>
            </View>
          </View>
        </>
      )}

      {/* Customer details modal */}
      <Modal
        visible={Boolean(selectedCustomerId)}
        transparent
        animationType="slide"
        onRequestClose={handleCloseDetails}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Customer details</Text>

              <Pressable
                onPress={handleCloseDetails}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close customer details"
              >
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            {detailQuery.isPending ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={colors.primary} />

                <Text style={styles.stateText}>
                  Loading customer details...
                </Text>
              </View>
            ) : detailQuery.isError ? (
              <View style={styles.modalLoading}>
                <Text style={styles.errorText}>
                  {detailQuery.error instanceof Error
                    ? detailQuery.error.message
                    : "Unable to load customer details."}
                </Text>

                <AppButton
                  title="Retry"
                  onPress={() => void detailQuery.refetch()}
                />
              </View>
            ) : detailQuery.data ? (
              <ScrollView
                style={styles.detailsScroll}
                showsVerticalScrollIndicator={false}
              >
                <CustomerDetails customer={detailQuery.data} />
              </ScrollView>
            ) : null}

            <AppButton
              title="Close"
              variant="secondary"
              onPress={handleCloseDetails}
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function CustomerDetails({ customer }: { customer: Customer }) {
  const address = [
    customer.addressLine1,
    customer.addressLine2,
    customer.city,
    customer.district,
    customer.state,
    customer.postalCode,
    customer.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={styles.detailsContent}>
      <View style={styles.detailProfile}>
        <View style={styles.detailAvatar}>
          <Text style={styles.detailAvatarText}>
            {getInitials(customer.customerName)}
          </Text>
        </View>

        <Text style={styles.detailName}>{customer.customerName}</Text>

        <Text style={styles.detailCompany}>
          {customer.companyName || "Individual customer"}
        </Text>

        <View
          style={[
            styles.statusBadge,
            customer.isActive ? styles.activeBadge : styles.inactiveBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color: customer.isActive ? colors.success : colors.danger,
              },
            ]}
          >
            {customer.isActive ? "Active customer" : "Inactive customer"}
          </Text>
        </View>
      </View>

      <DetailRow
        icon={<UserRound size={18} color={colors.textSecondary} />}
        label="Contact person"
        value={customer.contactPerson || "Not provided"}
      />

      <DetailRow
        icon={<Mail size={18} color={colors.textSecondary} />}
        label="Email"
        value={customer.email || "Not provided"}
      />

      <DetailRow
        icon={<Phone size={18} color={colors.textSecondary} />}
        label="Mobile"
        value={customer.mobile || "Not provided"}
      />

      <DetailRow
        icon={<MapPin size={18} color={colors.textSecondary} />}
        label="Address"
        value={address || "Not provided"}
      />

      <DetailRow
        icon={<Building2 size={18} color={colors.textSecondary} />}
        label="GSTIN"
        value={customer.gstin || "Not provided"}
      />

      <DetailRow
        icon={<Hash size={18} color={colors.textSecondary} />}
        label="PAN"
        value={customer.pan || "Not provided"}
      />

      <DetailRow
        icon={<Hash size={18} color={colors.textSecondary} />}
        label="Vendor code"
        value={customer.vendorCode || "Not provided"}
      />

      <DetailRow
        icon={<Building2 size={18} color={colors.textSecondary} />}
        label="Created"
        value={formatDate(customer.createdAt)}
      />
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
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailRowIcon}>{icon}</View>

      <View style={styles.detailRowContent}>
        <Text style={styles.detailLabel}>{label}</Text>

        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
    gap: 5,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 27,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryIcon: {
    width: 45,
    height: 45,
    borderRadius: radius.md,
    backgroundColor: "#FFFFFF25",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    color: "#D8E4FF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  summaryValue: {
    color: colors.white,
    fontSize: 26,
    fontWeight: "800",
    marginTop: 3,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF25",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 13,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 13,
    gap: 10,
  },
  searchInput: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
  },
  filterButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  filterButtonSelected: {
    backgroundColor: colors.primaryLight,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  filterTextSelected: {
    color: colors.primary,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 17,
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  refreshButton: {
    padding: 8,
  },
  refreshText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  centerState: {
    padding: 35,
    alignItems: "center",
    gap: 12,
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  list: {
    flexGrow: 0,
    maxHeight: 470,
  },
  listContent: {
    gap: 12,
    paddingBottom: 5,
  },
  customerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    gap: 13,
  },
  pressed: {
    opacity: 0.75,
  },
  customerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  customerInfo: {
    flex: 1,
    gap: 4,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  customerCompany: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  activeBadge: {
    backgroundColor: colors.successLight,
  },
  inactiveBadge: {
    backgroundColor: colors.dangerLight,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  customerBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mobileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mobileText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  viewDetails: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  vendorCode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  vendorCodeText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 5,
  },
  paginationText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  paginationActions: {
    flexDirection: "row",
    gap: 8,
  },
  pageButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  emptyCard: {
    padding: 25,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 12,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  errorCard: {
    backgroundColor: colors.dangerLight,
    padding: 18,
    borderRadius: radius.lg,
    gap: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.danger,
  },
  errorText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#00000070",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 22,
    paddingBottom: 30,
    gap: 18,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  modalLoading: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
  },
  detailsScroll: {
    flexGrow: 0,
  },
  detailsContent: {
    gap: 15,
  },
  detailProfile: {
    alignItems: "center",
    gap: 7,
    paddingVertical: 10,
  },
  detailAvatar: {
    width: 65,
    height: 65,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  detailAvatarText: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: "800",
  },
  detailName: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  detailCompany: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  detailRowContent: {
    flex: 1,
    gap: 4,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
});
