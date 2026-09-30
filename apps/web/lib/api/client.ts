export const controlPlaneUrl = (process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${controlPlaneUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...(init.headers || {}) },
    });
  } catch {
    throw new ApiError(0, "CONTROL_PLANE_UNAVAILABLE", `Cannot reach the control plane at ${controlPlaneUrl}. Start it or update NEXT_PUBLIC_CONTROL_PLANE_URL.`);
  }
  const body = await response.json().catch(() => undefined) as { error?: { code?: string; message?: string } | string } | undefined;
  if (!response.ok) {
    const error = typeof body?.error === "object" ? body.error : undefined;
    throw new ApiError(response.status, error?.code || "REQUEST_FAILED", error?.message || "The request could not be completed.");
  }
  return body as T;
}
