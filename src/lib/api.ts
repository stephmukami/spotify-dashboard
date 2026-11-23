import {
  TERMS_VERSION,
  type CompareResponse,
  type GraphResponse,
  type MeResponse,
  type SessionResponse,
  type SyncResponse,
  type Visibility,
} from "../../shared/types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  getSession: () => request<SessionResponse>("GET", "/api/session"),
  createSession: (accessToken: string) => request<SessionResponse>("POST", "/api/session", { accessToken }),
  logout: () => request<{ ok: true }>("DELETE", "/api/session"),
  consent: (visibility: Visibility) =>
    request<SessionResponse>("POST", "/api/consent", { termsVersion: TERMS_VERSION, visibility }),
  sync: (accessToken: string) => request<SyncResponse>("POST", "/api/sync", { accessToken }),
  graph: () => request<GraphResponse>("GET", "/api/graph"),
  compare: (publicId: string) => request<CompareResponse>("GET", `/api/compare?id=${encodeURIComponent(publicId)}`),
  me: () => request<MeResponse>("GET", "/api/me"),
  setVisibility: (visibility: Visibility) => request<SessionResponse>("PATCH", "/api/me", { visibility }),
  deleteMe: () => request<{ ok: true }>("DELETE", "/api/me"),
};
