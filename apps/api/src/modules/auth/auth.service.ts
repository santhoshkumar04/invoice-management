import { and, eq, gt } from "drizzle-orm";

import { db } from "../../db/client.js";

import { users } from "../../db/schema/users.js";

import { refreshSessions } from "../../db/schema/refresh-sessions.js";

import { verifyPassword } from "./services/password.service.js";

import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  getRefreshExpiry,
} from "./services/token.service.js";

const INVALID_CREDENTIALS = "Invalid email or password";

function publicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    organizationId: user.organizationId,
    isActive: user.isActive,
  };
}

async function createSession(user: typeof users.$inferSelect) {
  const refreshToken = generateRefreshToken();

  await db.insert(refreshSessions).values({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: getRefreshExpiry(),
    status: "active",
  });

  const accessToken = await generateAccessToken({
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
  });

  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer",
    expiresIn: 900,
    user: publicUser(user),
  };
}

export async function login(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!user) {
    throw new Error(INVALID_CREDENTIALS);
  }

  const validPassword = await verifyPassword(user.passwordHash, password);

  if (!validPassword) {
    throw new Error(INVALID_CREDENTIALS);
  }

  if (!user.isActive) {
    throw new Error("ACCOUNT_DISABLED");
  }

  const now = new Date();

  await db
    .update(users)
    .set({
      lastLoginAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));

  return createSession(user);
}

export async function refreshSession(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken);

  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(refreshSessions)
      .where(eq(refreshSessions.tokenHash, tokenHash))
      .limit(1)
      .for("update");

    if (!session || session.status !== "active") {
      throw new Error("INVALID_REFRESH_TOKEN");
    }

    const now = new Date();

    // if (session.expiresAt <= now) {
    //   await tx
    //     .update(refreshSessions)
    //     .set({ status: "expired" })
    //     .where(eq(refreshSessions.id, session.id));

    //   throw new Error("REFRESH_TOKEN_EXPIRED");
    // }

    if (session.expiresAt <= now) {
      throw new Error("REFRESH_TOKEN_EXPIRED");
    }

    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user || !user.isActive) {
      await tx
        .update(refreshSessions)
        .set({ status: "revoked", revokedAt: now })
        .where(eq(refreshSessions.id, session.id));

      throw new Error("ACCOUNT_DISABLED");
    }

    const newRefreshToken = generateRefreshToken();

    await tx
      .update(refreshSessions)
      .set({
        status: "revoked",
        revokedAt: now,
      })
      .where(eq(refreshSessions.id, session.id));

    await tx.insert(refreshSessions).values({
      userId: user.id,
      tokenHash: hashRefreshToken(newRefreshToken),
      expiresAt: getRefreshExpiry(),
      status: "active",
    });

    const accessToken = await generateAccessToken({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: "Bearer",
      expiresIn: 900,
      user: publicUser(user),
    };
  });
}

export async function logout(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken);

  const now = new Date();

  await db
    .update(refreshSessions)
    .set({
      status: "revoked",
      revokedAt: now,
    })
    .where(
      and(
        eq(refreshSessions.tokenHash, tokenHash),
        eq(refreshSessions.status, "active"),
      ),
    );

  return { success: true };
}

export async function getCurrentUser(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.isActive) {
    throw new Error("ACCOUNT_NOT_AVAILABLE");
  }

  return publicUser(user);
}
