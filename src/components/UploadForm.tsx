"use client";

import { useRef, useState } from "react";
import { AlertCircle, ArrowUp, FileAudio, FileVideo, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";

const MAX_SIZE = 500 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const selectFile = (nextFile?: File) => {
    setError("");
    if (!nextFile) return;
    if (!nextFile.type.startsWith("video/") && !nextFile.type.startsWith("audio/")) {
      setError("Choose a supported video or audio file.");
      return;
    }
    if (nextFile.size > MAX_SIZE) {
      setError("That file is larger than the 500 MB upload limit.");
      return;
    }
    setFile(nextFile);
  };

  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("media", file);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const raw = await response.text();
      let data: { jobId?: string; error?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        // Non-JSON body (e.g. a platform "Request Entity Too Large" page).
        throw new Error(
          response.status === 413
            ? "This file is too large for this server. Try a smaller file, or use the full deployment."
            : `Upload failed (${response.status}). The server could not process this file.`,
        );
      }
      if (!response.ok) throw new Error(data.error || `Upload failed (${response.status})`);
      if (!data.jobId) throw new Error("Upload failed: the server did not start a job.");
      router.push(`/processing/${data.jobId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed");
      setUploading(false);
    }
  };

  return (
    <section className="upload-surface">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg"
        hidden
        onChange={(event) => selectFile(event.target.files?.[0])}
      />
      {file ? (
        <div className="selected-file">
          <div className="file-icon">
            {file.type.startsWith("video/") ? <FileVideo /> : <FileAudio />}
          </div>
          <div>
            <strong>{file.name}</strong>
            <span>{formatBytes(file.size)} · ready to analyze</span>
          </div>
          <button type="button" className="icon-button" onClick={() => setFile(null)} aria-label="Remove file">
            <X size={18} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`drop-zone ${dragging ? "is-dragging" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            selectFile(event.dataTransfer.files[0]);
          }}
        >
          <span className="upload-arrow"><ArrowUp size={24} /></span>
          <strong>Drop a video or audio file here</strong>
          <span>MP4, MOV, WebM, MP3, M4A or WAV · 30 minutes max</span>
        </button>
      )}

      {error ? <p className="form-error"><AlertCircle size={16} />{error}</p> : null}

      <button type="button" className="primary-action" disabled={!file || uploading} onClick={upload}>
        {uploading ? <><LoaderCircle className="spin" size={18} /> Uploading media…</> : "Analyze media"}
      </button>
      <p className="privacy-note">Your upload stays private and is never used for model training.</p>
    </section>
  );
}
