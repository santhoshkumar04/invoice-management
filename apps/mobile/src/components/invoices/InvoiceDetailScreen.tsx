import { router, useLocalSearchParams } from "expo-router";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { ArrowLeft, FileText, MapPin } from "lucide-react-native";

import {
  useInvoice,
  useInvoicePayments,
  useIssueInvoice,
  useCancelInvoice,
  useRecordInvoicePayment,
  useInvoiceAdjustments,
  useCreateInvoiceAdjustment,
  useInvoiceDocuments,
} from "../../hooks/use-invoices";

import { useMyProfile } from "../../hooks/use-profile";
import { downloadInvoiceDocument } from "../../lib/invoices-api";

import { amountInWords } from "../../lib/amount-in-words";

import type {
  InvoiceDetail,
  InvoiceLineItem,
  InvoiceStatus,
  PaymentMethod,
  InvoiceAdjustmentType,
  InvoiceDocument,
} from "../../lib/invoices-api";

import { ScreenContainer } from "../ui/ScreenContainer";
import { AppButton } from "../ui/AppButton";

import { colors } from "../../theme/colors";
import { radius, spacing } from "../../theme/spacing";

type DataRecord = Record<string, unknown>;

function asRecord(value: unknown): DataRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as DataRecord;
  }

  return {};
}

function readString(record: DataRecord, key: string): string | null {
  const value = record[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";

  const datePart = value.slice(0, 10);
  const date = new Date(`${datePart}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(value: string | number, currency: string): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `${currency} ${String(value)}`;
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

function getStatus(status: InvoiceStatus) {
  switch (status) {
    case "draft":
      return {
        label: "Draft",
        background: colors.primaryLight,
        foreground: colors.primary,
      };

    case "issued":
      return {
        label: "Issued",
        background: colors.warningLight,
        foreground: colors.warning,
      };

    case "partially_paid":
      return {
        label: "Partially paid",
        background: colors.warningLight,
        foreground: colors.warning,
      };

    case "paid":
      return {
        label: "Paid",
        background: colors.successLight,
        foreground: colors.success,
      };

    case "cancelled":
      return {
        label: "Cancelled",
        background: colors.dangerLight,
        foreground: colors.danger,
      };
  }
}

function getAddress(record: DataRecord): string[] {
  return [
    readString(record, "addressLine1"),
    readString(record, "addressLine2"),
    readString(record, "city"),
    readString(record, "district"),
    readString(record, "state"),
    readString(record, "postalCode"),
    readString(record, "country"),
  ].filter((value): value is string => Boolean(value));
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function InvoiceItemCard({
  item,
  currency,
  isGstApplicable,
  supplyType,
}: {
  item: InvoiceLineItem;
  currency: string;
  isGstApplicable: boolean;
  supplyType: InvoiceDetail["supplyType"];
}) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemHeading}>
        <View style={styles.itemNumber}>
          <Text style={styles.itemNumberText}>{item.lineNumber}</Text>
        </View>

        <Text style={styles.itemDescription}>{item.description}</Text>
      </View>

      <View style={styles.itemCalculation}>
        <Text style={styles.itemCalculationText}>
          {Number(item.quantity).toLocaleString("en-IN")} ×{" "}
          {formatAmount(item.rate, currency)}
        </Text>

        <Text style={styles.itemAmount}>
          {formatAmount(item.amount, currency)}
        </Text>
      </View>

      {isGstApplicable ? (
        <View style={styles.itemTaxContainer}>
          <Text style={styles.itemTaxTitle}>GST {Number(item.gstRate)}%</Text>

          {supplyType === "intra_state" ? (
            <>
              <Text style={styles.itemTaxText}>
                CGST: {formatAmount(item.cgstAmount, currency)}
              </Text>
              <Text style={styles.itemTaxText}>
                SGST: {formatAmount(item.sgstAmount, currency)}
              </Text>
            </>
          ) : (
            <Text style={styles.itemTaxText}>
              IGST: {formatAmount(item.igstAmount, currency)}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function InvoiceContent({
  invoice,
  isAdmin,
  isIssuing,
  isCancelling,
  onIssue,
  onCancel,
}: {
  invoice: InvoiceDetail;
  isAdmin: boolean;
  isIssuing: boolean;
  isCancelling: boolean;
  onIssue: () => void;
  onCancel: () => void;
}) {
  const snapshot = asRecord(invoice.snapshot);
  const snapshotOrganization = asRecord(snapshot.organization);
  const snapshotCustomer = asRecord(snapshot.customer);

  const organization = snapshotOrganization;
  const customer =
    Object.keys(snapshotCustomer).length > 0
      ? snapshotCustomer
      : asRecord(invoice.customer);

  const status = getStatus(invoice.status);

  const paymentsQuery = useInvoicePayments(invoice.id);

  const paymentMutation = useRecordInvoicePayment();

  const adjustmentsQuery = useInvoiceAdjustments(invoice.id);

  const adjustmentMutation = useCreateInvoiceAdjustment();
  const documentsQuery = useInvoiceDocuments(invoice.id);

  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [isAdjustmentModalVisible, setIsAdjustmentModalVisible] =
    useState(false);
  const [adjustmentType, setAdjustmentType] =
    useState<InvoiceAdjustmentType>("credit");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");

  const balanceDue = paymentsQuery.data?.summary.balanceDue ?? "0";
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);
  async function handleDownloadInvoiceDocument(document: InvoiceDocument) {
    if (downloadingDocumentId) return;

    setDownloadingDocumentId(document.id);

    try {
      const documentDirectory = FileSystem.documentDirectory;

      if (!documentDirectory) {
        throw new Error("App document storage is unavailable.");
      }

      const directory = `${documentDirectory}invoices/`;

      await FileSystem.makeDirectoryAsync(directory, {
        intermediates: true,
      });

      const destinationUri = `${directory}${document.id}.pdf`;

      await downloadInvoiceDocument(
        document.id,
        destinationUri,
      );

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(destinationUri, {
          mimeType: "application/pdf",
          dialogTitle: document.fileName,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert(
          "PDF downloaded",
          `The document was saved to the app's private storage, but sharing is unavailable on this device.`,
        );
      }
    } catch (error) {
      Alert.alert(
        "Unable to download document",
        error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.",
      );
    } finally {
      setDownloadingDocumentId(null);
    }
  }

  function resetPaymentForm() {
    setPaymentAmount("");
    setPaymentReference("");
    setPaymentNotes("");
    setPaymentMethod("upi");
    setIsPaymentModalVisible(false);
  }

  function resetAdjustmentForm() {
    setAdjustmentType("credit");
    setAdjustmentAmount("");
    setAdjustmentReason("");
    setAdjustmentNotes("");
    setIsAdjustmentModalVisible(false);
  }

  function submitAdjustment() {
    const amount = Number(adjustmentAmount.trim());
    const reason = adjustmentReason.trim();

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(adjustmentAmount.trim())
    ) {
      Alert.alert(
        "Invalid amount",
        "Enter a positive adjustment amount with up to 2 decimal places.",
      );
      return;
    }

    if (reason.length < 5 || reason.length > 250) {
      Alert.alert(
        "Invalid reason",
        "Enter an adjustment reason between 5 and 250 characters.",
      );
      return;
    }

    Alert.alert(
      `Confirm ${adjustmentType} adjustment?`,
      `${adjustmentType === "credit" ? "This will reduce" : "This will increase"} the invoice total by ${formatAmount(amount, currency)}. The original invoice total will remain unchanged.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Confirm adjustment",
          onPress: () => {
            adjustmentMutation.mutate(
              {
                invoiceId: invoice.id,
                input: {
                  type: adjustmentType,
                  amount,
                  reason,
                  notes: adjustmentNotes.trim() || null,
                },
              },
              {
                onSuccess: (result) => {
                  resetAdjustmentForm();

                  Alert.alert(
                    "Adjustment recorded",
                    `Adjusted invoice total: ${formatAmount(result.summary.adjustedTotal, currency)}\\nBalance due: ${formatAmount(result.summary.balanceDue, currency)}`,
                  );
                },
                onError: (error) => {
                  Alert.alert(
                    "Unable to record adjustment",
                    error instanceof Error
                      ? error.message
                      : "An unexpected error occurred. Please try again.",
                  );
                },
              },
            );
          },
        },
      ],
    );
  }

  function submitPayment() {
    const amount = Number(paymentAmount);
    const amountInCents = Math.round(amount * 100);
    const balanceInCents = Math.round(Number(balanceDue) * 100);

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(paymentAmount.trim())
    ) {
      Alert.alert(
        "Invalid amount",
        "Enter a valid payment amount with up to 2 decimal places.",
      );
      return;
    }

    if (amountInCents > balanceInCents) {
      Alert.alert(
        "Payment exceeds balance",
        `The maximum payable amount is ${formatAmount(balanceDue, currency)}.`,
      );
      return;
    }

    const dateParts = paymentDate.split("-").map(Number);

    const year = dateParts[0];
    const month = dateParts[1];
    const day = dateParts[2];

    const isValidDate =
      /^\d{4}-\d{2}-\d{2}$/.test(paymentDate) &&
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31 &&
      new Date(Date.UTC(year, month - 1, day)).getUTCFullYear() === year &&
      new Date(Date.UTC(year, month - 1, day)).getUTCMonth() === month - 1 &&
      new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day;

    if (!isValidDate) {
      Alert.alert(
        "Invalid payment date",
        "Enter a valid date in YYYY-MM-DD format.",
      );
      return;
    }

    Alert.alert(
      "Confirm payment",
      `Record ${formatAmount(amount, currency)} by ${paymentMethod.replace(/_/g, " ")}?`,
      [
        { text: "Go back", style: "cancel" },
        {
          text: "Confirm payment",
          onPress: () => {
            paymentMutation.mutate(
              {
                invoiceId: invoice.id,
                input: {
                  amount,
                  paymentDate,
                  method: paymentMethod,
                  referenceNumber: paymentReference.trim() || null,
                  notes: paymentNotes.trim() || null,
                },
              },
              {
                onSuccess: () => {
                  resetPaymentForm();
                  Alert.alert(
                    "Payment recorded",
                    "The invoice payment was recorded successfully.",
                  );
                },
                onError: (error) => {
                  Alert.alert(
                    "Unable to record payment",
                    error instanceof Error
                      ? error.message
                      : "An unexpected error occurred. Please try again.",
                  );
                },
              },
            );
          },
        },
      ],
    );
  }

  const organizationName = readString(organization, "name") || "Organization";

  const customerName =
    readString(customer, "companyName") ||
    readString(customer, "customerName") ||
    "Customer";

  const organizationAddress = getAddress(organization);
  const customerAddress = getAddress(customer);

  const currency = invoice.currency || "INR";

  const grandTotalInWords = amountInWords(invoice.grandTotal, currency);

  return (
    <>
      {isAdmin && invoice.status === "draft" ? (
        <>
          <AppButton
            title="Edit Draft"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/(admin)/invoice-edit",
                params: { id: invoice.id },
              })
            }
          />

          <AppButton
            title="Issue Invoice"
            onPress={onIssue}
            loading={isIssuing}
            disabled={isIssuing}
          />
        </>
      ) : null}

      {isAdmin &&
      (invoice.status === "issued" || invoice.status === "partially_paid") &&
      paymentsQuery.data &&
      Number(balanceDue) > 0 ? (
        <AppButton
          title="Record Payment"
          onPress={() => setIsPaymentModalVisible(true)}
        />
      ) : null}

      {isAdmin &&
      ["issued", "partially_paid", "paid"].includes(invoice.status) ? (
        <AppButton
          title="Add Credit / Debit Adjustment"
          variant="secondary"
          onPress={() => setIsAdjustmentModalVisible(true)}
        />
      ) : null}

      {isAdmin && invoice.status === "issued" ? (
        <AppButton
          title="Cancel Invoice"
          variant="secondary"
          onPress={onCancel}
          loading={isCancelling}
          disabled={isCancelling}
        />
      ) : null}

      <AppButton
        title="Preview PDF"
        variant="secondary"
        onPress={() =>
          router.push({
            pathname: "/invoice-pdf-preview",
            params: { id: invoice.id },
          })
        }
      />

      <View style={styles.statusHeader}>
        <View style={styles.statusHeaderText}>
          <Text style={styles.eyebrow}>INVOICE DETAILS</Text>
          <Text style={styles.invoiceNumber}>
            {invoice.invoiceNumber || "Unnumbered invoice"}
          </Text>
        </View>

        <View
          style={[styles.statusBadge, { backgroundColor: status.background }]}
        >
          <Text style={[styles.statusText, { color: status.foreground }]}>
            {status.label}
          </Text>
        </View>
      </View>

      <View style={styles.documentCard}>
        <View style={styles.documentIcon}>
          <FileText size={25} color={colors.primary} />
        </View>

        <View style={styles.documentInfo}>
          <Text style={styles.documentTitle}>{organizationName}</Text>

          {readString(organization, "businessDescription") ? (
            <Text style={styles.mutedText}>
              {readString(organization, "businessDescription")}
            </Text>
          ) : null}

          {organizationAddress.length > 0 ? (
            <View style={styles.addressRow}>
              <MapPin size={14} color={colors.textSecondary} />
              <Text style={styles.addressText}>
                {organizationAddress.join(", ")}
              </Text>
            </View>
          ) : null}

          {readString(organization, "email") ? (
            <Text style={styles.mutedText}>
              {readString(organization, "email")}
            </Text>
          ) : null}

          {readString(organization, "mobile") ? (
            <Text style={styles.mutedText}>
              {readString(organization, "mobile")}
            </Text>
          ) : null}

          {readString(organization, "gstin") ? (
            <Text style={styles.mutedText}>
              GSTIN: {readString(organization, "gstin")}
            </Text>
          ) : null}

          {readString(organization, "vendorCode") ? (
            <Text style={styles.mutedText}>
              Company Vendor Code: {readString(organization, "vendorCode")}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <SectionTitle>Invoice information</SectionTitle>

        <DetailRow
          label="Invoice date"
          value={formatDate(invoice.invoiceDate)}
        />

        {invoice.issuedAt ? (
          <DetailRow
            label="Issued on"
            value={formatDateTime(invoice.issuedAt)}
          />
        ) : null}

        {invoice.cancelledAt ? (
          <DetailRow
            label="Cancelled on"
            value={formatDateTime(invoice.cancelledAt)}
          />
        ) : null}

        {invoice.cancellationReason ? (
          <DetailRow
            label="Cancellation reason"
            value={invoice.cancellationReason}
          />
        ) : null}

        <DetailRow label="Due date" value={formatDate(invoice.dueDate)} />

        <DetailRow
          label="Billing period"
          value={`${formatDate(invoice.billingPeriodStart)} – ${formatDate(invoice.billingPeriodEnd)}`}
        />

        <DetailRow label="Currency" value={currency} />

        <DetailRow label="Created by" value={invoice.createdByName || "—"} />

        {invoice.isGstApplicable ? (
          <DetailRow
            label="Supply type"
            value={
              invoice.supplyType === "intra_state"
                ? "Intra-state"
                : "Inter-state"
            }
          />
        ) : (
          <DetailRow label="GST" value="Not applicable" />
        )}
      </View>

      <View style={styles.sectionCard}>
        <SectionTitle>Customer details</SectionTitle>

        <Text style={styles.customerName}>{customerName}</Text>

        {readString(customer, "companyName") &&
        readString(customer, "customerName") ? (
          <Text style={styles.mutedText}>
            {readString(customer, "customerName")}
          </Text>
        ) : null}

        {readString(customer, "contactPerson") ? (
          <DetailRow
            label="Contact person"
            value={readString(customer, "contactPerson")!}
          />
        ) : null}

        {customerAddress.length > 0 ? (
          <View style={styles.addressRow}>
            <MapPin size={15} color={colors.textSecondary} />
            <Text style={styles.addressText}>{customerAddress.join(", ")}</Text>
          </View>
        ) : null}

        {readString(customer, "mobile") ? (
          <DetailRow label="Mobile" value={readString(customer, "mobile")!} />
        ) : null}

        {readString(customer, "email") ? (
          <DetailRow label="Email" value={readString(customer, "email")!} />
        ) : null}

        {readString(customer, "gstin") ? (
          <DetailRow label="GSTIN" value={readString(customer, "gstin")!} />
        ) : null}

        {readString(customer, "pan") ? (
          <DetailRow label="PAN" value={readString(customer, "pan")!} />
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <SectionTitle>Invoice items ({invoice.items.length})</SectionTitle>

        {invoice.items.map((item) => (
          <InvoiceItemCard
            key={item.id}
            item={item}
            currency={currency}
            isGstApplicable={invoice.isGstApplicable}
            supplyType={invoice.supplyType}
          />
        ))}
      </View>

      <View style={styles.sectionCard}>
        <SectionTitle>Invoice summary</SectionTitle>

        <DetailRow
          label="Subtotal"
          value={formatAmount(invoice.subtotal, currency)}
        />

        {invoice.isGstApplicable ? (
          <>
            {invoice.supplyType === "intra_state" ? (
              <>
                <DetailRow
                  label="Total CGST"
                  value={formatAmount(invoice.cgstTotal, currency)}
                />

                <DetailRow
                  label="Total SGST"
                  value={formatAmount(invoice.sgstTotal, currency)}
                />
              </>
            ) : (
              <DetailRow
                label="Total IGST"
                value={formatAmount(invoice.igstTotal, currency)}
              />
            )}

            <DetailRow
              label="Total tax"
              value={formatAmount(invoice.totalTax, currency)}
            />
          </>
        ) : null}

        <DetailRow
          label="Round off"
          value={formatAmount(invoice.roundOff, currency)}
        />

        <View style={styles.grandTotal}>
          <Text style={styles.grandTotalLabel}>Grand total</Text>
          <Text style={styles.grandTotalValue}>
            {formatAmount(invoice.grandTotal, currency)}
          </Text>
        </View>

        {grandTotalInWords ? (
          <View style={styles.amountWordsContainer}>
            <Text style={styles.amountWordsLabel}>Amount in words</Text>
            <Text style={styles.amountWordsValue}>{grandTotalInWords}</Text>
          </View>
        ) : null}
      </View>

      {invoice.notes ? (
        <View style={styles.sectionCard}>
          <SectionTitle>Notes</SectionTitle>
          <Text style={styles.notesText}>{invoice.notes}</Text>
        </View>
      ) : null}

      {invoice.status !== "draft" ? (
        <View style={styles.sectionCard}>
          <SectionTitle>Payment history</SectionTitle>

          {paymentsQuery.isPending ? (
            <View style={styles.paymentState}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.mutedText}>Loading payment history...</Text>
            </View>
          ) : paymentsQuery.isError ? (
            <View style={styles.paymentState}>
              <Text style={styles.errorText}>
                Unable to load payment history.
              </Text>
              <AppButton
                title="Retry"
                variant="secondary"
                onPress={() => void paymentsQuery.refetch()}
              />
            </View>
          ) : paymentsQuery.data ? (
            <>
              <DetailRow
                label="Invoice total"
                value={formatAmount(
                  paymentsQuery.data.summary.grandTotal,
                  currency,
                )}
              />

              <DetailRow
                label="Adjusted total"
                value={formatAmount(
                  paymentsQuery.data.summary.adjustedTotal,
                  currency,
                )}
              />

              <DetailRow
                label="Amount paid"
                value={formatAmount(
                  paymentsQuery.data.summary.paidAmount,
                  currency,
                )}
              />

              <DetailRow
                label="Balance due"
                value={formatAmount(
                  paymentsQuery.data.summary.balanceDue,
                  currency,
                )}
              />

              <DetailRow
                label="Payments received"
                value={String(paymentsQuery.data.summary.paymentCount)}
              />

              {paymentsQuery.data.payments.length === 0 ? (
                <Text style={styles.paymentEmptyText}>
                  No payments have been recorded for this invoice.
                </Text>
              ) : (
                paymentsQuery.data.payments.map((payment) => (
                  <View key={payment.id} style={styles.paymentCard}>
                    <View style={styles.paymentHeader}>
                      <View style={styles.paymentHeaderInfo}>
                        <Text style={styles.paymentAmount}>
                          {formatAmount(payment.amount, currency)}
                        </Text>
                        <Text style={styles.paymentDate}>
                          {formatDate(payment.paymentDate)}
                        </Text>
                      </View>

                      <View style={styles.paymentMethodBadge}>
                        <Text style={styles.paymentMethodText}>
                          {payment.method
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (character) =>
                              character.toUpperCase(),
                            )}
                        </Text>
                      </View>
                    </View>

                    {payment.referenceNumber ? (
                      <DetailRow
                        label="Reference"
                        value={payment.referenceNumber}
                      />
                    ) : null}

                    <DetailRow
                      label="Recorded by"
                      value={payment.recordedByName || "—"}
                    />

                    {payment.notes ? (
                      <View style={styles.paymentNotes}>
                        <Text style={styles.paymentNotesLabel}>Notes</Text>
                        <Text style={styles.notesText}>{payment.notes}</Text>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </>
          ) : null}
        </View>
      ) : null}

      {invoice.status !== "draft" ? (
        <View style={styles.sectionCard}>
          <SectionTitle>Credit / debit adjustments</SectionTitle>

          {adjustmentsQuery.isPending ? (
            <View style={styles.paymentState}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.mutedText}>
                Loading adjustment history...
              </Text>
            </View>
          ) : adjustmentsQuery.isError ? (
            <View style={styles.paymentState}>
              <Text style={styles.errorText}>
                Unable to load adjustment history.
              </Text>
              <AppButton
                title="Retry"
                variant="secondary"
                onPress={() => void adjustmentsQuery.refetch()}
              />
            </View>
          ) : adjustmentsQuery.data ? (
            <>
              <DetailRow
                label="Original invoice total"
                value={formatAmount(
                  adjustmentsQuery.data.summary.originalTotal,
                  currency,
                )}
              />

              <DetailRow
                label="Adjusted invoice total"
                value={formatAmount(
                  adjustmentsQuery.data.summary.adjustedTotal,
                  currency,
                )}
              />

              <DetailRow
                label="Adjustments recorded"
                value={String(adjustmentsQuery.data.summary.adjustmentCount)}
              />

              {adjustmentsQuery.data.adjustments.length === 0 ? (
                <Text style={styles.paymentEmptyText}>
                  No credit or debit adjustments have been recorded.
                </Text>
              ) : (
                adjustmentsQuery.data.adjustments.map((adjustment) => (
                  <View key={adjustment.id} style={styles.paymentCard}>
                    <View style={styles.paymentHeader}>
                      <View style={styles.paymentHeaderInfo}>
                        <Text style={styles.paymentAmount}>
                          {adjustment.type === "credit" ? "Credit" : "Debit"}{" "}
                          {formatAmount(adjustment.amount, currency)}
                        </Text>
                        <Text style={styles.paymentDate}>
                          {formatDateTime(adjustment.createdAt)}
                        </Text>
                      </View>

                      <View style={styles.paymentMethodBadge}>
                        <Text style={styles.paymentMethodText}>
                          {adjustment.type.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <DetailRow
                      label="Reason"
                      value={adjustment.reason}
                    />

                    <DetailRow
                      label="Recorded by"
                      value={adjustment.createdByName || "—"}
                    />

                    {adjustment.notes ? (
                      <View style={styles.paymentNotes}>
                        <Text style={styles.paymentNotesLabel}>Notes</Text>
                        <Text style={styles.notesText}>
                          {adjustment.notes}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </>
          ) : null}
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <SectionTitle>Stored PDF documents</SectionTitle>

        {documentsQuery.isPending ? (
          <View style={styles.paymentState}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.mutedText}>
              Loading stored documents...
            </Text>
          </View>
        ) : documentsQuery.isError ? (
          <View style={styles.paymentState}>
            <Text style={styles.errorText}>
              Unable to load stored documents.
            </Text>
            <AppButton
              title="Retry"
              variant="secondary"
              onPress={() => void documentsQuery.refetch()}
            />
          </View>
        ) : documentsQuery.data && documentsQuery.data.length > 0 ? (
          documentsQuery.data.map((document) => (
            <View key={document.id} style={styles.paymentCard}>
              <View style={styles.paymentHeader}>
                <View style={styles.paymentHeaderInfo}>
                  <Text style={styles.paymentAmount}>
                    {document.fileName}
                  </Text>
                  <Text style={styles.paymentDate}>
                    {document.copyType.toUpperCase()} copy
                  </Text>
                </View>

                <View style={styles.paymentMethodBadge}>
                  <Text style={styles.paymentMethodText}>PDF</Text>
                </View>
              </View>

              <DetailRow
                label="Uploaded"
                value={formatDateTime(document.generatedAt)}
              />

              {document.fileSize ? (
                <DetailRow
                  label="File size"
                  value={`${document.fileSize} bytes`}
                />
              ) : null}

              <AppButton
                title={
                  downloadingDocumentId === document.id
                    ? "Downloading..."
                    : "Download / Share PDF"
                }
                variant="secondary"
                loading={downloadingDocumentId === document.id}
                disabled={downloadingDocumentId !== null}
                onPress={() => void handleDownloadInvoiceDocument(document)}
              />
            </View>
          ))
        ) : (
          <Text style={styles.paymentEmptyText}>
            No PDF documents have been uploaded for this invoice yet.
          </Text>
        )}
      </View>
      <Text style={styles.footerText}>
        Invoice created on {formatDate(invoice.createdAt)}
      </Text>

      <Modal
        visible={isPaymentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!paymentMutation.isPending) {
            setIsPaymentModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Record payment</Text>

            <Text style={styles.modalDescription}>
              Record a payment received against this invoice.
            </Text>

            <View style={styles.paymentBalanceBox}>
              <Text style={styles.paymentBalanceLabel}>
                Outstanding balance
              </Text>
              <Text style={styles.paymentBalanceValue}>
                {formatAmount(balanceDue, currency)}
              </Text>
            </View>

            <Text style={styles.inputLabel}>Payment amount *</Text>
            <TextInput
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              placeholder="Enter amount"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              editable={!paymentMutation.isPending}
              style={styles.paymentInput}
            />

            <Text style={styles.inputLabel}>Payment date *</Text>
            <TextInput
              value={paymentDate}
              onChangeText={setPaymentDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              editable={!paymentMutation.isPending}
              style={styles.paymentInput}
            />

            <Text style={styles.inputLabel}>Payment method *</Text>
            <View style={styles.paymentMethodOptions}>
              {(
                [
                  "cash",
                  "bank_transfer",
                  "upi",
                  "cheque",
                  "card",
                  "other",
                ] as PaymentMethod[]
              ).map((method) => (
                <Pressable
                  key={method}
                  disabled={paymentMutation.isPending}
                  onPress={() => setPaymentMethod(method)}
                  style={[
                    styles.paymentMethodOption,
                    paymentMethod === method &&
                      styles.paymentMethodOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentMethodOptionText,
                      paymentMethod === method &&
                        styles.paymentMethodOptionTextSelected,
                    ]}
                  >
                    {method
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (character) => character.toUpperCase())}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>Reference number</Text>
            <TextInput
              value={paymentReference}
              onChangeText={setPaymentReference}
              placeholder="Transaction ID / cheque number"
              placeholderTextColor={colors.textSecondary}
              maxLength={150}
              editable={!paymentMutation.isPending}
              style={styles.paymentInput}
            />

            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              value={paymentNotes}
              onChangeText={setPaymentNotes}
              placeholder="Optional payment notes"
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={2000}
              editable={!paymentMutation.isPending}
              textAlignVertical="top"
              style={styles.paymentNotesInput}
            />

            <View style={styles.modalActions}>
              <Pressable
                disabled={paymentMutation.isPending}
                onPress={resetPaymentForm}
                style={styles.modalSecondaryButton}
              >
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={
                  paymentMutation.isPending ||
                  !paymentAmount.trim() ||
                  !paymentDate.trim()
                }
                onPress={submitPayment}
                style={[
                  styles.paymentSubmitButton,
                  (paymentMutation.isPending ||
                    !paymentAmount.trim() ||
                    !paymentDate.trim()) &&
                    styles.modalButtonDisabled,
                ]}
              >
                {paymentMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.paymentSubmitButtonText}>Continue</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isAdjustmentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!adjustmentMutation.isPending) {
            resetAdjustmentForm();
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invoice adjustment</Text>

            <Text style={styles.modalDescription}>
              Record a credit or debit adjustment. The original invoice total
              will remain unchanged.
            </Text>

            <Text style={styles.inputLabel}>Adjustment type *</Text>

            <View style={styles.paymentMethodOptions}>
              {(["credit", "debit"] as InvoiceAdjustmentType[]).map((type) => (
                <Pressable
                  key={type}
                  disabled={adjustmentMutation.isPending}
                  onPress={() => setAdjustmentType(type)}
                  style={[
                    styles.paymentMethodOption,
                    adjustmentType === type &&
                      styles.paymentMethodOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentMethodOptionText,
                      adjustmentType === type &&
                        styles.paymentMethodOptionTextSelected,
                    ]}
                  >
                    {type === "credit" ? "Credit (Reduce)" : "Debit (Increase)"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.paymentBalanceBox}>
              <Text style={styles.paymentBalanceLabel}>
                Current adjusted total
              </Text>
              <Text style={styles.paymentBalanceValue}>
                {formatAmount(
                  adjustmentsQuery.data?.summary.adjustedTotal ??
                    invoice.grandTotal,
                  currency,
                )}
              </Text>
            </View>

            <Text style={styles.inputLabel}>Adjustment amount *</Text>
            <TextInput
              value={adjustmentAmount}
              onChangeText={setAdjustmentAmount}
              placeholder="Enter positive amount"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              editable={!adjustmentMutation.isPending}
              style={styles.paymentInput}
            />

            <Text style={styles.inputLabel}>Reason *</Text>
            <TextInput
              value={adjustmentReason}
              onChangeText={setAdjustmentReason}
              placeholder="Enter reason (5–250 characters)"
              placeholderTextColor={colors.textSecondary}
              maxLength={250}
              editable={!adjustmentMutation.isPending}
              style={styles.paymentInput}
            />

            <Text style={styles.characterCount}>
              {adjustmentReason.trim().length}/250 characters
            </Text>

            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              value={adjustmentNotes}
              onChangeText={setAdjustmentNotes}
              placeholder="Optional additional details"
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={2000}
              editable={!adjustmentMutation.isPending}
              textAlignVertical="top"
              style={styles.paymentNotesInput}
            />

            <View style={styles.modalActions}>
              <Pressable
                disabled={adjustmentMutation.isPending}
                onPress={resetAdjustmentForm}
                style={styles.modalSecondaryButton}
              >
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={
                  adjustmentMutation.isPending ||
                  !adjustmentAmount.trim() ||
                  adjustmentReason.trim().length < 5
                }
                onPress={submitAdjustment}
                style={[
                  styles.paymentSubmitButton,
                  (adjustmentMutation.isPending ||
                    !adjustmentAmount.trim() ||
                    adjustmentReason.trim().length < 5) &&
                    styles.modalButtonDisabled,
                ]}
              >
                {adjustmentMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.paymentSubmitButtonText}>
                    Continue
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function InvoiceDetailScreen() {
  const cancelMutation = useCancelInvoice();

  const [isCancelModalVisible, setIsCancelModalVisible] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  const params = useLocalSearchParams<{ id: string | string[] }>();

  const invoiceId = Array.isArray(params.id) ? params.id[0] : params.id;

  const invoiceQuery = useInvoice(invoiceId ?? "");

  const profileQuery = useMyProfile();
  const issueMutation = useIssueInvoice();

  const isAdmin = profileQuery.data?.role === "admin";

  function confirmIssueInvoice() {
    const invoice = invoiceQuery.data;

    if (!invoice || !isAdmin || invoice.status !== "draft") {
      return;
    }

    Alert.alert(
      "Issue invoice?",
      `Are you sure you want to issue invoice ${invoice.invoiceNumber || ""}? This will change its status from Draft to Issued.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Issue Invoice",
          onPress: () => {
            issueMutation.mutate(invoice.id, {
              onSuccess: () => {
                Alert.alert(
                  "Invoice issued",
                  "The invoice has been successfully issued.",
                );
              },
              onError: (error) => {
                Alert.alert(
                  "Unable to issue invoice",
                  error instanceof Error
                    ? error.message
                    : "An unexpected error occurred. Please try again.",
                );
              },
            });
          },
        },
      ],
    );
  }

  function openCancelModal() {
    const invoice = invoiceQuery.data;

    if (!invoice || !isAdmin || invoice.status !== "issued") {
      return;
    }

    setCancellationReason("");
    setIsCancelModalVisible(true);
  }

  function confirmCancelInvoice() {
    const invoice = invoiceQuery.data;
    const reason = cancellationReason.trim();

    if (!invoice || !isAdmin || invoice.status !== "issued") {
      return;
    }

    if (reason.length < 5 || reason.length > 500) {
      Alert.alert(
        "Invalid cancellation reason",
        "Please enter a reason between 5 and 500 characters.",
      );
      return;
    }

    Alert.alert(
      "Confirm cancellation?",
      `Are you sure you want to cancel invoice ${invoice.invoiceNumber || ""}? This action cannot be undone.`,
      [
        {
          text: "Go back",
          style: "cancel",
        },
        {
          text: "Confirm cancellation",
          style: "destructive",
          onPress: () => {
            cancelMutation.mutate(
              {
                invoiceId: invoice.id,
                reason,
              },
              {
                onSuccess: () => {
                  setIsCancelModalVisible(false);
                  setCancellationReason("");

                  Alert.alert(
                    "Invoice cancelled",
                    "The invoice has been successfully cancelled.",
                  );
                },
                onError: (error) => {
                  Alert.alert(
                    "Unable to cancel invoice",
                    error instanceof Error
                      ? error.message
                      : "An unexpected error occurred. Please try again.",
                  );
                },
              },
            );
          },
        },
      ],
    );
  }

  return (
    <>
      <ScreenContainer>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={19} color={colors.primary} />
          <Text style={styles.backText}>Back to invoices</Text>
        </Pressable>

        {invoiceQuery.isPending ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateText}>Loading invoice details...</Text>
          </View>
        ) : invoiceQuery.isError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to load invoice</Text>

            <Text style={styles.errorText}>
              {invoiceQuery.error instanceof Error
                ? invoiceQuery.error.message
                : "An unexpected error occurred."}
            </Text>

            <AppButton
              title="Try again"
              onPress={() => void invoiceQuery.refetch()}
            />
          </View>
        ) : !invoiceQuery.data ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Invoice not found</Text>
            <Text style={styles.errorText}>
              This invoice may no longer be available to your account.
            </Text>
          </View>
        ) : (
          <InvoiceContent
            invoice={invoiceQuery.data}
            isAdmin={isAdmin}
            isIssuing={issueMutation.isPending}
            isCancelling={cancelMutation.isPending}
            onIssue={confirmIssueInvoice}
            onCancel={openCancelModal}
          />
        )}
      </ScreenContainer>
      <Modal
        visible={isCancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!cancelMutation.isPending) {
            setIsCancelModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancel invoice</Text>

            <Text style={styles.modalDescription}>
              Enter the reason for cancelling this issued invoice. This action
              cannot be undone.
            </Text>

            <Text style={styles.inputLabel}>Cancellation reason</Text>

            <TextInput
              value={cancellationReason}
              onChangeText={setCancellationReason}
              placeholder="Enter cancellation reason..."
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={500}
              editable={!cancelMutation.isPending}
              textAlignVertical="top"
              style={styles.reasonInput}
            />

            <Text style={styles.characterCount}>
              {cancellationReason.trim().length}/500 characters (minimum 5)
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                disabled={cancelMutation.isPending}
                onPress={() => setIsCancelModalVisible(false)}
                style={styles.modalSecondaryButton}
              >
                <Text style={styles.modalSecondaryButtonText}>Go back</Text>
              </Pressable>

              <Pressable
                disabled={
                  cancelMutation.isPending ||
                  cancellationReason.trim().length < 5
                }
                onPress={confirmCancelInvoice}
                style={[
                  styles.modalDangerButton,
                  (cancelMutation.isPending ||
                    cancellationReason.trim().length < 5) &&
                    styles.modalButtonDisabled,
                ]}
              >
                {cancelMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalDangerButtonText}>Continue</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 5,
  },
  backText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 13,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  statusHeaderText: {
    flex: 1,
    gap: 5,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  invoiceNumber: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
  },
  statusBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  documentCard: {
    flexDirection: "row",
    gap: 13,
    padding: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  documentIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  documentInfo: {
    flex: 1,
    gap: 5,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  mutedText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 3,
  },
  addressText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 13,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  detailLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
  },
  detailValue: {
    flex: 1.3,
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  customerName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  itemCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    gap: 10,
  },
  itemHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  itemNumber: {
    width: 25,
    height: 25,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  itemNumberText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "800",
  },
  itemDescription: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  itemCalculation: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  itemCalculationText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  itemAmount: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  itemTaxContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 9,
    gap: 5,
  },
  itemTaxTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
  },
  itemTaxText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  grandTotalLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  grandTotalValue: {
    color: colors.primary,
    fontSize: 19,
    fontWeight: "800",
  },
  notesText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  footerText: {
    textAlign: "center",
    color: colors.textSecondary,
    fontSize: 11,
    paddingVertical: spacing.sm,
  },
  stateContainer: {
    padding: 35,
    alignItems: "center",
    gap: 12,
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  errorCard: {
    backgroundColor: colors.dangerLight,
    padding: 18,
    borderRadius: radius.lg,
    gap: 12,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: "800",
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  amountWordsContainer: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: 12,
    gap: 5,
  },
  amountWordsLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  amountWordsValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 19,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    gap: 13,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
  },
  modalDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  reasonInput: {
    minHeight: 110,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: 14,
  },
  characterCount: {
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: "right",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 5,
  },
  modalSecondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalSecondaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  modalDangerButton: {
    minWidth: 105,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
  },
  modalDangerButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  modalButtonDisabled: {
    opacity: 0.45,
  },
  paymentState: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  paymentEmptyText: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 12,
  },
  paymentCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    gap: 10,
  },
  paymentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  paymentHeaderInfo: {
    flex: 1,
    gap: 4,
  },
  paymentAmount: {
    color: colors.success,
    fontSize: 16,
    fontWeight: "800",
  },
  paymentDate: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  paymentMethodBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  paymentMethodText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  paymentNotes: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 9,
  },
  paymentNotesLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  paymentBalanceBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: 13,
    gap: 5,
  },
  paymentBalanceLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  paymentBalanceValue: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "800",
  },
  paymentInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: 14,
  },
  paymentNotesInput: {
    minHeight: 75,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: 14,
  },
  paymentMethodOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  paymentMethodOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 11,
    paddingVertical: 9,
    backgroundColor: colors.background,
  },
  paymentMethodOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  paymentMethodOptionText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  paymentMethodOptionTextSelected: {
    color: colors.primary,
    fontWeight: "800",
  },
  paymentSubmitButton: {
    minWidth: 105,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  paymentSubmitButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});



