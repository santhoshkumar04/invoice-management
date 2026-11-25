import { createHash, randomBytes } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";

export interface AccessTokenPayload {
  userId: string;
  organizationId: string;
  role: "admin" | "technician";
}

const secret = process.env.JWT_ACCESS_SECRET;

if (!secret || secret.length < 32) {
  throw new Error(
    "JWT_ACCESS_SECRET must be configured with at least 32 characters",
  );
}

const JWT_SECRET = new TextEncoder().encode(secret);

const ISSUER = process.env.JWT_ISSUER ?? "invoice-management-api";

const AUDIENCE = process.env.JWT_AUDIENCE ?? "invoice-management-mobile";

const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";

export async function generateAccessToken(
  payload: AccessTokenPayload,
): Promise<string> {
  return new SignJWT({
    organizationId: payload.organizationId,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ACCESS_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ["HS256"],
  });

  if (
    typeof payload.sub !== "string" ||
    typeof payload.organizationId !== "string" ||
    (payload.role !== "admin" && payload.role !== "technician")
  ) {
    throw new Error("Invalid access token payload");
  }

  return {
    userId: payload.sub,
    organizationId: payload.organizationId,
    role: payload.role,
  };
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getRefreshExpiry(): Date {
  const days = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? 30);

  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error("Invalid refresh token expiration configuration");
  }

  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
