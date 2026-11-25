import type { FastifyInstance, FastifyReply } from "fastify";

import { authenticate, requireRole } from "../../middleware/authenticate.js";

import {
  createCustomerSchema,
  updateCustomerSchema,
  customerStatusSchema,
  listCustomersSchema,
  customerIdSchema,
} from "./schemas/customers.schema.js";

import {
  createCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  updateCustomerStatus,
} from "./customers.service.js";

function sendCustomerError(reply: FastifyReply, error: unknown) {
  const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";

  const knownErrors: Record<string, { statusCode: number; message: string }> = {
    CUSTOMER_NOT_FOUND: {
      statusCode: 404,
      message: "Customer not found",
    },
    CUSTOMER_CREATE_FAILED: {
      statusCode: 500,
      message: "Unable to create customer",
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

  requestErrorLog(code);

  return reply.status(500).send({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
}

function requestErrorLog(code: string) {
  // Do not expose internal database errors to API clients.
  console.error("[Customer API]", code);
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

export async function customersRoutes(app: FastifyInstance) {
  // List and search customers.
  // Technicians can only see active customers.
  app.get(
    "/customers",
    {
      preHandler: [authenticate, requireRole("admin", "technician")],
    },
    async (request, reply) => {
      const parsed = listCustomersSchema.safeParse(request.query);

      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.issues);
      }

      const status =
        request.authUser!.role === "technician" ? "active" : parsed.data.status;

      try {
        const result = await listCustomers(request.authUser!.organizationId, {
          ...parsed.data,
          status,
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return sendCustomerError(reply, error);
      }
    },
  );

  // Get a single customer.
  // Technicians cannot access inactive customers.
  app.get(
    "/customers/:id",
    {
      preHandler: [authenticate, requireRole("admin", "technician")],
    },
    async (request, reply) => {
      const parsed = customerIdSchema.safeParse(request.params);

      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.issues);
      }

      try {
        const customer = await getCustomer(
          request.authUser!.organizationId,
          parsed.data.id,
        );

        if (request.authUser!.role === "technician" && !customer.isActive) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }

        return reply.send({
          success: true,
          data: customer,
        });
      } catch (error) {
        return sendCustomerError(reply, error);
      }
    },
  );

  // Create customer — Admin only.
  app.post(
    "/customers",
    {
      preHandler: [authenticate, requireRole("admin")],
    },
    async (request, reply) => {
      const parsed = createCustomerSchema.safeParse(request.body);

      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.issues);
      }

      try {
        const customer = await createCustomer(
          {
            organizationId: request.authUser!.organizationId,
            userId: request.authUser!.userId,
            ipAddress: request.ip,
          },
          parsed.data,
        );

        return reply.status(201).send({
          success: true,
          data: customer,
        });
      } catch (error) {
        return sendCustomerError(reply, error);
      }
    },
  );

  // Update customer — Admin only.
  app.patch(
    "/customers/:id",
    {
      preHandler: [authenticate, requireRole("admin")],
    },
    async (request, reply) => {
      const params = customerIdSchema.safeParse(request.params);
      const body = updateCustomerSchema.safeParse(request.body);

      if (!params.success) {
        return sendValidationError(reply, params.error.issues);
      }

      if (!body.success) {
        return sendValidationError(reply, body.error.issues);
      }

      try {
        const customer = await updateCustomer(
          {
            organizationId: request.authUser!.organizationId,
            userId: request.authUser!.userId,
            ipAddress: request.ip,
          },
          params.data.id,
          body.data,
        );

        return reply.send({
          success: true,
          data: customer,
        });
      } catch (error) {
        return sendCustomerError(reply, error);
      }
    },
  );

  // Activate/deactivate customer — Admin only.
  app.patch(
    "/customers/:id/status",
    {
      preHandler: [authenticate, requireRole("admin")],
    },
    async (request, reply) => {
      const params = customerIdSchema.safeParse(request.params);
      const body = customerStatusSchema.safeParse(request.body);

      if (!params.success) {
        return sendValidationError(reply, params.error.issues);
      }

      if (!body.success) {
        return sendValidationError(reply, body.error.issues);
      }

      try {
        const customer = await updateCustomerStatus(
          {
            organizationId: request.authUser!.organizationId,
            userId: request.authUser!.userId,
            ipAddress: request.ip,
          },
          params.data.id,
          body.data.isActive,
        );

        return reply.send({
          success: true,
          data: customer,
        });
      } catch (error) {
        return sendCustomerError(reply, error);
      }
    },
  );
}
