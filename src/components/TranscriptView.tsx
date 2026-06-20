"use client";

import { useEffect, useRef } from "react";
import { Play } from "lucide-react";
import type { TranscriptSegment } from "@/lib/types";

interface TranscriptViewProps {
  transcript: TranscriptSegment[];
  currentTime: number;
  onSelect: (segment: TranscriptSegment) => void;
}

export function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
}

export default function TranscriptView({ transcript, currentTime, onSelect }: TranscriptViewProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const activeId = transcript.find((segment) => currentTime >= segment.start && currentTime < segment.end)?.id;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeId]);

  return (
    <div className="transcript-list">
      {transcript.map((segment) => {
        const active = segment.id === activeId;
        return (
          <button
            ref={active ? activeRef : undefined}
            type="button"
            key={segment.id}
            className={`transcript-row ${active ? "active" : ""}`}
            onClick={() => onSelect(segment)}
          >
            <span className="row-time">{active ? <Play size={12} fill="currentColor" /> : null}{formatTime(segment.start)}</span>
            <span>{segment.text}</span>
          </button>
        );
      })}
    </div>
  );
}
