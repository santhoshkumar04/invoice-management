import { saveTokens, getRefreshToken, clearTokens } from "./auth-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("EXPO_PUBLIC_API_URL is not configured");
}

interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  mobile: string | null;
  role: "admin" | "technician";
  organizationId: string;
  isActive: boolean;
}

interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
    user: AuthUser;
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.error?.message ?? "Request failed");
  }

  return result as T;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthUser> {
  const result = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  await saveTokens(result.data.accessToken, result.data.refreshToken);

  return result.data.user;
}

export async function refreshAccessToken(): Promise<void> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    throw new Error("Login required");
  }

  try {
    const result = await request<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });

    await saveTokens(result.data.accessToken, result.data.refreshToken);
  } catch (error) {
    await clearTokens();
    throw error;
  }
}

export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();

  try {
    if (refreshToken) {
      await request("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    }
  } finally {
    await clearTokens();
  }
}
