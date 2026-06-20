import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

const mimeTypes: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

function browserStream(filePath: string, range?: { start: number; end: number }) {
  const nodeStream = createReadStream(filePath, range);
  let closed = false;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on("data", (chunk: string | Buffer) => {
        if (!closed) controller.enqueue(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      });
      nodeStream.once("end", () => {
        if (closed) return;
        closed = true;
        controller.close();
      });
      nodeStream.once("error", (error) => {
        if (closed) return;
        closed = true;
        controller.error(error);
      });
    },
    cancel() {
      closed = true;
      nodeStream.destroy();
    },
  });
}

export async function streamMediaFile(request: Request, filePath: string) {
  const file = await stat(filePath);
  const range = request.headers.get("range");
  const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";

  if (!range) {
    const stream = browserStream(filePath);
    return new Response(stream, {
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(file.size),
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const match = /bytes=(\d+)-(\d*)/.exec(range);
  if (!match) return new Response(null, { status: 416 });
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : file.size - 1;
  const end = Math.min(requestedEnd, file.size - 1);
  if (start > end || start >= file.size) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${file.size}` },
    });
  }

  const stream = browserStream(filePath, { start, end });
  return new Response(stream, {
    status: 206,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${file.size}`,
      "Content-Type": contentType,
    },
  });
}
