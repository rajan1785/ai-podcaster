import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/job-store';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await getJob(id);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const publicJob = {
    ...job,
    filePath: undefined,
    result: job.result
      ? {
          ...job.result,
          transcript: job.result.transcript.map((segment) => ({
            id: segment.id,
            start: segment.start,
            end: segment.end,
            text: segment.text,
            words: segment.words,
          })),
        }
      : undefined,
  };
  return NextResponse.json(publicJob, { headers: { 'Cache-Control': 'no-store' } });
}
