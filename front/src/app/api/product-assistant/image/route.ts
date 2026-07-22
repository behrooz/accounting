import { GoogleGenAI, Modality } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import {
  apiBaseUrl,
  apiOrigin,
  verifyDashboardToken,
} from "@/lib/dashboardAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadedImage = {
  path: string;
  url: string;
  filename: string;
};

function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function geminiModel(): string {
  return (
    process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image"
  );
}

function buildImagePrompt(userPrompt: string): string {
  return [
    "You are editing a product photo for an online clothing store.",
    "Return only the edited image as output.",
    "Keep the result realistic, high quality, and suitable for e-commerce.",
    "Do not add text, watermarks, or logos unless explicitly requested.",
    "",
    "User instructions:",
    userPrompt,
  ].join("\n");
}

async function fetchSourceImage(
  imagePath: string,
): Promise<{ base64: string; mimeType: string }> {
  const rel = imagePath.replace(/^\//, "");
  if (!rel || rel.includes("..")) {
    throw new Error("مسیر تصویر نامعتبر است.");
  }

  const response = await fetch(`${apiOrigin()}/${rel}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`دریافت تصویر اصلی ناموفق بود (HTTP ${response.status}).`);
  }

  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ||
    "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    throw new Error("فایل تصویر خالی است.");
  }
  if (buffer.length > 12 * 1024 * 1024) {
    throw new Error("حجم تصویر برای پردازش هوش مصنوعی بیش از حد مجاز است.");
  }

  return { base64: buffer.toString("base64"), mimeType };
}

function extractGeneratedImage(response: {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { data?: string; mimeType?: string };
      }>;
    };
  }>;
}): { base64: string; mimeType: string } | null {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const data = part.inlineData?.data;
    if (!data) continue;
    return {
      base64: data,
      mimeType: part.inlineData?.mimeType || "image/png",
    };
  }
  return null;
}

async function uploadGeneratedImage(
  authorization: string,
  buffer: Buffer,
  mimeType: string,
): Promise<UploadedImage> {
  const ext = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : "jpg";
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  form.append("file", blob, `ai-${Date.now()}.${ext}`);

  const response = await fetch(`${apiBaseUrl()}/uploads/product`, {
    method: "POST",
    headers: { Authorization: authorization },
    body: form,
  });

  if (!response.ok) {
    let message = `آپلود تصویر جدید ناموفق بود (HTTP ${response.status}).`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  return (await response.json()) as UploadedImage;
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const auth = await verifyDashboardToken(authorization);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "کلید Gemini روی سرور تنظیم نشده است (GEMINI_API_KEY)." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const row =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const imagePath = text(row.imagePath, 512);
  const prompt = text(row.prompt, 4000);

  if (!imagePath) {
    return NextResponse.json(
      { error: "مسیر تصویر ارسال نشده است." },
      { status: 400 },
    );
  }
  if (prompt.length < 5) {
    return NextResponse.json(
      { error: "دستور ویرایش تصویر را کامل‌تر وارد کنید." },
      { status: 400 },
    );
  }

  try {
    const source = await fetchSourceImage(imagePath);
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: geminiModel(),
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: source.mimeType, data: source.base64 } },
            { text: buildImagePrompt(prompt) },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const generated = extractGeneratedImage(response);
    if (!generated) {
      return NextResponse.json(
        { error: "Gemini تصویر جدیدی برنگرداند. دستور را تغییر دهید و دوباره تلاش کنید." },
        { status: 502 },
      );
    }

    const uploaded = await uploadGeneratedImage(
      authorization,
      Buffer.from(generated.base64, "base64"),
      generated.mimeType,
    );

    return NextResponse.json({ image: uploaded });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ویرایش تصویر ناموفق بود.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
