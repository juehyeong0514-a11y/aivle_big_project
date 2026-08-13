import { resolve } from "node:path";
import { createApp } from "./app.mjs";

const port = Number(process.env.PORT ?? 3000);
const app = await createApp({ databasePath: resolve("data/database.json") });

const server = app.listen(port, () => {
  console.log(`API server listening at http://localhost:${port}`);
});

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  app.locals.automation?.stop();
  server.close(() => process.exit(0));
  void Promise.all([app.locals.aiProctor?.shutdown({ graceMs: 5000 }), app.locals.mobileAiProctor?.shutdown({ graceMs: 5000 })]).finally(() => server.closeAllConnections?.());
  setTimeout(() => process.exit(1), 7000).unref();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
