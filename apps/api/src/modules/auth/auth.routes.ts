import type { FastifyInstance } from "fastify";

import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  updateCurrentUserSchema,
  changePasswordSchema,
} from "./schemas/auth.schema.js";

import {
  login,
  refreshSession,
  logout,
  getCurrentUser,
} from "./auth.service.js";

import {
  updateCurrentUser,
  changeCurrentUserPassword,
} from "./profile.service.js";

import type { FastifyReply } from "fastify";

import { authenticate } from "../../middleware/authenticate.js";

function sendError(reply: FastifyReply, error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "Invalid email or password") {
    return reply.status(401).send({
      success: false,
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      },
    });
  }

  if (message === "ACCOUNT_DISABLED") {
    return reply.status(403).send({
      success: false,
      error: {
        code: "ACCOUNT_DISABLED",
        message: "Your account is disabled",
      },
    });
  }

  if (
    message === "INVALID_REFRESH_TOKEN" ||
    message === "REFRESH_TOKEN_EXPIRED"
  ) {
    return reply.status(401).send({
      success: false,
      error: {
        code: message,
        message: "Please log in again",
      },
    });
  }

  if (message === "ACCOUNT_NOT_AVAILABLE") {
    return reply.status(401).send({
      success: false,
      error: {
        code: message,
        message: "Account is not available",
      },
    });
  }

  if (message === "CURRENT_PASSWORD_INVALID") {
    return reply.status(400).send({
      success: false,
      error: {
        code: message,
        message: "Current password is incorrect",
      },
    });
  }

  if (message === "ACCOUNT_NOT_AVAILABLE") {
    return reply.status(401).send({
      success: false,
      error: {
        code: message,
        message: "Account is not available",
      },
    });
  }

  throw error;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/auth/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid login details",
          },
        });
      }

      try {
        const result = await login(parsed.data.email, parsed.data.password);

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.post("/auth/refresh", async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid refresh token",
        },
      });
    }

    try {
      const result = await refreshSession(parsed.data.refreshToken);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post("/auth/logout", async (request, reply) => {
    const parsed = logoutSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid logout request",
        },
      });
    }

    await logout(parsed.data.refreshToken);

    return {
      success: true,
      message: "Logged out successfully",
    };
  });

  app.get(
    "/auth/me",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        const user = await getCurrentUser(request.authUser!.userId);

        return {
          success: true,
          data: user,
        };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.patch(
    "/auth/me",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsed = updateCurrentUserSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid profile details",
            details: parsed.error.flatten(),
          },
        });
      }

      try {
        const result = await updateCurrentUser(
          {
            userId: request.authUser!.userId,
            organizationId: request.authUser!.organizationId,
            ipAddress: request.ip,
          },
          parsed.data,
        );

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.post(
    "/auth/change-password",
    {
      preHandler: authenticate,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const parsed = changePasswordSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid password change request",
            details: parsed.error.flatten(),
          },
        });
      }

      try {
        const result = await changeCurrentUserPassword(
          {
            userId: request.authUser!.userId,
            organizationId: request.authUser!.organizationId,
            ipAddress: request.ip,
          },
          parsed.data.currentPassword,
          parsed.data.newPassword,
        );

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );
}
