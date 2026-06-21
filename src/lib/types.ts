export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type ProcessingStage =
  | "queued"
  | "probing"
  | "extracting-audio"
  | "transcribing"
  | "indexing"
  | "analyzing"
  | "rendering-clips"
  | "complete";

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words?: TranscriptWord[];
  embedding?: number[];
}

export interface Chapter {
  start: number;
  title: string;
  summary: string;
}

export interface ViralClip {
  id: string;
  start: number;
  end: number;
  title: string;
  hook: string;
  score: number;
  assetPath?: string;
}

export interface AnalysisResult {
  summary: string;
  chapters: Chapter[];
  transcript: TranscriptSegment[];
  viralClips: ViralClip[];
  analysisMode: "openai" | "groq" | "demo";
  duration: number;
}

export interface MediaJob {
  id: string;
  status: JobStatus;
  stage: ProcessingStage;
  stageLabel: string;
  progress: number;
  fileName: string;
  filePath: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  result?: AnalysisResult;
  error?: string;
}

export interface SearchHit extends TranscriptSegment {
  score: number;
}
