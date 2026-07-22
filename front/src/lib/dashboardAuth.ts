export function apiBaseUrl(): string {
  const raw =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "https://ns-xp45-default-accounting-api.bugx.ir/api";
  return raw.replace(/\/$/, "");
}

export function apiOrigin(): string {
  return apiBaseUrl().replace(/\/api\/?$/, "");
}

export type DashboardAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function verifyDashboardToken(
  authorization: string,
): Promise<DashboardAuthResult> {
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, error: "توکن ورود ارسال نشده است." };
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/me`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });
    if (response.ok) return { ok: true };
    if (response.status === 401) {
      return {
        ok: false,
        status: 401,
        error: "توکن ورود نامعتبر یا منقضی شده است. دوباره وارد شوید.",
      };
    }
    return {
      ok: false,
      status: 502,
      error: `بررسی توکن با API ناموفق بود (HTTP ${response.status}).`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "network error";
    return {
      ok: false,
      status: 502,
      error: `اتصال به API برای بررسی توکن برقرار نشد: ${detail}`,
    };
  }
}
