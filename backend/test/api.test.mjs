import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/app.mjs";
import { createStore } from "../src/store.mjs";

const startServer = async () => {
  const directory = await mkdtemp(join(tmpdir(), "aivle-api-"));
  const app = await createApp({ databasePath: join(directory, "database.json") });
  const server = app.listen(0);
  await new Promise((resolveReady) => server.once("listening", resolveReady));
  const address = server.address();
  return { baseUrl: `http://127.0.0.1:${address.port}`, directory, server };
};

test("serves public data and protects administration endpoints", async (context) => {
  const { baseUrl, directory, server } = await startServer();
  context.after(() => server.close());

  const exams = await fetch(`${baseUrl}/api/exams`);
  assert.equal(exams.status, 200);
  assert.equal((await exams.json()).length, 1);

  const denied = await fetch(`${baseUrl}/api/admin/users`);
  assert.equal(denied.status, 401);

  const signup = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "신규 응시자", email: "new-applicant@aivle.com", password: "safe-password", role: "APPLICANT" })
  });
  assert.equal(signup.status, 201);
  assert.equal("password" in (await signup.json()).user, false);

  const database = JSON.parse(await readFile(join(directory, "database.json"), "utf8"));
  const registeredUser = database.users.find((user) => user.email === "new-applicant@aivle.com");
  assert.equal(registeredUser.password, undefined);

  const privilegedSignup = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "권한 상승 시도", email: "blocked-admin@aivle.com", password: "safe-password", role: "ADMIN" })
  });
  assert.equal(privilegedSignup.status, 403);
});

test("authenticates an administrator and creates an exam", async (context) => {
  const { baseUrl, server } = await startServer();
  context.after(() => server.close());

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@aivle.com", password: "123", role: "ADMIN" })
  });
  assert.equal(login.status, 200);
  const { token } = await login.json();

  const create = await fetch(`${baseUrl}/api/admin/exams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: "신규 평가", duration: "60분", questions: "총 3문제" })
  });
  assert.equal(create.status, 201);
  assert.equal((await create.json()).title, "신규 평가");
});

test("removes plaintext passwords from an existing database", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aivle-api-"));
  const databasePath = join(directory, "database.json");
  await writeFile(databasePath, JSON.stringify({
    users: [{ id: "legacy-user", email: "legacy@aivle.com", password: "legacy-secret", passwordHash: "kept" }],
    exams: [], notices: [], examinees: [], warnings: []
  }));

  await createStore(databasePath);

  const migratedDatabase = JSON.parse(await readFile(databasePath, "utf8"));
  assert.equal(migratedDatabase.users[0].password, undefined);
  assert.equal(migratedDatabase.users[0].passwordHash, "kept");
});
