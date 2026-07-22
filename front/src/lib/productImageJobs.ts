import { randomUUID } from "node:crypto";
import type { UploadedImage } from "@/lib/media";

export type ImageJobStatus = "queued" | "running" | "done" | "error";

export type ImageJob = {
  id: string;
  status: ImageJobStatus;
  createdAt: number;
  updatedAt: number;
  image?: UploadedImage;
  error?: string;
};

const jobs = new Map<string, ImageJob>();
const MAX_AGE_MS = 30 * 60 * 1000;

function pruneJobs() {
  const cutoff = Date.now() - MAX_AGE_MS;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}

export function createImageJob(): ImageJob {
  pruneJobs();
  const now = Date.now();
  const job: ImageJob = {
    id: randomUUID(),
    status: "queued",
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(job.id, job);
  return job;
}

export function getImageJob(id: string): ImageJob | undefined {
  pruneJobs();
  return jobs.get(id);
}

export function updateImageJob(
  id: string,
  patch: Partial<Pick<ImageJob, "status" | "image" | "error">>,
): ImageJob | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  Object.assign(job, patch, { updatedAt: Date.now() });
  jobs.set(id, job);
  return job;
}
