import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createInvoice,
  getInvoice,
  getInvoicePayments,
  getInvoices,
  issueInvoice,
  updateInvoice,
  cancelInvoice,
  recordInvoicePayment,
  createInvoiceAdjustment,
  getInvoiceAdjustments,
  getInvoiceDocuments,
  uploadInvoiceDocument,
  type CreateInvoiceAdjustmentInput,
  type InvoiceAdjustmentsResponse,
  type CreateInvoicePaymentInput,
  type CreateInvoiceInput,
  type InvoiceListParams,
  type InvoicePaymentsResponse,
  type InvoiceDocumentCopyType,
} from "../lib/invoices-api";

export const invoiceKeys = {
  all: ["invoices"] as const,

  paymentHistories: () => [...invoiceKeys.all, "payments"] as const,

  paymentHistory: (invoiceId: string) =>
    [...invoiceKeys.paymentHistories(), invoiceId] as const,

  adjustmentHistories: () => [...invoiceKeys.all, "adjustments"] as const,

  adjustmentHistory: (invoiceId: string) =>
    [...invoiceKeys.adjustmentHistories(), invoiceId] as const,

  documentHistories: () => [...invoiceKeys.all, "documents"] as const,

  documentHistory: (invoiceId: string) =>
    [...invoiceKeys.documentHistories(), invoiceId] as const,

  lists: () => [...invoiceKeys.all, "list"] as const,

  list: (params: InvoiceListParams = {}) =>
    [...invoiceKeys.lists(), params] as const,

  details: () => [...invoiceKeys.all, "detail"] as const,

  detail: (invoiceId: string) => [...invoiceKeys.details(), invoiceId] as const,
};

export function useInvoices(params: InvoiceListParams = {}) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: () => getInvoices(params),
  });
}

export function useInvoice(invoiceId: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(invoiceId),
    queryFn: () => getInvoice(invoiceId),
    enabled: Boolean(invoiceId),
  });
}

export function useInvoicePayments(invoiceId: string) {
  return useQuery<InvoicePaymentsResponse>({
    queryKey: invoiceKeys.paymentHistory(invoiceId),
    queryFn: () => getInvoicePayments(invoiceId),
    enabled: Boolean(invoiceId),
  });
}

export function useInvoiceAdjustments(invoiceId: string) {
  return useQuery<InvoiceAdjustmentsResponse>({
    queryKey: invoiceKeys.adjustmentHistory(invoiceId),
    queryFn: () => getInvoiceAdjustments(invoiceId),
    enabled: Boolean(invoiceId),
  });
}

export function useInvoiceDocuments(invoiceId: string) {
  return useQuery({
    queryKey: invoiceKeys.documentHistory(invoiceId),
    queryFn: () => getInvoiceDocuments(invoiceId),
    enabled: Boolean(invoiceId),
  });
}

export function useUploadInvoiceDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      invoiceId,
      fileUri,
      fileName,
      copyType,
    }: {
      invoiceId: string;
      fileUri: string;
      fileName: string;
      copyType: InvoiceDocumentCopyType;
    }) =>
      uploadInvoiceDocument(
        invoiceId,
        fileUri,
        fileName,
        copyType,
      ),

    onSuccess: async (_document, variables) => {
      await queryClient.invalidateQueries({
        queryKey: invoiceKeys.documentHistory(variables.invoiceId),
      });
    },
  });
}
export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => createInvoice(input),

    onSuccess: async (createdInvoice) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.lists(),
        }),
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.detail(createdInvoice.id),
        }),
      ]);
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      invoiceId,
      input,
    }: {
      invoiceId: string;
      input: CreateInvoiceInput;
    }) => updateInvoice(invoiceId, input),

    onSuccess: async (updatedInvoice) => {
      queryClient.setQueryData(
        invoiceKeys.detail(updatedInvoice.id),
        updatedInvoice,
      );

      await queryClient.invalidateQueries({
        queryKey: invoiceKeys.lists(),
      });
    },
  });
}

export function useIssueInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invoiceId: string) => issueInvoice(invoiceId),

    onSuccess: async (_result, invoiceId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.lists(),
        }),
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.detail(invoiceId),
        }),
      ]);
    },
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      invoiceId,
      reason,
    }: {
      invoiceId: string;
      reason: string;
    }) => cancelInvoice(invoiceId, reason),

    onSuccess: async (cancelledInvoice) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.lists(),
        }),
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.detail(cancelledInvoice.id),
        }),
      ]);
    },
  });
}

export function useRecordInvoicePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      invoiceId,
      input,
    }: {
      invoiceId: string;
      input: CreateInvoicePaymentInput;
    }) => recordInvoicePayment(invoiceId, input),

    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.lists(),
        }),
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.detail(variables.invoiceId),
        }),
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.paymentHistory(variables.invoiceId),
        }),
      ]);
    },
  });
}

export function useCreateInvoiceAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      invoiceId,
      input,
    }: {
      invoiceId: string;
      input: CreateInvoiceAdjustmentInput;
    }) => createInvoiceAdjustment(invoiceId, input),

    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.lists(),
        }),
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.detail(variables.invoiceId),
        }),
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.paymentHistory(variables.invoiceId),
        }),
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.adjustmentHistory(variables.invoiceId),
        }),
      ]);
    },
  });
}
