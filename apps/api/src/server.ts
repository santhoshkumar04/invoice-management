
import "dotenv/config";

import { buildApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "0.0.0.0";

async function startServer() {
  const app = await buildApp();

  try {
    await app.listen({
      port: PORT,
      host: HOST
    });

    app.log.info(
      `Invoice API running at http://${HOST}:${PORT}`
    );
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

startServer();
