import { apiRequest } from "./api-client";

export interface ReportPeriod {
  from: string | null;
  to: string | null;
}

export interface ReportDateRange {
  from?: string;
  to?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

function buildQuery(
  params: object,
): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }

  const result = query.toString();
  return result ? `?${result}` : "";
}

async function getReport<T>(
  path: string,
  params: object = {},
): Promise<T> {
  const response = await apiRequest<ApiResponse<T>>(
    `${path}${buildQuery(params)}`,
  );

  return response.data;
}

// Overview

export interface OverviewReport {
  period: ReportPeriod;
  dateBasis: {
    invoiceMetrics: "invoiceDate";
    collections: "paymentDate";
  };
  invoiceCount: number;
  billedTotal: string;
  collectedTotal: string;
  outstandingTotal: string;
}

export function getOverviewReport(
  params?: ReportDateRange,
): Promise<OverviewReport> {
  return getReport("/reports/overview", params ?? {});
}

// Sales

export type SalesGroupBy = "day" | "month" | "financialYear";

export interface SalesReportRow {
  period: string;
  invoiceCount: number;
  taxableTotal: string;
  taxTotal: string;
  billedTotal: string;
}

export interface SalesReport {
  period: ReportPeriod;
  groupBy: SalesGroupBy;
  dateBasis: "invoiceDate";
  data: SalesReportRow[];
}

export interface SalesReportParams extends ReportDateRange {
  groupBy?: SalesGroupBy;
}

export function getSalesReport(
  params?: SalesReportParams,
): Promise<SalesReport> {
  return getReport("/reports/sales", params ?? {});
}

// Payments

export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "upi"
  | "cheque"
  | "card"
  | "other";

export interface PaymentsReportRow {
  paymentDate: string;
  method: PaymentMethod;
  paymentCount: number;
  collectedTotal: string;
}

export interface PaymentsReport {
  period: ReportPeriod;
  dateBasis: "paymentDate";
  method: PaymentMethod | null;
  summary: {
    paymentCount: number;
    collectedTotal: string;
  };
  data: PaymentsReportRow[];
}

export interface PaymentsReportParams extends ReportDateRange {
  method?: PaymentMethod;
}

export function getPaymentsReport(
  params?: PaymentsReportParams,
): Promise<PaymentsReport> {
  return getReport("/reports/payments", params ?? {});
}

// Outstanding invoices

export type OutstandingStatus =
  | "unpaid"
  | "partially_paid"
  | "all";

export interface OutstandingReportRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  currency: string;
  customerId: string;
  customerName: string;
  companyName: string | null;
  grandTotal: string;
  adjustedTotal: string;
  paidAmount: string;
  balanceDue: string;
}

export interface ReportPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface OutstandingReport {
  period: ReportPeriod;
  status: OutstandingStatus;
  data: OutstandingReportRow[];
  pagination: ReportPagination;
}

export interface OutstandingReportParams extends ReportDateRange {
  status?: OutstandingStatus;
  customerId?: string;
  page?: number;
  limit?: number;
}

export function getOutstandingReport(
  params?: OutstandingReportParams,
): Promise<OutstandingReport> {
  return getReport("/reports/outstanding", params ?? {});
}

// GST

export interface GstReportSummary {
  invoiceCount: number;
  taxableTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  totalTax: string;
  billedTotal: string;
}

export interface GstSupplyBreakdown {
  supplyType: string;
  invoiceCount: number;
  taxableTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  totalTax: string;
}

export interface GstReport {
  period: ReportPeriod;
  dateBasis: "invoiceDate";
  summary: GstReportSummary;
  supplyBreakdown: GstSupplyBreakdown[];
}

export function getGstReport(
  params?: ReportDateRange,
): Promise<GstReport> {
  return getReport("/reports/gst", params ?? {});
}

// Customers

export interface CustomerReportRow {
  customerId: string;
  customerName: string;
  companyName: string | null;
  city: string | null;
  state: string | null;
  invoiceCount: number;
  taxableTotal: string;
  billedTotal: string;
  collectedTotal: string;
  outstandingTotal: string;
}

export interface CustomersReportSummary {
  customerCount: number;
  invoiceCount: number;
  taxableTotal: string;
  billedTotal: string;
  collectedTotal: string;
  outstandingTotal: string;
}

export interface CustomersReport {
  period: ReportPeriod;
  dateBasis: "invoiceDate";
  search: string | null;
  summary: CustomersReportSummary;
  data: CustomerReportRow[];
  pagination: ReportPagination;
}

export interface CustomersReportParams extends ReportDateRange {
  search?: string;
  page?: number;
  limit?: number;
}

export function getCustomersReport(
  params?: CustomersReportParams,
): Promise<CustomersReport> {
  return getReport("/reports/customers", params ?? {});
}

