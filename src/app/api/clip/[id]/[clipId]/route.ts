import { getJob } from '@/lib/job-store';
import { streamMediaFile } from '@/lib/http-media';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; clipId: string }> },
) {
  const { id, clipId } = await params;
  const job = await getJob(id);
  const clip = job?.result?.viralClips.find((item) => item.id === clipId);
  if (!clip?.assetPath) return Response.json({ error: 'Clip not found' }, { status: 404 });
  try {
    return await streamMediaFile(request, clip.assetPath);
  } catch {
    return Response.json({ error: 'Clip file is unavailable' }, { status: 404 });
  }
}
