import { apiRequest } from "./api-client";

export interface Technician {
  id: string;
  organizationId: string;
  fullName: string;
  email: string;
  mobile: string | null;
  role: "technician";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TechnicianPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface TechnicianListResponse {
  items: Technician[];
  pagination: TechnicianPagination;
}

export interface CreateTechnicianInput {
  fullName: string;
  email: string;
  mobile?: string | null;
  password: string;
}

export interface UpdateTechnicianInput {
  fullName?: string;
  email?: string;
  mobile?: string | null;
}

export async function getTechnicians(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<TechnicianListResponse> {
  const query = new URLSearchParams();

  query.set("page", String(params?.page ?? 1));
  query.set("limit", String(params?.limit ?? 20));

  if (params?.search?.trim()) {
    query.set("search", params.search.trim());
  }

  const response = await apiRequest<ApiResponse<TechnicianListResponse>>(
    `/users?${query.toString()}`,
  );

  return response.data;
}

export async function getTechnician(id: string): Promise<Technician> {
  const response = await apiRequest<ApiResponse<Technician>>(
    `/users/${encodeURIComponent(id)}`,
  );

  return response.data;
}

export async function createTechnician(
  input: CreateTechnicianInput,
): Promise<Technician> {
  const response = await apiRequest<ApiResponse<Technician>>("/users", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function updateTechnician(
  id: string,
  input: UpdateTechnicianInput,
): Promise<Technician> {
  const response = await apiRequest<ApiResponse<Technician>>(
    `/users/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return response.data;
}

export async function updateTechnicianStatus(
  id: string,
  isActive: boolean,
): Promise<Technician> {
  const response = await apiRequest<ApiResponse<Technician>>(
    `/users/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    },
  );

  return response.data;
}

export async function resetTechnicianPassword(
  id: string,
  newPassword: string,
): Promise<void> {
  await apiRequest<ApiResponse<{ success: boolean }>>(
    `/users/${encodeURIComponent(id)}/reset-password`,
    {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    },
  );
}
