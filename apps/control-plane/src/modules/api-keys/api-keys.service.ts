import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";

import type { SafeUser } from "../auth/auth.types.js";
import type { ApiKeyRepository } from "./api-keys.repository.js";

export const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  expiresAt: z.string().datetime().optional(),
});

export const hashApiKey = (token: string) => createHash("sha256").update(token).digest("hex");

export class ApiKeyService {
  constructor(private readonly repository: ApiKeyRepository) {}

  async create(userId: string, input: z.infer<typeof apiKeyCreateSchema>) {
    const token = `hz_live_${randomBytes(32).toString("base64url")}`;
    const created = await this.repository.create({
      id: randomUUID(),
      userId,
      name: input.name.trim(),
      tokenHash: hashApiKey(token),
      tokenPrefix: token.slice(0, 16),
      scopes: "inference:write",
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });
    return { key: this.toPublic(created), token };
  }

  list(userId: string) {
    return this.repository.listForUser(userId).then((keys) => keys.map((key) => this.toPublic(key)));
  }

  async revoke(id: string, userId: string) {
    if (!await this.repository.revoke(id, userId)) throw new ApiKeyNotFoundError();
  }

  async authenticate(token: string): Promise<SafeUser | undefined> {
    const result = await this.repository.findValidByHash(hashApiKey(token), new Date());
    if (!result) return undefined;
    void this.repository.touchLastUsed(result.id);
    return { id: result.user.id, name: result.user.name, email: result.user.email };
  }

  private toPublic(key: { id: string; name: string; tokenPrefix: string; scopes: string; expiresAt: Date | null; lastUsedAt: Date | null; createdAt: Date }) {
    return { id: key.id, name: key.name, prefix: key.tokenPrefix, scopes: key.scopes.split(","), expiresAt: key.expiresAt, lastUsedAt: key.lastUsedAt, createdAt: key.createdAt };
  }
}

export class ApiKeyNotFoundError extends Error {
  readonly code = "API_KEY_NOT_FOUND";

  constructor() {
    super("API key not found.");
    this.name = "ApiKeyNotFoundError";
  }
}
