import type { FastifyReply, FastifyRequest } from "fastify";

import { eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { users } from "../db/schema/users.js";

import {
  verifyAccessToken,
  type AccessTokenPayload,
} from "../modules/auth/services/token.service.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser: AccessTokenPayload | null;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  }

  try {
    const token = authorization.slice(7);
    const payload = await verifyAccessToken(token);

    const [user] = await db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (
      !user ||
      !user.isActive ||
      user.organizationId !== payload.organizationId ||
      user.role !== payload.role
    ) {
      return reply.status(401).send({
        success: false,
        error: {
          code: "ACCOUNT_NOT_AVAILABLE",
          message: "Account is not available",
        },
      });
    }

    request.authUser = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
    };
  } catch {
    return reply.status(401).send({
      success: false,
      error: {
        code: "INVALID_ACCESS_TOKEN",
        message: "Access token is invalid or expired",
      },
    });
  }
}

export function requireRole(...roles: Array<"admin" | "technician">) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!request.authUser) {
      return reply.status(401).send({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
    }

    if (!roles.includes(request.authUser.role)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission",
        },
      });
    }
  };
}
