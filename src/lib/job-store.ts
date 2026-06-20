import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MediaJob } from "@/lib/types";

const SAFE_ID = /^[a-zA-Z0-9-]+$/;

export function dataDirectory() {
  return process.env.MEDIA_DATA_DIR || path.join(process.cwd(), ".data");
}

export function uploadsDirectory() {
  return path.join(dataDirectory(), "uploads");
}

export function workDirectory(jobId: string) {
  assertSafeId(jobId);
  return path.join(dataDirectory(), "work", jobId);
}

export function clipsDirectory(jobId: string) {
  assertSafeId(jobId);
  return path.join(dataDirectory(), "clips", jobId);
}

function jobsDirectory() {
  return path.join(dataDirectory(), "jobs");
}

function assertSafeId(id: string) {
  if (!SAFE_ID.test(id)) throw new Error("Invalid job id");
}

function jobPath(id: string) {
  assertSafeId(id);
  return path.join(jobsDirectory(), `${id}.json`);
}

export async function ensureDataDirectories() {
  await Promise.all([
    mkdir(jobsDirectory(), { recursive: true }),
    mkdir(uploadsDirectory(), { recursive: true }),
    mkdir(path.join(dataDirectory(), "work"), { recursive: true }),
    mkdir(path.join(dataDirectory(), "clips"), { recursive: true }),
  ]);
}

export async function saveJob(job: MediaJob) {
  await ensureDataDirectories();
  const target = jobPath(job.id);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(job), "utf8");
  await rename(temporary, target);
}

export async function getJob(id: string): Promise<MediaJob | undefined> {
  try {
    return JSON.parse(await readFile(jobPath(id), "utf8")) as MediaJob;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function updateJob(
  id: string,
  patch: Partial<MediaJob>,
): Promise<MediaJob> {
  const existing = await getJob(id);
  if (!existing) throw new Error(`Job ${id} not found`);
  const next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await saveJob(next);
  return next;
}
