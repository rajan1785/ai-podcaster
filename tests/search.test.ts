import assert from "node:assert/strict";
import test from "node:test";
import { hybridSearch, localEmbedding } from "../src/lib/search";
import type { TranscriptSegment } from "../src/lib/types";

test("local embeddings are normalized and deterministic", () => {
  const first = localEmbedding("systems beat motivation");
  const second = localEmbedding("systems beat motivation");
  assert.deepEqual(first, second);
  const magnitude = Math.sqrt(first.reduce((sum, value) => sum + value ** 2, 0));
  assert.ok(Math.abs(magnitude - 1) < 0.0001);
});

test("hybrid search returns the matching temporal chunk first", async () => {
  const transcript: TranscriptSegment[] = [
    { id: "one", start: 0, end: 10, text: "Welcome to the weekly show", embedding: localEmbedding("Welcome to the weekly show") },
    { id: "two", start: 10, end: 20, text: "Reduce friction by changing your environment", embedding: localEmbedding("Reduce friction by changing your environment") },
    { id: "three", start: 20, end: 30, text: "Thanks for listening", embedding: localEmbedding("Thanks for listening") },
  ];
  const [hit] = await hybridSearch("How do I reduce friction?", transcript);
  assert.equal(hit.id, "two");
  assert.equal(hit.start, 10);
});
