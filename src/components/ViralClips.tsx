"use client";

import { Play } from "lucide-react";
import type { ViralClip } from "@/lib/types";
import { formatTime } from "@/components/TranscriptView";

interface ViralClipsProps {
  jobId: string;
  clips: ViralClip[];
  onSeek: (time: number) => void;
}

export default function ViralClips({ jobId, clips, onSeek }: ViralClipsProps) {
  if (!clips.length) return null;
  return (
    <section className="viral-section">
      <div className="section-heading">
        <div><h2>Viral moments</h2><p>Short-form candidates ranked by hook, clarity, and standalone value.</p></div>
      </div>
      <div className="clip-grid">
        {clips.map((clip) => (
          <article className="clip-card" key={clip.id}>
            <button type="button" className="clip-preview" onClick={() => onSeek(clip.start)} aria-label={`Play ${clip.title}`}>
              {clip.assetPath ? (
                <video src={`/api/clip/${jobId}/${clip.id}`} muted playsInline preload="metadata" />
              ) : <div className="clip-placeholder" />}
              <span className="clip-play"><Play size={16} fill="currentColor" /></span>
              <strong>{clip.hook}</strong>
              <small>{Math.max(1, Math.round(clip.end - clip.start))}s</small>
            </button>
            <div className="clip-copy">
              <div>
                <h3>{clip.title}</h3>
                <p>{formatTime(clip.start)} – {formatTime(clip.end)}</p>
              </div>
              <span><b>{clip.score}</b>/100</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
