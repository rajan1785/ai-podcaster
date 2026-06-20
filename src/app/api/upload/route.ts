import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/services/queue';
import { ensureDataDirectories, uploadsDirectory } from '@/lib/job-store';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mp3', '.m4a', '.wav', '.ogg']);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('media') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const extension = path.extname(file.name).toLowerCase();
    const isMediaMime = file.type.startsWith('video/') || file.type.startsWith('audio/');
    if (!isMediaMime || !ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ error: 'Unsupported media type' }, { status: 415 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File must be between 1 byte and 500 MB' }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await ensureDataDirectories();
    const safeBaseName = path.basename(file.name, extension).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80);
    const uniqueName = `${Date.now()}-${safeBaseName || 'media'}${extension}`;
    const filePath = path.join(uploadsDirectory(), uniqueName);
    
    await writeFile(filePath, buffer);

    // Enqueue the job
    const jobId = await createJob(file.name, filePath, file.type);

    return NextResponse.json({ success: true, jobId, message: 'File uploaded and processing started.' });
  } catch (error: unknown) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
