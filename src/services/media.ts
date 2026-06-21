import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { clipsDirectory, workDirectory } from "@/lib/job-store";
import type { ViralClip } from "@/lib/types";

interface MediaProbe {
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

function run(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} failed (${code}): ${stderr.slice(-1200)}`));
    });
  });
}

export async function probeMedia(filePath: string): Promise<MediaProbe> {
  const raw = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=codec_type",
    "-of",
    "json",
    filePath,
  ]);
  const data = JSON.parse(raw) as {
    format?: { duration?: string };
    streams?: Array<{ codec_type?: string }>;
  };
  const duration = Number(data.format?.duration || 0);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Could not read media duration");
  return {
    duration,
    hasVideo: Boolean(data.streams?.some((stream) => stream.codec_type === "video")),
    hasAudio: Boolean(data.streams?.some((stream) => stream.codec_type === "audio")),
  };
}

export async function extractAudio(jobId: string, filePath: string) {
  const directory = workDirectory(jobId);
  await mkdir(directory, { recursive: true });
  const output = path.join(directory, "audio.mp3");
  await run("ffmpeg", [
    "-y",
    "-i",
    filePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "48k",
    output,
  ]);
  return output;
}

export async function extractFrames(
  jobId: string,
  filePath: string,
  duration: number,
  hasVideo: boolean,
) {
  if (!hasVideo) return [];
  const directory = workDirectory(jobId);
  await mkdir(directory, { recursive: true });
  const positions = [0.12, 0.35, 0.62, 0.86].map((ratio) => duration * ratio);
  const frames: string[] = [];
  for (let index = 0; index < positions.length; index += 1) {
    const output = path.join(directory, `frame-${index}.jpg`);
    await run("ffmpeg", [
      "-y",
      "-ss",
      positions[index].toFixed(2),
      "-i",
      filePath,
      "-frames:v",
      "1",
      "-vf",
      "scale=960:-2",
      "-q:v",
      "3",
      output,
    ]);
    frames.push(output);
  }
  return frames;
}

export async function renderVerticalClips(
  jobId: string,
  filePath: string,
  clips: ViralClip[],
  hasVideo: boolean,
) {
  if (!hasVideo) return clips;
  const directory = clipsDirectory(jobId);
  await mkdir(directory, { recursive: true });

  const rendered: ViralClip[] = [];
  for (const clip of clips) {
    const output = path.join(directory, `${clip.id}.mp4`);
    await run("ffmpeg", [
      "-y",
      "-ss",
      clip.start.toFixed(2),
      "-i",
      filePath,
      "-t",
      Math.max(1, clip.end - clip.start).toFixed(2),
      "-vf",
      "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "24",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      output,
    ]);
    rendered.push({ ...clip, assetPath: output });
  }
  return rendered;
}
