import { and, eq, gt } from "drizzle-orm";

import { db } from "../../db/index.js";
import { sessions, users } from "../../db/schema.js";
import type { SessionRecord, UserRecord } from "./auth.types.js";

export type NewUser = Omit<UserRecord, "id" | "createdAt" | "updatedAt">;
export type NewSession = Omit<SessionRecord, "createdAt">;

export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  findUserById(userId: string): Promise<UserRecord | undefined>;
  createUser(user: NewUser): Promise<UserRecord>;
  createSession(session: NewSession): Promise<SessionRecord>;
  findValidSession(tokenHash: string, now: Date): Promise<(SessionRecord & { user: UserRecord }) | undefined>;
  deleteSession(tokenHash: string): Promise<void>;
}

export const authRepository: AuthRepository = {
  async findUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  },
  async findUserById(userId) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user;
  },
  async createUser(user) {
    const [created] = await db.insert(users).values(user).returning();
    if (!created) throw new Error("User insert did not return a user");
    return created;
  },
  async createSession(session) {
    const [created] = await db.insert(sessions).values(session).returning();
    if (!created) throw new Error("Session insert did not return a session");
    return created;
  },
  async findValidSession(tokenHash, now) {
    const rows = await db.select({ session: sessions, user: users }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)));
    const row = rows[0];
    return row ? { ...row.session, user: row.user } : undefined;
  },
  async deleteSession(tokenHash) {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  },
};
