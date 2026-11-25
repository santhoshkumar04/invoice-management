import type { FastifyInstance, FastifyReply } from "fastify";

import { authenticate, requireRole } from "../../middleware/authenticate.js";
import {
  createInvoiceSchema,
  invoiceIdSchema,
  listInvoicesSchema,
  updateInvoiceSchema,
  cancelInvoiceSchema,
  createPaymentSchema,
  createInvoiceAdjustmentSchema,
} from "./schemas/invoices.schema.js";
import {
  createInvoice,
  getInvoiceDetails,
  getInvoicePayments,
  issueInvoice,
  listInvoices,
  updateInvoice,
  cancelInvoice,
  createPayment,
  createInvoiceAdjustment,
  getInvoiceAdjustments,
} from "./invoices.service.js";

function sendInvoiceError(reply: FastifyReply, error: unknown) {
  const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";

  const knownErrors: Record<string, { statusCode: number; message: string }> = {
    ORGANIZATION_NOT_FOUND: {
      statusCode: 404,
      message: "Organization not found",
    },
    CUSTOMER_NOT_FOUND: {
      statusCode: 404,
      message: "Active customer not found",
    },
    GST_COUNTRY_NOT_SUPPORTED: {
      statusCode: 400,
      message: "GST invoices currently support India only",
    },
    GST_STATE_CODE_REQUIRED: {
      statusCode: 400,
      message: "Valid two-digit state codes are required for GST invoices",
    },
    ORGANIZATION_GSTIN_STATE_MISMATCH: {
      statusCode: 400,
      message: "Organization GSTIN does not match its state code",
    },
    CUSTOMER_GSTIN_STATE_MISMATCH: {
      statusCode: 400,
      message: "Customer GSTIN does not match its state code",
    },
    GST_REQUIRES_INR_CURRENCY: {
      statusCode: 400,
      message: "GST invoices must use INR currency",
    },
    INVALID_GST_RATE: {
      statusCode: 400,
      message: "Invalid GST rate",
    },
    GST_SUPPLY_TYPE_REQUIRED: {
      statusCode: 400,
      message: "GST supply type could not be determined",
    },
    INVALID_INVOICE_DATE: {
      statusCode: 400,
      message: "Invalid invoice date",
    },
    INVALID_INVOICE_AMOUNT: {
      statusCode: 400,
      message: "Invoice contains an invalid amount",
    },
    INVOICE_AMOUNT_OUT_OF_RANGE: {
      statusCode: 400,
      message: "Invoice amount exceeds the supported limit",
    },

    INVOICE_NOT_FOUND: {
      statusCode: 404,
      message: "Invoice not found",
    },
    INVOICE_NOT_DRAFT: {
      statusCode: 409,
      message: "Only draft invoices can be issued",
    },
    INVOICE_ISSUE_FAILED: {
      statusCode: 500,
      message: "Unable to issue invoice",
    },
    INVOICE_EDIT_NOT_DRAFT: {
      statusCode: 409,
      message: "Only draft invoices can be edited",
    },
    INVOICE_UPDATE_FAILED: {
      statusCode: 500,
      message: "Unable to update invoice",
    },
    INVOICE_CANCEL_NOT_ISSUED: {
      statusCode: 409,
      message: "Only issued invoices can be cancelled",
    },
    INVOICE_HAS_PAYMENTS: {
      statusCode: 409,
      message: "Invoices with recorded payments cannot be cancelled",
    },
    INVOICE_CANCEL_FAILED: {
      statusCode: 500,
      message: "Unable to cancel invoice",
    },
    PAYMENT_INVOICE_CANCELLED: {
      statusCode: 409,
      message: "Cannot record payment against a cancelled invoice",
    },
    INVOICE_CANCELLED: {
      statusCode: 409,
      message: "Cannot record payment against a cancelled invoice",
    },
    INVOICE_ALREADY_PAID: {
      statusCode: 409,
      message: "This invoice is already fully paid",
    },
    INVOICE_NOT_PAYABLE: {
      statusCode: 409,
      message: "Only issued invoices can receive payments",
    },
    PAYMENT_EXCEEDS_BALANCE: {
      statusCode: 409,
      message: "Payment amount exceeds the outstanding balance",
    },
    PAYMENT_CREATE_FAILED: {
      statusCode: 500,
      message: "Unable to record payment",
    },
    PAYMENT_INVOICE_UPDATE_FAILED: {
      statusCode: 500,
      message: "Unable to update invoice payment status",
    },
    INVOICE_ADJUSTMENT_NOT_ALLOWED: {
      statusCode: 409,
      message: "Only issued invoices can receive adjustments",
    },
    ADJUSTMENT_EXCEEDS_PAID_AMOUNT: {
      statusCode: 409,
      message:
        "Credit adjustment cannot reduce the invoice total below the amount already paid",
    },
    ADJUSTMENT_TOTAL_INVALID: {
      statusCode: 409,
      message: "Adjusted invoice total must remain greater than zero",
    },
    ADJUSTMENT_CREATE_FAILED: {
      statusCode: 500,
      message: "Unable to create invoice adjustment",
    },
    ADJUSTMENT_INVOICE_UPDATE_FAILED: {
      statusCode: 500,
      message: "Unable to update invoice after adjustment",
    },
  };

  const known = knownErrors[code];

  if (known) {
    return reply.status(known.statusCode).send({
      success: false,
      error: {
        code,
        message: known.message,
      },
    });
  }

  console.error("[Invoice API]", code);

  return reply.status(500).send({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to process invoice request",
    },
  });
}

function sendValidationError(reply: FastifyReply, issues: unknown) {
  return reply.status(400).send({
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: issues,
    },
  });
}

export async function invoicesRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/invoices",
    {
      preHandler: [authenticate, requireRole("admin", "technician")],
    },
    async (request, reply) => {
      const parsed = createInvoiceSchema.safeParse(request.body);

      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.issues);
      }

      try {
        const invoice = await createInvoice(
          {
            organizationId: request.authUser!.organizationId,
            userId: request.authUser!.userId,
            ipAddress: request.ip,
          },
          parsed.data,
        );

        return reply.status(201).send({
          success: true,
          data: invoice,
        });
      } catch (error) {
        return sendInvoiceError(reply, error);
      }
    },
  );

  app.post(
    "/invoices/:id/issue",
    {
      preHandler: [authenticate, requireRole("admin")],
    },
    async (request, reply) => {
      const parsed = invoiceIdSchema.safeParse(request.params);

      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.issues);
      }

      try {
        const invoice = await issueInvoice(
          {
            organizationId: request.authUser!.organizationId,
            userId: request.authUser!.userId,
            ipAddress: request.ip,
          },
          parsed.data.id,
        );

        return reply.send({
          success: true,
          data: invoice,
        });
      } catch (error) {
        return sendInvoiceError(reply, error);
      }
    },
  );

  app.get(
    "/invoices",
    {
      preHandler: [authenticate, requireRole("admin", "technician")],
    },
    async (request, reply) => {
      const parsed = listInvoicesSchema.safeParse(request.query);

      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.issues);
      }

      try {
        const result = await listInvoices(
          {
            organizationId: request.authUser!.organizationId,
            userId: request.authUser!.userId,
            role: request.authUser!.role as "admin" | "technician",
          },
          parsed.data,
        );

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error("[Invoice List API]", error);

        return reply.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to retrieve invoices",
          },
        });
      }
    },
  );

  app.put(
    "/invoices/:id",
    {
      preHandler: [authenticate, requireRole("admin")],
    },
    async (request, reply) => {
      const parsedParams = invoiceIdSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return sendValidationError(reply, parsedParams.error.issues);
      }

      const parsedBody = updateInvoiceSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return sendValidationError(reply, parsedBody.error.issues);
      }

      try {
        const invoice = await updateInvoice(
          {
            organizationId: request.authUser!.organizationId,
            userId: request.authUser!.userId,
            ipAddress: request.ip,
          },
          parsedParams.data.id,
          parsedBody.data,
        );

        return reply.send({
          success: true,
          data: invoice,
        });
      } catch (error) {
        return sendInvoiceError(reply, error);
      }
    },
  );

  app.get(
    "/invoices/:id",
    {
      preHandler: [authenticate, requireRole("admin", "technician")],
    },
    async (request, reply) => {
      const parsed = invoiceIdSchema.safeParse(request.params);

      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.issues);
      }

      try {
        const invoice = await getInvoiceDetails(
          {
            organizationId: request.authUser!.organizationId,
            userId: request.authUser!.userId,
            role: request.authUser!.role as "admin" | "technician",
          },
          parsed.data.id,
        );

        return reply.send({
          success: true,
          data: invoice,
        });
      } catch (error) {
        const code =
          error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";

        if (code === "INVOICE_NOT_FOUND") {
          return reply.status(404).send({
            success: false,
            error: {
              code: "INVOICE_NOT_FOUND",
              message: "Invoice not found",
            },
          });
        }

        console.error("[Invoice Detail API]", error);

        return reply.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to retrieve invoice",
          },
        });
      }
    },
  );

  app.post(
    "/invoices/:id/cancel",
    {
      preHandler: [authenticate, requireRole("admin")],
    },
    async (request, reply) => {
      const parsedParams = invoiceIdSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return sendValidationError(reply, parsedParams.error.issues);
      }

      const parsedBody = cancelInvoiceSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return sendValidationError(reply, parsedBody.error.issues);
      }

      try {
        const invoice = await cancelInvoice(
          {
            organizationId: request.authUser!.organizationId,
            userId: request.authUser!.userId,
            ipAddress: request.ip,
          },
          parsedParams.data.id,
          parsedBody.data,
        );

        return reply.send({
          success: true,
          data: invoice,
        });
      } catch (error) {
        return sendInvoiceError(reply, error);
      }
    },
  );

  app.post(
    "/invoices/:id/payments",
    {
      preHandler: [authenticate, requireRole("admin")],
    },
    async (request, reply) => {
      const parsedParams = invoiceIdSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return sendValidationError(reply, parsedParams.error.issues);
      }

      const parsedBody = createPaymentSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return sendValidationError(reply, parsedBody.error.issues);
      }

      try {
        const result = await createPayment(
          {
            organizationId: request.authUser!.organizationId,
            userId: request.authUser!.userId,
            ipAddress: request.ip,
          },
          parsedParams.data.id,
          parsedBody.data,
        );

        return reply.status(201).send({
          success: true,
          data: result,
        });
      } catch (error) {
        return sendInvoiceError(reply, error);
      }
    },
  );

  app.get(
    "/invoices/:id/payments",
    {
      preHandler: [authenticate, requireRole("admin", "technician")],
    },
    async (request, reply) => {
      const parsedParams = invoiceIdSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return sendValidationError(reply, parsedParams.error.issues);
      }

      try {
        const result = await getInvoicePayments(
          {
            organizationId: request.authUser!.organizationId,
            userId: request.authUser!.userId,
            role: request.authUser!.role as "admin" | "technician",
          },
          parsedParams.data.id,
        );

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return sendInvoiceError(reply, error);
      }
    },
  );

  app.post(
    "/invoices/:id/adjustments",
    {
      preHandler: [authenticate, requireRole("admin")],
    },
    async (request, reply) => {
      const parsedParams = invoiceIdSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return sendValidationError(reply, parsedParams.error.issues);
      }

      const parsedBody = createInvoiceAdjustmentSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return sendValidationError(reply, parsedBody.error.issues);
      }

      try {
        const result = await createInvoiceAdjustment(
          {
            organizationId: request.authUser!.organizationId,
            userId: request.authUser!.userId,
            ipAddress: request.ip,
          },
          parsedParams.data.id,
          parsedBody.data,
        );

        return reply.status(201).send({
          success: true,
          data: result,
        });
      } catch (error) {
        return sendInvoiceError(reply, error);
      }
    },
  );

  app.get(
    "/invoices/:id/adjustments",
    {
      preHandler: [authenticate, requireRole("admin", "technician")],
    },
    async (request, reply) => {
      const parsedParams = invoiceIdSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return sendValidationError(reply, parsedParams.error.issues);
      }

      try {
        const result = await getInvoiceAdjustments(
          {
            organizationId: request.authUser!.organizationId,
            userId: request.authUser!.userId,
            role: request.authUser!.role as "admin" | "technician",
          },
          parsedParams.data.id,
        );

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return sendInvoiceError(reply, error);
      }
    },
  );
}
