import { apiRequest } from "./api-client";

export interface Organization {
  id: string;
  name: string;
  businessDescription: string | null;
  logoUrl: string | null;
  vendorCode: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  stateCode: string | null;
  postalCode: string | null;
  country: string;

  email: string | null;
  mobile: string | null;

  gstin: string | null;
  pan: string | null;

  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;

  authorizedSignatory: string | null;
  invoiceFooter: string | null;

  createdAt: string;
  updatedAt: string;
}

export type UpdateOrganizationInput = Partial<
  Omit<Organization, "id" | "createdAt" | "updatedAt">
>;

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export async function getOrganization(): Promise<Organization> {
  const response = await apiRequest<ApiResponse<Organization>>("/organization");

  return response.data;
}

export async function updateOrganization(
  input: UpdateOrganizationInput,
): Promise<Organization> {
  const response = await apiRequest<ApiResponse<Organization>>(
    "/organization",
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return response.data;
}
