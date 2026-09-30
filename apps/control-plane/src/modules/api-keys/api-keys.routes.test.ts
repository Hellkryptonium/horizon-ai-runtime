import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { createApiKeyRouter } from "./api-keys.routes.js";
import { ApiKeyService } from "./api-keys.service.js";
import type { ApiKeyRepository } from "./api-keys.repository.js";
import type { AuthService } from "../auth/auth.service.js";

const user = { id: "00000000-0000-4000-8000-000000000001", name: "Ada", email: "ada@example.com", passwordHash: "hash", createdAt: new Date(), updatedAt: new Date() };

const createRepository = (): ApiKeyRepository => {
	const keys: Awaited<ReturnType<ApiKeyRepository["create"]>>[] = [];
	return {
		async create(input) {
			const key = { id: input.id ?? randomUUID(), name: input.name, userId: input.userId, tokenHash: input.tokenHash, tokenPrefix: input.tokenPrefix, scopes: input.scopes ?? "inference:write", expiresAt: input.expiresAt ?? null, createdAt: new Date(), lastUsedAt: null, revokedAt: null };
			keys.push(key);
			return key;
		},
		async listForUser(userId) { return keys.filter((key) => key.userId === userId && !key.revokedAt); },
		async findValidByHash(tokenHash, now) {
			const key = keys.find((candidate) => candidate.tokenHash === tokenHash && !candidate.revokedAt && (!candidate.expiresAt || candidate.expiresAt > now));
			return key ? { ...key, user } : undefined;
		},
		async touchLastUsed(id) { const key = keys.find((candidate) => candidate.id === id); if (key) key.lastUsedAt = new Date(); },
		async revoke(id, userId) {
			const key = keys.find((candidate) => candidate.id === id && candidate.userId === userId && !candidate.revokedAt);
			if (!key) return false;
			key.revokedAt = new Date();
			return true;
		},
	};
};

describe("API key routes", () => {
	it("creates a usable key and rejects it after revocation", async () => {
		const service = new ApiKeyService(createRepository());
		const auth = { getUserForToken: async (token: string) => token === "session" ? user : undefined } as unknown as AuthService;
		const app = express();
		app.use(express.json());
		app.use("/keys", createApiKeyRouter(service, auth));

		const created = await request(app).post("/keys").set("Cookie", "horizon_session=session").send({ name: "CLI" });
		expect(created.status).toBe(201);
		expect(created.body.token).toMatch(/^hz_live_/);

		const token = created.body.token as string;
		expect((await service.authenticate(token))?.id).toBe(user.id);
		expect((await request(app).get("/keys").set("Cookie", "horizon_session=session")).body.keys).toHaveLength(1);

		expect((await request(app).delete(`/keys/${created.body.key.id}`).set("Cookie", "horizon_session=session")).status).toBe(204);
		expect(await service.authenticate(token)).toBeUndefined();
	});
});