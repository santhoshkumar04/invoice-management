import { Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";

import { ScreenContainer } from "../../src/components/ui/ScreenContainer";
import { SectionHeader } from "../../src/components/dashboard/SectionHeader";
import { StatCard } from "../../src/components/dashboard/StatCard";

import {
  useOverviewReport,
  useSalesReport,
  usePaymentsReport,
  useOutstandingReport,
  useGstReport,
  useCustomersReport,
} from "../../src/hooks/use-reports";

import { colors } from "../../src/theme/colors";
import type { ReportDateRange } from "../../src/lib/reports-api";

function formatCurrency(value: string | undefined): string {
  if (value === undefined) return "—";

  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function reportValue(
  isPending: boolean,
  isError: boolean,
  value: string,
): string {
  if (isPending) return "...";
  if (isError) return "Unavailable";
  return value;
}

type ReportPreset = "month" | "lastMonth" | "financialYear" | "all";

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getReportDateRange(preset: ReportPreset): ReportDateRange {
  const now = new Date();
  const today = formatLocalDate(now);

  if (preset === "all") {
    return {};
  }

  if (preset === "month") {
    return {
      from: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: today,
    };
  }

  if (preset === "lastMonth") {
    return {
      from: formatLocalDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }

  const financialYearStart =
    now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  return {
    from: `${financialYearStart}-04-01`,
    to: today,
  };
}
export default function AdminReportsScreen() {
  const [selectedPeriod, setSelectedPeriod] =
    useState<ReportPreset>("month");

  const dateRange = getReportDateRange(selectedPeriod);

  const overview = useOverviewReport(dateRange);
  const sales = useSalesReport({ ...dateRange, groupBy: "month" });
  const payments = usePaymentsReport(dateRange);
  const outstanding = useOutstandingReport({
    ...dateRange,
    page: 1,
    limit: 20,
  });
  const gst = useGstReport(dateRange);
  const customers = useCustomersReport({
    ...dateRange,
    page: 1,
    limit: 20,
  });

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Reports & Analytics</Text>
        <Text style={styles.subtitle}>
          Business performance and financial summaries
        </Text>
      </View>

      <View style={styles.periodContainer}>
        {(
          [
            ["month", "This month"],
            ["lastMonth", "Last month"],
            ["financialYear", "Financial year"],
            ["all", "All time"],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setSelectedPeriod(value)}
            style={[
              styles.periodButton,
              selectedPeriod === value && styles.periodButtonActive,
            ]}
          >
            <Text
              style={[
                styles.periodText,
                selectedPeriod === value && styles.periodTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader title="Overview" />

      <View style={styles.stats}>
        <StatCard
          title="Invoices"
          value={reportValue(
            overview.isPending,
            overview.isError,
            String(overview.data?.invoiceCount ?? 0),
          )}
        />
        <StatCard
          title="Billed"
          value={reportValue(
            overview.isPending,
            overview.isError,
            formatCurrency(overview.data?.billedTotal),
          )}
        />
        <StatCard
          title="Collected"
          value={reportValue(
            overview.isPending,
            overview.isError,
            formatCurrency(overview.data?.collectedTotal),
          )}
        />
        <StatCard
          title="Outstanding"
          value={reportValue(
            overview.isPending,
            overview.isError,
            formatCurrency(overview.data?.outstandingTotal),
          )}
        />
      </View>

      <SectionHeader title="Sales" />

      <View style={styles.panel}>
        <ReportRow
          label="Invoice count"
          value={reportValue(
            sales.isPending,
            sales.isError,
            String(
              sales.data?.data.reduce(
                (total, row) => total + row.invoiceCount,
                0,
              ) ?? 0,
            ),
          )}
        />
        <ReportRow
          label="Billed total"
          value={reportValue(
            sales.isPending,
            sales.isError,
            formatCurrency(
              sales.data?.data.reduce(
                (total, row) => total + Number(row.billedTotal),
                0,
              ).toString(),
            ),
          )}
        />
      </View>

      <SectionHeader title="Payments" />

      <View style={styles.panel}>
        <ReportRow
          label="Payment count"
          value={reportValue(
            payments.isPending,
            payments.isError,
            String(payments.data?.summary.paymentCount ?? 0),
          )}
        />
        <ReportRow
          label="Collected total"
          value={reportValue(
            payments.isPending,
            payments.isError,
            formatCurrency(payments.data?.summary.collectedTotal),
          )}
        />
      </View>

      <SectionHeader title="Outstanding invoices" />

      <View style={styles.panel}>
        <ReportRow
          label="Matching invoices"
          value={reportValue(
            outstanding.isPending,
            outstanding.isError,
            String(outstanding.data?.pagination.total ?? 0),
          )}
        />
        <ReportRow
          label="Current page"
          value={reportValue(
            outstanding.isPending,
            outstanding.isError,
            `${outstanding.data?.pagination.page ?? 0} / ${outstanding.data?.pagination.totalPages ?? 0}`,
          )}
        />
      </View>

      <SectionHeader title="GST" />

      <View style={styles.panel}>
        <ReportRow
          label="Taxable value"
          value={reportValue(
            gst.isPending,
            gst.isError,
            formatCurrency(gst.data?.summary.taxableTotal),
          )}
        />
        <ReportRow
          label="Total tax"
          value={reportValue(
            gst.isPending,
            gst.isError,
            formatCurrency(gst.data?.summary.totalTax),
          )}
        />
        <ReportRow
          label="CGST"
          value={reportValue(
            gst.isPending,
            gst.isError,
            formatCurrency(gst.data?.summary.cgstTotal),
          )}
        />
        <ReportRow
          label="SGST"
          value={reportValue(
            gst.isPending,
            gst.isError,
            formatCurrency(gst.data?.summary.sgstTotal),
          )}
        />
        <ReportRow
          label="IGST"
          value={reportValue(
            gst.isPending,
            gst.isError,
            formatCurrency(gst.data?.summary.igstTotal),
          )}
        />
      </View>

      <SectionHeader title="Customers" />

      <View style={styles.panel}>
        <ReportRow
          label="Customers"
          value={reportValue(
            customers.isPending,
            customers.isError,
            String(customers.data?.summary.customerCount ?? 0),
          )}
        />
        <ReportRow
          label="Billed total"
          value={reportValue(
            customers.isPending,
            customers.isError,
            formatCurrency(customers.data?.summary.billedTotal),
          )}
        />
        <ReportRow
          label="Outstanding total"
          value={reportValue(
            customers.isPending,
            customers.isError,
            formatCurrency(customers.data?.summary.outstandingTotal),
          )}
        />
      </View>
    </ScreenContainer>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  periodContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  periodTextActive: {
    color: colors.white,
  },  header: {
    gap: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    textAlign: "right",
  },
});

