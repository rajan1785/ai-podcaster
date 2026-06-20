import { getJob, updateJob } from "@/lib/job-store";
import type { AnalysisResult, ProcessingStage } from "@/lib/types";
import {
  analyzeTranscript,
  demoResult,
  transcribeMedia,
} from "@/services/openai-analysis";
import {
  extractAudio,
  extractFrames,
  probeMedia,
  renderVerticalClips,
} from "@/services/media";

const labels: Record<ProcessingStage, string> = {
  queued: "Waiting for a worker",
  probing: "Inspecting media",
  "extracting-audio": "Extracting clean audio",
  transcribing: "Aligning transcript with Whisper",
  indexing: "Building the hybrid search index",
  analyzing: "Finding chapters and key moments",
  "rendering-clips": "Rendering vertical clips",
  complete: "Analysis complete",
};

async function progress(jobId: string, stage: ProcessingStage, value: number) {
  await updateJob(jobId, {
    status: "processing",
    stage,
    stageLabel: labels[stage],
    progress: value,
  });
}

export async function processMediaJob(jobId: string) {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  try {
    await progress(jobId, "probing", 8);
    const probe = await probeMedia(job.filePath);
    if (probe.duration > 30 * 60 + 1) throw new Error("Media exceeds the 30-minute limit");

    await progress(jobId, "extracting-audio", 20);
    const audioPath = await extractAudio(jobId, job.filePath);

    let result: AnalysisResult;
    if (!process.env.OPENAI_API_KEY) {
      await progress(jobId, "transcribing", 45);
      result = await demoResult(probe.duration);
    } else {
      await progress(jobId, "transcribing", 45);
      const transcript = await transcribeMedia(audioPath);
      if (!transcript.length) throw new Error("No speech was detected in this media");

      await progress(jobId, "indexing", 64);
      const frames = await extractFrames(jobId, job.filePath, probe.duration, probe.hasVideo);
      await progress(jobId, "analyzing", 78);
      const analysis = await analyzeTranscript(transcript, probe.duration, frames);
      result = {
        ...analysis,
        transcript,
        duration: probe.duration,
        analysisMode: "openai",
        viralClips: analysis.viralClips.map((clip, index) => ({
          ...clip,
          id: `clip-${index + 1}`,
          start: Math.max(0, Math.min(clip.start, probe.duration)),
          end: Math.max(clip.start + 1, Math.min(clip.end, probe.duration)),
          score: Math.round(Math.max(0, Math.min(100, clip.score))),
        })),
      };
    }

    await progress(jobId, "rendering-clips", 90);
    result.viralClips = await renderVerticalClips(
      jobId,
      job.filePath,
      result.viralClips,
      probe.hasVideo,
    );

    await updateJob(jobId, {
      status: "completed",
      stage: "complete",
      stageLabel: labels.complete,
      progress: 100,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error";
    await updateJob(jobId, { status: "failed", error: message });
    throw error;
  }
}
