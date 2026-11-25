import { and, eq } from "drizzle-orm";

import { db } from "../../db/client.js";
import { users } from "../../db/schema/users.js";
import { auditLogs } from "../../db/schema/audit-logs.js";
import { refreshSessions } from "../../db/schema/refresh-sessions.js";

import { hashPassword, verifyPassword } from "./services/password.service.js";

type ProfileContext = {
  userId: string;
  organizationId: string;
  ipAddress?: string;
};

export async function updateCurrentUser(
  context: ProfileContext,
  input: {
    fullName?: string;
    mobile?: string | null;
  },
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, context.userId),
          eq(users.organizationId, context.organizationId),
          eq(users.isActive, true),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error("ACCOUNT_NOT_AVAILABLE");
    }

    const updateValues = {
      ...(input.fullName !== undefined && {
        fullName: input.fullName.trim(),
      }),
      ...(input.mobile !== undefined && {
        mobile: input.mobile?.trim() || null,
      }),
      updatedAt: new Date(),
    };

    const [updated] = await tx
      .update(users)
      .set(updateValues)
      .where(
        and(
          eq(users.id, context.userId),
          eq(users.organizationId, context.organizationId),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error("ACCOUNT_NOT_AVAILABLE");
    }

    await tx.insert(auditLogs).values({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "user.profile_updated",
      entityType: "user",
      entityId: context.userId,
      description: "User updated their personal profile",
      oldValues: {
        fullName: existing.fullName,
        mobile: existing.mobile,
      },
      newValues: {
        fullName: updated.fullName,
        mobile: updated.mobile,
      },
      ipAddress: context.ipAddress ?? null,
    });

    return {
      id: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      mobile: updated.mobile,
      role: updated.role,
      organizationId: updated.organizationId,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  });
}

export async function changeCurrentUserPassword(
  context: ProfileContext,
  currentPassword: string,
  newPassword: string,
) {
  const [existing] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.id, context.userId),
        eq(users.organizationId, context.organizationId),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new Error("ACCOUNT_NOT_AVAILABLE");
  }

  const isCurrentPasswordValid = await verifyPassword(
    existing.passwordHash,
    currentPassword,
  );

  if (!isCurrentPasswordValid) {
    throw new Error("CURRENT_PASSWORD_INVALID");
  }

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(users)
      .set({
        passwordHash,
        updatedAt: now,
      })
      .where(
        and(
          eq(users.id, context.userId),
          eq(users.organizationId, context.organizationId),
          eq(users.isActive, true),
        ),
      )
      .returning({ id: users.id });

    if (!updated) {
      throw new Error("ACCOUNT_NOT_AVAILABLE");
    }

    await tx
      .update(refreshSessions)
      .set({
        status: "revoked",
        revokedAt: now,
      })
      .where(
        and(
          eq(refreshSessions.userId, context.userId),
          eq(refreshSessions.status, "active"),
        ),
      );

    await tx.insert(auditLogs).values({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "user.password_changed",
      entityType: "user",
      entityId: context.userId,
      description: "User changed their password",
      oldValues: null,
      newValues: {
        passwordChanged: true,
        activeSessionsRevoked: true,
      },
      ipAddress: context.ipAddress ?? null,
    });
  });

  return { success: true };
}
