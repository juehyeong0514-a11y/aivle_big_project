import express from "express";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createStore, verifyPassword } from "./store.mjs";

const roles = new Set(["APPLICANT", "SUPERVISOR", "ADMIN"]);
const isNonEmptyText = (value) => typeof value === "string" && value.trim().length > 0;
const publicUser = ({ password, passwordHash, ...user }) => user;

const requestUser = (sessions) => (request, response, next) => {
  const token = request.header("authorization")?.replace("Bearer ", "");
  const user = token ? sessions.get(token) : undefined;
  if (!user) return response.status(401).json({ message: "로그인이 필요합니다." });
  request.user = user;
  return next();
};

const requireRole = (role) => (request, response, next) => {
  if (request.user.role !== role) return response.status(403).json({ message: "권한이 없습니다." });
  return next();
};

export const createApp = async ({ databasePath = resolve("data/database.json") } = {}) => {
  const store = await createStore(databasePath);
  const sessions = new Map();
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use((request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (request.method === "OPTIONS") return response.sendStatus(204);
    return next();
  });

  app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
  app.get("/api/exams", (_request, response) => response.json(store.exams));
  app.get("/api/notices", (_request, response) => response.json(store.notices));

  app.post("/api/auth/signup", async (request, response, next) => {
    try {
      const { name, email, password, role } = request.body;
      if (!isNonEmptyText(name) || !isNonEmptyText(email) || !isNonEmptyText(password) || !roles.has(role)) {
        return response.status(400).json({ message: "회원가입 정보를 다시 확인해주세요." });
      }
      if (role !== "APPLICANT") {
        return response.status(403).json({ message: "관리자와 감독관 계정은 운영자가 생성합니다." });
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (store.users.some((user) => user.email === normalizedEmail)) {
        return response.status(409).json({ message: "이미 등록된 이메일입니다." });
      }
      const user = { id: randomUUID(), name: name.trim(), email: normalizedEmail, password, role: "APPLICANT", approvalStatus: "APPROVED" };
      await store.addUser(user);
      return response.status(201).json({ user: publicUser(user) });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/auth/login", async (request, response, next) => {
    try {
      const { email, password, role } = request.body;
      const user = store.users.find((candidate) => candidate.email === email?.trim().toLowerCase());
      if (!user || user.role !== role || !(await verifyPassword(password ?? "", user.passwordHash))) {
        return response.status(401).json({ message: "이메일, 비밀번호 또는 권한을 확인해주세요." });
      }
      const token = randomUUID();
      const safeUser = publicUser(user);
      sessions.set(token, safeUser);
      return response.json({ token, user: safeUser });
    } catch (error) {
      return next(error);
    }
  });

  const authenticate = requestUser(sessions);
  app.get("/api/admin/users", authenticate, requireRole("ADMIN"), (_request, response) => {
    response.json(store.users.filter((user) => user.role === "APPLICANT").map(publicUser));
  });
  app.post("/api/admin/exams", authenticate, requireRole("ADMIN"), async (request, response, next) => {
    try {
      const { title, duration, questions } = request.body;
      if (![title, duration, questions].every(isNonEmptyText)) {
        return response.status(400).json({ message: "시험명, 제한 시간, 문항 수를 입력해주세요." });
      }
      const exam = {
        id: randomUUID(), title: title.trim(), duration: duration.trim(), questions: questions.trim(),
        category: "정규 평가", status: "AVAILABLE", date: "일정 미정"
      };
      await store.addExam(exam);
      return response.status(201).json(exam);
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/supervisor/examinees", authenticate, requireRole("SUPERVISOR"), (_request, response) => response.json(store.examinees));
  app.post("/api/supervisor/examinees/:id/warnings", authenticate, requireRole("SUPERVISOR"), async (request, response, next) => {
    try {
      const examinee = store.examinees.find((candidate) => candidate.id === request.params.id);
      if (!examinee || !isNonEmptyText(request.body.message)) return response.status(400).json({ message: "경고 대상을 확인해주세요." });
      await store.addWarning({ id: randomUUID(), examineeId: examinee.id, message: request.body.message.trim(), createdAt: new Date().toISOString() });
      return response.status(201).json({ message: "경고를 전송했습니다." });
    } catch (error) {
      return next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({ message: "서버 오류가 발생했습니다." });
  });
  return app;
};
