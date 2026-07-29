import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createApp } from "../../../backend/src/app.mjs";

const port = Number(process.env.PORT ?? 43100);
const databasePath = resolve(process.env.QA_DB_PATH ?? ".omo/evidence/resend-email-review/qa-db.json");
const resendLogPath = resolve(process.env.QA_RESEND_LOG ?? ".omo/evidence/resend-email-review/resend.ndjson");
const mode = process.env.QA_RESEND_MODE ?? "success";

await mkdir(dirname(databasePath), { recursive: true });
await mkdir(dirname(resendLogPath), { recursive: true });
const resendLog = createWriteStream(resendLogPath, { flags: "a" });
const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, init = {}) => {
  if (String(url) === "https://api.resend.com/emails") {
    const record = {
      at: new Date().toISOString(),
      url: String(url),
      method: init.method,
      headers: init.headers,
      body: JSON.parse(init.body)
    };
    resendLog.write(JSON.stringify(record) + "\n");
    if (mode === "fail") return new Response(JSON.stringify({ message: "mock failure" }), { status: 500, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ id: "mock-email-id" }), { status: 201, headers: { "Content-Type": "application/json" } });
  }
  return originalFetch(url, init);
};

const app = await createApp({ databasePath });
const server = app.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ status: "listening", port, databasePath, resendLogPath, mode }));
});

const shutdown = () => {
  server.close(() => {
    resendLog.end(() => process.exit(0));
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
