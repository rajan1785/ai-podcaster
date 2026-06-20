"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import type { JobStatus, ProcessingStage } from "@/lib/types";

const stages: Array<{ key: ProcessingStage; label: string }> = [
  { key: "probing", label: "Inspect media" },
  { key: "extracting-audio", label: "Extract audio" },
  { key: "transcribing", label: "Align transcript" },
  { key: "indexing", label: "Build search index" },
  { key: "analyzing", label: "Find key moments" },
  { key: "rendering-clips", label: "Render clips" },
];

export default function ProcessingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<JobStatus>("pending");
  const [stage, setStage] = useState<ProcessingStage>("queued");
  const [stageLabel, setStageLabel] = useState("Waiting for a worker");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const response = await fetch(`/api/job/${id}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load this job");
        if (stopped) return;
        setProgress(data.progress);
        setStatus(data.status);
        setStage(data.stage);
        setStageLabel(data.stageLabel);
        if (data.status === "completed") {
          router.replace(`/player/${id}`);
          return;
        }
        if (data.status === "failed") {
          setError(data.error || "Processing failed");
          return;
        }
        timer = setTimeout(poll, 1000);
      } catch (caught) {
        if (!stopped) {
          setError(caught instanceof Error ? caught.message : "Unable to check progress");
          timer = setTimeout(poll, 3000);
        }
      }
    };

    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [id, router]);

  const activeIndex = Math.max(0, stages.findIndex((item) => item.key === stage));

  return (
    <div className="processing-page">
      <section className="processing-card">
        {status === "failed" ? (
          <div className="processing-symbol error"><AlertCircle size={30} /></div>
        ) : (
          <div className="processing-symbol"><LoaderCircle className="spin" size={30} /></div>
        )}
        <h1>{status === "failed" ? "Analysis stopped" : "Building your media workspace"}</h1>
        <p>{status === "failed" ? error : stageLabel}</p>

        <div className="progress-track" aria-label={`${progress}% complete`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <strong className="progress-value">{progress}%</strong>

        <ol className="stage-list">
          {stages.map((item, index) => {
            const complete = index < activeIndex || status === "completed";
            const active = index === activeIndex && status !== "failed";
            return (
              <li key={item.key} className={active ? "active" : complete ? "complete" : ""}>
                <span>{complete ? <Check size={14} /> : index + 1}</span>
                {item.label}
              </li>
            );
          })}
        </ol>
        <p className="processing-note">You can leave this tab open. The worker will continue safely in the background.</p>
      </section>
    </div>
  );
}
