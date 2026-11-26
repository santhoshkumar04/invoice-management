import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { authenticate, requireRole } from "../../middleware/authenticate.js";

import {
  overviewReportSchema,
  salesReportSchema,
  paymentsReportSchema,
  outstandingReportSchema,
  gstReportSchema,
  customersReportSchema,
} from "./schemas/reports.schema.js";

import {
  getOverviewReport,
  getSalesReport,
  getPaymentsReport,
  getOutstandingReport,
  getGstReport,
  getCustomersReport,
  type ReportsContext,
} from "./reports.service.js";

function getReportsContext(request: FastifyRequest): ReportsContext {
  return {
    organizationId: request.authUser!.organizationId,
    userId: request.authUser!.userId,
    role: request.authUser!.role as "admin" | "technician",
  };
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

function sendReportError(
  reply: FastifyReply,
  reportName: string,
  error: unknown,
) {
  console.error(`[${reportName} Report API]`, error);

  return reply.status(500).send({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to generate report",
    },
  });
}

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  const reportOptions = {
    preHandler: [authenticate, requireRole("admin", "technician")],
  };

  // GET /reports/overview
  app.get("/reports/overview", reportOptions, async (request, reply) => {
    const parsed = overviewReportSchema.safeParse(request.query);

    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.issues);
    }

    try {
      const result = await getOverviewReport(
        getReportsContext(request),
        parsed.data,
      );

      return reply.send({ success: true, data: result });
    } catch (error) {
      return sendReportError(reply, "Overview", error);
    }
  });

  // GET /reports/sales
  app.get("/reports/sales", reportOptions, async (request, reply) => {
    const parsed = salesReportSchema.safeParse(request.query);

    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.issues);
    }

    try {
      const result = await getSalesReport(
        getReportsContext(request),
        parsed.data,
      );

      return reply.send({ success: true, data: result });
    } catch (error) {
      return sendReportError(reply, "Sales", error);
    }
  });

  // GET /reports/payments
  app.get("/reports/payments", reportOptions, async (request, reply) => {
    const parsed = paymentsReportSchema.safeParse(request.query);

    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.issues);
    }

    try {
      const result = await getPaymentsReport(
        getReportsContext(request),
        parsed.data,
      );

      return reply.send({ success: true, data: result });
    } catch (error) {
      return sendReportError(reply, "Payments", error);
    }
  });

  // GET /reports/outstanding
  app.get("/reports/outstanding", reportOptions, async (request, reply) => {
    const parsed = outstandingReportSchema.safeParse(request.query);

    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.issues);
    }

    try {
      const result = await getOutstandingReport(
        getReportsContext(request),
        parsed.data,
      );

      return reply.send({ success: true, data: result });
    } catch (error) {
      return sendReportError(reply, "Outstanding", error);
    }
  });

  // GET /reports/gst
  app.get("/reports/gst", reportOptions, async (request, reply) => {
    const parsed = gstReportSchema.safeParse(request.query);

    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.issues);
    }

    try {
      const result = await getGstReport(
        getReportsContext(request),
        parsed.data,
      );

      return reply.send({ success: true, data: result });
    } catch (error) {
      return sendReportError(reply, "GST", error);
    }
  });

  // GET /reports/customers
  app.get("/reports/customers", reportOptions, async (request, reply) => {
    const parsed = customersReportSchema.safeParse(request.query);

    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.issues);
    }

    try {
      const result = await getCustomersReport(
        getReportsContext(request),
        parsed.data,
      );

      return reply.send({ success: true, data: result });
    } catch (error) {
      return sendReportError(reply, "Customers", error);
    }
  });
}