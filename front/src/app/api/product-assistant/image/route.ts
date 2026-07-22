import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  apiBaseUrl,
  apiOrigin,
  verifyDashboardToken,
} from "@/lib/dashboardAuth";
import {
  createImageJob,
  getImageJob,
  updateImageJob,
} from "@/lib/productImageJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

type UploadedImage = {
  path: string;
  url: string;
  filename: string;
};

type GeneratedImage = {
  base64: string;
  mimeType: string;
};

function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function mimeFromPath(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "jpg";
}

function buildImagePrompt(userPrompt: string): string {
  return [
    "You are editing a product photo for an online clothing store.",
    "The attached image is the original product photo.",
    "Use the generateImage tool to create an edited replacement image.",
    "Save the generated file as output.png in the working directory.",
    "Keep the result realistic, high quality, and suitable for e-commerce.",
    "Do not add text, watermarks, or logos unless explicitly requested.",
    "Do not edit source code. Only generate the edited product image.",
    "Finish as quickly as possible after the image is generated.",
    "",
    "User instructions:",
    userPrompt,
  ].join("\n");
}

async function fetchSourceImage(
  imagePath: string,
): Promise<{ base64: string; mimeType: string; buffer: Buffer }> {
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

  return { base64: buffer.toString("base64"), mimeType, buffer };
}

function extractImageDataFromUnknown(value: unknown): GeneratedImage | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;

  if (row.status === "success" && row.value && typeof row.value === "object") {
    const success = row.value as Record<string, unknown>;
    if (typeof success.imageData === "string" && success.imageData) {
      return {
        base64: success.imageData.replace(/^data:[^;]+;base64,/, ""),
        mimeType:
          typeof success.filePath === "string"
            ? mimeFromPath(success.filePath)
            : "image/png",
      };
    }
  }

  if (typeof row.imageData === "string" && row.imageData) {
    return {
      base64: row.imageData.replace(/^data:[^;]+;base64,/, ""),
      mimeType:
        typeof row.filePath === "string"
          ? mimeFromPath(row.filePath)
          : "image/png",
    };
  }

  return null;
}

async function readGeneratedFileFromCwd(
  cwd: string,
  sourceName: string,
): Promise<GeneratedImage | null> {
  const names = await readdir(cwd).catch(() => [] as string[]);
  const preferred = names.find((name) =>
    /^output\.(png|jpe?g|webp|gif)$/i.test(name),
  );
  const candidates = preferred
    ? [preferred]
    : names.filter(
        (name) =>
          name !== sourceName && /\.(png|jpe?g|webp|gif)$/i.test(name),
      );

  for (const name of candidates) {
    const buffer = await readFile(join(cwd, name)).catch(() => null);
    if (!buffer?.length) continue;
    return {
      base64: buffer.toString("base64"),
      mimeType: mimeFromPath(name),
    };
  }
  return null;
}

async function generateWithCursor(options: {
  apiKey: string;
  prompt: string;
  source: { base64: string; mimeType: string; buffer: Buffer };
}): Promise<GeneratedImage> {
  const cwd = await mkdtemp(join(tmpdir(), "product-image-ai-"));
  const sourceExt = extensionForMime(options.source.mimeType);
  const sourceName = `source.${sourceExt}`;

  try {
    await writeFile(join(cwd, sourceName), options.source.buffer);

    await using agent = await Agent.create({
      apiKey: options.apiKey,
      model: { id: "auto" },
      local: { cwd, settingSources: [] },
      name: "Dashboard Product Image Assistant",
    });

    const run = await agent.send({
      text: buildImagePrompt(options.prompt),
      images: [
        {
          data: options.source.base64,
          mimeType: options.source.mimeType,
        },
      ],
    });

    let generated: GeneratedImage | null = null;
    for await (const event of run.stream()) {
      if (event.type !== "tool_call") continue;
      const name = String(event.name || "").toLowerCase();
      if (!name.includes("generateimage") && name !== "generate_image") continue;
      if (event.status !== "completed") continue;
      generated = extractImageDataFromUnknown(event.result) ?? generated;
      if (generated) {
        try {
          await run.cancel();
        } catch {
          /* ignore */
        }
        break;
      }
    }

    const result = await run.wait().catch(() => null);
    if (!generated && result?.status === "error") {
      throw new Error(
        result.error?.message || "ویرایش تصویر با Cursor ناموفق بود.",
      );
    }

    if (!generated) {
      generated = await readGeneratedFileFromCwd(cwd, sourceName);
    }
    if (!generated) {
      throw new Error(
        "Cursor تصویر جدیدی برنگرداند. دستور را تغییر دهید و دوباره تلاش کنید.",
      );
    }
    return generated;
  } finally {
    await rm(cwd, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function uploadGeneratedImage(
  authorization: string,
  buffer: Buffer,
  mimeType: string,
): Promise<UploadedImage> {
  const ext = extensionForMime(mimeType);
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

async function runImageJob(options: {
  jobId: string;
  authorization: string;
  apiKey: string;
  imagePath: string;
  prompt: string;
}) {
  updateImageJob(options.jobId, { status: "running" });
  try {
    const source = await fetchSourceImage(options.imagePath);
    const generated = await generateWithCursor({
      apiKey: options.apiKey,
      prompt: options.prompt,
      source,
    });
    const uploaded = await uploadGeneratedImage(
      options.authorization,
      Buffer.from(generated.base64, "base64"),
      generated.mimeType,
    );
    updateImageJob(options.jobId, { status: "done", image: uploaded });
  } catch (error) {
    const message =
      error instanceof CursorAgentError
        ? `Cursor: ${error.message}`
        : error instanceof Error
          ? error.message
          : "ویرایش تصویر ناموفق بود.";
    updateImageJob(options.jobId, { status: "error", error: message });
  }
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const auth = await verifyDashboardToken(authorization);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const jobId = text(request.nextUrl.searchParams.get("jobId"), 80);
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = getImageJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    image: job.image,
    error: job.error,
  });
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const auth = await verifyDashboardToken(authorization);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "کلید Cursor روی سرور تنظیم نشده است (CURSOR_API_KEY)." },
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

  const job = createImageJob();
  void runImageJob({
    jobId: job.id,
    authorization,
    apiKey,
    imagePath,
    prompt,
  });

  return NextResponse.json(
    { jobId: job.id, status: job.status },
    { status: 202 },
  );
}
