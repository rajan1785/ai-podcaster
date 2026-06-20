import { getJob } from '@/lib/job-store';
import { streamMediaFile } from '@/lib/http-media';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: 'Media not found' }, { status: 404 });
  try {
    return await streamMediaFile(request, job.filePath);
  } catch {
    return Response.json({ error: 'Media file is unavailable' }, { status: 404 });
  }
}
