import { apiRequest, clearApiToken, setApiToken } from "@/lib/api";

export type AppUser = {
  id: string;
  fullName: string;
  username: string;
  password?: string;
  role: "admin" | "manager" | "staff";
  isActive: boolean;
};

export type SessionUser = {
  id: string;
  fullName: string;
  username: string;
  role: AppUser["role"];
};

const USERS_KEY = "accounting-users";
const SESSION_KEY = "accounting-session";

function inBrowser() {
  return typeof window !== "undefined";
}

export async function getUsers(): Promise<AppUser[]> {
  const users = await apiRequest<AppUser[]>("/users");
  if (inBrowser()) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  return users;
}

export async function createUser(user: AppUser & { password: string }) {
  await apiRequest("/users", {
    method: "POST",
    body: JSON.stringify(user),
  });
}

export async function updateUser(
  id: string,
  user: AppUser & { password: string },
) {
  await apiRequest(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(user),
  });
}

export async function deleteUser(id: string) {
  await apiRequest(`/users/${id}`, { method: "DELETE" });
}

export async function loginWithUsernamePassword(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const resp = await apiRequest<{
    token: string;
    user: SessionUser;
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  setApiToken(resp.token);
  const session: SessionUser = {
    id: resp.user.id,
    fullName: resp.user.fullName,
    username: resp.user.username,
    role: resp.user.role,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSessionUser(): SessionUser | null {
  if (!inBrowser()) return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function logout() {
  if (!inBrowser()) return;
  localStorage.removeItem(SESSION_KEY);
  clearApiToken();
}
