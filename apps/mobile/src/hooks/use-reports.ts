import { useQuery } from "@tanstack/react-query";

import {
  getOverviewReport,
  getSalesReport,
  getPaymentsReport,
  getOutstandingReport,
  getGstReport,
  getCustomersReport,
  type ReportDateRange,
  type SalesReportParams,
  type PaymentsReportParams,
  type OutstandingReportParams,
  type CustomersReportParams,
} from "../lib/reports-api";

export const reportKeys = {
  all: ["reports"] as const,

  overview: (params?: ReportDateRange) =>
    [...reportKeys.all, "overview", params ?? {}] as const,

  sales: (params?: SalesReportParams) =>
    [...reportKeys.all, "sales", params ?? {}] as const,

  payments: (params?: PaymentsReportParams) =>
    [...reportKeys.all, "payments", params ?? {}] as const,

  outstanding: (params?: OutstandingReportParams) =>
    [...reportKeys.all, "outstanding", params ?? {}] as const,

  gst: (params?: ReportDateRange) =>
    [...reportKeys.all, "gst", params ?? {}] as const,

  customers: (params?: CustomersReportParams) =>
    [...reportKeys.all, "customers", params ?? {}] as const,
};

export function useOverviewReport(params?: ReportDateRange) {
  return useQuery({
    queryKey: reportKeys.overview(params),
    queryFn: () => getOverviewReport(params),
  });
}

export function useSalesReport(params?: SalesReportParams) {
  return useQuery({
    queryKey: reportKeys.sales(params),
    queryFn: () => getSalesReport(params),
  });
}

export function usePaymentsReport(params?: PaymentsReportParams) {
  return useQuery({
    queryKey: reportKeys.payments(params),
    queryFn: () => getPaymentsReport(params),
  });
}

export function useOutstandingReport(params?: OutstandingReportParams) {
  return useQuery({
    queryKey: reportKeys.outstanding(params),
    queryFn: () => getOutstandingReport(params),
  });
}

export function useGstReport(params?: ReportDateRange) {
  return useQuery({
    queryKey: reportKeys.gst(params),
    queryFn: () => getGstReport(params),
  });
}

export function useCustomersReport(params?: CustomersReportParams) {
  return useQuery({
    queryKey: reportKeys.customers(params),
    queryFn: () => getCustomersReport(params),
  });
}
