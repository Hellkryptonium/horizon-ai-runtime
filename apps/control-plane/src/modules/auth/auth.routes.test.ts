import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import type { AuthRepository, NewSession, NewUser } from "./auth.repository.js";
import type { SessionRecord, UserRecord } from "./auth.types.js";
import { AuthService, hashSessionToken } from "./auth.service.js";
import { hashPassword } from "./password.js";

const userId = "00000000-0000-4000-8000-000000000001";
const createUser = async (overrides: Partial<UserRecord> = {}): Promise<UserRecord> => ({
  id: userId,
  name: "Harish",
  email: "harish@example.com",
  passwordHash: await hashPassword("correct horse battery staple"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const createFakeRepository = async (existing: UserRecord[] = []): Promise<AuthRepository> => {
  const users = [...existing];
  const sessions: SessionRecord[] = [];
  return {
    async findUserByEmail(email) { return users.find((user) => user.email === email); },
    async findUserById(id) { return users.find((user) => user.id === id); },
    async createUser(input: NewUser) {
      const user = await createUser({ ...input, id: `00000000-0000-4000-8000-${String(users.length + 2).padStart(12, "0")}` });
      users.push(user);
      return user;
    },
    async createSession(input: NewSession) {
      const session: SessionRecord = { ...input, createdAt: new Date() };
      sessions.push(session);
      return session;
    },
    async findValidSession(tokenHash, now) {
      const session = sessions.find((candidate) => candidate.tokenHash === tokenHash && candidate.expiresAt > now);
      const user = session && users.find((candidate) => candidate.id === session.userId);
      return session && user ? { ...session, user } : undefined;
    },
    async deleteSession(tokenHash) {
      const index = sessions.findIndex((session) => session.tokenHash === tokenHash);
      if (index >= 0) sessions.splice(index, 1);
    },
    async updateUser(id, updates) {
      const user = users.find((candidate) => candidate.id === id);
      if (!user) return undefined;
      Object.assign(user, updates, { updatedAt: new Date() });
      return user;
    },
    async deleteUser(id) {
      const index = users.findIndex((user) => user.id === id);
      if (index >= 0) users.splice(index, 1);
    },
  };
};

describe("auth routes", () => {
  it("registers a user, creates a session, and never returns password data", async () => {
    const repository = await createFakeRepository();
    const response = await request(createApp(undefined, undefined, undefined, undefined, new AuthService(repository)))
      .post("/api/auth/register")
      .send({ name: "Harish", email: " HARISH@example.com ", password: "correct horse battery staple" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ success: true, user: { id: expect.any(String), name: "Harish", email: "harish@example.com" } });
    expect(response.headers["set-cookie"]).toEqual([expect.stringContaining("horizon_session=")]);
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it("rejects duplicate email and invalid registration data", async () => {
    const repository = await createFakeRepository([await createUser()]);
    const app = createApp(undefined, undefined, undefined, undefined, new AuthService(repository));
    const duplicate = await request(app).post("/api/auth/register").send({ name: "Other", email: "HARISH@example.com", password: "correct horse battery staple" });
    const invalid = await request(app).post("/api/auth/register").send({ name: "Other", email: "bad", password: "short" });
    expect(duplicate.status).toBe(409);
    expect(invalid.status).toBe(400);
  });

  it("logs in with valid credentials and rejects invalid credentials generically", async () => {
    const repository = await createFakeRepository([await createUser()]);
    const app = createApp(undefined, undefined, undefined, undefined, new AuthService(repository));
    const valid = await request(app).post("/api/auth/login").send({ email: "harish@example.com", password: "correct horse battery staple" });
    const invalid = await request(app).post("/api/auth/login").send({ email: "missing@example.com", password: "wrong" });
    expect(valid.status).toBe(200);
    expect(valid.headers["set-cookie"]).toEqual([expect.stringContaining("horizon_session=")]);
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.message).toBe("Invalid email or password.");
  });

  it("loads the current user and invalidates the session on logout", async () => {
    const repository = await createFakeRepository([await createUser()]);
    const app = createApp(undefined, undefined, undefined, undefined, new AuthService(repository));
    const login = await request(app).post("/api/auth/login").send({ email: "harish@example.com", password: "correct horse battery staple" });
    const cookie = login.headers["set-cookie"][0].split(";")[0];
    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    const logout = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    const after = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("harish@example.com");
    expect(logout.status).toBe(200);
    expect(after.status).toBe(401);
  });

  it("rejects missing and expired sessions", async () => {
    const repository = await createFakeRepository([await createUser()]);
    const service = new AuthService(repository);
    const app = createApp(undefined, undefined, undefined, undefined, service);
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    await repository.createSession({ id: "00000000-0000-4000-8000-000000000099", userId, tokenHash: hashSessionToken("expired"), expiresAt: new Date("2020-01-01T00:00:00.000Z") });
    expect((await request(app).get("/api/auth/me").set("Cookie", "horizon_session=expired")).status).toBe(401);
  });
});
