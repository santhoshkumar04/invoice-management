import { useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { router } from "expo-router";

import {
  FileText,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react-native";

import { useInvoices } from "../../hooks/use-invoices";

import type {
  InvoiceListItem,
  InvoiceStatus,
} from "../../lib/invoices-api";

import { ScreenContainer } from "../ui/ScreenContainer";
import { AppInput } from "../ui/AppInput";
import { AppButton } from "../ui/AppButton";

import { colors } from "../../theme/colors";
import { radius, spacing } from "../../theme/spacing";

type UserRole = "admin" | "technician";

interface Props {
  role: UserRole;
}

const PAGE_SIZE = 10;

const STATUS_OPTIONS: {
  label: string;
  value: InvoiceStatus | "all";
}[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Issued", value: "issued" },
  { label: "Partial", value: "partially_paid" },
  { label: "Paid", value: "paid" },
  { label: "Cancelled", value: "cancelled" },
];

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(value: string, currency: string): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `${currency} ${value}`;
  }

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function getStatusStyle(status: InvoiceStatus) {
  switch (status) {
    case "draft":
      return {
        backgroundColor: colors.primaryLight,
        color: colors.primary,
        label: "Draft",
      };

    case "issued":
      return {
        backgroundColor: colors.warningLight,
        color: colors.warning,
        label: "Issued",
      };

    case "partially_paid":
      return {
        backgroundColor: colors.warningLight,
        color: colors.warning,
        label: "Partially paid",
      };

    case "paid":
      return {
        backgroundColor: colors.successLight,
        color: colors.success,
        label: "Paid",
      };

    case "cancelled":
      return {
        backgroundColor: colors.dangerLight,
        color: colors.danger,
        label: "Cancelled",
      };
  }
}

function getCustomerName(invoice: InvoiceListItem): string {
  return (
    invoice.customer?.companyName ||
    invoice.customer?.customerName ||
    "Unknown customer"
  );
}

export function InvoiceListScreen({ role }: Props) {
  const isAdmin = role === "admin";

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");

  const invoicesQuery = useInvoices({
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    status,
  });

  const invoices = invoicesQuery.data?.items ?? [];
  const pagination = invoicesQuery.data?.pagination;

  const totalPages = Math.max(pagination?.totalPages ?? 1, 1);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: InvoiceStatus | "all") => {
    setStatus(value);
    setPage(1);
  };

  const handleCreateInvoice = () => {
    if (isAdmin) {
      router.push("/(admin)/invoice-create");
    } else {
      router.push("/(technician)/create-invoice");
    }
  };

  const handleOpenInvoice = (invoice: InvoiceListItem) => {
    router.push({
      pathname: "/invoice/[id]",
      params: { id: invoice.id },
    });
  };

  const handleRefresh = () => {
    void invoicesQuery.refetch();
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>
            {isAdmin ? "ORGANIZATION" : "MY WORKSPACE"}
          </Text>

          <Text style={styles.title}>
            {isAdmin ? "Invoices" : "My invoice history"}
          </Text>

          <Text style={styles.subtitle}>
            {isAdmin
              ? "View and manage your organization's invoices."
              : "View invoices created by you."}
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <FileText size={25} color={colors.primary} />
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <FileText size={23} color={colors.white} />
        </View>

        <View style={styles.summaryContent}>
          <Text style={styles.summaryLabel}>
            {isAdmin ? "TOTAL INVOICES" : "MY TOTAL INVOICES"}
          </Text>

          <Text style={styles.summaryValue}>
            {pagination ? pagination.total : "—"}
          </Text>
        </View>

        <Pressable
          onPress={handleCreateInvoice}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.pressed,
          ]}
        >
          <Plus size={19} color={colors.white} />
          <Text style={styles.addButtonText}>Create</Text>
        </Pressable>
      </View>

      <View style={styles.searchContainer}>
        <Search size={19} color={colors.textSecondary} />

        <View style={styles.searchInput}>
          <AppInput
            label="Search invoices"
            placeholder="Invoice number or customer"
            value={search}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

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

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            {status === "all"
              ? "All invoices"
              : `${STATUS_OPTIONS.find((item) => item.value === status)?.label ?? "Invoices"} invoices`}
          </Text>

          <Text style={styles.sectionSubtitle}>
            {pagination
              ? `${pagination.total} invoice records`
              : "Invoice records"}
          </Text>
        </View>

        <Pressable
          onPress={handleRefresh}
          style={styles.refreshButton}
          disabled={invoicesQuery.isFetching}
        >
          {invoicesQuery.isFetching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <RefreshCw size={18} color={colors.primary} />
          )}
        </Pressable>
      </View>

      {invoicesQuery.isPending ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>Loading invoices...</Text>
        </View>
      ) : invoicesQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Unable to load invoices</Text>

          <Text style={styles.errorText}>
            {invoicesQuery.error instanceof Error
              ? invoicesQuery.error.message
              : "Something went wrong. Please try again."}
          </Text>

          <AppButton
            title="Try again"
            onPress={() => void invoicesQuery.refetch()}
          />
        </View>
      ) : invoices.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <FileText size={30} color={colors.primary} />
          </View>

          <Text style={styles.emptyTitle}>
            {search.trim()
              ? "No invoices found"
              : status !== "all"
                ? "No invoices in this status"
                : "No invoices yet"}
          </Text>

          <Text style={styles.emptyText}>
            {search.trim()
              ? "Try another invoice number or customer name."
              : status !== "all"
                ? "There are no invoices matching this status."
                : "Create your first invoice to see it here."}
          </Text>

          {!search.trim() && status === "all" ? (
            <AppButton
              title="Create invoice"
              onPress={handleCreateInvoice}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.listContent}>
          {invoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              isAdmin={isAdmin}
              onPress={() => handleOpenInvoice(invoice)}
            />
          ))}
        </View>
      )}

      {!invoicesQuery.isPending &&
      !invoicesQuery.isError &&
      invoices.length > 0 ? (
        <View style={styles.pagination}>
          <Text style={styles.paginationText}>
            Page {pagination?.page ?? page} of {totalPages}
          </Text>

          <View style={styles.paginationActions}>
            <Pressable
              onPress={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || invoicesQuery.isFetching}
              style={[
                styles.pageButton,
                (page <= 1 || invoicesQuery.isFetching) &&
                  styles.pageButtonDisabled,
              ]}
            >
              <Text style={styles.pageButtonText}>Previous</Text>
            </Pressable>

            <Pressable
              onPress={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages || invoicesQuery.isFetching}
              style={[
                styles.pageButton,
                (page >= totalPages || invoicesQuery.isFetching) &&
                  styles.pageButtonDisabled,
              ]}
            >
              <Text style={styles.pageButtonText}>Next</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

function InvoiceCard({
  invoice,
  isAdmin,
  onPress,
}: {
  invoice: InvoiceListItem;
  isAdmin: boolean;
  onPress: () => void;
}) {
  const statusStyle = getStatusStyle(invoice.status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.invoiceCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.invoiceTop}>
        <View style={styles.invoiceNumberContainer}>
          <Text style={styles.invoiceNumber}>
            {invoice.invoiceNumber || "Unnumbered invoice"}
          </Text>

          <Text style={styles.invoiceDate}>
            {formatDate(invoice.invoiceDate)}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusStyle.backgroundColor },
          ]}
        >
          <Text style={[styles.statusText, { color: statusStyle.color }]}>
            {statusStyle.label}
          </Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <Text style={styles.customerName} numberOfLines={1}>
        {getCustomerName(invoice)}
      </Text>

      {invoice.customer?.companyName ? (
        <Text style={styles.customerSecondary} numberOfLines={1}>
          {invoice.customer.customerName}
        </Text>
      ) : null}

      {isAdmin ? (
        <Text style={styles.creatorText}>
          Created by: {invoice.createdByName || "Unknown"}
        </Text>
      ) : null}

      <View style={styles.cardDivider} />

      <View style={styles.invoiceBottom}>
        <View>
          <Text style={styles.amountLabel}>GRAND TOTAL</Text>

          <Text style={styles.amountValue}>
            {formatAmount(invoice.grandTotal, invoice.currency)}
          </Text>
        </View>

        <Text style={styles.viewDetails}>View details ›</Text>
      </View>
    </Pressable>
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
    flexWrap: "wrap",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
  },
  filterButton: {
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  filterButtonSelected: {
    backgroundColor: colors.primaryLight,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 11,
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
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
  listContent: {
    gap: 12,
  },
  invoiceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    gap: 12,
  },
  pressed: {
    opacity: 0.75,
  },
  invoiceTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  invoiceNumberContainer: {
    flex: 1,
    gap: 5,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  invoiceDate: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  customerSecondary: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  creatorText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  invoiceBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  amountLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.textSecondary,
    letterSpacing: 0.7,
  },
  amountValue: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    marginTop: 4,
  },
  viewDetails: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
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
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
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
});
