import PlayerContainer from "@/components/PlayerContainer";
import { showcaseResult } from "@/lib/demo-data";

export default function DemoPage() {
  return (
    <PlayerContainer
      jobId="showcase"
      videoUrl="/uploads/1781975169643-create-psd.mp4"
      fileName="ContextCast sample analysis.mp4"
      result={showcaseResult}
    />
  );
}
