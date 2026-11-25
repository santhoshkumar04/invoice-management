import type { FastifyInstance, FastifyReply } from "fastify";

import { authenticate, requireRole } from "../../middleware/authenticate.js";

import {
  createTechnicianSchema,
  updateTechnicianSchema,
  technicianStatusSchema,
  resetTechnicianPasswordSchema,
  listTechniciansSchema,
  technicianIdSchema,
} from "./schemas/users.schema.js";

import {
  createTechnician,
  listTechnicians,
  getTechnician,
  updateTechnician,
  updateTechnicianStatus,
  resetTechnicianPassword,
} from "./users.service.js";

function sendServiceError(reply: FastifyReply, error: unknown) {
  const message = error instanceof Error ? error.message : "";

  const errors: Record<string, { status: number; message: string }> = {
    EMAIL_ALREADY_EXISTS: {
      status: 409,
      message: "A user with this email already exists",
    },
    TECHNICIAN_NOT_FOUND: {
      status: 404,
      message: "Technician not found",
    },
    TECHNICIAN_CREATE_FAILED: {
      status: 500,
      message: "Unable to create technician",
    },
  };

  const known = errors[message];

  if (known) {
    return reply.status(known.status).send({
      success: false,
      error: {
        code: message,
        message: known.message,
      },
    });
  }

  throw error;
}

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  const adminOnly = {
    preHandler: [authenticate, requireRole("admin")],
  };

  // Create a technician.
  app.post("/users", adminOnly, async (request, reply) => {
    const parsed = createTechnicianSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid technician details",
          details: parsed.error.flatten(),
        },
      });
    }

    try {
      const result = await createTechnician(
        {
          organizationId: request.authUser!.organizationId,
          adminUserId: request.authUser!.userId,
          ipAddress: request.ip,
        },
        parsed.data,
      );

      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });

  // List technicians.
  app.get("/users", adminOnly, async (request, reply) => {
    const parsed = listTechniciansSchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid pagination or search parameters",
        },
      });
    }

    const result = await listTechnicians(
      request.authUser!.organizationId,
      parsed.data,
    );

    return {
      success: true,
      data: result,
    };
  });

  // Get one technician.
  app.get<{ Params: { id: string } }>(
    "/users/:id",
    adminOnly,
    async (request, reply) => {
      const parsed = technicianIdSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid technician ID",
          },
        });
      }

      try {
        const result = await getTechnician(
          request.authUser!.organizationId,
          parsed.data.id,
        );

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  // Update technician details.
  app.patch<{ Params: { id: string } }>(
    "/users/:id",
    adminOnly,
    async (request, reply) => {
      const params = technicianIdSchema.safeParse(request.params);
      const body = updateTechnicianSchema.safeParse(request.body);

      if (!params.success || !body.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid technician update",
          },
        });
      }

      try {
        const result = await updateTechnician(
          {
            organizationId: request.authUser!.organizationId,
            adminUserId: request.authUser!.userId,
            ipAddress: request.ip,
          },
          params.data.id,
          body.data,
        );

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  // Activate or deactivate a technician.
  app.patch<{ Params: { id: string } }>(
    "/users/:id/status",
    adminOnly,
    async (request, reply) => {
      const params = technicianIdSchema.safeParse(request.params);
      const body = technicianStatusSchema.safeParse(request.body);

      if (!params.success || !body.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid technician status request",
          },
        });
      }

      try {
        const result = await updateTechnicianStatus(
          {
            organizationId: request.authUser!.organizationId,
            adminUserId: request.authUser!.userId,
            ipAddress: request.ip,
          },
          params.data.id,
          body.data.isActive,
        );

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  // Reset technician password.
  app.post<{ Params: { id: string } }>(
    "/users/:id/reset-password",
    adminOnly,
    async (request, reply) => {
      const params = technicianIdSchema.safeParse(request.params);
      const body = resetTechnicianPasswordSchema.safeParse(request.body);

      if (!params.success || !body.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid password reset request",
          },
        });
      }

      try {
        const result = await resetTechnicianPassword(
          {
            organizationId: request.authUser!.organizationId,
            adminUserId: request.authUser!.userId,
            ipAddress: request.ip,
          },
          params.data.id,
          body.data.newPassword,
        );

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );
}
