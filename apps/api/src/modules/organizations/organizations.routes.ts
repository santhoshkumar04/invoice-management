import type { FastifyInstance, FastifyReply } from "fastify";

import { authenticate, requireRole } from "../../middleware/authenticate.js";

import { updateOrganizationSchema } from "./schemas/organizations.schema.js";

import {
  getOrganization,
  updateOrganization,
} from "./organizations.service.js";

function sendOrganizationError(reply: FastifyReply, error: unknown) {
  const code =
    error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";

  const knownErrors: Record<
    string,
    { statusCode: number; message: string }
  > = {
    ORGANIZATION_NOT_FOUND: {
      statusCode: 404,
      message: "Company profile not found",
    },
    ORGANIZATION_UPDATE_FAILED: {
      statusCode: 500,
      message: "Unable to update company profile",
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
  console.error("[Organization API]", code);
}

export async function organizationsRoutes(app: FastifyInstance) {
  // Admin and Technician can read company details.
  app.get(
    "/organization",
    {
      preHandler: [
        authenticate,
        requireRole("admin", "technician"),
      ],
    },
    async (request, reply) => {
      try {
        const organization = await getOrganization(
          request.authUser!.organizationId,
        );

        return reply.send({
          success: true,
          data: organization,
        });
      } catch (error) {
        return sendOrganizationError(reply, error);
      }
    },
  );

  // Only Admin can update company details.
  app.patch(
    "/organization",
    {
      preHandler: [
        authenticate,
        requireRole("admin"),
      ],
    },
    async (request, reply) => {
      const parsed = updateOrganizationSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid company profile details",
            details: parsed.error.issues,
          },
        });
      }

      try {
        const organization = await updateOrganization(
          {
            organizationId: request.authUser!.organizationId,
            userId: request.authUser!.userId,
            ipAddress: request.ip,
          },
          parsed.data,
        );

        return reply.send({
          success: true,
          data: organization,
        });
      } catch (error) {
        return sendOrganizationError(reply, error);
      }
    },
  );
}
