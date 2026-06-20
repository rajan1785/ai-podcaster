import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/job-store';
import { hybridSearch } from '@/lib/search';
import { answerQuestion } from '@/services/openai-analysis';
import { showcaseResult } from '@/lib/demo-data';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { jobId, query, anchorTime } = await req.json();
    
    if (!jobId || !query) {
      return NextResponse.json({ error: 'Missing jobId or query' }, { status: 400 });
    }

    const job = await getJob(jobId);
    const result = jobId === 'showcase' ? showcaseResult : job?.result;
    if (!result?.transcript) {
      return NextResponse.json({ error: 'Job not found or transcript not ready' }, { status: 404 });
    }

    const anchor = typeof anchorTime === 'number' ? anchorTime : undefined;
    const scopedTranscript = anchor === undefined
      ? result.transcript
      : result.transcript.filter((segment) => segment.end >= anchor - 90 && segment.start <= anchor + 90);
    const corpus = scopedTranscript.length ? scopedTranscript : result.transcript;
    const hits = await hybridSearch(String(query).slice(0, 500), corpus, 5);
    const timestamp = hits[0]?.start;
    const reply = await answerQuestion(String(query), hits);

    return NextResponse.json({
      reply,
      timestamp,
      sources: hits.slice(0, 3).map((hit) => ({
        id: hit.id,
        start: hit.start,
        end: hit.end,
        text: hit.text,
        score: hit.score,
      })),
    });
  } catch (error: unknown) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
