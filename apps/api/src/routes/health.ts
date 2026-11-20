
import type { FastifyInstance } from "fastify";

export async function healthRoutes(
  app: FastifyInstance
): Promise<void> {
  app.get("/health", async () => {
    return {
      success: true,
      data: {
        status: "ok",
        service: "invoice-management-api",
        environment: process.env.NODE_ENV ?? "development",
        timestamp: new Date().toISOString()
      }
    };
  });
}
