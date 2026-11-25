import {
  and,
  desc,
  eq,
} from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  invoiceDocuments,
  invoices,
} from "../../db/schema/index.js";

export type InvoiceDocumentCopyType =
  typeof invoiceDocuments.$inferInsert.copyType;

export async function createInvoiceDocument(input: {
  organizationId: string;
  invoiceId: string;
  copyType: InvoiceDocumentCopyType;
  storageKey: string;
  fileName: string;
  fileSize: number;
  checksum: string;
}) {
  const [invoice] = await db
    .select({
      id: invoices.id,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.id, input.invoiceId),
        eq(invoices.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (!invoice) {
    throw new Error("INVOICE_NOT_FOUND");
  }

  const [document] = await db
    .insert(invoiceDocuments)
    .values({
      invoiceId: input.invoiceId,
      copyType: input.copyType,
      storageKey: input.storageKey,
      fileName: input.fileName,
      mimeType: "application/pdf",
      fileSize: String(input.fileSize),
      checksum: input.checksum,
    })
    .returning({
      id: invoiceDocuments.id,
      invoiceId: invoiceDocuments.invoiceId,
      copyType: invoiceDocuments.copyType,
      fileName: invoiceDocuments.fileName,
      mimeType: invoiceDocuments.mimeType,
      fileSize: invoiceDocuments.fileSize,
      checksum: invoiceDocuments.checksum,
      generatedAt: invoiceDocuments.generatedAt,
    });

  if (!document) {
    throw new Error("DOCUMENT_CREATE_FAILED");
  }

  return document;
}

export async function listInvoiceDocuments(input: {
  organizationId: string;
  invoiceId: string;
}) {
  const documents = await db
    .select({
      id: invoiceDocuments.id,
      invoiceId: invoiceDocuments.invoiceId,
      copyType: invoiceDocuments.copyType,
      fileName: invoiceDocuments.fileName,
      mimeType: invoiceDocuments.mimeType,
      fileSize: invoiceDocuments.fileSize,
      checksum: invoiceDocuments.checksum,
      generatedAt: invoiceDocuments.generatedAt,
    })
    .from(invoiceDocuments)
    .innerJoin(
      invoices,
      eq(invoiceDocuments.invoiceId, invoices.id),
    )
    .where(
      and(
        eq(invoiceDocuments.invoiceId, input.invoiceId),
        eq(invoices.organizationId, input.organizationId),
      ),
    )
    .orderBy(desc(invoiceDocuments.generatedAt));

  return documents;
}

export async function getInvoiceDocument(input: {
  organizationId: string;
  documentId: string;
}) {
  const [document] = await db
    .select({
      id: invoiceDocuments.id,
      invoiceId: invoiceDocuments.invoiceId,
      copyType: invoiceDocuments.copyType,
      storageKey: invoiceDocuments.storageKey,
      fileName: invoiceDocuments.fileName,
      mimeType: invoiceDocuments.mimeType,
      fileSize: invoiceDocuments.fileSize,
      checksum: invoiceDocuments.checksum,
      generatedAt: invoiceDocuments.generatedAt,
    })
    .from(invoiceDocuments)
    .innerJoin(
      invoices,
      eq(invoiceDocuments.invoiceId, invoices.id),
    )
    .where(
      and(
        eq(invoiceDocuments.id, input.documentId),
        eq(invoices.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (!document) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  return document;
}
