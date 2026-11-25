import { apiRequest } from "./api-client";

export type CustomerStatusFilter = "active" | "inactive" | "all";

export interface Customer {
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

export interface CustomerPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CustomerListResponse {
  items: Customer[];
  pagination: CustomerPagination;
}

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: CustomerStatusFilter;
}

export interface CreateCustomerInput {
  customerName: string;

  companyName?: string | null;
  contactPerson?: string | null;

  email?: string | null;
  mobile?: string | null;

  addressLine1?: string | null;
  addressLine2?: string | null;

  city?: string | null;
  district?: string | null;
  state?: string | null;
  stateCode?: string | null;
  postalCode?: string | null;
  country?: string;

  gstin?: string | null;
  pan?: string | null;
  vendorCode?: string | null;

  notes?: string | null;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export async function getCustomers(
  params?: CustomerListParams,
): Promise<CustomerListResponse> {
  const query = new URLSearchParams();

  query.set("page", String(params?.page ?? 1));
  query.set("limit", String(params?.limit ?? 20));
  query.set("status", params?.status ?? "active");

  if (params?.search?.trim()) {
    query.set("search", params.search.trim());
  }

  const response = await apiRequest<ApiResponse<CustomerListResponse>>(
    `/customers?${query.toString()}`,
  );

  return response.data;
}

export async function getCustomer(id: string): Promise<Customer> {
  const response = await apiRequest<ApiResponse<Customer>>(
    `/customers/${encodeURIComponent(id)}`,
  );

  return response.data;
}

export async function createCustomer(
  input: CreateCustomerInput,
): Promise<Customer> {
  const response = await apiRequest<ApiResponse<Customer>>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput,
): Promise<Customer> {
  const response = await apiRequest<ApiResponse<Customer>>(
    `/customers/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return response.data;
}

export async function updateCustomerStatus(
  id: string,
  isActive: boolean,
): Promise<Customer> {
  const response = await apiRequest<ApiResponse<Customer>>(
    `/customers/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    },
  );

  return response.data;
}
