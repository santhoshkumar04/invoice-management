import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";

import { db } from "../db/client.js";

export async function databaseHealthRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/health/database", async (_request, reply) => {
    try {
      await db.execute(sql`SELECT 1`);

      return {
        success: true,
        data: {
          database: "connected",
          provider: "postgresql",
        },
      };
    } catch (error) {
      app.log.error(error);

      return reply.status(503).send({
        success: false,
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Database connection failed",
        },
      });
    }
  });
}
