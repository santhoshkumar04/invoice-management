import { useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { router, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";

import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import {
  useInvoice,
  useUploadInvoiceDocument,
} from "../../hooks/use-invoices";
import { useMyProfile } from "../../hooks/use-profile";
import { buildInvoiceHtml, type InvoiceCopyType } from "../../lib/invoice-pdf";
import type { InvoiceDocumentCopyType } from "../../lib/invoices-api";

import { ScreenContainer } from "../ui/ScreenContainer";
import { AppButton } from "../ui/AppButton";

import { colors } from "../../theme/colors";
import { radius, spacing } from "../../theme/spacing";

const COPY_OPTIONS: {
  label: string;
  value: InvoiceCopyType;
}[] = [
  { label: "Original", value: "ORIGINAL" },
  { label: "Duplicate", value: "DUPLICATE" },
  { label: "Triplicate", value: "TRIPLICATE" },
];

export function InvoicePdfPreviewScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();

  const invoiceId = Array.isArray(params.id) ? params.id[0] : params.id;

  const invoiceQuery = useInvoice(invoiceId ?? "");
  const profileQuery = useMyProfile();
  const uploadMutation = useUploadInvoiceDocument();

  const [isGenerating, setIsGenerating] = useState(false);
  const [copyType, setCopyType] = useState<InvoiceCopyType>("ORIGINAL");
  const [generatedPdfUri, setGeneratedPdfUri] = useState<string | null>(null);
  const [generatedCopyType, setGeneratedCopyType] = useState<InvoiceCopyType | null>(null);

  const html = useMemo(() => {
    if (!invoiceQuery.data) return "";

    return buildInvoiceHtml(invoiceQuery.data, copyType);
  }, [invoiceQuery.data, copyType]);


  const handleUploadPdf = async () => {
    if (
      !invoiceId ||
      !generatedPdfUri ||
      !generatedCopyType ||
      profileQuery.data?.role !== "admin" ||
      uploadMutation.isPending
    ) {
      return;
    }

    try {
      const uploadCopyType =
        generatedCopyType.toLowerCase() as InvoiceDocumentCopyType;

      const fileName =
        `invoice-${invoiceId}-${uploadCopyType}.pdf`;

      await uploadMutation.mutateAsync({
        invoiceId,
        fileUri: generatedPdfUri,
        fileName,
        copyType: uploadCopyType,
      });

      Alert.alert(
        "PDF uploaded",
        `${generatedCopyType.toLowerCase()} invoice copy was securely uploaded and saved.`,
      );
    } catch (error) {
      Alert.alert(
        "PDF upload failed",
        error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.",
      );
    }
  };
  const handleSharePdf = async () => {
    if (!html || isGenerating) return;

    setIsGenerating(true);

    try {
      const result = await Print.printToFileAsync({
        html,
        base64: true,
      });

      if (!result.base64) {
        throw new Error("PDF Base64 data was not returned.");
      }

      const directory = FileSystem.documentDirectory;

      if (!directory) {
        throw new Error("App document directory is unavailable.");
      }

      const pdfDirectory = `${directory}invoices/`;

      await FileSystem.makeDirectoryAsync(pdfDirectory, {
        intermediates: true,
      });

      const fileName = `invoice-${copyType.toLowerCase()}-${Date.now()}.pdf`;

      const pdfUri = `${pdfDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(pdfUri, result.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setGeneratedPdfUri(pdfUri);
      setGeneratedCopyType(copyType);

      const available = await Sharing.isAvailableAsync();

      if (!available) {
        Alert.alert(
          "Sharing unavailable",
          "The PDF was generated and saved inside the app.",
        );
        return;
      }

      await Sharing.shareAsync(pdfUri, {
        mimeType: "application/pdf",
        dialogTitle: `Share ${copyType.toLowerCase()} invoice`,
      });
    } catch (error) {
      console.error("Invoice PDF generation/sharing error:", error);

      const message = error instanceof Error ? error.message : String(error);

      Alert.alert("PDF generation or sharing failed", message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ScreenContainer>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back to invoice</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>Invoice preview</Text>

        <Text style={styles.subtitle}>
          Select the invoice copy before generating the PDF.
        </Text>
      </View>

      {invoiceQuery.isPending ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>Preparing invoice preview...</Text>
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
        </View>
      ) : (
        <>
          <View style={styles.copySelector}>
            <Text style={styles.copyLabel}>INVOICE COPY</Text>

            <View style={styles.copyOptions}>
              {COPY_OPTIONS.map((option) => {
                const selected = copyType === option.value;

                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    disabled={isGenerating}
                    onPress={() => setCopyType(option.value)}
                    style={[
                      styles.copyOption,
                      selected && styles.copyOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.copyOptionText,
                        selected && styles.copyOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.previewCard}>
            <WebView
              originWhitelist={["*"]}
              source={{ html }}
              style={styles.webView}
              javaScriptEnabled={false}
              domStorageEnabled={false}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webLoading}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              )}
            />
          </View>

          <View style={styles.actions}>
            {profileQuery.data?.role === "admin" ? (
              <AppButton
                title={
                  uploadMutation.isPending
                    ? "Uploading PDF..."
                    : generatedPdfUri
                      ? `Upload ${generatedCopyType?.toLowerCase()} PDF to server`
                      : "Generate a PDF before uploading"
                }
                variant="secondary"
                onPress={() => void handleUploadPdf()}
                loading={uploadMutation.isPending}
                disabled={!generatedPdfUri || uploadMutation.isPending}
              />
            ) : null}
            <AppButton
              title={
                isGenerating
                  ? "Generating PDF..."
                  : `Generate ${copyType.toLowerCase()} PDF`
              }
              onPress={() => void handleSharePdf()}
              loading={isGenerating}
              disabled={isGenerating || !html}
            />

            <Text style={styles.helperText}>
              Generate the PDF to save it locally. Admins can then upload the
              generated copy separately to the secure server document history.
            </Text>
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
  },
  backText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  copySelector: {
    gap: spacing.sm,
  },
  copyLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  copyOptions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  copyOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  copyOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  copyOptionText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  copyOptionTextSelected: {
    color: colors.primary,
  },
  previewCard: {
    height: 620,
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.white,
  },
  webLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    gap: spacing.md,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
  stateContainer: {
    padding: spacing.xxxl,
    alignItems: "center",
    gap: spacing.md,
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  errorCard: {
    padding: spacing.lg,
    backgroundColor: colors.dangerLight,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: "800",
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
