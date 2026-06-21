import { createReadStream } from "node:fs";
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

export type LiveProvider = "groq" | "openai";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

// Prefer Groq when its (free) key is present, otherwise fall back to OpenAI.
export function liveProvider(): LiveProvider | undefined {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.OPENAI_API_KEY) return "openai";
  return undefined;
}

function providerConfig(provider: LiveProvider) {
  if (provider === "groq") {
    return {
      client: new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: GROQ_BASE_URL }),
      transcriptionModel: process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3",
      analysisModel: process.env.GROQ_ANALYSIS_MODEL || "llama-3.3-70b-versatile",
      chatModel: process.env.GROQ_CHAT_MODEL || "llama-3.1-8b-instant",
    };
  }
  return {
    client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1",
    analysisModel: process.env.OPENAI_ANALYSIS_MODEL || "gpt-4o",
    chatModel: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
  };
}

function wordsForSegment(words: TranscriptWord[], start: number, end: number) {
  return words.filter((word) => word.start >= start && word.start < end);
}

export async function transcribeMedia(audioPath: string): Promise<TranscriptSegment[]> {
  const provider = liveProvider();
  if (!provider) return [];
  const { client, transcriptionModel } = providerConfig(provider);

  const response = (await client.audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: transcriptionModel,
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

// Analyzes the transcript as text so it works with non-vision models
// (e.g. Llama on Groq); video frames are not required.
export async function analyzeTranscript(
  transcript: TranscriptSegment[],
  duration: number,
): Promise<StructuredAnalysis> {
  const provider = liveProvider();
  if (!provider) throw new Error("No analysis provider is configured");
  const { client, analysisModel } = providerConfig(provider);

  const transcriptText = transcript
    .map((segment) => `[${segment.start.toFixed(1)}-${segment.end.toFixed(1)}] ${segment.text}`)
    .join("\n")
    .slice(0, 90_000);

  const system = [
    `You analyze a timestamped transcript of a ${duration.toFixed(1)}-second media file.`,
    "Respond with ONLY a JSON object of this exact shape:",
    "{",
    '  "summary": string,            // 2-4 sentence factual summary of what is actually said',
    '  "chapters": [{ "start": number, "title": string, "summary": string }],',
    '  "viralClips": [{ "start": number, "end": number, "title": string, "hook": string, "score": number }]',
    "}",
    `Rules: chapter "start" and clip "start"/"end" are seconds within 0-${duration.toFixed(1)}. ` +
      "Provide 3-8 chapters. Provide up to 3 clip candidates, each 15-60 seconds, starting on a complete " +
      "thought, with a 0-100 score. Base everything strictly on the transcript; do not invent content.",
  ].join("\n");

  const response = await client.chat.completions.create({
    model: analysisModel,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: `TRANSCRIPT\n${transcriptText}` },
    ],
  });

  const content = response.choices[0]?.message?.content || "{}";
  const analysis = JSON.parse(content) as Partial<StructuredAnalysis>;

  return {
    summary: typeof analysis.summary === "string" ? analysis.summary : "",
    chapters: Array.isArray(analysis.chapters) ? analysis.chapters : [],
    viralClips: (Array.isArray(analysis.viralClips) ? analysis.viralClips : []).map((clip) => ({
      ...clip,
      score: Math.max(0, Math.min(100, Math.round(Number(clip.score) || 0))),
    })),
  };
}

export async function answerQuestion(
  query: string,
  hits: TranscriptSegment[],
): Promise<string> {
  const provider = liveProvider();
  if (!provider) {
    return hits[0]
      ? `The closest section says: “${hits[0].text}”`
      : "I could not find a matching section.";
  }
  const { client, chatModel } = providerConfig(provider);

  const context = hits
    .map((hit) => `[${hit.start.toFixed(1)}-${hit.end.toFixed(1)}] ${hit.text}`)
    .join("\n");
  const response = await client.chat.completions.create({
    model: chatModel,
    messages: [
      {
        role: "system",
        content:
          "Answer only from the supplied timestamped context. Be concise. If the answer is not present, say so. Mention the most relevant timestamp naturally.",
      },
      { role: "user", content: `Question: ${query}\n\nContext:\n${context}` },
    ],
  });
  return response.choices[0]?.message?.content || "";
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
