import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { createEmbeddings } from "@/lib/search";
import type {
  AnalysisResult,
  Chapter,
  TranscriptSegment,
  TranscriptWord,
  ViralClip,
} from "@/lib/types";

interface WhisperResponse {
  duration?: number;
  segments?: Array<{ id?: number; start: number; end: number; text: string }>;
  words?: Array<{ word: string; start: number; end: number }>;
  text: string;
}

interface StructuredAnalysis {
  summary: string;
  chapters: Chapter[];
  viralClips: Array<Omit<ViralClip, "id" | "assetPath">>;
}

function client() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function wordsForSegment(words: TranscriptWord[], start: number, end: number) {
  return words.filter((word) => word.start >= start && word.start < end);
}

export async function transcribeMedia(audioPath: string): Promise<TranscriptSegment[]> {
  if (!process.env.OPENAI_API_KEY) return [];

  const response = (await client().audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word", "segment"],
  })) as unknown as WhisperResponse;

  const words: TranscriptWord[] = (response.words || []).map((word) => ({
    word: word.word,
    start: word.start,
    end: word.end,
  }));

  const rawSegments = response.segments?.length
    ? response.segments
    : [{ id: 0, start: 0, end: response.duration || 1, text: response.text }];

  const segments: TranscriptSegment[] = rawSegments
    .filter((segment) => segment.text.trim())
    .map((segment, index) => ({
      id: `segment-${segment.id ?? index}`,
      start: segment.start,
      end: segment.end,
      text: segment.text.trim(),
      words: wordsForSegment(words, segment.start, segment.end),
    }));

  const embeddings = await createEmbeddings(segments.map((segment) => segment.text));
  return segments.map((segment, index) => ({ ...segment, embedding: embeddings[index] }));
}

async function imageContent(framePaths: string[]) {
  return Promise.all(
    framePaths.map(async (framePath) => ({
      type: "input_image" as const,
      detail: "low" as const,
      image_url: `data:image/jpeg;base64,${(await readFile(framePath)).toString("base64")}`,
    })),
  );
}

export async function analyzeTranscript(
  transcript: TranscriptSegment[],
  duration: number,
  framePaths: string[],
): Promise<StructuredAnalysis> {
  const transcriptText = transcript
    .map((segment) => `[${segment.start.toFixed(1)}-${segment.end.toFixed(1)}] ${segment.text}`)
    .join("\n")
    .slice(0, 90_000);

  const frames = await imageContent(framePaths);
  const response = await client().responses.create({
    model: process.env.OPENAI_ANALYSIS_MODEL || "gpt-4o",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Analyze this timestamped transcript and the sampled video frames. Return a factual summary, 3-8 useful chapters, and up to 3 compelling standalone vertical clip candidates. Clip candidates must be 15-60 seconds, remain within the media duration (${duration.toFixed(1)} seconds), start on a complete thought, and avoid misleading hooks.\n\nTRANSCRIPT\n${transcriptText}`,
          },
          ...frames,
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "media_analysis",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["summary", "chapters", "viralClips"],
          properties: {
            summary: { type: "string" },
            chapters: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["start", "title", "summary"],
                properties: {
                  start: { type: "number" },
                  title: { type: "string" },
                  summary: { type: "string" },
                },
              },
            },
            viralClips: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["start", "end", "title", "hook", "score"],
                properties: {
                  start: { type: "number" },
                  end: { type: "number" },
                  title: { type: "string" },
                  hook: { type: "string" },
                  score: { type: "number", minimum: 0, maximum: 100 },
                },
              },
            },
          },
        },
      },
    },
  });

  return JSON.parse(response.output_text) as StructuredAnalysis;
}

export async function answerQuestion(
  query: string,
  hits: TranscriptSegment[],
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return hits[0]
      ? `The closest section says: “${hits[0].text}”`
      : "I could not find a matching section.";
  }

  const context = hits
    .map((hit) => `[${hit.start.toFixed(1)}-${hit.end.toFixed(1)}] ${hit.text}`)
    .join("\n");
  const response = await client().responses.create({
    model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
    instructions:
      "Answer only from the supplied timestamped context. Be concise. If the answer is not present, say so. Mention the most relevant timestamp naturally.",
    input: `Question: ${query}\n\nContext:\n${context}`,
  });
  return response.output_text;
}

export async function demoResult(duration: number): Promise<AnalysisResult> {
  const safeDuration = Math.max(duration, 30);
  const points = [0, 0.12, 0.28, 0.44, 0.61, 0.78, 0.9].map((ratio) =>
    Math.min(safeDuration - 1, Math.round(safeDuration * ratio)),
  );
  const copy = [
    "Welcome to the conversation. We start by defining the problem and why it matters now.",
    "The key shift is to focus on repeatable systems instead of waiting for motivation.",
    "A useful system reduces friction and makes the next action obvious.",
    "The speakers compare short-term output with outcomes that compound over time.",
    "They explain how feedback and accountability improve consistency.",
    "A practical example shows how a small change in environment can reshape behavior.",
    "The episode closes with a reminder to measure progress and keep iterating.",
  ];
  const transcript: TranscriptSegment[] = copy.map((text, index) => ({
    id: `demo-${index}`,
    start: points[index],
    end: index === copy.length - 1 ? safeDuration : points[index + 1],
    text,
  }));
  const embeddings = await createEmbeddings(transcript.map((segment) => segment.text));
  transcript.forEach((segment, index) => {
    segment.embedding = embeddings[index];
  });

  return {
    summary:
      "A practical discussion about building durable systems, reducing friction, and using feedback loops to create meaningful long-term progress.",
    chapters: [
      { start: points[0], title: "Why systems matter", summary: "The core problem and a more reliable way to approach it." },
      { start: points[2], title: "Remove friction", summary: "How environment design makes useful actions easier." },
      { start: points[4], title: "Build a feedback loop", summary: "Measure outcomes and adjust the system over time." },
    ],
    transcript,
    viralClips: [
      { id: "clip-1", start: points[1], end: Math.min(points[1] + 30, safeDuration), title: "Systems beat motivation", hook: "Motivation fades. Systems keep working.", score: 94 },
      { id: "clip-2", start: points[3], end: Math.min(points[3] + 32, safeDuration), title: "Make the next step obvious", hook: "The best habit starts before willpower is needed.", score: 91 },
      { id: "clip-3", start: points[5], end: Math.min(points[5] + 28, safeDuration), title: "Measure what compounds", hook: "Track outcomes, not just activity.", score: 88 },
    ].filter((clip) => clip.end - clip.start >= 3),
    analysisMode: "demo",
    duration,
  };
}
