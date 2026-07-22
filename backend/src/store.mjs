import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { seedData } from "./seed.mjs";

const scrypt = promisify(scryptCallback);

const clone = (value) => structuredClone(value);

const hashPassword = async (password) => {
  const salt = randomUUID();
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(derivedKey).toString("hex")}`;
};

export const verifyPassword = async (password, passwordHash) => {
  const [salt, storedHash] = passwordHash.split(":");
  const derivedKey = await scrypt(password, salt, 64);
  return timingSafeEqual(Buffer.from(storedHash, "hex"), Buffer.from(derivedKey));
};

const normalizeSeed = async () => ({
  ...clone(seedData),
  users: await Promise.all(seedData.users.map(async ({ password, ...user }) => ({
    ...user,
    passwordHash: await hashPassword(password)
  })))
});

export const createStore = async (filePath) => {
  let data;
  let shouldSave = false;
  try {
    data = JSON.parse(await readFile(filePath, "utf8"));
    if (data.users.some((user) => Object.hasOwn(user, "password"))) {
      data = {
        ...data,
        users: data.users.map(({ password, ...user }) => user)
      };
      shouldSave = true;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    data = await normalizeSeed();
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2));
  }

  const save = async () => {
    const temporaryPath = `${filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(data, null, 2));
    await rename(temporaryPath, filePath);
  };

  if (shouldSave) await save();

  return {
    get users() { return data.users; },
    get exams() { return data.exams; },
    get notices() { return data.notices; },
    get examinees() { return data.examinees; },
    addUser: async ({ password, ...user }) => {
      data.users.push({ ...user, passwordHash: await hashPassword(password) });
      await save();
    },
    addExam: async (exam) => {
      data.exams.unshift(exam);
      await save();
    },
    addWarning: async (warning) => {
      data.warnings.push(warning);
      await save();
    }
  };
};
