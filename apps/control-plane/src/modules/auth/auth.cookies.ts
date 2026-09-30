import type { Request, Response } from "express";

export const SESSION_COOKIE = "horizon_session";

export function readSessionCookie(request: Request): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  const value = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return value ? decodeURIComponent(value.slice(SESSION_COOKIE.length + 1)) : undefined;
}

export function setSessionCookie(response: Response, token: string, secure: boolean) {
  const sameSite = secure ? "None" : "Lax";
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSite}${secure ? "; Secure" : ""}; Max-Age=2592000`);
}

export function clearSessionCookie(response: Response, secure: boolean) {
  const sameSite = secure ? "None" : "Lax";
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=${sameSite}${secure ? "; Secure" : ""}; Max-Age=0`);
}
