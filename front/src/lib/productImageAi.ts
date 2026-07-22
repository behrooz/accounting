import { getApiToken } from "@/lib/api";
import type { UploadedImage } from "@/lib/media";

export async function transformProductImage(
  imagePath: string,
  prompt: string,
): Promise<UploadedImage> {
  const token = getApiToken();
  const response = await fetch("/api/product-assistant/image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ imagePath, prompt }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    image?: UploadedImage;
    error?: string;
  };
  if (!response.ok || !body.image) {
    throw new Error(body.error || `API error: ${response.status}`);
  }
  return body.image;
}
