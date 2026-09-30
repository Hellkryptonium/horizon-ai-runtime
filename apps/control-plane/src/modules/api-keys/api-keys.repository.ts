import { and, eq, gt, isNull, or } from "drizzle-orm";

import { db } from "../../db/index.js";
import { apiKeys, users } from "../../db/schema.js";

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiKeyWithUser = ApiKey & { user: typeof users.$inferSelect };

export interface ApiKeyRepository {
  create(input: NewApiKey): Promise<ApiKey>;
  listForUser(userId: string): Promise<ApiKey[]>;
  findValidByHash(tokenHash: string, now: Date): Promise<ApiKeyWithUser | undefined>;
  touchLastUsed(id: string): Promise<void>;
  revoke(id: string, userId: string): Promise<boolean>;
}

export const apiKeyRepository: ApiKeyRepository = {
  async create(input) {
    const [created] = await db.insert(apiKeys).values(input).returning();
    if (!created) throw new Error("API key insert did not return a key");
    return created;
  },
  listForUser(userId) {
    return db.select().from(apiKeys).where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
  },
  async findValidByHash(tokenHash, now) {
    const rows = await db.select({ key: apiKeys, user: users })
      .from(apiKeys)
      .innerJoin(users, eq(apiKeys.userId, users.id))
      .where(and(
        eq(apiKeys.tokenHash, tokenHash),
        isNull(apiKeys.revokedAt),
        or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now)),
      ));
    const row = rows[0];
    return row ? { ...row.key, user: row.user } : undefined;
  },
  async touchLastUsed(id) {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
  },
  async revoke(id, userId) {
    const updated = await db.update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });
    return updated.length > 0;
  },
};
