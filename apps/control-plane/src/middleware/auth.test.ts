import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { requireAuth } from "./auth.js";
import { AuthService, hashSessionToken } from "../modules/auth/auth.service.js";
import type { AuthRepository } from "../modules/auth/auth.repository.js";

const createRepository = (): AuthRepository => {
  const user = { id: "user-1", name: "Harish", email: "harish@example.com", passwordHash: "unused", createdAt: new Date(), updatedAt: new Date() };
  const session = { id: "session-1", userId: user.id, tokenHash: hashSessionToken("token"), expiresAt: new Date(Date.now() + 60_000), createdAt: new Date() };
  return {
    findUserByEmail: async () => user,
    findUserById: async () => user,
    createUser: async () => user,
    createSession: async () => session,
    findValidSession: async (tokenHash) => tokenHash === session.tokenHash ? { ...session, user } : undefined,
    deleteSession: async () => undefined,
    updateUser: async (_userId, updates) => ({ ...user, ...updates }),
    deleteUser: async () => undefined,
  };
};

describe("requireAuth", () => {
  it("rejects unauthenticated requests", async () => {
    const app = express();
    app.get("/protected", requireAuth(new AuthService(createRepository())), (_request, response) => response.json({ ok: true }));
    expect((await request(app).get("/protected")).status).toBe(401);
  });

  it("attaches the authenticated user and proceeds", async () => {
    const app = express();
    app.get("/protected", requireAuth(new AuthService(createRepository())), (request, response) => response.json({ ok: true, user: request.authenticatedUser }));
    const response = await request(app).get("/protected").set("Cookie", "horizon_session=token");
    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe("harish@example.com");
  });
});
