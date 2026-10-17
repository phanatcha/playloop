import { createApp } from './app.js';
import { env, assertEnv } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { logger } from './utils/logger.js';

assertEnv();
await connectDb(env.mongodbUri);

const server = createApp().listen(env.port, () => {
  logger.info({ port: env.port, env: env.nodeEnv }, 'API listening');
});

function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  server.close(async () => {
    await disconnectDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
