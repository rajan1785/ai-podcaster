"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Copy, Search } from "lucide-react";
import type { AnalysisResult, TranscriptSegment } from "@/lib/types";
import ChatInterface from "@/components/ChatInterface";
import TranscriptView from "@/components/TranscriptView";
import VideoPlayer from "@/components/VideoPlayer";
import ViralClips from "@/components/ViralClips";

interface PlayerContainerProps {
  jobId: string;
  videoUrl: string;
  fileName: string;
  result?: AnalysisResult;
}

export default function PlayerContainer({ jobId, videoUrl, fileName, result }: PlayerContainerProps) {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activePanel, setActivePanel] = useState<"transcript" | "chat">("transcript");
  const [anchorTime, setAnchorTime] = useState<number>();
  const [copied, setCopied] = useState(false);

  if (!result) return <div className="empty-state"><h1>Analysis is not ready</h1><p>Return to the processing page and try again.</p></div>;

  const seek = (time: number) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = time;
    void mediaRef.current.play();
    setCurrentTime(time);
  };

  const selectTranscript = (segment: TranscriptSegment) => {
    setAnchorTime(segment.start);
    seek(segment.start);
  };

  return (
    <div className="workspace">
      <div className="workspace-title">
        <div><h1>{fileName}</h1><p>{result.chapters.length} chapters · {result.transcript.length} aligned segments</p></div>
        {result.analysisMode === "demo" ? <span className="mode-label">Demo analysis · add OPENAI_API_KEY for live AI</span> : null}
      </div>

      <div className="workspace-grid">
        <div className="media-column">
          <VideoPlayer ref={mediaRef} src={videoUrl} fileName={fileName} onTimeUpdate={(time) => setCurrentTime(time)} />
          <section className="summary-section">
            <div className="section-heading">
              <div><h2>AI summary</h2><p>{result.summary}</p></div>
              <button type="button" className="secondary-action" onClick={async () => {
                await navigator.clipboard.writeText(result.summary);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}>{copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy summary"}</button>
            </div>
            <div className="chapter-rail">
              {result.chapters.map((chapter) => (
                <button key={`${chapter.start}-${chapter.title}`} type="button" onClick={() => seek(chapter.start)}>
                  <span>{Math.floor(chapter.start / 60)}:{Math.floor(chapter.start % 60).toString().padStart(2, "0")}</span>
                  <strong>{chapter.title}</strong>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="insight-panel">
          <div className="panel-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={activePanel === "transcript"} onClick={() => setActivePanel("transcript")}>Transcript</button>
            <button type="button" role="tab" aria-selected={activePanel === "chat"} onClick={() => setActivePanel("chat")}>Ask AI</button>
          </div>
          <div className="panel-body">
            {activePanel === "transcript" ? (
              <TranscriptView transcript={result.transcript} currentTime={currentTime} onSelect={selectTranscript} />
            ) : (
              <ChatInterface jobId={jobId} anchorTime={anchorTime} onSeek={seek} />
            )}
          </div>
          <div className="panel-status">
            <span><i /><CheckCircle2 size={14} />Whisper aligned</span>
            <span><Search size={14} />Hybrid search<i /></span>
          </div>
        </aside>
      </div>

      <ViralClips jobId={jobId} clips={result.viralClips} onSeek={seek} />
    </div>
  );
}
