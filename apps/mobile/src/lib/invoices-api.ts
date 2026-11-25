import { File } from "expo-file-system";
import { apiDownloadFile, apiRequest } from "./api-client";

export type InvoiceGstRate = 0 | 5 | 12 | 18 | 28;

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "cancelled";

export type InvoiceSupplyType = "intra_state" | "inter_state";

export interface CreateInvoiceItemInput {
  description: string;
  quantity: number;
  rate: number;
  gstRate?: InvoiceGstRate;
}

export interface CreateInvoiceInput {
  customerId: string;
  invoiceDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate?: string | null;
  currency?: string;
  notes?: string | null;
  isGstApplicable: boolean;
  items: CreateInvoiceItemInput[];
}

export interface CreatedInvoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  totalTax: string;
  roundOff: string;
  grandTotal: string;
  currency: string;
}

export interface InvoiceListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvoiceStatus | "all";
}

export interface InvoicePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface InvoiceCustomerSummary {
  id: string;
  customerName: string;
  companyName: string | null;
  mobile: string | null;
  email: string | null;
}

export interface InvoiceListItem {
  id: string;
  organizationId: string;
  customerId: string;
  createdBy: string;
  sequenceId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string | null;
  vendorCode: string | null;
  status: InvoiceStatus;
  currency: string;
  isGstApplicable: boolean;
  supplyType: InvoiceSupplyType | null;
  subtotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  totalTax: string;
  roundOff: string;
  grandTotal: string;
  notes: string | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  customer: InvoiceCustomerSummary;
  createdByName: string;
}

export interface InvoiceListResponse {
  items: InvoiceListItem[];
  pagination: InvoicePagination;
}

export interface InvoiceCustomerDetails {
  id: string;
  organizationId: string;
  customerName: string;
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  mobile: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  stateCode: string | null;
  postalCode: string | null;
  country: string;
  gstin: string | null;
  pan: string | null;
  vendorCode: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  lineNumber: number;
  description: string;
  quantity: string;
  rate: string;
  amount: string;
  gstRate: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  createdAt: string;
}

export interface InvoiceDetail extends Omit<InvoiceListItem, "customer"> {
  customer: InvoiceCustomerDetails;
  items: InvoiceLineItem[];
  snapshot: Record<string, unknown> | null;
}

export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "upi"
  | "cheque"
  | "card"
  | "other";

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  recordedBy: string;
  paymentDate: string;
  amount: string;
  method: PaymentMethod;
  referenceNumber: string | null;
  notes: string | null;
  createdAt: string;
  recordedByName: string;
}

export interface InvoicePaymentSummary {
  grandTotal: string;
  adjustedTotal: string;
  paidAmount: string;
  balanceDue: string;
  paymentCount: number;
}

export type InvoiceAdjustmentType = "credit" | "debit";

export interface InvoiceAdjustment {
  id: string;
  invoiceId: string;
  createdBy: string;
  type: InvoiceAdjustmentType;
  amount: string;
  reason: string;
  notes: string | null;
  createdAt: string;
  createdByName?: string;
}

export interface InvoiceAdjustmentSummary {
  originalTotal: string;
  adjustedTotal: string;
  paidAmount: string;
  balanceDue: string;
  adjustmentCount: number;
}

export interface InvoiceAdjustmentsResponse {
  adjustments: InvoiceAdjustment[];
  summary: InvoiceAdjustmentSummary;
}

export interface CreateInvoiceAdjustmentInput {
  type: InvoiceAdjustmentType;
  amount: number;
  reason: string;
  notes?: string | null;
}

export interface CreatedInvoiceAdjustmentResponse {
  adjustment: InvoiceAdjustment;
  invoice: {
    id: string;
    status: InvoiceStatus;
  };
  summary: Omit<InvoiceAdjustmentSummary, "adjustmentCount">;
}

export interface InvoicePaymentsResponse {
  payments: InvoicePayment[];
  summary: InvoicePaymentSummary;
}

export interface CreateInvoicePaymentInput {
  paymentDate: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
}

export type InvoiceDocumentCopyType =
  | "original"
  | "duplicate"
  | "triplicate";

export interface InvoiceDocument {
  id: string;
  invoiceId: string;
  copyType: InvoiceDocumentCopyType;
  fileName: string;
  mimeType: string;
  fileSize: string | null;
  checksum: string | null;
  generatedAt: string;
}
interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export async function createInvoice(
  input: CreateInvoiceInput,
): Promise<CreatedInvoice> {
  const response = await apiRequest<ApiResponse<CreatedInvoice>>("/invoices", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function updateInvoice(
  invoiceId: string,
  input: CreateInvoiceInput,
): Promise<InvoiceDetail> {
  const response = await apiRequest<ApiResponse<InvoiceDetail>>(
    `/invoices/${encodeURIComponent(invoiceId)}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );

  return response.data;
}

export async function getInvoices(
  params: InvoiceListParams = {},
): Promise<InvoiceListResponse> {
  const query = new URLSearchParams();

  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 20));
  query.set("status", params.status ?? "all");

  const search = params.search?.trim();

  if (search) {
    query.set("search", search);
  }

  const response = await apiRequest<ApiResponse<InvoiceListResponse>>(
    `/invoices?${query.toString()}`,
    {
      method: "GET",
    },
  );

  return response.data;
}

export async function getInvoice(invoiceId: string): Promise<InvoiceDetail> {
  const response = await apiRequest<ApiResponse<InvoiceDetail>>(
    `/invoices/${encodeURIComponent(invoiceId)}`,
    {
      method: "GET",
    },
  );

  return response.data;
}

export async function issueInvoice(invoiceId: string): Promise<void> {
  await apiRequest<ApiResponse<unknown>>(
    `/invoices/${encodeURIComponent(invoiceId)}/issue`,
    {
      method: "POST",
    },
  );
}

export async function cancelInvoice(
  invoiceId: string,
  reason: string,
): Promise<InvoiceDetail> {
  const response = await apiRequest<ApiResponse<InvoiceDetail>>(
    `/invoices/${encodeURIComponent(invoiceId)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  );

  return response.data;
}

export async function getInvoicePayments(
  invoiceId: string,
): Promise<InvoicePaymentsResponse> {
  const response = await apiRequest<ApiResponse<InvoicePaymentsResponse>>(
    `/invoices/${encodeURIComponent(invoiceId)}/payments`,
    {
      method: "GET",
    },
  );

  return response.data;
}

export async function recordInvoicePayment(
  invoiceId: string,
  input: CreateInvoicePaymentInput,
): Promise<unknown> {
  const response = await apiRequest<ApiResponse<unknown>>(
    `/invoices/${encodeURIComponent(invoiceId)}/payments`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return response.data;
}

export async function getInvoiceAdjustments(
  invoiceId: string,
): Promise<InvoiceAdjustmentsResponse> {
  const response = await apiRequest<ApiResponse<InvoiceAdjustmentsResponse>>(
    `/invoices/${encodeURIComponent(invoiceId)}/adjustments`,
    {
      method: "GET",
    },
  );

  return response.data;
}

export async function createInvoiceAdjustment(
  invoiceId: string,
  input: CreateInvoiceAdjustmentInput,
): Promise<CreatedInvoiceAdjustmentResponse> {
  const response = await apiRequest<
    ApiResponse<CreatedInvoiceAdjustmentResponse>
  >(`/invoices/${encodeURIComponent(invoiceId)}/adjustments`, {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.data;
}


export async function getInvoiceDocuments(
  invoiceId: string,
): Promise<InvoiceDocument[]> {
  const response = await apiRequest<ApiResponse<InvoiceDocument[]>>(
    `/invoices/${encodeURIComponent(invoiceId)}/documents`,
    {
      method: "GET",
    },
  );

  return response.data;
}

export async function uploadInvoiceDocument(
  invoiceId: string,
  fileUri: string,
  fileName: string,
  copyType: InvoiceDocumentCopyType,
): Promise<InvoiceDocument> {
  const formData = new FormData();
  const pdfFile = new File(fileUri);

  formData.append("file", pdfFile, fileName);

  const response = await apiRequest<ApiResponse<InvoiceDocument>>(
    `/invoices/${encodeURIComponent(invoiceId)}/documents?copyType=${copyType}`,
    {
      method: "POST",
      body: formData,
    },
  );

  return response.data;
}

export async function downloadInvoiceDocument(
  documentId: string,
  destinationUri: string,
) {
  return apiDownloadFile(
    `/invoice-documents/${encodeURIComponent(documentId)}/download`,
    destinationUri,
  );
}