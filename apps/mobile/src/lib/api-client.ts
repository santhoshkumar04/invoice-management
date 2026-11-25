import { clearTokens, getAccessToken } from "./auth-storage";
import * as FileSystem from "expo-file-system/legacy";
import { refreshAccessToken } from "./auth-api";

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");

if (!API_URL) {
  throw new Error("EXPO_PUBLIC_API_URL is not configured");
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  await refreshPromise;
}

async function sendRequest<T>(
  path: string,
  options: RequestInit,
  token: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);

  const isFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  if (
    options.body &&
    !isFormData &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const errorResult = result as ApiErrorResponse | null;

    throw new ApiError(
      errorResult?.error?.message ?? "Request failed",
      response.status,
    );
  }

  return result as T;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const accessToken = await getAccessToken();

  try {
    return await sendRequest<T>(path, options, accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }
  }

  try {
    await refreshSession();

    const newAccessToken = await getAccessToken();

    if (!newAccessToken) {
      throw new Error("Session expired. Please sign in again.");
    }

    return await sendRequest<T>(path, options, newAccessToken);
  } catch (error) {
    await clearTokens();
    throw error;
  }
}


export async function apiDownloadFile(
  path: string,
  destinationUri: string,
) {
  async function download(token: string | null) {
    const headers: Record<string, string> = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return FileSystem.downloadAsync(
      `${API_URL}${path}`,
      destinationUri,
      { headers },
    );
  }

  await FileSystem.deleteAsync(destinationUri, {
    idempotent: true,
  });

  let token = await getAccessToken();
  let result = await download(token);

  if (result.status === 401) {
    try {
      await refreshSession();
      token = await getAccessToken();

      if (!token) {
        throw new Error("Session expired. Please sign in again.");
      }
    } catch (error) {
      await clearTokens();
      await FileSystem.deleteAsync(destinationUri, {
        idempotent: true,
      });
      throw error;
    }

    await FileSystem.deleteAsync(destinationUri, {
      idempotent: true,
    });

    result = await download(token);
  }

  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(destinationUri, {
      idempotent: true,
    });

    if (result.status === 401) {
      await clearTokens();
      throw new ApiError(
        "Session expired. Please sign in again.",
        401,
      );
    }

    throw new ApiError(
      "Unable to download invoice document.",
      result.status,
    );
  }

  return result;
}