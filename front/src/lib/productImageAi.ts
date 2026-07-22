import { getApiToken } from "@/lib/api";
import type { UploadedImage } from "@/lib/media";

type JobResponse = {
  jobId?: string;
  status?: "queued" | "running" | "done" | "error";
  image?: UploadedImage;
  error?: string;
};

function authHeaders(): HeadersInit {
  const token = getApiToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function transformProductImage(
  imagePath: string,
  prompt: string,
): Promise<UploadedImage> {
  const start = await fetch("/api/product-assistant/image", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ imagePath, prompt }),
  });
  const startBody = (await start.json().catch(() => ({}))) as JobResponse;
  if (!start.ok || !startBody.jobId) {
    throw new Error(startBody.error || `API error: ${start.status}`);
  }

  const jobId = startBody.jobId;
  const deadline = Date.now() + 10 * 60 * 1000;

  while (Date.now() < deadline) {
    await sleep(2500);
    const poll = await fetch(
      `/api/product-assistant/image?jobId=${encodeURIComponent(jobId)}`,
      { method: "GET", headers: authHeaders() },
    );
    const body = (await poll.json().catch(() => ({}))) as JobResponse;
    if (!poll.ok) {
      throw new Error(body.error || `API error: ${poll.status}`);
    }
    if (body.status === "done" && body.image) {
      return body.image;
    }
    if (body.status === "error") {
      throw new Error(body.error || "ویرایش تصویر ناموفق بود.");
    }
  }

  throw new Error("زمان ویرایش تصویر به پایان رسید. دوباره تلاش کنید.");
}
