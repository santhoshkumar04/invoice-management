import { and, count, desc, eq, ilike, or } from "drizzle-orm";

import { db } from "../../db/client.js";
import { customers } from "../../db/schema/customers.js";
import { auditLogs } from "../../db/schema/audit-logs.js";

type CustomerContext = {
  organizationId: string;
  userId: string;
  ipAddress?: string;
};

type CustomerInput = {
  customerName: string;
  companyName?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  mobile?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  stateCode?: string | null;
  postalCode?: string | null;
  country?: string;
  gstin?: string | null;
  pan?: string | null;
  vendorCode?: string | null;
  notes?: string | null;
};

type CustomerUpdateInput = Partial<CustomerInput>;

type CustomerListInput = {
  page: number;
  limit: number;
  search?: string;
  status: "active" | "inactive" | "all";
};

function normalizeNullable(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return value.trim() || null;
}

function publicCustomer(customer: typeof customers.$inferSelect) {
  return {
    id: customer.id,
    organizationId: customer.organizationId,
    customerName: customer.customerName,
    companyName: customer.companyName,
    contactPerson: customer.contactPerson,
    email: customer.email,
    mobile: customer.mobile,
    addressLine1: customer.addressLine1,
    addressLine2: customer.addressLine2,
    city: customer.city,
    district: customer.district,
    state: customer.state,
    stateCode: customer.stateCode,
    postalCode: customer.postalCode,
    country: customer.country,
    gstin: customer.gstin,
    pan: customer.pan,
    vendorCode: customer.vendorCode,
    notes: customer.notes,
    isActive: customer.isActive,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

function ensureCustomer(
  customer: typeof customers.$inferSelect | undefined,
): asserts customer is typeof customers.$inferSelect {
  if (!customer) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }
}

async function writeAudit(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  context: CustomerContext,
  action: string,
  customerId: string,
  description: string,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
) {
  await tx.insert(auditLogs).values({
    organizationId: context.organizationId,
    userId: context.userId,
    action,
    entityType: "customer",
    entityId: customerId,
    description,
    oldValues,
    newValues,
    ipAddress: context.ipAddress ?? null,
  });
}

function customerAuditValues(
  customer: typeof customers.$inferSelect,
): Record<string, unknown> {
  return {
    customerName: customer.customerName,
    companyName: customer.companyName,
    contactPerson: customer.contactPerson,
    email: customer.email,
    mobile: customer.mobile,
    gstin: customer.gstin,
    pan: customer.pan,
    vendorCode: customer.vendorCode,
    isActive: customer.isActive,
  };
}

/**
 * Create a customer inside the authenticated organization.
 */
export async function createCustomer(
  context: CustomerContext,
  input: CustomerInput,
) {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(customers)
      .values({
        organizationId: context.organizationId,

        customerName: input.customerName.trim(),
        companyName: normalizeNullable(input.companyName) ?? null,
        contactPerson: normalizeNullable(input.contactPerson) ?? null,

        email: normalizeNullable(input.email)?.toLowerCase() ?? null,
        mobile: normalizeNullable(input.mobile) ?? null,

        addressLine1: normalizeNullable(input.addressLine1) ?? null,
        addressLine2: normalizeNullable(input.addressLine2) ?? null,

        city: normalizeNullable(input.city) ?? null,
        district: normalizeNullable(input.district) ?? null,
        state: normalizeNullable(input.state) ?? null,
        stateCode: normalizeNullable(input.stateCode) ?? null,
        postalCode: normalizeNullable(input.postalCode) ?? null,

        country: input.country?.trim() || "India",

        gstin: normalizeNullable(input.gstin)?.toUpperCase() ?? null,
        pan: normalizeNullable(input.pan)?.toUpperCase() ?? null,
        vendorCode: normalizeNullable(input.vendorCode) ?? null,

        notes: normalizeNullable(input.notes) ?? null,

        isActive: true,
      })
      .returning();

    if (!created) {
      throw new Error("CUSTOMER_CREATE_FAILED");
    }

    await writeAudit(
      tx,
      context,
      "customer.created",
      created.id,
      "Customer created",
      null,
      customerAuditValues(created),
    );

    return publicCustomer(created);
  });
}

/**
 * List customers belonging to one organization.
 */
export async function listCustomers(
  organizationId: string,
  input: CustomerListInput,
) {
  const conditions = [eq(customers.organizationId, organizationId)];

  if (input.status === "active") {
    conditions.push(eq(customers.isActive, true));
  } else if (input.status === "inactive") {
    conditions.push(eq(customers.isActive, false));
  }

  const search = input.search?.trim();

  const whereClause = search
    ? and(
        ...conditions,
        or(
          ilike(customers.customerName, `%${search}%`),
          ilike(customers.companyName, `%${search}%`),
          ilike(customers.contactPerson, `%${search}%`),
          ilike(customers.email, `%${search}%`),
          ilike(customers.mobile, `%${search}%`),
          ilike(customers.vendorCode, `%${search}%`),
        ),
      )
    : and(...conditions);

  const offset = (input.page - 1) * input.limit;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(whereClause)
      .orderBy(desc(customers.createdAt))
      .limit(input.limit)
      .offset(offset),

    db.select({ total: count() }).from(customers).where(whereClause),
  ]);

  const total = countResult[0]?.total ?? 0;

  return {
    items: rows.map(publicCustomer),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

/**
 * Get one customer, scoped to the authenticated organization.
 */
export async function getCustomer(organizationId: string, customerId: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.organizationId, organizationId),
      ),
    )
    .limit(1);

  ensureCustomer(customer);

  return publicCustomer(customer);
}

/**
 * Update customer details.
 */
export async function updateCustomer(
  context: CustomerContext,
  customerId: string,
  input: CustomerUpdateInput,
) {
  const updateValues = {
    ...(input.customerName !== undefined && {
      customerName: input.customerName.trim(),
    }),

    ...(input.companyName !== undefined && {
      companyName: normalizeNullable(input.companyName),
    }),

    ...(input.contactPerson !== undefined && {
      contactPerson: normalizeNullable(input.contactPerson),
    }),

    ...(input.email !== undefined && {
      email: normalizeNullable(input.email)?.toLowerCase() ?? null,
    }),

    ...(input.mobile !== undefined && {
      mobile: normalizeNullable(input.mobile),
    }),

    ...(input.addressLine1 !== undefined && {
      addressLine1: normalizeNullable(input.addressLine1),
    }),

    ...(input.addressLine2 !== undefined && {
      addressLine2: normalizeNullable(input.addressLine2),
    }),

    ...(input.city !== undefined && {
      city: normalizeNullable(input.city),
    }),

    ...(input.district !== undefined && {
      district: normalizeNullable(input.district),
    }),

    ...(input.state !== undefined && {
      state: normalizeNullable(input.state),
    }),

    ...(input.stateCode !== undefined && {
      stateCode: normalizeNullable(input.stateCode),
    }),

    ...(input.postalCode !== undefined && {
      postalCode: normalizeNullable(input.postalCode),
    }),

    ...(input.country !== undefined && {
      country: input.country.trim(),
    }),

    ...(input.gstin !== undefined && {
      gstin: normalizeNullable(input.gstin)?.toUpperCase() ?? null,
    }),

    ...(input.pan !== undefined && {
      pan: normalizeNullable(input.pan)?.toUpperCase() ?? null,
    }),

    ...(input.vendorCode !== undefined && {
      vendorCode: normalizeNullable(input.vendorCode),
    }),

    ...(input.notes !== undefined && {
      notes: normalizeNullable(input.notes),
    }),

    updatedAt: new Date(),
  };

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.organizationId, context.organizationId),
        ),
      )
      .limit(1);

    ensureCustomer(existing);

    const [updated] = await tx
      .update(customers)
      .set(updateValues)
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.organizationId, context.organizationId),
        ),
      )
      .returning();

    ensureCustomer(updated);

    await writeAudit(
      tx,
      context,
      "customer.updated",
      customerId,
      "Customer details updated",
      customerAuditValues(existing),
      customerAuditValues(updated),
    );

    return publicCustomer(updated);
  });
}

/**
 * Activate or deactivate a customer.
 *
 * Existing invoices remain linked to the customer.
 */
export async function updateCustomerStatus(
  context: CustomerContext,
  customerId: string,
  isActive: boolean,
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.organizationId, context.organizationId),
        ),
      )
      .limit(1);

    ensureCustomer(existing);

    const [updated] = await tx
      .update(customers)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.organizationId, context.organizationId),
        ),
      )
      .returning();

    ensureCustomer(updated);

    await writeAudit(
      tx,
      context,
      isActive ? "customer.activated" : "customer.deactivated",
      customerId,
      isActive ? "Customer activated" : "Customer deactivated",
      { isActive: existing.isActive },
      { isActive: updated.isActive },
    );

    return publicCustomer(updated);
  });
}
