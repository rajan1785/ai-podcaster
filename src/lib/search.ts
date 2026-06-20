import MiniSearch from "minisearch";
import OpenAI from "openai";
import type { SearchHit, TranscriptSegment } from "@/lib/types";

const VECTOR_SIZE = 256;

function normalizeToken(token: string) {
  return token.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function localEmbedding(text: string) {
  const vector = new Array<number>(VECTOR_SIZE).fill(0);
  for (const rawToken of text.split(/\s+/)) {
    const token = normalizeToken(rawToken);
    if (!token) continue;
    vector[hashToken(token) % VECTOR_SIZE] += 1;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0));
  return magnitude ? vector.map((value) => value / magnitude) : vector;
}

export async function createEmbeddings(texts: string[]) {
  if (!process.env.OPENAI_API_KEY) return texts.map(localEmbedding);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    input: texts,
  });
  return response.data.map((item) => item.embedding);
}

function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude) || 1);
}

export async function hybridSearch(
  query: string,
  transcript: TranscriptSegment[],
  limit = 5,
): Promise<SearchHit[]> {
  const miniSearch = new MiniSearch({
    fields: ["text"],
    storeFields: ["id"],
    searchOptions: { prefix: true, fuzzy: 0.2 },
  });
  miniSearch.addAll(transcript.map(({ id, text }) => ({ id, text })));

  const keywordResults = miniSearch.search(query);
  const maxKeywordScore = keywordResults[0]?.score || 1;
  const keywordScores = new Map(
    keywordResults.map((result) => [String(result.id), result.score / maxKeywordScore]),
  );
  const [queryEmbedding] = await createEmbeddings([query]);

  return transcript
    .map((segment) => {
      const semantic = segment.embedding
        ? Math.max(0, cosineSimilarity(queryEmbedding, segment.embedding))
        : 0;
      const keyword = keywordScores.get(segment.id) || 0;
      return { ...segment, score: semantic * 0.65 + keyword * 0.35 };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
