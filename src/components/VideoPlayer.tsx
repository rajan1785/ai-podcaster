"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Expand, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";

interface VideoPlayerProps {
  src: string;
  fileName: string;
  onTimeUpdate: (time: number, duration: number) => void;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

const audioExtensions = /\.(mp3|m4a|wav|ogg)$/i;

const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, fileName, onTimeUpdate }, ref) => {
    const shellRef = useRef<HTMLDivElement>(null);
    const internalRef = useRef<HTMLVideoElement | null>(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [rate, setRate] = useState(1);
    const isAudio = audioExtensions.test(fileName);

    useEffect(() => {
      const media = internalRef.current;
      if (!media) return;
      const syncMetadata = () => {
        if (Number.isFinite(media.duration)) setDuration(media.duration);
        setCurrentTime(media.currentTime);
      };
      syncMetadata();
      media.addEventListener("loadedmetadata", syncMetadata);
      media.addEventListener("durationchange", syncMetadata);
      return () => {
        media.removeEventListener("loadedmetadata", syncMetadata);
        media.removeEventListener("durationchange", syncMetadata);
      };
    }, [src]);

    const attachRef = (node: HTMLVideoElement | null) => {
      internalRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    const togglePlayback = async () => {
      const media = internalRef.current;
      if (!media) return;
      if (media.paused) await media.play();
      else media.pause();
    };

    const seekBy = (amount: number) => {
      if (!internalRef.current) return;
      internalRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + amount));
    };

    const cycleRate = () => {
      const next = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : rate === 1.5 ? 2 : 1;
      setRate(next);
      if (internalRef.current) internalRef.current.playbackRate = next;
    };

    return (
      <div ref={shellRef} className={`media-player ${isAudio ? "audio-player" : ""}`}>
        {isAudio ? (
          <div className="audio-art" aria-hidden="true">
            <span>ContextCast</span>
            <div className="audio-bars">{Array.from({ length: 32 }, (_, index) => <i key={index} />)}</div>
            <strong>{fileName}</strong>
          </div>
        ) : null}
        <video
          ref={attachRef}
          src={src}
          preload="metadata"
          playsInline
          onClick={togglePlayback}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onTimeUpdate={(event) => {
            const media = event.currentTarget;
            setCurrentTime(media.currentTime);
            setDuration(media.duration || 0);
            onTimeUpdate(media.currentTime, media.duration || 0);
          }}
        >
          Your browser does not support HTML5 media playback.
        </video>
        <div className="player-controls">
          <div className="timeline-row">
            <span className="accent-time">{formatTime(currentTime)}</span>
            <span>/ {formatTime(duration)}</span>
            <input
              aria-label="Media progress"
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              style={{ "--player-progress": `${duration ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (internalRef.current) internalRef.current.currentTime = next;
                setCurrentTime(next);
              }}
            />
          </div>
          <div className="control-row">
            <div>
              <button type="button" onClick={() => seekBy(-10)} aria-label="Back 10 seconds"><RotateCcw /></button>
              <button type="button" className="play-control" onClick={togglePlayback} aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
              </button>
              <button type="button" onClick={() => seekBy(10)} aria-label="Forward 10 seconds"><RotateCw /></button>
            </div>
            <div>
              <button type="button" onClick={() => {
                const media = internalRef.current;
                if (!media) return;
                media.muted = !media.muted;
                setMuted(media.muted);
              }} aria-label={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX /> : <Volume2 />}</button>
              <button type="button" className="rate-button" onClick={cycleRate}>{rate}×</button>
              <button type="button" onClick={() => shellRef.current?.requestFullscreen()} aria-label="Enter fullscreen"><Expand /></button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

VideoPlayer.displayName = "VideoPlayer";
export default VideoPlayer;
