import { apiRequest } from "./api-client";

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  mobile: string | null;
  role: "admin" | "technician";
  organizationId: string;
  isActive: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface UpdateProfileInput {
  fullName: string;
  mobile: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function getMyProfile(): Promise<UserProfile> {
  const response = await apiRequest<ApiResponse<UserProfile>>("/auth/me");

  return response.data;
}

export async function updateMyProfile(
  input: UpdateProfileInput,
): Promise<UserProfile> {
  const response = await apiRequest<ApiResponse<UserProfile>>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function changeMyPassword(
  input: ChangePasswordInput,
): Promise<void> {
  await apiRequest<ApiResponse<{ success: boolean }>>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
