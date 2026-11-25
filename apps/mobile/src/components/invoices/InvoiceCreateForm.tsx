import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import { ScreenContainer } from "../ui/ScreenContainer";
import { AppInput } from "../ui/AppInput";
import { AppButton } from "../ui/AppButton";

import { useCustomers } from "../../hooks/use-customers";
import {
  useCreateInvoice,
  useInvoice,
  useUpdateInvoice,
} from "../../hooks/use-invoices";

import type { Customer } from "../../lib/customers-api";
import type {
  CreateInvoiceInput,
  InvoiceGstRate,
} from "../../lib/invoices-api";

import { colors } from "../../theme/colors";
import { radius, spacing } from "../../theme/spacing";

interface InvoiceLine {
  id: string;
  description: string;
  quantity: string;
  rate: string;
  gstRate: InvoiceGstRate;
}

interface InvoiceCreateFormProps {
  invoiceId?: string;
}

const GST_RATES: InvoiceGstRate[] = [0, 5, 12, 18, 28];

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthStart(date: Date): string {
  return localDateString(new Date(date.getFullYear(), date.getMonth(), 1));
}

function createLine(): InvoiceLine {
  return {
    id: `${Date.now()}-${Math.random()}`,
    description: "",
    quantity: "1",
    rate: "0.00",
    gstRate: 0,
  };
}

function optionalDate(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00`);

  return !Number.isNaN(parsed.getTime()) && localDateString(parsed) === value;
}

function calculatePreview(lines: InvoiceLine[]) {
  return lines.reduce((total, line) => {
    const quantity = Number(line.quantity);
    const rate = Number(line.rate);

    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(rate) ||
      quantity <= 0 ||
      rate < 0
    ) {
      return total;
    }

    return total + quantity * rate;
  }, 0);
}

export function InvoiceCreateForm({ invoiceId }: InvoiceCreateFormProps) {
  const today = localDateString(new Date());

  const router = useRouter();

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );

  const [invoiceDate, setInvoiceDate] = useState(today);
  const [billingPeriodStart, setBillingPeriodStart] = useState(
    getMonthStart(new Date()),
  );
  const [billingPeriodEnd, setBillingPeriodEnd] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [gstEnabled, setGstEnabled] = useState(false);
  const [lines, setLines] = useState<InvoiceLine[]>([createLine()]);

  const invoiceQuery = useInvoice(invoiceId ?? "");
  const updateMutation = useUpdateInvoice();

  const [isFormHydrated, setIsFormHydrated] = useState(!invoiceId);

  const customersQuery = useCustomers({
    page: 1,
    limit: 100,
    status: "active",
    search: customerSearch.trim() || undefined,
  });

  const createMutation = useCreateInvoice();

  useEffect(() => {
    const invoice = invoiceQuery.data;

    if (!invoiceId || !invoice || invoice.status !== "draft") {
      return;
    }

    const availableCustomers = customersQuery.data?.items ?? [];

    const invoiceCustomer =
      invoice.customer ??
      availableCustomers.find((customer) => customer.id === invoice.customerId);

    setSelectedCustomer(invoiceCustomer ?? null);
    setCustomerSearch(invoiceCustomer?.customerName ?? "");

    setInvoiceDate(invoice.invoiceDate.slice(0, 10));
    setBillingPeriodStart(invoice.billingPeriodStart.slice(0, 10));
    setBillingPeriodEnd(invoice.billingPeriodEnd.slice(0, 10));
    setDueDate(invoice.dueDate?.slice(0, 10) ?? "");
    setNotes(invoice.notes ?? "");

    setGstEnabled(invoice.isGstApplicable);

    setLines(
      invoice.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        gstRate: Number(item.gstRate) as InvoiceGstRate,
      })),
    );

    setIsFormHydrated(true);
  }, [invoiceId, invoiceQuery.data, customersQuery.data]);

  const customers = customersQuery.data?.items ?? [];

  const subtotalPreview = useMemo(() => calculatePreview(lines), [lines]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function updateLine(
    id: string,
    field: keyof Omit<InvoiceLine, "id">,
    value: string | InvoiceGstRate,
  ) {
    setLines((current) =>
      current.map((line) =>
        line.id === id ? { ...line, [field]: value } : line,
      ),
    );
  }

  function removeLine(id: string) {
    setLines((current) =>
      current.length <= 1 ? current : current.filter((line) => line.id !== id),
    );
  }

  function validateForm(): string | null {
    if (!selectedCustomer) {
      return "Please select a customer.";
    }

    if (
      !validDate(invoiceDate) ||
      !validDate(billingPeriodStart) ||
      !validDate(billingPeriodEnd)
    ) {
      return "Enter valid invoice and billing dates in YYYY-MM-DD format.";
    }

    if (billingPeriodEnd < billingPeriodStart) {
      return "Billing period end must be on or after the start date.";
    }

    if (dueDate.trim() && !validDate(dueDate.trim())) {
      return "Enter a valid due date in YYYY-MM-DD format.";
    }

    if (dueDate.trim() && dueDate.trim() < invoiceDate) {
      return "Due date cannot be before the invoice date.";
    }

    if (lines.length === 0) {
      return "Add at least one invoice item.";
    }

    for (const [index, line] of lines.entries()) {
      const quantity = Number(line.quantity);
      const rate = Number(line.rate);

      if (!line.description.trim()) {
        return `Enter a description for item ${index + 1}.`;
      }

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 1e-8
      ) {
        return `Item ${index + 1}: quantity must be positive and support at most 3 decimal places.`;
      }

      if (
        !Number.isFinite(rate) ||
        rate < 0 ||
        Math.abs(rate * 100 - Math.round(rate * 100)) > 1e-8
      ) {
        return `Item ${index + 1}: rate must be non-negative and support at most 2 decimal places.`;
      }
    }

    if (!Number.isFinite(subtotalPreview) || subtotalPreview > 1e12) {
      return "Invoice subtotal is outside the supported range.";
    }

    return null;
  }

  async function submitInvoice() {
    const validationError = validateForm();

    if (validationError) {
      Alert.alert("Check invoice details", validationError);
      return;
    }

    const input: CreateInvoiceInput = {
      customerId: selectedCustomer!.id,
      invoiceDate,
      billingPeriodStart,
      billingPeriodEnd,
      dueDate: optionalDate(dueDate),
      currency: invoiceId ? (invoiceQuery.data?.currency ?? "INR") : "INR",
      notes: optionalDate(notes),
      isGstApplicable: gstEnabled,
      items: lines.map((line) => ({
        description: line.description.trim(),
        quantity: Number(line.quantity),
        rate: Number(line.rate),
        ...(gstEnabled ? { gstRate: line.gstRate } : {}),
      })),
    };

    try {
      const invoice = invoiceId
        ? await updateMutation.mutateAsync({
            invoiceId,
            input,
          })
        : await createMutation.mutateAsync(input);

      Alert.alert(
        invoiceId ? "Draft updated" : "Invoice created",
        invoiceId
          ? `Invoice ${invoice.invoiceNumber || ""} was updated successfully.`
          : `Invoice ${invoice.invoiceNumber || ""} was created successfully.`,
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        invoiceId ? "Unable to update invoice" : "Unable to create invoice",
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  if (invoiceId && invoiceQuery.isPending) {
    return (
      <ScreenContainer>
        <View style={styles.errorCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.secondaryText}>Loading draft invoice...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (invoiceId && invoiceQuery.isError) {
    return (
      <ScreenContainer>
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Unable to load invoice details.</Text>
          <AppButton
            title="Retry"
            onPress={() => void invoiceQuery.refetch()}
          />
          <AppButton
            title="Go back"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      </ScreenContainer>
    );
  }

  if (invoiceId && invoiceQuery.data?.status !== "draft") {
    return (
      <ScreenContainer>
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>
            This invoice is no longer editable. Only draft invoices can be
            edited.
          </Text>
          <AppButton title="Go back" onPress={() => router.back()} />
        </View>
      </ScreenContainer>
    );
  }

  if (invoiceId && !isFormHydrated) {
    return (
      <ScreenContainer>
        <View style={styles.errorCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.secondaryText}>Preparing invoice editor...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            disabled={createMutation.isPending}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              {invoiceId ? "Edit draft invoice" : "Create invoice"}
            </Text>
            <Text style={styles.subtitle}>
              {invoiceId
                ? "Update the details of this draft invoice."
                : "Prepare a customer billing invoice."}
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            {invoiceId ? "Draft invoice editing" : "Invoice preparation"}
          </Text>
          <Text style={styles.infoText}>
            Invoice number, taxes and final totals are generated by the server.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Customer</Text>

        <AppInput
          label="Search active customers"
          placeholder="Customer or company name"
          value={customerSearch}
          onChangeText={(value) => {
            setCustomerSearch(value);
            setSelectedCustomer(null);
          }}
          autoCapitalize="none"
        />

        {selectedCustomer ? (
          <View style={styles.selectedCustomer}>
            <Text style={styles.selectedName}>
              {selectedCustomer.customerName}
            </Text>
            <Text style={styles.secondaryText}>
              {selectedCustomer.companyName || "Individual customer"}
            </Text>
            <Pressable onPress={() => setSelectedCustomer(null)}>
              <Text style={styles.changeText}>Change customer</Text>
            </Pressable>
          </View>
        ) : customersQuery.isLoading ? (
          <Text style={styles.secondaryText}>Loading customers…</Text>
        ) : customersQuery.isError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>Unable to load customers.</Text>
            <AppButton
              title="Retry"
              variant="secondary"
              onPress={() => customersQuery.refetch()}
            />
          </View>
        ) : customers.length === 0 ? (
          <Text style={styles.secondaryText}>
            No active customers found. Add a customer first.
          </Text>
        ) : (
          <View style={styles.customerList}>
            {customers.slice(0, 8).map((customer) => (
              <Pressable
                key={customer.id}
                style={styles.customerOption}
                onPress={() => {
                  setSelectedCustomer(customer);
                  setCustomerSearch(customer.customerName);
                }}
              >
                <Text style={styles.customerName}>{customer.customerName}</Text>
                <Text style={styles.secondaryText}>
                  {customer.companyName || customer.mobile || "Customer"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Invoice dates</Text>

        <AppInput
          label="Invoice date (YYYY-MM-DD)"
          value={invoiceDate}
          onChangeText={setInvoiceDate}
          placeholder="2026-11-23"
          autoCapitalize="none"
        />

        <AppInput
          label="Billing period start"
          value={billingPeriodStart}
          onChangeText={setBillingPeriodStart}
          placeholder="2026-11-01"
          autoCapitalize="none"
        />

        <AppInput
          label="Billing period end"
          value={billingPeriodEnd}
          onChangeText={setBillingPeriodEnd}
          placeholder="2026-11-30"
          autoCapitalize="none"
        />

        <AppInput
          label="Due date (optional)"
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />

        <View style={styles.divider} />

        <View style={styles.gstHeader}>
          <View style={styles.gstText}>
            <Text style={styles.sectionTitle}>GST</Text>
            <Text style={styles.secondaryText}>
              Enable GST for this invoice.
            </Text>
          </View>

          <Switch
            value={gstEnabled}
            onValueChange={setGstEnabled}
            trackColor={{
              false: colors.border,
              true: colors.primary,
            }}
          />
        </View>

        {gstEnabled ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              The server determines CGST/SGST or IGST from the organization and
              customer state codes.
            </Text>
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.itemsHeader}>
          <Text style={styles.sectionTitle}>Invoice items</Text>

          <Pressable
            onPress={() => setLines((current) => [...current, createLine()])}
            disabled={lines.length >= 100}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>+ Add item</Text>
          </Pressable>
        </View>

        {lines.map((line, index) => (
          <View key={line.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle}>Item {index + 1}</Text>

              {lines.length > 1 ? (
                <Pressable onPress={() => removeLine(line.id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>

            <AppInput
              label="Description"
              value={line.description}
              onChangeText={(value) =>
                updateLine(line.id, "description", value)
              }
              placeholder="Service or product description"
              maxLength={500}
            />

            <AppInput
              label="Quantity"
              value={line.quantity}
              onChangeText={(value) => updateLine(line.id, "quantity", value)}
              keyboardType="decimal-pad"
              placeholder="1"
            />

            <AppInput
              label="Rate (₹)"
              value={line.rate}
              onChangeText={(value) => updateLine(line.id, "rate", value)}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />

            {gstEnabled ? (
              <View style={styles.rateSection}>
                <Text style={styles.label}>GST rate</Text>

                <View style={styles.rateOptions}>
                  {GST_RATES.map((rate) => (
                    <Pressable
                      key={rate}
                      onPress={() => updateLine(line.id, "gstRate", rate)}
                      style={[
                        styles.rateOption,
                        line.gstRate === rate && styles.rateOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.rateText,
                          line.gstRate === rate && styles.rateTextSelected,
                        ]}
                      >
                        {rate}%
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ))}

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Subtotal preview</Text>
          <Text style={styles.totalValue}>₹{subtotalPreview.toFixed(2)}</Text>
          <Text style={styles.secondaryText}>
            Taxes and final total will be calculated by the server.
          </Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Additional information</Text>

        <AppInput
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Add invoice notes"
          multiline
          maxLength={5000}
        />

        <View style={styles.actions}>
          <AppButton
            title={invoiceId ? "Save changes" : "Create invoice"}
            onPress={submitInvoice}
            loading={isSaving}
            disabled={isSaving}
          />

          <AppButton
            title="Cancel"
            variant="secondary"
            onPress={() => router.back()}
            disabled={isSaving}
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.lg,
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
  backText: {
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
  infoText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  secondaryText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  selectedCustomer: {
    padding: spacing.md,
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  selectedName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  changeText: {
    color: colors.primary,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  customerList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  customerOption: {
    padding: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  errorCard: {
    gap: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  gstHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gstText: {
    flex: 1,
    gap: spacing.xs,
  },
  itemsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addButton: {
    padding: spacing.sm,
  },
  addButtonText: {
    color: colors.primary,
    fontWeight: "700",
  },
  itemCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  removeText: {
    color: colors.danger,
    fontWeight: "700",
  },
  rateSection: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  rateOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  rateOption: {
    minWidth: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  rateOptionSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  rateText: {
    color: colors.textSecondary,
    fontWeight: "600",
  },
  rateTextSelected: {
    color: colors.primary,
  },
  totalCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  totalLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  totalValue: {
    color: colors.text,
    fontSize: 25,
    fontWeight: "800",
  },
  actions: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
});
