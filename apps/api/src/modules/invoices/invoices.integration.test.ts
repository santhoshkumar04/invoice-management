import "dotenv/config";

import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import pg from "pg";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { buildApp as BuildApp } from "../../app.js";

const { hashPassword, verifyPassword } =
  await import("../auth/services/password.service.js");

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required for invoice integration tests",
  );
}

// Set this before importing the application or database client.
// The application must never connect to the development database in this test.
process.env.DATABASE_URL = testDatabaseUrl;

if (!process.env.JWT_ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET must be configured for integration tests");
}

const { buildApp } = await import("../../app.js");
const { generateAccessToken } =
  await import("../auth/services/token.service.js");
const { closeDatabase } = await import("../../db/client.js");

const pool = new pg.Pool({
  connectionString: testDatabaseUrl,
  max: 5,
});

let app: Awaited<ReturnType<typeof BuildApp>>;

let organizationId: string;
let adminId: string;
let technicianId: string;
let intraStateCustomerId: string;
let interStateCustomerId: string;

let adminToken: string;
let technicianToken: string;
let documentStorageDirectory: string | undefined;

function invoicePayload(
  customerId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    customerId,
    invoiceDate: "2026-11-23",
    billingPeriodStart: "2026-11-01",
    billingPeriodEnd: "2026-11-30",
    items: [
      {
        description: "Integration test service",
        quantity: 2,
        rate: 500,
      },
    ],
    ...overrides,
  };
}

async function postInvoice(payload: Record<string, unknown>, token?: string) {
  return app.inject({
    method: "POST",
    url: "/invoices",
    headers: token
      ? {
          authorization: `Bearer ${token}`,
        }
      : {},
    payload,
  });
}

async function issueInvoiceRequest(id: string, token?: string) {
  return app.inject({
    method: "POST",
    url: `/invoices/${encodeURIComponent(id)}/issue`,
    headers: token
      ? {
          authorization: `Bearer ${token}`,
        }
      : {},
  });
}

async function cancelInvoiceRequest(
  id: string,
  reason: string,
  token?: string,
) {
  return app.inject({
    method: "POST",
    url: `/invoices/${encodeURIComponent(id)}/cancel`,
    headers: token
      ? {
          authorization: `Bearer ${token}`,
        }
      : {},
    payload: { reason },
  });
}

async function recordPaymentRequest(
  id: string,
  payload: Record<string, unknown>,
  token?: string,
) {
  return app.inject({
    method: "POST",
    url: `/invoices/${encodeURIComponent(id)}/payments`,
    headers: token
      ? {
          authorization: `Bearer ${token}`,
        }
      : {},
    payload,
  });
}

async function getInvoicePaymentsRequest(id: string, token?: string) {
  return app.inject({
    method: "GET",
    url: `/invoices/${encodeURIComponent(id)}/payments`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

async function createInvoiceAdjustmentRequest(
  id: string,
  payload: Record<string, unknown>,
  token?: string,
) {
  return app.inject({
    method: "POST",
    url: `/invoices/${encodeURIComponent(id)}/adjustments`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload,
  });
}

async function getInvoiceAdjustmentsRequest(id: string, token?: string) {
  return app.inject({
    method: "GET",
    url: `/invoices/${encodeURIComponent(id)}/adjustments`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

async function putInvoiceRequest(
  id: string,
  payload: Record<string, unknown>,
  token?: string,
) {
  return app.inject({
    method: "PUT",
    url: `/invoices/${encodeURIComponent(id)}`,
    headers: token
      ? {
          authorization: `Bearer ${token}`,
        }
      : {},
    payload,
  });
}

async function getInvoiceRequest(id: string, token?: string) {
  return app.inject({
    method: "GET",
    url: `/invoices/${encodeURIComponent(id)}`,
    headers: token
      ? {
          authorization: `Bearer ${token}`,
        }
      : {},
  });
}

async function getInvoicesRequest(url: string, token?: string) {
  return app.inject({
    method: "GET",
    url,
    headers: token
      ? {
          authorization: `Bearer ${token}`,
        }
      : {},
  });
}

describe("Invoice API integration tests", () => {
  beforeAll(async () => {
    // This cleanup is restricted to the dedicated test database.
    const databaseResult = await pool.query(
      "SELECT current_database() AS database_name",
    );

    if (databaseResult.rows[0]?.database_name !== "invoice_management_test") {
      throw new Error(
        "Safety check failed: integration tests are not connected to invoice_management_test",
      );
    }

    await pool.query(`
      TRUNCATE TABLE
        audit_logs,
        invoice_documents,
        invoice_adjustments,
        payments,
        invoice_snapshots,
        invoice_items,
        invoices,
        invoice_sequences,
        customers,
        refresh_sessions,
        users,
        service_catalog,
        organizations
      RESTART IDENTITY CASCADE
    `);

    const organizationResult = await pool.query(
      `
        INSERT INTO organizations (
          name,
          country,
          state,
          state_code
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      ["Integration Test Organization", "India", "Tamil Nadu", "33"],
    );

    organizationId = organizationResult.rows[0].id;

    const adminResult = await pool.query(
      `
        INSERT INTO users (
          organization_id,
          full_name,
          email,
          password_hash,
          role,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
      `,
      [
        organizationId,
        "Integration Test Admin",
        "integration-admin@example.test",
        "integration-test-password-hash",
        "admin",
      ],
    );

    adminId = adminResult.rows[0].id;

    const technicianResult = await pool.query(
      `
        INSERT INTO users (
          organization_id,
          full_name,
          email,
          password_hash,
          role,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
      `,
      [
        organizationId,
        "Integration Test Technician",
        "integration-technician@example.test",
        "integration-test-password-hash",
        "technician",
      ],
    );

    technicianId = technicianResult.rows[0].id;

    const intraCustomerResult = await pool.query(
      `
        INSERT INTO customers (
          organization_id,
          customer_name,
          country,
          state,
          state_code,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
      `,
      [
        organizationId,
        "Integration Intra State Customer",
        "India",
        "Tamil Nadu",
        "33",
      ],
    );

    intraStateCustomerId = intraCustomerResult.rows[0].id;

    const interCustomerResult = await pool.query(
      `
        INSERT INTO customers (
          organization_id,
          customer_name,
          country,
          state,
          state_code,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
      `,
      [
        organizationId,
        "Integration Inter State Customer",
        "India",
        "Karnataka",
        "29",
      ],
    );

    interStateCustomerId = interCustomerResult.rows[0].id;

    adminToken = await generateAccessToken({
      userId: adminId,
      organizationId,
      role: "admin",
    });

    technicianToken = await generateAccessToken({
      userId: technicianId,
      organizationId,
      role: "technician",
    });

    documentStorageDirectory = await mkdtemp(
      path.join(tmpdir(), "invoice-documents-test-"),
    );
    process.env.INVOICE_DOCUMENT_STORAGE_DIR =
      documentStorageDirectory;

    app = await buildApp();
    await app.ready();
  }, 30000);

  afterAll(async () => {
    try {
      if (app) {
        await app.close();
      }

      const databaseResult = await pool.query(
        "SELECT current_database() AS database_name",
      );

      if (databaseResult.rows[0]?.database_name !== "invoice_management_test") {
        throw new Error(
          "Safety check failed: refusing to clean up a database other than invoice_management_test",
        );
      }

      await pool.query(`
        TRUNCATE TABLE
          audit_logs,
          invoice_documents,
          invoice_adjustments,
          payments,
          invoice_snapshots,
          invoice_items,
          invoices,
          invoice_sequences,
          customers,
          refresh_sessions,
          users,
          service_catalog,
          organizations
        RESTART IDENTITY CASCADE
      `);
    } finally {
      if (documentStorageDirectory) {
        await rm(documentStorageDirectory, {
          recursive: true,
          force: true,
        }).catch(() => undefined);
      }

      await pool.end();
      await closeDatabase();
    }
  }, 30000);

  it("rejects requests without authentication", async () => {
    const response = await postInvoice(invoicePayload(intraStateCustomerId));

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
  });

  it("rejects invalid access tokens", async () => {
    const response = await postInvoice(
      invoicePayload(intraStateCustomerId),
      "invalid.integration.token",
    );

    expect(response.statusCode).toBe(401);
  });

  it("allows an Admin to create a GST-disabled invoice", async () => {
    const response = await postInvoice(
      invoicePayload(intraStateCustomerId),
      adminToken,
    );

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.success).toBe(true);
    expect(body.data.invoiceNumber).toMatch(/^INV\/2026-27\/\d{4}$/);
    expect(body.data.status).toBe("draft");
    expect(body.data.isGstApplicable).toBe(false);
    expect(body.data.supplyType).toBeNull();

    expect(Number(body.data.subtotal)).toBe(1000);
    expect(Number(body.data.totalTax)).toBe(0);
    expect(Number(body.data.grandTotal)).toBe(1000);

    expect(body.data.items).toHaveLength(1);
    expect(Number(body.data.items[0].amount)).toBe(1000);
    expect(Number(body.data.items[0].gstRate)).toBe(0);

    expect(body.data.snapshot).toBeDefined();
  });

  it("allows a Technician to create an invoice with intra-state GST", async () => {
    const response = await postInvoice(
      invoicePayload(intraStateCustomerId, {
        isGstApplicable: true,
        items: [
          {
            description: "Intra-state taxable service",
            quantity: 2,
            rate: 500,
            gstRate: 18,
          },
        ],
      }),
      technicianToken,
    );

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.success).toBe(true);
    expect(body.data.isGstApplicable).toBe(true);
    expect(body.data.supplyType).toBe("intra_state");

    expect(Number(body.data.subtotal)).toBe(1000);
    expect(Number(body.data.cgstTotal)).toBe(90);
    expect(Number(body.data.sgstTotal)).toBe(90);
    expect(Number(body.data.igstTotal)).toBe(0);
    expect(Number(body.data.totalTax)).toBe(180);
    expect(Number(body.data.grandTotal)).toBe(1180);

    expect(Number(body.data.items[0].cgstAmount)).toBe(90);
    expect(Number(body.data.items[0].sgstAmount)).toBe(90);
    expect(Number(body.data.items[0].igstAmount)).toBe(0);
  });

  it("calculates IGST for inter-state GST invoices", async () => {
    const response = await postInvoice(
      invoicePayload(interStateCustomerId, {
        isGstApplicable: true,
        items: [
          {
            description: "Inter-state taxable service",
            quantity: 2,
            rate: 500,
            gstRate: 18,
          },
        ],
      }),
      adminToken,
    );

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.data.supplyType).toBe("inter_state");
    expect(Number(body.data.cgstTotal)).toBe(0);
    expect(Number(body.data.sgstTotal)).toBe(0);
    expect(Number(body.data.igstTotal)).toBe(180);
    expect(Number(body.data.totalTax)).toBe(180);
    expect(Number(body.data.grandTotal)).toBe(1180);

    expect(Number(body.data.items[0].igstAmount)).toBe(180);
  });

  it("rejects an invalid billing period", async () => {
    const before = await pool.query(
      "SELECT COUNT(*)::int AS count FROM invoices",
    );

    const response = await postInvoice(
      invoicePayload(intraStateCustomerId, {
        billingPeriodStart: "2026-11-30",
        billingPeriodEnd: "2026-11-01",
      }),
      adminToken,
    );

    const after = await pool.query(
      "SELECT COUNT(*)::int AS count FROM invoices",
    );

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });

  it("rejects invoices for inactive customers", async () => {
    await pool.query("UPDATE customers SET is_active = false WHERE id = $1", [
      intraStateCustomerId,
    ]);

    try {
      const response = await postInvoice(
        invoicePayload(intraStateCustomerId),
        adminToken,
      );

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("CUSTOMER_NOT_FOUND");
    } finally {
      await pool.query("UPDATE customers SET is_active = true WHERE id = $1", [
        intraStateCustomerId,
      ]);
    }
  });

  it("rejects GST invoices when state codes are missing", async () => {
    await pool.query(
      "UPDATE organizations SET state_code = NULL WHERE id = $1",
      [organizationId],
    );

    try {
      const response = await postInvoice(
        invoicePayload(intraStateCustomerId, {
          isGstApplicable: true,
          items: [
            {
              description: "GST state validation",
              quantity: 1,
              rate: 100,
              gstRate: 18,
            },
          ],
        }),
        adminToken,
      );

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("GST_STATE_CODE_REQUIRED");
    } finally {
      await pool.query(
        "UPDATE organizations SET state_code = '33' WHERE id = $1",
        [organizationId],
      );
    }
  });

  it("generates unique invoice numbers for concurrent requests", async () => {
    const requestCount = 8;

    const responses = await Promise.all(
      Array.from({ length: requestCount }, () =>
        postInvoice(invoicePayload(intraStateCustomerId), technicianToken),
      ),
    );

    for (const response of responses) {
      expect(response.statusCode).toBe(201);
    }

    const invoiceNumbers = responses.map(
      (response) => response.json().data.invoiceNumber as string,
    );

    expect(new Set(invoiceNumbers).size).toBe(requestCount);

    for (const invoiceNumber of invoiceNumbers) {
      expect(invoiceNumber).toMatch(/^INV\/2026-27\/\d{4}$/);
    }

    const sequenceResult = await pool.query(
      `
        SELECT last_number
        FROM invoice_sequences
        WHERE organization_id = $1
          AND financial_year = '2026-27'
      `,
      [organizationId],
    );

    expect(Number(sequenceResult.rows[0].last_number)).toBe(3 + requestCount);
  });

  it("persists invoice items, snapshots, and audit logs", async () => {
    const invoiceResult = await pool.query(`
      SELECT
        i.id,
        i.invoice_number,
        i.created_by,
        COUNT(DISTINCT ii.id)::int AS item_count,
        COUNT(DISTINCT s.id)::int AS snapshot_count,
        COUNT(DISTINCT a.id)::int AS audit_count
      FROM invoices i
      LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
      LEFT JOIN invoice_snapshots s ON s.invoice_id = i.id
      LEFT JOIN audit_logs a
        ON a.entity_id = i.id
        AND a.entity_type = 'invoice'
        AND a.action = 'invoice.created'
      GROUP BY i.id
    `);

    expect(invoiceResult.rows.length).toBe(11);

    for (const row of invoiceResult.rows) {
      expect(row.item_count).toBe(1);
      expect(row.snapshot_count).toBe(1);
      expect(row.audit_count).toBe(1);
      expect(row.invoice_number).toMatch(/^INV\/2026-27\/\d{4}$/);
    }
  });

  it("rejects invoice list requests without authentication", async () => {
    const response = await getInvoicesRequest("/invoices");

    expect(response.statusCode).toBe(401);
  });

  it("allows Admins to list all invoices in their organization", async () => {
    const response = await getInvoicesRequest(
      "/invoices?page=1&limit=20",
      adminToken,
    );

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(11);
    expect(body.data.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 11,
      totalPages: 1,
    });
  });

  it("restricts Technician invoice lists to invoices they created", async () => {
    const response = await getInvoicesRequest(
      "/invoices?page=1&limit=20",
      technicianToken,
    );

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(9);
    expect(
      body.data.items.every(
        (invoice: { createdBy: string }) => invoice.createdBy === technicianId,
      ),
    ).toBe(true);
    expect(body.data.pagination.total).toBe(9);
  });

  it("supports invoice list pagination", async () => {
    const response = await getInvoicesRequest(
      "/invoices?page=1&limit=1",
      adminToken,
    );

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.data.items).toHaveLength(1);
    expect(body.data.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 11,
      totalPages: 11,
    });
  });

  it("supports invoice status filtering", async () => {
    const response = await getInvoicesRequest(
      "/invoices?status=draft",
      adminToken,
    );

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.data.items).toHaveLength(11);
    expect(
      body.data.items.every(
        (invoice: { status: string }) => invoice.status === "draft",
      ),
    ).toBe(true);
  });

  it("supports searching invoices by invoice number", async () => {
    const invoiceResult = await pool.query(
      `
        SELECT invoice_number
        FROM invoices
        WHERE organization_id = $1
          AND created_by = $2
        LIMIT 1
      `,
      [organizationId, adminId],
    );

    const invoiceNumber = invoiceResult.rows[0].invoice_number as string;

    const response = await getInvoicesRequest(
      `/invoices?search=${encodeURIComponent(invoiceNumber)}`,
      adminToken,
    );

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].invoiceNumber).toBe(invoiceNumber);
  });

  it("supports searching invoices by customer name", async () => {
    const response = await getInvoicesRequest(
      "/invoices?search=Integration%20Intra%20State%20Customer",
      adminToken,
    );

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.data.items.length).toBeGreaterThan(0);
    expect(
      body.data.items.every(
        (invoice: { customer: { customerName: string } }) =>
          invoice.customer.customerName === "Integration Intra State Customer",
      ),
    ).toBe(true);
  });

  it("rejects invalid invoice list query parameters", async () => {
    const response = await getInvoicesRequest(
      "/invoices?page=0&limit=500",
      adminToken,
    );

    expect(response.statusCode).toBe(400);
  });

  it("allows Technicians to view their own invoice details", async () => {
    const invoiceResult = await pool.query(
      `
        SELECT id
        FROM invoices
        WHERE organization_id = $1
          AND created_by = $2
        LIMIT 1
      `,
      [organizationId, technicianId],
    );

    const invoiceId = invoiceResult.rows[0].id as string;

    const response = await getInvoiceRequest(invoiceId, technicianToken);

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.success).toBe(true);
    expect(body.data.id).toBe(invoiceId);
    expect(body.data.createdBy).toBe(technicianId);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.snapshot).toBeDefined();
  });

  it("prevents Technicians from viewing another user's invoice", async () => {
    const invoiceResult = await pool.query(
      `
        SELECT id
        FROM invoices
        WHERE organization_id = $1
          AND created_by = $2
        LIMIT 1
      `,
      [organizationId, adminId],
    );

    const invoiceId = invoiceResult.rows[0].id as string;

    const response = await getInvoiceRequest(invoiceId, technicianToken);

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("INVOICE_NOT_FOUND");
  });

  it("allows Admins to view invoices created by Technicians", async () => {
    const invoiceResult = await pool.query(
      `
        SELECT id
        FROM invoices
        WHERE organization_id = $1
          AND created_by = $2
        LIMIT 1
      `,
      [organizationId, technicianId],
    );

    const invoiceId = invoiceResult.rows[0].id as string;

    const response = await getInvoiceRequest(invoiceId, adminToken);

    expect(response.statusCode).toBe(200);
    expect(response.json().data.id).toBe(invoiceId);
  });

  it("returns 404 for an invoice that does not exist", async () => {
    const response = await getInvoiceRequest(
      "00000000-0000-4000-8000-000000000001",
      adminToken,
    );

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("INVOICE_NOT_FOUND");
  });

  it("rejects an invalid invoice ID", async () => {
    const response = await getInvoiceRequest("not-a-uuid", adminToken);

    expect(response.statusCode).toBe(400);
  });

  //   it("does not expose invoices belonging to another organization", async () => {
  //     const otherOrganizationResult = await pool.query(
  //       `
  //         INSERT INTO organizations (
  //           name,
  //           country,
  //           state,
  //           state_code
  //         )
  //         VALUES ($1, $2, $3, $4)
  //         RETURNING id
  //       `,
  //       ["Other Integration Organization", "India", "Maharashtra", "27"],
  //     );

  //     const otherOrganizationId = otherOrganizationResult.rows[0].id as string;

  //     const otherUserResult = await pool.query(
  //       `
  //         INSERT INTO users (
  //           organization_id,
  //           full_name,
  //           email,
  //           password_hash,
  //           role,
  //           is_active
  //         )
  //         VALUES ($1, $2, $3, $4, $5, true)
  //         RETURNING id
  //       `,
  //       [
  //         otherOrganizationId,
  //         "Other Organization Admin",
  //         "other-admin@example.test",
  //         "integration-test-password-hash",
  //         "admin",
  //       ],
  //     );

  //     const otherUserId = otherUserResult.rows[0].id as string;

  //     const otherCustomerResult = await pool.query(
  //       `
  //         INSERT INTO customers (
  //           organization_id,
  //           customer_name,
  //           country,
  //           state,
  //           state_code,
  //           is_active
  //         )
  //         VALUES ($1, $2, $3, $4, $5, true)
  //         RETURNING id
  //       `,
  //       [
  //         otherOrganizationId,
  //         "Other Organization Customer",
  //         "India",
  //         "Maharashtra",
  //         "27",
  //       ],
  //     );

  //     const otherCustomerId = otherCustomerResult.rows[0].id as string;

  //     const otherInvoiceResult = await pool.query(
  //       `
  //         INSERT INTO invoices (
  //           organization_id,
  //           customer_id,
  //           created_by,
  //           invoice_number,
  //           invoice_date,
  //           billing_period_start,
  //           billing_period_end
  //         )
  //         VALUES ($1, $2, $3, $4, $5, $6, $7)
  //         RETURNING id
  //       `,
  //       [
  //         otherOrganizationId,
  //         otherCustomerId,
  //         otherUserId,
  //         "OTHER/2026-27/0001",
  //         "2026-11-23",
  //         "2026-11-01",
  //         "2026-11-30",
  //       ],
  //     );

  //     const otherInvoiceId = otherInvoiceResult.rows[0].id as string;

  //     const detailResponse = await getInvoiceRequest(otherInvoiceId, adminToken);

  //     expect(detailResponse.statusCode).toBe(404);
  //     expect(detailResponse.json().error.code).toBe("INVOICE_NOT_FOUND");

  //     const listResponse = await getInvoicesRequest(
  //       "/invoices?page=1&limit=20",
  //       adminToken,
  //     );

  //     expect(listResponse.statusCode).toBe(200);
  //     expect(listResponse.json().data.pagination.total).toBe(11);
  //     expect(
  //       listResponse
  //         .json()
  //         .data.items.some(
  //           (invoice: { id: string }) => invoice.id === otherInvoiceId,
  //         ),
  //     ).toBe(false);
  //   });

  it("enforces the single-organization database constraint", async () => {
    await expect(
      pool.query(
        `
          INSERT INTO organizations (
            name,
            country,
            state,
            state_code
          )
          VALUES ($1, $2, $3, $4)
        `,
        ["Other Integration Organization", "India", "Maharashtra", "27"],
      ),
    ).rejects.toMatchObject({
      code: "23505",
      constraint: "organizations_singleton_key_unique",
    });

    const response = await getInvoicesRequest(
      "/invoices?page=1&limit=20",
      adminToken,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().data.pagination.total).toBe(11);
  });

  describe("Draft invoice editing", () => {
    let editableInvoiceId: string;
    let issuedInvoiceId: string;
    let originalInvoice: Record<string, unknown>;

    beforeAll(async () => {
      const editableResponse = await postInvoice(
        invoicePayload(intraStateCustomerId),
        adminToken,
      );

      expect(editableResponse.statusCode).toBe(201);
      editableInvoiceId = editableResponse.json().data.id;

      const issuedResponse = await postInvoice(
        invoicePayload(intraStateCustomerId),
        adminToken,
      );

      expect(issuedResponse.statusCode).toBe(201);
      issuedInvoiceId = issuedResponse.json().data.id;

      const originalResult = await pool.query(
        `
          SELECT
            id,
            invoice_number,
            sequence_id,
            created_by,
            created_at,
            status,
            grand_total
          FROM invoices
          WHERE id = $1
        `,
        [editableInvoiceId],
      );

      originalInvoice = originalResult.rows[0];
    });

    it("rejects draft updates without authentication", async () => {
      const response = await putInvoiceRequest(
        editableInvoiceId,
        invoicePayload(intraStateCustomerId),
      );

      expect(response.statusCode).toBe(401);
    });

    it("prevents Technicians from editing draft invoices", async () => {
      const response = await putInvoiceRequest(
        editableInvoiceId,
        invoicePayload(intraStateCustomerId),
        technicianToken,
      );

      expect(response.statusCode).toBe(403);
    });

    it("allows Admins to update draft invoices and preserves invoice identity", async () => {
      const response = await putInvoiceRequest(
        editableInvoiceId,
        invoicePayload(intraStateCustomerId, {
          invoiceDate: "2026-11-24",
          billingPeriodStart: "2026-11-01",
          billingPeriodEnd: "2026-11-30",
          dueDate: "2026-12-15",
          notes: "Updated integration test invoice",
          items: [
            {
              description: "Updated service",
              quantity: 3,
              rate: 750,
            },
            {
              description: "Additional service",
              quantity: 2,
              rate: 250,
            },
          ],
        }),
        adminToken,
      );

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.success).toBe(true);
      expect(body.data.id).toBe(editableInvoiceId);
      expect(body.data.invoiceNumber).toBe(originalInvoice.invoice_number);
      expect(body.data.sequenceId).toBe(originalInvoice.sequence_id);
      expect(body.data.createdBy).toBe(originalInvoice.created_by);
      expect(new Date(body.data.createdAt).toISOString()).toBe(
        new Date(originalInvoice.created_at as Date).toISOString(),
      );

      expect(body.data.status).toBe("draft");
      expect(body.data.invoiceDate).toBe("2026-11-24");
      expect(body.data.dueDate).toBe("2026-12-15");
      expect(body.data.notes).toBe("Updated integration test invoice");

      expect(body.data.items).toHaveLength(2);
      expect(Number(body.data.subtotal)).toBe(2750);
      expect(Number(body.data.totalTax)).toBe(0);
      expect(Number(body.data.grandTotal)).toBe(2750);

      expect(
        body.data.items.map(
          (item: { description: string }) => item.description,
        ),
      ).toEqual(["Updated service", "Additional service"]);
    });

    it("updates the existing snapshot and records an audit log", async () => {
      const snapshotResult = await pool.query(
        `
          SELECT snapshot_data
          FROM invoice_snapshots
          WHERE invoice_id = $1
        `,
        [editableInvoiceId],
      );

      expect(snapshotResult.rows).toHaveLength(1);

      const snapshot = snapshotResult.rows[0].snapshot_data;

      expect(snapshot.invoice.invoiceNumber).toBe(
        originalInvoice.invoice_number,
      );
      expect(snapshot.invoice.items).toHaveLength(2);
      expect(Number(snapshot.totals.grandTotal)).toBe(2750);

      const itemResult = await pool.query(
        `
          SELECT COUNT(*)::int AS count
          FROM invoice_items
          WHERE invoice_id = $1
        `,
        [editableInvoiceId],
      );

      expect(itemResult.rows[0].count).toBe(2);

      const auditResult = await pool.query(
        `
          SELECT action, old_values, new_values
          FROM audit_logs
          WHERE organization_id = $1
            AND entity_id = $2
            AND entity_type = 'invoice'
            AND action = 'invoice.updated'
        `,
        [organizationId, editableInvoiceId],
      );

      expect(auditResult.rows).toHaveLength(1);
      expect(auditResult.rows[0].old_values.status).toBe("draft");
      expect(Number(auditResult.rows[0].old_values.grandTotal)).toBe(1000);
      expect(auditResult.rows[0].new_values.status).toBe("draft");
      expect(Number(auditResult.rows[0].new_values.grandTotal)).toBe(2750);
    });

    it("rejects editing an issued invoice", async () => {
      const issueResponse = await issueInvoiceRequest(
        issuedInvoiceId,
        adminToken,
      );

      expect(issueResponse.statusCode).toBe(200);

      const response = await putInvoiceRequest(
        issuedInvoiceId,
        invoicePayload(intraStateCustomerId),
        adminToken,
      );

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("INVOICE_EDIT_NOT_DRAFT");
    });

    it("returns 404 when the invoice does not exist", async () => {
      const response = await putInvoiceRequest(
        "00000000-0000-4000-8000-000000000001",
        invoicePayload(intraStateCustomerId),
        adminToken,
      );

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("INVOICE_NOT_FOUND");
    });

    it("rejects invalid invoice IDs", async () => {
      const response = await putInvoiceRequest(
        "not-a-uuid",
        invoicePayload(intraStateCustomerId),
        adminToken,
      );

      expect(response.statusCode).toBe(400);
    });
  });

  describe("Invoice issuance", () => {
    let issuanceInvoiceId: string;
    let concurrentInvoiceId: string;

    beforeAll(async () => {
      const result = await pool.query(
        `
        SELECT id
        FROM invoices
        WHERE organization_id = $1
          AND created_by = $2
          AND status = 'draft'
        ORDER BY created_at
        LIMIT 2
      `,
        [organizationId, adminId],
      );

      if (result.rows.length < 2) {
        throw new Error(
          "Two Admin draft invoices are required for issuance tests",
        );
      }

      issuanceInvoiceId = result.rows[0].id as string;
      concurrentInvoiceId = result.rows[1].id as string;
    });

    it("rejects issuance without authentication", async () => {
      const response = await issueInvoiceRequest(issuanceInvoiceId);

      expect(response.statusCode).toBe(401);
    });

    it("prevents Technicians from issuing invoices", async () => {
      const response = await issueInvoiceRequest(
        issuanceInvoiceId,
        technicianToken,
      );

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("FORBIDDEN");
    });

    it("allows Admins to issue draft invoices and records an audit log", async () => {
      const response = await issueInvoiceRequest(issuanceInvoiceId, adminToken);

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.success).toBe(true);
      expect(body.data.id).toBe(issuanceInvoiceId);
      expect(body.data.status).toBe("issued");
      expect(body.data.issuedAt).toBeTruthy();
      expect(body.data.invoiceNumber).toMatch(/^INV\/2026-27\/\d{4}$/);

      const auditResult = await pool.query(
        `
        SELECT action, old_values, new_values
        FROM audit_logs
        WHERE organization_id = $1
          AND entity_id = $2
          AND entity_type = 'invoice'
          AND action = 'invoice.issued'
      `,
        [organizationId, issuanceInvoiceId],
      );

      expect(auditResult.rows).toHaveLength(1);
      expect(auditResult.rows[0].old_values.status).toBe("draft");
      expect(auditResult.rows[0].new_values.status).toBe("issued");
    });

    it("rejects issuing an invoice more than once", async () => {
      const response = await issueInvoiceRequest(issuanceInvoiceId, adminToken);

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("INVOICE_NOT_DRAFT");
    });

    it("prevents concurrent requests from issuing the same invoice twice", async () => {
      const responses = await Promise.all([
        issueInvoiceRequest(concurrentInvoiceId, adminToken),
        issueInvoiceRequest(concurrentInvoiceId, adminToken),
      ]);

      expect(responses.map((response) => response.statusCode).sort()).toEqual([
        200, 409,
      ]);

      const auditResult = await pool.query(
        `
        SELECT COUNT(*)::int AS count
        FROM audit_logs
        WHERE entity_id = $1
          AND action = 'invoice.issued'
      `,
        [concurrentInvoiceId],
      );

      expect(auditResult.rows[0].count).toBe(1);
    });

    it("returns 404 when the invoice does not exist", async () => {
      const response = await issueInvoiceRequest(
        "00000000-0000-4000-8000-000000000001",
        adminToken,
      );

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("INVOICE_NOT_FOUND");
    });

    it("rejects invalid invoice IDs", async () => {
      const response = await issueInvoiceRequest("not-a-uuid", adminToken);

      expect(response.statusCode).toBe(400);
    });
  });

  describe("Invoice payments", () => {
    async function createIssuedInvoice() {
      const response = await postInvoice(
        invoicePayload(intraStateCustomerId),
        adminToken,
      );

      if (response.statusCode !== 201 && response.statusCode !== 200) {
        throw new Error(
          `Unable to create payment test invoice: ${response.body}`,
        );
      }

      const invoiceId = response.json().data.id as string;

      const issueResponse = await issueInvoiceRequest(invoiceId, adminToken);

      if (issueResponse.statusCode !== 200) {
        throw new Error(
          `Unable to issue payment test invoice: ${issueResponse.body}`,
        );
      }

      const result = await pool.query(
        `SELECT grand_total::text AS grand_total FROM invoices WHERE id = $1`,
        [invoiceId],
      );

      return {
        invoiceId,
        grandTotal: Number(result.rows[0].grand_total),
      };
    }

    const paymentPayload = (amount: number) => ({
      paymentDate: "2026-11-24",
      amount,
      method: "upi",
      referenceNumber: "TEST-UPI-001",
      notes: "Integration test payment",
    });

    it("rejects payment history requests without authentication", async () => {
      const invoice = await createIssuedInvoice();

      const response = await getInvoicePaymentsRequest(invoice.invoiceId);

      expect(response.statusCode).toBe(401);
    });

    it("allows Admins to retrieve payment history and summary", async () => {
      const invoice = await createIssuedInvoice();

      const paymentResponse = await recordPaymentRequest(
        invoice.invoiceId,
        paymentPayload(100),
        adminToken,
      );

      expect(paymentResponse.statusCode).toBe(201);

      const response = await getInvoicePaymentsRequest(
        invoice.invoiceId,
        adminToken,
      );

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.success).toBe(true);
      expect(body.data.payments).toHaveLength(1);
      expect(body.data.payments[0].amount).toBe("100.00");
      expect(body.data.payments[0].method).toBe("upi");
      expect(body.data.payments[0].referenceNumber).toBe("TEST-UPI-001");
      expect(body.data.payments[0].recordedByName).toBe(
        "Integration Test Admin",
      );

      expect(body.data.summary.grandTotal).toBe(invoice.grandTotal.toFixed(2));
      expect(body.data.summary.paidAmount).toBe("100.00");
      expect(Number(body.data.summary.balanceDue)).toBeCloseTo(
        invoice.grandTotal - 100,
        2,
      );
      expect(body.data.summary.paymentCount).toBe(1);
    });

    it("prevents Technicians from viewing another user's invoice payment history", async () => {
      const invoice = await createIssuedInvoice();

      const response = await getInvoicePaymentsRequest(
        invoice.invoiceId,
        technicianToken,
      );

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("INVOICE_NOT_FOUND");
    });

    it("returns empty payment history and zero paid amount", async () => {
      const invoice = await createIssuedInvoice();

      const response = await getInvoicePaymentsRequest(
        invoice.invoiceId,
        adminToken,
      );

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.data.payments).toHaveLength(0);
      expect(Number(body.data.summary.paidAmount)).toBe(0);
      expect(body.data.summary.balanceDue).toBe(invoice.grandTotal.toFixed(2));
      expect(body.data.summary.paymentCount).toBe(0);
    });

    it("returns payment history ordered by payment date newest first", async () => {
      const invoice = await createIssuedInvoice();

      const olderPayment = await recordPaymentRequest(
        invoice.invoiceId,
        {
          ...paymentPayload(100),
          paymentDate: "2026-11-20",
          referenceNumber: "OLDER-PAYMENT",
        },
        adminToken,
      );

      const newerPayment = await recordPaymentRequest(
        invoice.invoiceId,
        {
          ...paymentPayload(150),
          paymentDate: "2026-11-24",
          referenceNumber: "NEWER-PAYMENT",
        },
        adminToken,
      );

      expect(olderPayment.statusCode).toBe(201);
      expect(newerPayment.statusCode).toBe(201);

      const response = await getInvoicePaymentsRequest(
        invoice.invoiceId,
        adminToken,
      );

      expect(response.statusCode).toBe(200);

      const history = response.json().data.payments;

      expect(history).toHaveLength(2);
      expect(history[0].referenceNumber).toBe("NEWER-PAYMENT");
      expect(history[1].referenceNumber).toBe("OLDER-PAYMENT");
      expect(response.json().data.summary.paidAmount).toBe("250.00");
      expect(response.json().data.summary.paymentCount).toBe(2);
    });

    it("rejects payment without authentication", async () => {
      const invoice = await createIssuedInvoice();

      const response = await recordPaymentRequest(
        invoice.invoiceId,
        paymentPayload(100),
      );

      expect(response.statusCode).toBe(401);
    });

    it("prevents Technicians from recording payments", async () => {
      const invoice = await createIssuedInvoice();

      const response = await recordPaymentRequest(
        invoice.invoiceId,
        paymentPayload(100),
        technicianToken,
      );

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("FORBIDDEN");
    });

    it("records a partial payment and updates invoice status", async () => {
      const invoice = await createIssuedInvoice();

      const response = await recordPaymentRequest(
        invoice.invoiceId,
        paymentPayload(100),
        adminToken,
      );

      expect(response.statusCode).toBe(201);

      const body = response.json();

      expect(body.success).toBe(true);
      expect(body.data.payment.amount).toBe("100.00");
      expect(body.data.invoice.status).toBe("partially_paid");
      expect(body.data.paidAmount).toBe("100.00");
      expect(Number(body.data.balanceDue)).toBeCloseTo(
        invoice.grandTotal - 100,
        2,
      );

      const databaseResult = await pool.query(
        `SELECT status FROM invoices WHERE id = $1`,
        [invoice.invoiceId],
      );

      expect(databaseResult.rows[0].status).toBe("partially_paid");

      const auditResult = await pool.query(
        `
        SELECT action, old_values, new_values
        FROM audit_logs
        WHERE entity_id = $1
          AND action = 'invoice.payment_recorded'
      `,
        [invoice.invoiceId],
      );

      expect(auditResult.rows).toHaveLength(1);
      expect(auditResult.rows[0].new_values.paymentAmount).toBe("100.00");
    });

    it("marks invoice as paid after the remaining balance is recorded", async () => {
      const invoice = await createIssuedInvoice();

      const firstPayment = await recordPaymentRequest(
        invoice.invoiceId,
        paymentPayload(100),
        adminToken,
      );

      expect(firstPayment.statusCode).toBe(201);

      const remainingAmount = Number((invoice.grandTotal - 100).toFixed(2));

      const secondPayment = await recordPaymentRequest(
        invoice.invoiceId,
        paymentPayload(remainingAmount),
        adminToken,
      );

      expect(secondPayment.statusCode).toBe(201);

      const body = secondPayment.json();

      expect(body.data.invoice.status).toBe("paid");
      expect(Number(body.data.paidAmount)).toBeCloseTo(invoice.grandTotal, 2);
      expect(Number(body.data.balanceDue)).toBe(0);
    });

    it("rejects payments containing fractional paise", async () => {
      const invoice = await createIssuedInvoice();

      const response = await recordPaymentRequest(
        invoice.invoiceId,
        paymentPayload(10.12000000001),
        adminToken,
      );

      expect(response.statusCode).toBe(400);
    });
    it("rejects payments exceeding the outstanding balance", async () => {
      const invoice = await createIssuedInvoice();

      const response = await recordPaymentRequest(
        invoice.invoiceId,
        paymentPayload(invoice.grandTotal + 1),
        adminToken,
      );

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("PAYMENT_EXCEEDS_BALANCE");
    });

    it("rejects payments against draft invoices", async () => {
      const response = await postInvoice(
        invoicePayload(intraStateCustomerId),
        adminToken,
      );

      const invoiceId = response.json().data.id as string;

      const paymentResponse = await recordPaymentRequest(
        invoiceId,
        paymentPayload(100),
        adminToken,
      );

      expect(paymentResponse.statusCode).toBe(409);
      expect(paymentResponse.json().error.code).toBe("INVOICE_NOT_PAYABLE");
    });

    it("rejects payments against cancelled invoices", async () => {
      const invoice = await createIssuedInvoice();

      const cancelResponse = await cancelInvoiceRequest(
        invoice.invoiceId,
        "Customer requested cancellation",
        adminToken,
      );

      expect(cancelResponse.statusCode).toBe(200);

      const response = await recordPaymentRequest(
        invoice.invoiceId,
        paymentPayload(100),
        adminToken,
      );

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("INVOICE_CANCELLED");
    });

    it("prevents concurrent payments from exceeding the invoice total", async () => {
      const invoice = await createIssuedInvoice();

      const amount = Number((invoice.grandTotal * 0.6).toFixed(2));

      const responses = await Promise.all([
        recordPaymentRequest(
          invoice.invoiceId,
          paymentPayload(amount),
          adminToken,
        ),
        recordPaymentRequest(
          invoice.invoiceId,
          paymentPayload(amount),
          adminToken,
        ),
      ]);

      expect(
        responses.filter((response) => response.statusCode === 201),
      ).toHaveLength(1);

      expect(
        responses.filter((response) => response.statusCode === 409),
      ).toHaveLength(1);

      const rejected = responses.find(
        (response) => response.statusCode === 409,
      );

      expect(rejected?.json().error.code).toBe("PAYMENT_EXCEEDS_BALANCE");

      const result = await pool.query(
        `
        SELECT
          i.status,
          i.grand_total::text AS grand_total,
          COALESCE(SUM(p.amount), 0)::text AS paid_amount
        FROM invoices i
        LEFT JOIN payments p ON p.invoice_id = i.id
        WHERE i.id = $1
        GROUP BY i.id
      `,
        [invoice.invoiceId],
      );

      expect(Number(result.rows[0].paid_amount)).toBeLessThanOrEqual(
        Number(result.rows[0].grand_total),
      );

      expect(result.rows[0].status).toBe("partially_paid");
    });
  });

  describe("Invoice adjustments", () => {
    async function createIssuedInvoice(token = adminToken) {
      const response = await postInvoice(
        invoicePayload(intraStateCustomerId),
        token,
      );

      if (response.statusCode !== 201 && response.statusCode !== 200) {
        throw new Error(
          `Unable to create adjustment test invoice: ${response.body}`,
        );
      }

      const invoiceId = response.json().data.id as string;

      const issueResponse = await issueInvoiceRequest(invoiceId, adminToken);

      if (issueResponse.statusCode !== 200) {
        throw new Error(
          `Unable to issue adjustment test invoice: ${issueResponse.body}`,
        );
      }

      const result = await pool.query(
        `SELECT grand_total::text AS grand_total FROM invoices WHERE id = $1`,
        [invoiceId],
      );

      return {
        invoiceId,
        grandTotal: Number(result.rows[0].grand_total),
      };
    }

    const adjustmentPayload = (type: "credit" | "debit", amount: number) => ({
      type,
      amount,
      reason: "Integration test adjustment",
      notes: "Adjustment integration test",
    });

    it("rejects adjustment requests without authentication", async () => {
      const invoice = await createIssuedInvoice();

      const response = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        adjustmentPayload("credit", 100),
      );

      expect(response.statusCode).toBe(401);
    });

    it("prevents Technicians from creating adjustments", async () => {
      const invoice = await createIssuedInvoice();

      const response = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        adjustmentPayload("credit", 100),
        technicianToken,
      );

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("FORBIDDEN");
    });

    it("records a credit adjustment without changing the original invoice total", async () => {
      const invoice = await createIssuedInvoice();

      const response = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        adjustmentPayload("credit", 100),
        adminToken,
      );

      expect(response.statusCode).toBe(201);

      const body = response.json();

      expect(body.success).toBe(true);
      expect(body.data.adjustment.type).toBe("credit");
      expect(body.data.adjustment.amount).toBe("100.00");
      expect(body.data.invoice.status).toBe("issued");
      expect(Number(body.data.summary.originalTotal)).toBeCloseTo(
        invoice.grandTotal,
        2,
      );
      expect(Number(body.data.summary.adjustedTotal)).toBeCloseTo(
        invoice.grandTotal - 100,
        2,
      );
      expect(Number(body.data.summary.balanceDue)).toBeCloseTo(
        invoice.grandTotal - 100,
        2,
      );

      const databaseResult = await pool.query(
        `SELECT grand_total::text AS grand_total FROM invoices WHERE id = $1`,
        [invoice.invoiceId],
      );

      expect(Number(databaseResult.rows[0].grand_total)).toBeCloseTo(
        invoice.grandTotal,
        2,
      );
    });

    it("records a debit adjustment and increases the adjusted total", async () => {
      const invoice = await createIssuedInvoice();

      const response = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        adjustmentPayload("debit", 150),
        adminToken,
      );

      expect(response.statusCode).toBe(201);

      const body = response.json();

      expect(body.data.adjustment.type).toBe("debit");
      expect(Number(body.data.summary.adjustedTotal)).toBeCloseTo(
        invoice.grandTotal + 150,
        2,
      );
      expect(Number(body.data.summary.balanceDue)).toBeCloseTo(
        invoice.grandTotal + 150,
        2,
      );
    });

    it("allows Admins to retrieve adjustment history and summary", async () => {
      const invoice = await createIssuedInvoice();

      const firstAdjustment = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        adjustmentPayload("credit", 100),
        adminToken,
      );

      const secondAdjustment = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        adjustmentPayload("debit", 50),
        adminToken,
      );

      expect(firstAdjustment.statusCode).toBe(201);
      expect(secondAdjustment.statusCode).toBe(201);

      const response = await getInvoiceAdjustmentsRequest(
        invoice.invoiceId,
        adminToken,
      );

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.success).toBe(true);
      expect(body.data.adjustments).toHaveLength(2);
      expect(body.data.adjustments[0].createdByName).toBe(
        "Integration Test Admin",
      );
      expect(body.data.summary.adjustmentCount).toBe(2);
      expect(Number(body.data.summary.originalTotal)).toBeCloseTo(
        invoice.grandTotal,
        2,
      );
      expect(Number(body.data.summary.adjustedTotal)).toBeCloseTo(
        invoice.grandTotal - 50,
        2,
      );
      expect(Number(body.data.summary.balanceDue)).toBeCloseTo(
        invoice.grandTotal - 50,
        2,
      );
    });

    it("prevents Technicians from viewing another user's adjustment history", async () => {
      const invoice = await createIssuedInvoice();

      const response = await getInvoiceAdjustmentsRequest(
        invoice.invoiceId,
        technicianToken,
      );

      expect(response.statusCode).toBe(404);
    });

    it("allows Technicians to view adjustment history for their own invoices", async () => {
      const invoice = await createIssuedInvoice(technicianToken);

      const adjustmentResponse = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        adjustmentPayload("credit", 100),
        adminToken,
      );

      expect(adjustmentResponse.statusCode).toBe(201);

      const response = await getInvoiceAdjustmentsRequest(
        invoice.invoiceId,
        technicianToken,
      );

      expect(response.statusCode).toBe(200);
      expect(response.json().data.adjustments).toHaveLength(1);
      expect(response.json().data.adjustments[0].createdByName).toBe(
        "Integration Test Admin",
      );
    });

    it("rejects credit adjustments that reduce the total below payments received", async () => {
      const invoice = await createIssuedInvoice();

      const paymentResponse = await recordPaymentRequest(
        invoice.invoiceId,
        {
          paymentDate: "2026-11-24",
          amount: 900,
          method: "upi",
          referenceNumber: "ADJUSTMENT-TEST-PAYMENT",
          notes: "Payment before credit adjustment",
        },
        adminToken,
      );

      expect(paymentResponse.statusCode).toBe(201);

      const response = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        adjustmentPayload("credit", 101),
        adminToken,
      );

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("ADJUSTMENT_EXCEEDS_PAID_AMOUNT");

      const historyResponse = await getInvoiceAdjustmentsRequest(
        invoice.invoiceId,
        adminToken,
      );

      expect(historyResponse.statusCode).toBe(200);
      expect(historyResponse.json().data.adjustments).toHaveLength(0);
    });

    it("reopens a fully paid invoice after a debit adjustment", async () => {
      const invoice = await createIssuedInvoice();

      const paymentResponse = await recordPaymentRequest(
        invoice.invoiceId,
        {
          paymentDate: "2026-11-24",
          amount: invoice.grandTotal,
          method: "upi",
          referenceNumber: "FULL-PAYMENT-BEFORE-DEBIT",
          notes: "Full payment before debit",
        },
        adminToken,
      );

      expect(paymentResponse.statusCode).toBe(201);
      expect(paymentResponse.json().data.invoice.status).toBe("paid");

      const response = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        adjustmentPayload("debit", 100),
        adminToken,
      );

      expect(response.statusCode).toBe(201);

      const body = response.json();

      expect(body.data.invoice.status).toBe("partially_paid");
      expect(Number(body.data.summary.adjustedTotal)).toBeCloseTo(
        invoice.grandTotal + 100,
        2,
      );
      expect(Number(body.data.summary.paidAmount)).toBeCloseTo(
        invoice.grandTotal,
        2,
      );
      expect(Number(body.data.summary.balanceDue)).toBeCloseTo(100, 2);
    });

    it("marks a partially paid invoice as paid when a credit adjustment clears the balance", async () => {
      const invoice = await createIssuedInvoice();

      const paymentResponse = await recordPaymentRequest(
        invoice.invoiceId,
        {
          paymentDate: "2026-11-24",
          amount: invoice.grandTotal - 100,
          method: "upi",
          referenceNumber: "PARTIAL-PAYMENT-BEFORE-CREDIT",
          notes: "Partial payment before credit",
        },
        adminToken,
      );

      expect(paymentResponse.statusCode).toBe(201);
      expect(paymentResponse.json().data.invoice.status).toBe("partially_paid");

      const response = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        adjustmentPayload("credit", 100),
        adminToken,
      );

      expect(response.statusCode).toBe(201);

      const body = response.json();

      expect(body.data.invoice.status).toBe("paid");
      expect(Number(body.data.summary.adjustedTotal)).toBeCloseTo(
        invoice.grandTotal - 100,
        2,
      );
      expect(Number(body.data.summary.paidAmount)).toBeCloseTo(
        invoice.grandTotal - 100,
        2,
      );
      expect(Number(body.data.summary.balanceDue)).toBe(0);
    });

    it("uses the adjusted total when validating new payments", async () => {
      const invoice = await createIssuedInvoice();

      const adjustmentResponse = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        adjustmentPayload("credit", 100),
        adminToken,
      );

      expect(adjustmentResponse.statusCode).toBe(201);

      const paymentResponse = await recordPaymentRequest(
        invoice.invoiceId,
        {
          paymentDate: "2026-11-24",
          amount: invoice.grandTotal,
          method: "upi",
          referenceNumber: "OVER-ADJUSTED-BALANCE",
          notes: "Payment exceeding adjusted total",
        },
        adminToken,
      );

      expect(paymentResponse.statusCode).toBe(409);
      expect(paymentResponse.json().error.code).toBe("PAYMENT_EXCEEDS_BALANCE");

      const historyResponse = await getInvoicePaymentsRequest(
        invoice.invoiceId,
        adminToken,
      );

      expect(historyResponse.statusCode).toBe(200);
      expect(
        Number(historyResponse.json().data.summary.adjustedTotal),
      ).toBeCloseTo(invoice.grandTotal - 100, 2);
      expect(Number(historyResponse.json().data.summary.paidAmount)).toBe(0);
    });

    it("rejects adjustments against draft invoices", async () => {
      const response = await postInvoice(
        invoicePayload(intraStateCustomerId),
        adminToken,
      );

      expect(response.statusCode).toBe(201);

      const invoiceId = response.json().data.id as string;

      const adjustmentResponse = await createInvoiceAdjustmentRequest(
        invoiceId,
        adjustmentPayload("credit", 100),
        adminToken,
      );

      expect(adjustmentResponse.statusCode).toBe(409);
      expect(adjustmentResponse.json().error.code).toBe(
        "INVOICE_ADJUSTMENT_NOT_ALLOWED",
      );
    });

    it("rejects adjustments against cancelled invoices", async () => {
      const invoice = await createIssuedInvoice();

      const cancelResponse = await cancelInvoiceRequest(
        invoice.invoiceId,
        "Customer requested cancellation",
        adminToken,
      );

      expect(cancelResponse.statusCode).toBe(200);

      const adjustmentResponse = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        adjustmentPayload("credit", 100),
        adminToken,
      );

      expect(adjustmentResponse.statusCode).toBe(409);
      expect(adjustmentResponse.json().error.code).toBe(
        "INVOICE_ADJUSTMENT_NOT_ALLOWED",
      );
    });

    it("rejects invalid invoice IDs for adjustment creation", async () => {
      const response = await createInvoiceAdjustmentRequest(
        "not-a-uuid",
        adjustmentPayload("credit", 100),
        adminToken,
      );

      expect(response.statusCode).toBe(400);
    });

    it("rejects adjustments when the invoice does not exist", async () => {
      const response = await createInvoiceAdjustmentRequest(
        "00000000-0000-4000-8000-000000000001",
        adjustmentPayload("credit", 100),
        adminToken,
      );

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("INVOICE_NOT_FOUND");
    });

    it.each([
      ["zero amount", 0],
      ["negative amount", -100],
      ["more than two decimal places", 10.123],
      ["fractional paise", 10.12000000001],
      ["amount exceeding the maximum", 1000000000000],
    ])("rejects an adjustment with %s", async (_label, amount) => {
      const invoice = await createIssuedInvoice();

      const response = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        adjustmentPayload("credit", amount as number),
        adminToken,
      );

      expect(response.statusCode).toBe(400);
    });

    it("rejects an unsupported adjustment type", async () => {
      const invoice = await createIssuedInvoice();

      const response = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        {
          ...adjustmentPayload("credit", 100),
          type: "refund",
        },
        adminToken,
      );

      expect(response.statusCode).toBe(400);
    });

    it("rejects adjustment reasons shorter than five characters", async () => {
      const invoice = await createIssuedInvoice();

      const response = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        {
          ...adjustmentPayload("credit", 100),
          reason: "Test",
        },
        adminToken,
      );

      expect(response.statusCode).toBe(400);
    });

    it("rejects adjustment reasons longer than 250 characters", async () => {
      const invoice = await createIssuedInvoice();

      const response = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        {
          ...adjustmentPayload("credit", 100),
          reason: "A".repeat(251),
        },
        adminToken,
      );

      expect(response.statusCode).toBe(400);
    });

    it("writes an audit log with adjustment and updated accounting values", async () => {
      const invoice = await createIssuedInvoice();

      const response = await createInvoiceAdjustmentRequest(
        invoice.invoiceId,
        adjustmentPayload("debit", 250),
        adminToken,
      );

      expect(response.statusCode).toBe(201);

      const auditResult = await pool.query(
        `
          SELECT action, old_values, new_values
          FROM audit_logs
          WHERE organization_id = $1
            AND entity_id = $2
            AND entity_type = 'invoice'
            AND action = 'invoice.adjustment_recorded'
        `,
        [organizationId, invoice.invoiceId],
      );

      expect(auditResult.rows).toHaveLength(1);

      const audit = auditResult.rows[0];

      expect(audit.action).toBe("invoice.adjustment_recorded");

      expect(audit.old_values).toMatchObject({
        status: "issued",
        adjustedTotal: "1000.00",
        paidAmount: "0.00",
        balanceDue: "1000.00",
      });

      expect(audit.new_values).toMatchObject({
        status: "issued",
        adjustmentType: "debit",
        adjustmentAmount: "250.00",
        adjustedTotal: "1250.00",
        paidAmount: "0.00",
        balanceDue: "1250.00",
      });

      expect(audit.new_values.adjustmentId).toBeTruthy();
    });
  });
  describe("Invoice cancellation", () => {
    let cancellableInvoiceId: string;
    let draftInvoiceId: string;
    let paidInvoiceId: string;
    let partiallyPaidInvoiceId: string;
    let paymentInvoiceId: string;

    async function createTestInvoice() {
      const response = await postInvoice(
        invoicePayload(intraStateCustomerId),
        adminToken,
      );

      if (response.statusCode !== 201 && response.statusCode !== 200) {
        throw new Error(
          `Unable to create cancellation test invoice: ${response.body}`,
        );
      }

      const id = response.json().data?.id;

      if (!id) {
        throw new Error("Cancellation test invoice ID was not returned");
      }

      return id as string;
    }

    async function issueTestInvoice(id: string) {
      const response = await issueInvoiceRequest(id, adminToken);

      if (response.statusCode !== 200) {
        throw new Error(
          `Unable to issue cancellation test invoice: ${response.body}`,
        );
      }
    }

    beforeAll(async () => {
      cancellableInvoiceId = await createTestInvoice();
      draftInvoiceId = await createTestInvoice();
      paidInvoiceId = await createTestInvoice();
      partiallyPaidInvoiceId = await createTestInvoice();
      paymentInvoiceId = await createTestInvoice();

      await issueTestInvoice(cancellableInvoiceId);
      await issueTestInvoice(paidInvoiceId);
      await issueTestInvoice(partiallyPaidInvoiceId);
      await issueTestInvoice(paymentInvoiceId);

      await pool.query(
        `
        UPDATE invoices
        SET status = 'paid'
        WHERE id = $1
      `,
        [paidInvoiceId],
      );

      await pool.query(
        `
        UPDATE invoices
        SET status = 'partially_paid'
        WHERE id = $1
      `,
        [partiallyPaidInvoiceId],
      );

      await pool.query(
        `
        INSERT INTO payments (
          invoice_id,
          recorded_by,
          payment_date,
          amount,
          method
        )
        VALUES ($1, $2, CURRENT_DATE, $3, $4)
      `,
        [paymentInvoiceId, adminId, "100.00", "cash"],
      );
    });

    it("rejects cancellation without authentication", async () => {
      const response = await cancelInvoiceRequest(
        cancellableInvoiceId,
        "Customer requested cancellation",
      );

      expect(response.statusCode).toBe(401);
    });

    it("prevents Technicians from cancelling invoices", async () => {
      const response = await cancelInvoiceRequest(
        cancellableInvoiceId,
        "Customer requested cancellation",
        technicianToken,
      );

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("FORBIDDEN");
    });

    it("allows Admins to cancel issued invoices and records an audit log", async () => {
      const beforeResult = await pool.query(
        `SELECT invoice_number FROM invoices WHERE id = $1`,
        [cancellableInvoiceId],
      );

      const originalInvoiceNumber = beforeResult.rows[0]
        .invoice_number as string;

      const reason = "Customer requested cancellation";

      const response = await cancelInvoiceRequest(
        cancellableInvoiceId,
        reason,
        adminToken,
      );

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.success).toBe(true);
      expect(body.data.id).toBe(cancellableInvoiceId);
      expect(body.data.status).toBe("cancelled");
      expect(body.data.cancelledAt).toBeTruthy();
      expect(body.data.cancellationReason).toBe(reason);
      expect(body.data.invoiceNumber).toBe(originalInvoiceNumber);

      const auditResult = await pool.query(
        `
        SELECT action, old_values, new_values
        FROM audit_logs
        WHERE organization_id = $1
          AND entity_id = $2
          AND entity_type = 'invoice'
          AND action = 'invoice.cancelled'
      `,
        [organizationId, cancellableInvoiceId],
      );

      expect(auditResult.rows).toHaveLength(1);
      expect(auditResult.rows[0].old_values.status).toBe("issued");
      expect(auditResult.rows[0].new_values.status).toBe("cancelled");
      expect(auditResult.rows[0].new_values.cancellationReason).toBe(reason);

      const databaseResult = await pool.query(
        `
        SELECT status, cancelled_at, cancellation_reason, invoice_number
        FROM invoices
        WHERE id = $1
      `,
        [cancellableInvoiceId],
      );

      expect(databaseResult.rows[0].status).toBe("cancelled");
      expect(databaseResult.rows[0].cancelled_at).toBeTruthy();
      expect(databaseResult.rows[0].cancellation_reason).toBe(reason);
      expect(databaseResult.rows[0].invoice_number).toBe(originalInvoiceNumber);
    });

    it("rejects cancelling an invoice more than once", async () => {
      const response = await cancelInvoiceRequest(
        cancellableInvoiceId,
        "Duplicate cancellation attempt",
        adminToken,
      );

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("INVOICE_CANCEL_NOT_ISSUED");
    });

    it("rejects cancellation of draft invoices", async () => {
      const response = await cancelInvoiceRequest(
        draftInvoiceId,
        "Customer requested cancellation",
        adminToken,
      );

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("INVOICE_CANCEL_NOT_ISSUED");
    });

    it("rejects cancellation of paid invoices", async () => {
      const response = await cancelInvoiceRequest(
        paidInvoiceId,
        "Customer requested cancellation",
        adminToken,
      );

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("INVOICE_CANCEL_NOT_ISSUED");
    });

    it("rejects cancellation of partially paid invoices", async () => {
      const response = await cancelInvoiceRequest(
        partiallyPaidInvoiceId,
        "Customer requested cancellation",
        adminToken,
      );

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("INVOICE_CANCEL_NOT_ISSUED");
    });

    it("rejects cancellation when payment records exist", async () => {
      const response = await cancelInvoiceRequest(
        paymentInvoiceId,
        "Customer requested cancellation",
        adminToken,
      );

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("INVOICE_HAS_PAYMENTS");
    });

    it("returns 404 when the invoice does not exist", async () => {
      const response = await cancelInvoiceRequest(
        "00000000-0000-4000-8000-000000000001",
        "Customer requested cancellation",
        adminToken,
      );

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("INVOICE_NOT_FOUND");
    });

    it("rejects invalid invoice IDs", async () => {
      const response = await cancelInvoiceRequest(
        "not-a-uuid",
        "Customer requested cancellation",
        adminToken,
      );

      expect(response.statusCode).toBe(400);
    });

    it("rejects cancellation reasons shorter than five characters", async () => {
      const response = await cancelInvoiceRequest(
        draftInvoiceId,
        "No",
        adminToken,
      );

      expect(response.statusCode).toBe(400);
    });
  });

  describe("Invoice documents", () => {
    let invoiceId: string;
    let documentId: string;

    const pdfBuffer = Buffer.from(
      "%PDF-1.7\nInvoice document integration test\n%%EOF",
      "ascii",
    );

    async function uploadPdf(
      options: {
        token?: string;
        copyType?: string;
        mimeType?: string;
        fileName?: string;
        content?: Buffer;
      } = {},
    ) {
      const boundary = `----invoice-document-${randomUUID()}`;
      const content = options.content ?? pdfBuffer;
      const mimeType = options.mimeType ?? "application/pdf";
      const fileName = options.fileName ?? "integration-invoice.pdf";
      const copyType = options.copyType ?? "original";

      const payload = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
            `Content-Type: ${mimeType}\r\n\r\n`,
            "utf8",
        ),
        content,
        Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
      ]);

      return app.inject({
        method: "POST",
        url: `/invoices/${invoiceId}/documents?copyType=${encodeURIComponent(copyType)}`,
        headers: {
          ...(options.token
            ? { authorization: `Bearer ${options.token}` }
            : {}),
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });
    }

    beforeAll(async () => {
      const response = await postInvoice(
        invoicePayload(intraStateCustomerId),
        adminToken,
      );

      expect(response.statusCode).toBe(201);
      invoiceId = response.json().data.id;
    });

    it("allows an Admin to upload a valid PDF and stores its metadata", async () => {
      const response = await uploadPdf({
        token: adminToken,
        copyType: "original",
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();

      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.invoiceId).toBe(invoiceId);
      expect(body.data.copyType).toBe("original");
      expect(body.data.fileName).toBe("integration-invoice.pdf");
      expect(body.data.mimeType).toBe("application/pdf");
      expect(Number(body.data.fileSize)).toBe(pdfBuffer.length);
      expect(body.data.checksum).toBe(
        createHash("sha256").update(pdfBuffer).digest("hex"),
      );
      expect(body.data.generatedAt).toBeDefined();
      expect(body.data.storageKey).toBeUndefined();

      documentId = body.data.id;
    });

    it("allows an Admin to list invoice documents", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/invoices/${invoiceId}/documents`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
      expect(response.json().data).toHaveLength(1);
      expect(response.json().data[0].id).toBe(documentId);
    });

    it("allows a Technician to list invoice documents", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/invoices/${invoiceId}/documents`,
        headers: {
          authorization: `Bearer ${technicianToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toHaveLength(1);
      expect(response.json().data[0].id).toBe(documentId);
    });

    it("allows a Technician to download an invoice PDF", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/invoice-documents/${documentId}/download`,
        headers: {
          authorization: `Bearer ${technicianToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/pdf");
      expect(response.headers["content-disposition"]).toContain(
        "integration-invoice.pdf",
      );
      expect(response.body).toContain("%PDF-1.7");
      expect(Buffer.from(response.rawPayload)).toEqual(pdfBuffer);
    });

    it("rejects document uploads by a Technician", async () => {
      const response = await uploadPdf({
        token: technicianToken,
      });

      expect(response.statusCode).toBe(403);
    });

    it("rejects uploads without authentication", async () => {
      const response = await uploadPdf();

      expect(response.statusCode).toBe(401);
    });

    it("rejects non-PDF MIME types", async () => {
      const response = await uploadPdf({
        token: adminToken,
        mimeType: "image/png",
      });

      expect(response.statusCode).toBe(415);
    });

    it("rejects files without a PDF signature", async () => {
      const response = await uploadPdf({
        token: adminToken,
        content: Buffer.from("This is not a PDF", "utf8"),
      });

      expect(response.statusCode).toBe(415);
    });

    it("rejects unsupported document copy types", async () => {
      const response = await uploadPdf({
        token: adminToken,
        copyType: "invalid",
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects tokens claiming a different organization", async () => {
      const mismatchedOrganizationToken = await generateAccessToken({
        userId: adminId,
        organizationId: randomUUID(),
        role: "admin",
      });

      const listResponse = await app.inject({
        method: "GET",
        url: `/invoices/${invoiceId}/documents`,
        headers: {
          authorization: `Bearer ${mismatchedOrganizationToken}`,
        },
      });

      expect(listResponse.statusCode).toBe(401);
      expect(listResponse.json().error.code).toBe("ACCOUNT_NOT_AVAILABLE");

      const downloadResponse = await app.inject({
        method: "GET",
        url: `/invoice-documents/${documentId}/download`,
        headers: {
          authorization: `Bearer ${mismatchedOrganizationToken}`,
        },
      });

      expect(downloadResponse.statusCode).toBe(401);
      expect(downloadResponse.json().error.code).toBe("ACCOUNT_NOT_AVAILABLE");
    });

    it("rejects invalid invoice and document IDs", async () => {
      const invalidInvoiceResponse = await app.inject({
        method: "GET",
        url: "/invoices/not-a-uuid/documents",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(invalidInvoiceResponse.statusCode).toBe(400);

      const invalidDocumentResponse = await app.inject({
        method: "GET",
        url: "/invoice-documents/not-a-uuid/download",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(invalidDocumentResponse.statusCode).toBe(400);
    });
  });
  describe("Organization API integration tests", () => {
    it("allows Admins to retrieve their organization profile", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/organization",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.id).toBe(organizationId);
      expect(response.json().data.name).toBe("Integration Test Organization");
      expect(response.json().data.stateCode).toBe("33");
    });

    it("allows Technicians to retrieve their organization profile", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/organization",
        headers: { authorization: `Bearer ${technicianToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.id).toBe(organizationId);
    });

    it("rejects unauthenticated organization profile requests", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/organization",
      });

      expect(response.statusCode).toBe(401);
    });

    it("prevents Technicians from updating the organization profile", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/organization",
        headers: { authorization: `Bearer ${technicianToken}` },
        payload: { name: "Unauthorized Company Update" },
      });

      expect(response.statusCode).toBe(403);

      const organization = await pool.query(
        "SELECT name FROM organizations WHERE id = $1",
        [organizationId],
      );

      expect(organization.rows[0].name).toBe("Integration Test Organization");
    });

    it("rejects invalid organization GSTIN, PAN, IFSC and state code", async () => {
      const invalidPayloads = [
        { stateCode: "330" },
        { gstin: "INVALID-GSTIN" },
        { pan: "INVALID-PAN" },
        { bankIfsc: "INVALID-IFSC" },
      ];

      for (const payload of invalidPayloads) {
        const response = await app.inject({
          method: "PATCH",
          url: "/organization",
          headers: { authorization: `Bearer ${adminToken}` },
          payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("allows Admins to update company profile and safely audit bank details", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/organization",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: "Updated Integration Company",
          stateCode: "33",
          gstin: "33ABCDE1234F1Z5",
          pan: "ABCDE1234F",
          bankName: "Integration Test Bank",
          bankAccountName: "Integration Test Company",
          bankAccountNumber: "123456789012",
          bankIfsc: "HDFC0001234",
          authorizedSignatory: "Test Signatory",
          invoiceFooter: "Thank you for your business",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.name).toBe("Updated Integration Company");
      expect(response.json().data.gstin).toBe("33ABCDE1234F1Z5");
      expect(response.json().data.pan).toBe("ABCDE1234F");
      expect(response.json().data.bankAccountNumber).toBe("123456789012");

      const auditResult = await pool.query(
        `
          SELECT old_values, new_values
          FROM audit_logs
          WHERE organization_id = $1
            AND action = 'organization.updated'
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [organizationId],
      );

      expect(auditResult.rows).toHaveLength(1);
      expect(auditResult.rows[0].new_values.bankAccountNumber).toBe("****9012");
      expect(auditResult.rows[0].new_values.bankAccountNumber).not.toContain(
        "123456789012",
      );
    });

    it("preserves existing organization fields during partial updates", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/organization",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: "Partially Updated Company",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.name).toBe("Partially Updated Company");
      expect(response.json().data.stateCode).toBe("33");
      expect(response.json().data.gstin).toBe("33ABCDE1234F1Z5");
      expect(response.json().data.bankAccountNumber).toBe("123456789012");
    });

    it("rejects an empty organization update", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/organization",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Self-service profile integration tests", () => {
    it("allows Admin to view their own profile", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.role).toBe("admin");
      expect(response.json().data.fullName).toBe("Integration Test Admin");
      expect(response.json().data).toHaveProperty("mobile");
      expect(response.json().data).not.toHaveProperty("passwordHash");
    });

    it("allows Technician to update their own profile", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/auth/me",
        headers: { authorization: `Bearer ${technicianToken}` },
        payload: {
          fullName: "Updated Integration Technician",
          mobile: "9876543210",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.fullName).toBe(
        "Updated Integration Technician",
      );
      expect(response.json().data.mobile).toBe("9876543210");
      expect(response.json().data.role).toBe("technician");
    });

    it("allows Admin to update their own profile", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/auth/me",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          fullName: "Updated Integration Admin",
          mobile: "9123456780",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.fullName).toBe("Updated Integration Admin");
      expect(response.json().data.mobile).toBe("9123456780");
      expect(response.json().data.role).toBe("admin");
    });

    it("rejects attempts to change protected profile fields", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/auth/me",
        headers: { authorization: `Bearer ${technicianToken}` },
        payload: {
          fullName: "Attempted Privilege Escalation",
          role: "admin",
          organizationId: "00000000-0000-4000-8000-000000000000",
          isActive: false,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects empty profile updates", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/auth/me",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects profile updates without authentication", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/auth/me",
        payload: { fullName: "Unauthenticated Update" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("rejects an incorrect current password", async () => {
      const passwordHash = await hashPassword("CurrentPassword123!");

      await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        passwordHash,
        technicianId,
      ]);

      const response = await app.inject({
        method: "POST",
        url: "/auth/change-password",
        headers: { authorization: `Bearer ${technicianToken}` },
        payload: {
          currentPassword: "WrongPassword123!",
          newPassword: "NewPassword123!456",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("CURRENT_PASSWORD_INVALID");
    });

    it("changes password and revokes active refresh sessions", async () => {
      const currentPassword = "CurrentPassword123!";
      const newPassword = "NewPassword123!456";
      const currentHash = await hashPassword(currentPassword);

      await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        currentHash,
        technicianId,
      ]);

      await pool.query(
        `
          INSERT INTO refresh_sessions (
            user_id,
            token_hash,
            status,
            expires_at
          )
          VALUES ($1, $2, 'active', NOW() + INTERVAL '1 day')
        `,
        [technicianId, "integration-test-profile-session-hash"],
      );

      const response = await app.inject({
        method: "POST",
        url: "/auth/change-password",
        headers: { authorization: `Bearer ${technicianToken}` },
        payload: {
          currentPassword,
          newPassword,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.success).toBe(true);

      const userResult = await pool.query(
        "SELECT password_hash FROM users WHERE id = $1",
        [technicianId],
      );

      expect(
        await verifyPassword(userResult.rows[0].password_hash, newPassword),
      ).toBe(true);

      const sessionResult = await pool.query(
        `
          SELECT status
          FROM refresh_sessions
          WHERE user_id = $1
            AND token_hash = $2
        `,
        [technicianId, "integration-test-profile-session-hash"],
      );

      expect(sessionResult.rows[0].status).toBe("revoked");

      const auditResult = await pool.query(
        `
          SELECT action, new_values
          FROM audit_logs
          WHERE organization_id = $1
            AND entity_id = $2
            AND action = 'user.password_changed'
        `,
        [organizationId, technicianId],
      );

      expect(auditResult.rows).toHaveLength(1);
      expect(auditResult.rows[0].new_values.passwordChanged).toBe(true);
    });
  });

  describe("Reports API integration tests", () => {
    const reportEndpoints = [
      "/reports/overview",
      "/reports/sales",
      "/reports/payments",
      "/reports/outstanding",
      "/reports/gst",
      "/reports/customers",
    ];

    it("rejects report requests without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/reports/overview",
      });

      expect(response.statusCode).toBe(401);
    });

    it("allows Admin and Technician to access all report endpoints", async () => {
      for (const token of [adminToken, technicianToken]) {
        for (const endpoint of reportEndpoints) {
          const response = await app.inject({
            method: "GET",
            url: endpoint,
            headers: {
              authorization: `Bearer ${token}`,
            },
          });

          expect(
            response.statusCode,
            `${endpoint} should return 200`,
          ).toBe(200);

          expect(response.json().success).toBe(true);
          expect(response.json().data).toBeDefined();
        }
      }
    });

    it("rejects invalid report date ranges", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/reports/sales?from=2026-11-30&to=2026-11-01",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects unsupported sales grouping values", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/reports/sales?groupBy=year",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
    });
  });
});