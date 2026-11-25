import type { FastifyInstance, FastifyReply } from "fastify";
import { createHash } from "node:crypto";

import {
  authenticate,
  requireRole,
} from "../../middleware/authenticate.js";

import {
  createInvoiceDocument,
  getInvoiceDocument,
  listInvoiceDocuments,
} from "./invoice-documents.service.js";

import {
  deleteInvoicePdf,
  readInvoicePdf,
  storeInvoicePdf,
} from "./invoice-document-storage.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COPY_TYPES = [
  "original",
  "duplicate",
  "triplicate",
] as const;

type CopyType = (typeof COPY_TYPES)[number];

function isCopyType(value: unknown): value is CopyType {
  return (
    typeof value === "string" &&
    COPY_TYPES.includes(value as CopyType)
  );
}

function safeFileName(value: string): string {
  const baseName = value.split(/[\\/]/).pop() ?? "";

  return baseName
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/["\\]/g, "_")
    .trim();
}

function sendDocumentError(
  reply: FastifyReply,
  error: unknown,
) {
  if (
    error instanceof Error &&
    error.message === "INVOICE_NOT_FOUND"
  ) {
    return reply.code(404).send({
      success: false,
      message: "Invoice not found",
    });
  }

  if (
    error instanceof Error &&
    error.message === "DOCUMENT_NOT_FOUND"
  ) {
    return reply.code(404).send({
      success: false,
      message: "Invoice document not found",
    });
  }

  reply.log.error(error);

  return reply.code(500).send({
    success: false,
    message: "Unable to process invoice document",
  });
}

function isFileTooLarge(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code ===
      "FST_REQ_FILE_TOO_LARGE"
  );
}

export async function invoiceDocumentsRoutes(
  app: FastifyInstance,
) {
  // Upload a PDF document for an invoice.
  app.post(
    "/invoices/:invoiceId/documents",
    {
      preHandler: [
        authenticate,
        requireRole("admin"),
      ],
    },
    async (request, reply) => {
      const { invoiceId } = request.params as {
        invoiceId: string;
      };

      const { copyType } = request.query as {
        copyType?: string;
      };

      if (!UUID_REGEX.test(invoiceId)) {
        return reply.code(400).send({
          success: false,
          message: "Invalid invoice ID",
        });
      }

      if (!isCopyType(copyType)) {
        return reply.code(400).send({
          success: false,
          message:
            "copyType must be original, duplicate, or triplicate",
        });
      }

      let storageKey: string | undefined;

      try {
        const part = await request.file();

        if (!part) {
          return reply.code(400).send({
            success: false,
            message: "PDF file is required",
          });
        }

        if (part.mimetype !== "application/pdf") {
          return reply.code(415).send({
            success: false,
            message: "Only PDF files are allowed",
          });
        }

        const fileName = safeFileName(part.filename);

        if (
          !fileName ||
          fileName.length > 255
        ) {
          return reply.code(400).send({
            success: false,
            message: "Invalid file name",
          });
        }

        const buffer = await part.toBuffer();

        if (
          buffer.length < 5 ||
          buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
        ) {
          return reply.code(415).send({
            success: false,
            message: "The uploaded file is not a valid PDF",
          });
        }

        const checksum = createHash("sha256")
          .update(buffer)
          .digest("hex");

        storageKey = await storeInvoicePdf(
          invoiceId,
          buffer,
        );

        const document = await createInvoiceDocument({
          organizationId:
            request.authUser!.organizationId,
          invoiceId,
          copyType,
          storageKey,
          fileName,
          fileSize: buffer.length,
          checksum,
        });

        return reply.code(201).send({
          success: true,
          data: document,
        });
      } catch (error) {
        if (storageKey) {
          try {
            await deleteInvoicePdf(storageKey);
          } catch (cleanupError) {
            request.log.error(
              cleanupError,
              "Failed to clean up uploaded invoice PDF",
            );
          }
        }

        if (isFileTooLarge(error)) {
          return reply.code(413).send({
            success: false,
            message: "PDF file exceeds the 10 MB limit",
          });
        }

        return sendDocumentError(reply, error);
      }
    },
  );

  // List documents belonging to an invoice in the user's organization.
  app.get(
    "/invoices/:invoiceId/documents",
    {
      preHandler: [
        authenticate,
        requireRole("admin", "technician"),
      ],
    },
    async (request, reply) => {
      const { invoiceId } = request.params as {
        invoiceId: string;
      };

      if (!UUID_REGEX.test(invoiceId)) {
        return reply.code(400).send({
          success: false,
          message: "Invalid invoice ID",
        });
      }

      try {
        const documents = await listInvoiceDocuments({
          organizationId:
            request.authUser!.organizationId,
          invoiceId,
        });

        return reply.send({
          success: true,
          data: documents,
        });
      } catch (error) {
        return sendDocumentError(reply, error);
      }
    },
  );

  // Download a document after checking organization ownership.
  app.get(
    "/invoice-documents/:documentId/download",
    {
      preHandler: [
        authenticate,
        requireRole("admin", "technician"),
      ],
    },
    async (request, reply) => {
      const { documentId } = request.params as {
        documentId: string;
      };

      if (!UUID_REGEX.test(documentId)) {
        return reply.code(400).send({
          success: false,
          message: "Invalid document ID",
        });
      }

      try {
        const document = await getInvoiceDocument({
          organizationId:
            request.authUser!.organizationId,
          documentId,
        });

        const buffer = await readInvoicePdf(
          document.storageKey,
        );

        const fallbackName = document.fileName
          .replace(/[^\x20-\x7E]/g, "_")
          .replace(/["\\]/g, "_");

        return reply
          .type("application/pdf")
          .header(
            "Content-Disposition",
            `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
          )
          .header("X-Content-Type-Options", "nosniff")
          .send(buffer);
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return reply.code(404).send({
            success: false,
            message: "Stored invoice PDF was not found",
          });
        }

        return sendDocumentError(reply, error);
      }
    },
  );
}
