import { getApiToken } from "@/lib/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "https://ns-xp45-default-accounting-api.bugx.ir/api";

/** Host origin for static files (without /api suffix). */
export function apiOrigin(): string {
  return API_BASE_URL.replace(/\/api\/?$/, "");
}

/**
 * Resolve a product image value to a browser-usable URL.
 * Accepts: data URLs, absolute http(s), or stored paths like assets/product/x.jpg
 */
export function mediaUrl(path?: string | null): string {
  if (!path) return "";
  const s = path.trim();
  if (!s) return "";
  if (
    s.startsWith("data:") ||
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("blob:")
  ) {
    return s;
  }
  const rel = s.replace(/^\//, "");
  return `${apiOrigin()}/${rel}`;
}

export type UploadedImage = {
  path: string;
  url: string;
  filename: string;
};

/** Upload a product image file; returns relative path for DB storage. */
export async function uploadProductImage(file: File): Promise<UploadedImage> {
  const token = getApiToken();
  const body = new FormData();
  body.append("file", file);

  const res = await fetch(`${API_BASE_URL}/uploads/product`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body,
  });

  if (!res.ok) {
    let message = `API error: ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  return (await res.json()) as UploadedImage;
}
