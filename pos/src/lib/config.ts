const API_BASE_KEY = "abrang-pos-api-base";
const TOKEN_KEY = "abrang-pos-token";
const USER_KEY = "abrang-pos-user";

export const DEFAULT_API_BASE =
  "https://ns-xp45-default-accounting-api.bugx.ir/api";

export function getApiBase(): string {
  const raw = localStorage.getItem(API_BASE_KEY) || DEFAULT_API_BASE;
  return raw.replace(/\/$/, "");
}

export function setApiBase(url: string) {
  localStorage.setItem(API_BASE_KEY, url.replace(/\/$/, ""));
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export type SessionUser = {
  id: string;
  fullName: string;
  username: string;
  role: "admin" | "manager" | "staff" | string;
};

export function getSessionUser(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function setSessionUser(user: SessionUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function mediaUrl(path?: string | null): string {
  if (!path) return "";
  const s = String(path).trim();
  if (!s) return "";
  if (
    s.startsWith("data:") ||
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("blob:")
  ) {
    return s;
  }
  const origin = getApiBase().replace(/\/api\/?$/, "");
  return `${origin}/${s.replace(/^\//, "")}`;
}
