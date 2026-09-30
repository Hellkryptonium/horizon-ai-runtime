import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";

import type { AuthRepository } from "./auth.repository.js";
import { hashPassword, verifyPassword } from "./password.js";
import type { SafeUser, UserRecord } from "./auth.types.js";

export const registerSchema = z.object({ name: z.string().trim().min(1).max(255), email: z.string().trim().email(), password: z.string().min(8).max(128) });
export const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });
export const accountUpdateSchema = z.object({ name: z.string().trim().min(1).max(255), email: z.string().trim().email() });
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export class DuplicateEmailError extends Error { readonly code = "EMAIL_ALREADY_REGISTERED"; }
export class InvalidCredentialsError extends Error { readonly code = "INVALID_CREDENTIALS"; }

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const toSafeUser = (user: UserRecord): SafeUser => ({ id: user.id, name: user.name, email: user.email });
export const hashSessionToken = (token: string) => createHash("sha256").update(token).digest("hex");

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async register(input: z.infer<typeof registerSchema>) {
    const email = normalizeEmail(input.email);
    if (await this.repository.findUserByEmail(email)) throw new DuplicateEmailError();
    const user = await this.repository.createUser({ name: input.name.trim(), email, passwordHash: await hashPassword(input.password) });
    return this.createSession(user);
  }

  async login(input: z.infer<typeof loginSchema>) {
    const user = await this.repository.findUserByEmail(normalizeEmail(input.email));
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) throw new InvalidCredentialsError();
    return this.createSession(user);
  }

  async getUserForToken(token: string, now = new Date()) {
    const session = await this.repository.findValidSession(hashSessionToken(token), now);
    return session ? toSafeUser(session.user) : undefined;
  }

  async logout(token: string | undefined) { if (token) await this.repository.deleteSession(hashSessionToken(token)); }

  async updateAccount(userId: string, input: z.infer<typeof accountUpdateSchema>) {
    const email = normalizeEmail(input.email);
    const existing = await this.repository.findUserByEmail(email);
    if (existing && existing.id !== userId) throw new DuplicateEmailError();
    const user = await this.repository.updateUser(userId, { name: input.name.trim(), email });
    return user ? toSafeUser(user) : undefined;
  }

  deleteAccount(userId: string) {
    return this.repository.deleteUser(userId);
  }

  private async createSession(user: UserRecord) {
    const token = randomBytes(32).toString("base64url");
    await this.repository.createSession({ id: randomUUID(), userId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
    return { user: toSafeUser(user), token };
  }
}
