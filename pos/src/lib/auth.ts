import { apiRequest } from "./api";
import {
  clearToken,
  setSessionUser,
  setToken,
  type SessionUser,
} from "./config";

export type { SessionUser };

export async function login(
  username: string,
  password: string,
): Promise<SessionUser> {
  const resp = await apiRequest<{ token: string; user: SessionUser }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
  );
  setToken(resp.token);
  setSessionUser(resp.user);
  return resp.user;
}

export function logout() {
  clearToken();
}
