import { and, count, desc, eq, ilike, or } from "drizzle-orm";

import { db } from "../../db/client.js";
import { users } from "../../db/schema/users.js";
import { auditLogs } from "../../db/schema/audit-logs.js";
import { refreshSessions } from "../../db/schema/refresh-sessions.js";

import { hashPassword } from "../auth/services/password.service.js";

type TechnicianContext = {
  organizationId: string;
  adminUserId: string;
  ipAddress?: string;
};

function publicTechnician(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    organizationId: user.organizationId,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function ensureTechnician(
  user: typeof users.$inferSelect | undefined,
): asserts user is typeof users.$inferSelect {
  if (!user || user.role !== "technician") {
    throw new Error("TECHNICIAN_NOT_FOUND");
  }
}

async function writeAudit(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  context: TechnicianContext,
  action: string,
  technicianId: string,
  description: string,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
) {
  await tx.insert(auditLogs).values({
    organizationId: context.organizationId,
    userId: context.adminUserId,
    action,
    entityType: "technician",
    entityId: technicianId,
    description,
    oldValues,
    newValues,
    ipAddress: context.ipAddress ?? null,
  });
}

export async function createTechnician(
  context: TechnicianContext,
  input: {
    fullName: string;
    email: string;
    mobile?: string | null;
    password: string;
  },
) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          organizationId: context.organizationId,
          fullName: input.fullName.trim(),
          email,
          mobile: input.mobile?.trim() || null,
          passwordHash,
          role: "technician",
          isActive: true,
        })
        .returning();

      if (!created) {
        throw new Error("TECHNICIAN_CREATE_FAILED");
      }

      await writeAudit(
        tx,
        context,
        "technician.created",
        created.id,
        "Technician account created",
        null,
        {
          fullName: created.fullName,
          email: created.email,
          mobile: created.mobile,
          role: created.role,
          isActive: created.isActive,
        },
      );

      return publicTechnician(created);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    throw error;
  }
}

export async function listTechnicians(
  organizationId: string,
  input: {
    page: number;
    limit: number;
    search?: string;
  },
) {
  const conditions = [
    eq(users.organizationId, organizationId),
    eq(users.role, "technician"),
  ];

  const search = input.search?.trim();

  const whereClause = search
    ? and(
        ...conditions,
        or(
          ilike(users.fullName, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.mobile, `%${search}%`),
        ),
      )
    : and(...conditions);

  const offset = (input.page - 1) * input.limit;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(input.limit)
      .offset(offset),

    db.select({ total: count() }).from(users).where(whereClause),
  ]);

  const total = countResult[0]?.total ?? 0;

  return {
    items: rows.map(publicTechnician),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

export async function getTechnician(
  organizationId: string,
  technicianId: string,
) {
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.id, technicianId),
        eq(users.organizationId, organizationId),
        eq(users.role, "technician"),
      ),
    )
    .limit(1);

  ensureTechnician(user);

  return publicTechnician(user);
}

export async function updateTechnician(
  context: TechnicianContext,
  technicianId: string,
  input: {
    fullName?: string;
    email?: string;
    mobile?: string | null;
  },
) {
  const updateValues = {
    ...(input.fullName !== undefined && {
      fullName: input.fullName.trim(),
    }),
    ...(input.email !== undefined && {
      email: input.email.trim().toLowerCase(),
    }),
    ...(input.mobile !== undefined && {
      mobile: input.mobile?.trim() || null,
    }),
    updatedAt: new Date(),
  };

  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, technicianId),
            eq(users.organizationId, context.organizationId),
            eq(users.role, "technician"),
          ),
        )
        .limit(1);

      ensureTechnician(existing);

      const [updated] = await tx
        .update(users)
        .set(updateValues)
        .where(
          and(
            eq(users.id, technicianId),
            eq(users.organizationId, context.organizationId),
            eq(users.role, "technician"),
          ),
        )
        .returning();

      if (!updated) {
        throw new Error("TECHNICIAN_NOT_FOUND");
      }

      await writeAudit(
        tx,
        context,
        "technician.updated",
        technicianId,
        "Technician account updated",
        {
          fullName: existing.fullName,
          email: existing.email,
          mobile: existing.mobile,
        },
        {
          fullName: updated.fullName,
          email: updated.email,
          mobile: updated.mobile,
        },
      );

      return publicTechnician(updated);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    throw error;
  }
}

export async function updateTechnicianStatus(
  context: TechnicianContext,
  technicianId: string,
  isActive: boolean,
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, technicianId),
          eq(users.organizationId, context.organizationId),
          eq(users.role, "technician"),
        ),
      )
      .limit(1);

    ensureTechnician(existing);

    const now = new Date();

    const [updated] = await tx
      .update(users)
      .set({
        isActive,
        updatedAt: now,
      })
      .where(
        and(
          eq(users.id, technicianId),
          eq(users.organizationId, context.organizationId),
          eq(users.role, "technician"),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error("TECHNICIAN_NOT_FOUND");
    }

    if (!isActive) {
      await tx
        .update(refreshSessions)
        .set({
          status: "revoked",
          revokedAt: now,
        })
        .where(
          and(
            eq(refreshSessions.userId, technicianId),
            eq(refreshSessions.status, "active"),
          ),
        );
    }

    await writeAudit(
      tx,
      context,
      isActive ? "technician.activated" : "technician.deactivated",
      technicianId,
      isActive
        ? "Technician account activated"
        : "Technician account deactivated",
      { isActive: existing.isActive },
      { isActive: updated.isActive },
    );

    return publicTechnician(updated);
  });
}

export async function resetTechnicianPassword(
  context: TechnicianContext,
  technicianId: string,
  newPassword: string,
) {
  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: users.id,
      })
      .from(users)
      .where(
        and(
          eq(users.id, technicianId),
          eq(users.organizationId, context.organizationId),
          eq(users.role, "technician"),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error("TECHNICIAN_NOT_FOUND");
    }

    await tx
      .update(users)
      .set({
        passwordHash,
        updatedAt: now,
      })
      .where(eq(users.id, technicianId));

    // Revoke all existing refresh sessions after a password reset.
    await tx
      .update(refreshSessions)
      .set({
        status: "revoked",
        revokedAt: now,
      })
      .where(
        and(
          eq(refreshSessions.userId, technicianId),
          eq(refreshSessions.status, "active"),
        ),
      );

    await writeAudit(
      tx,
      context,
      "technician.password_reset",
      technicianId,
      "Technician password reset by administrator",
      null,
      { passwordReset: true },
    );

    return { success: true };
  });
}
