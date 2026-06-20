"use client";

import { FormEvent, useState } from "react";
import { ArrowUp, LoaderCircle } from "lucide-react";
import { formatTime } from "@/components/TranscriptView";

interface ChatInterfaceProps {
  jobId: string;
  anchorTime?: number;
  onSeek: (time: number) => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp?: number;
}

export default function ChatInterface({ jobId, anchorTime, onSeek }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", text: "Ask about an idea, quote, or moment. I’ll answer from the transcript and cite the closest timestamp." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const query = input.trim();
    if (!query || loading) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: query }]);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, query, anchorTime }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The search failed");
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: data.reply,
        timestamp: data.timestamp,
      }]);
    } catch (caught) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: caught instanceof Error ? caught.message : "The search failed",
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-interface">
      {anchorTime !== undefined ? (
        <div className="chat-scope">Focused near {formatTime(anchorTime)} · ±90 seconds</div>
      ) : null}
      <div className="message-list" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <p>{message.text}</p>
            {message.timestamp !== undefined ? (
              <button type="button" onClick={() => onSeek(message.timestamp!)}>
                Jump to {formatTime(message.timestamp)}
              </button>
            ) : null}
          </div>
        ))}
        {loading ? <LoaderCircle className="spin chat-loader" size={20} /> : null}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <textarea
          rows={2}
          value={input}
          placeholder="Ask a question about this media…"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button type="submit" disabled={!input.trim() || loading} aria-label="Send question"><ArrowUp size={18} /></button>
      </form>
    </div>
  );
}
