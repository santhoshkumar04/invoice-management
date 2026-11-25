import { eq } from "drizzle-orm";

import { db } from "../../db/client.js";
import { organizations } from "../../db/schema/organizations.js";
import { auditLogs } from "../../db/schema/audit-logs.js";

import type { UpdateOrganizationInput } from "./schemas/organizations.schema.js";

type OrganizationContext = {
  organizationId: string;
  userId: string;
  ipAddress?: string;
};

export async function getOrganization(organizationId: string) {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    throw new Error("ORGANIZATION_NOT_FOUND");
  }

  return organization;
}

export async function updateOrganization(
  context: OrganizationContext,
  input: UpdateOrganizationInput,
) {
  const updateValues = {
    ...(input.name !== undefined && {
      name: input.name.trim(),
    }),

    ...(input.businessDescription !== undefined && {
      businessDescription: input.businessDescription?.trim() || null,
    }),

    ...(input.logoUrl !== undefined && {
      logoUrl: input.logoUrl?.trim() || null,
    }),

    ...(input.vendorCode !== undefined && {
      vendorCode: input.vendorCode?.trim() || null,
    }),

    ...(input.addressLine1 !== undefined && {
      addressLine1: input.addressLine1?.trim() || null,
    }),

    ...(input.addressLine2 !== undefined && {
      addressLine2: input.addressLine2?.trim() || null,
    }),

    ...(input.city !== undefined && {
      city: input.city?.trim() || null,
    }),

    ...(input.district !== undefined && {
      district: input.district?.trim() || null,
    }),

    ...(input.state !== undefined && {
      state: input.state?.trim() || null,
    }),

    ...(input.stateCode !== undefined && {
      stateCode: input.stateCode?.trim() || null,
    }),

    ...(input.postalCode !== undefined && {
      postalCode: input.postalCode?.trim() || null,
    }),

    ...(input.country !== undefined && {
      country: input.country.trim(),
    }),

    ...(input.email !== undefined && {
      email: input.email?.trim().toLowerCase() || null,
    }),

    ...(input.mobile !== undefined && {
      mobile: input.mobile?.trim() || null,
    }),

    ...(input.gstin !== undefined && {
      gstin: input.gstin?.trim().toUpperCase() || null,
    }),

    ...(input.pan !== undefined && {
      pan: input.pan?.trim().toUpperCase() || null,
    }),

    ...(input.bankName !== undefined && {
      bankName: input.bankName?.trim() || null,
    }),

    ...(input.bankAccountName !== undefined && {
      bankAccountName: input.bankAccountName?.trim() || null,
    }),

    ...(input.bankAccountNumber !== undefined && {
      bankAccountNumber: input.bankAccountNumber?.trim() || null,
    }),

    ...(input.bankIfsc !== undefined && {
      bankIfsc: input.bankIfsc?.trim().toUpperCase() || null,
    }),

    ...(input.authorizedSignatory !== undefined && {
      authorizedSignatory: input.authorizedSignatory?.trim() || null,
    }),

    ...(input.invoiceFooter !== undefined && {
      invoiceFooter: input.invoiceFooter?.trim() || null,
    }),

    updatedAt: new Date(),
  };

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(organizations)
      .where(eq(organizations.id, context.organizationId))
      .limit(1);

    if (!existing) {
      throw new Error("ORGANIZATION_NOT_FOUND");
    }

    const [updated] = await tx
      .update(organizations)
      .set(updateValues)
      .where(eq(organizations.id, context.organizationId))
      .returning();

    if (!updated) {
      throw new Error("ORGANIZATION_UPDATE_FAILED");
    }

    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    for (const key of Object.keys(input) as Array<
      keyof UpdateOrganizationInput
    >) {
      if (key === "bankAccountNumber") {
        const oldAccount = existing.bankAccountNumber;
        const newAccount = updated.bankAccountNumber;

        oldValues[key] = oldAccount ? `****${oldAccount.slice(-4)}` : null;

        newValues[key] = newAccount ? `****${newAccount.slice(-4)}` : null;
      } else {
        oldValues[key] = existing[key];
        newValues[key] = updated[key];
      }
    }

    await tx.insert(auditLogs).values({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "organization.updated",
      entityType: "organization",
      entityId: context.organizationId,
      description: "Company profile updated",
      oldValues,
      newValues,
      ipAddress: context.ipAddress ?? null,
    });

    return updated;
  });
}
