import type { FastifyInstance } from "fastify";

import { authenticate, requireRole } from "../middleware/authenticate.js";

export async function protectedRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/admin/access-check",
    {
      preHandler: [authenticate, requireRole("admin")],
    },
    async () => ({
      success: true,
      data: {
        message: "Admin access granted",
      },
    }),
  );

  app.get(
    "/technician/access-check",
    {
      preHandler: [authenticate, requireRole("technician")],
    },
    async () => ({
      success: true,
      data: {
        message: "Technician access granted",
      },
    }),
  );
}
