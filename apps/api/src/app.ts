import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";

import { authRoutes } from "./modules/auth/auth.routes.js";
import { customersRoutes } from "./modules/customers/customers.routes.js";
import { invoiceDocumentsRoutes } from "./modules/invoice-documents/invoice-documents.routes.js";
import { invoicesRoutes } from "./modules/invoices/invoices.routes.js";
import { organizationsRoutes } from "./modules/organizations/organizations.routes.js";
import { reportsRoutes } from "./modules/reports/reports.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { databaseHealthRoutes } from "./routes/database-health.js";
import { healthRoutes } from "./routes/health.js";
import { protectedRoutes } from "./routes/protected.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  await app.register(helmet);

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
      : false,
  });

  await app.register(rateLimit, {
    global: true,
    max: process.env.NODE_ENV === "test" ? 10_000 : 100,
    timeWindow: "1 minute",
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
      fields: 2,
      parts: 3,
    },
  });

  await app.register(healthRoutes);
  await app.register(databaseHealthRoutes);
  await app.register(authRoutes);
  await app.register(usersRoutes);
  await app.register(customersRoutes);
  await app.register(invoicesRoutes);
  await app.register(invoiceDocumentsRoutes);
  await app.register(organizationsRoutes);
  await app.register(reportsRoutes);
  await app.register(protectedRoutes);

  app.setNotFoundHandler(async (request, reply) => {
    return reply.status(404).send({
      success: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  return app;
}
