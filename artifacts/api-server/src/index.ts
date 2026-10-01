// Auto-load .env file if available in process working directory
try {
  // @ts-ignore
  process.loadEnvFile?.();
} catch {
  // Environment file absent or already loaded via CLI
}

import app from "./app";
import { logger } from "./lib/logger";
import { seedDatabase } from "./services/seed.service";

const rawPort = process.env["PORT"] || "5000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const shouldSeed = process.env.AUTO_SEED !== "false";

const startServer = () => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
};

if (shouldSeed) {
  seedDatabase()
    .then(() => startServer())
    .catch((err) => {
      logger.error({ err }, "Failed to seed database");
      startServer();
    });
} else {
  logger.info("AUTO_SEED is disabled, skipping startup seed.");
  startServer();
}
