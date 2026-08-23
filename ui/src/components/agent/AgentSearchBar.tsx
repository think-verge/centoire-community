import { useEffect, useRef, useState } from "react";
import { useAgentSearchQuery } from "../../lib/api/generated/agent/agent";
import type { AgentSearchFilters } from "../../lib/api/generated/model";

interface SpeechRecognitionResultLike {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

interface AgentSearchBarProps {
  onResult: (filters: AgentSearchFilters) => void;
}

export function AgentSearchBar({ onResult }: AgentSearchBarProps) {
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const interpret = useAgentSearchQuery({
    mutation: { onSuccess: onResult },
  });

  const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  const voiceSupported = Boolean(SpeechRecognitionCtor);

  useEffect(() => {
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setQuery(transcript);
        interpret.mutate({ data: { query: transcript } });
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    interpret.mutate({ data: { query: query.trim() } });
  }

  function toggleListening() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="flex w-full items-center gap-2 rounded-full border border-line bg-paper px-2 py-1.5 pl-5 shadow-card">
      <SparkleIcon className="size-4 shrink-0 text-crimson" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask anything — “what's happening in fashion technology in China?”"
        className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
      />
      {voiceSupported && (
        <button
          type="button"
          onClick={toggleListening}
          aria-pressed={listening}
          aria-label={listening ? "Stop voice input" : "Start voice input"}
          className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${
            listening ? "bg-crimson text-ink-inverse" : "text-ink-faint hover:bg-cream hover:text-ink"
          }`}
        >
          <MicIcon className="size-4" />
        </button>
      )}
      <button
        type="submit"
        disabled={interpret.isPending || !query.trim()}
        className="shrink-0 rounded-full bg-crimson px-4 py-2 text-sm font-semibold text-ink-inverse transition-opacity hover:bg-crimson-deep disabled:opacity-50"
      >
        {interpret.isPending ? "Thinking…" : "Ask"}
      </button>
      </form>
      {interpret.error && (
        <p className="mt-2 px-5 text-sm text-crimson">
          {interpret.error.message || "Couldn't understand that search — try again."}
        </p>
      )}
    </div>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2l1.8 5.6L19.4 9.4 13.8 11.2 12 17l-1.8-5.8L4.6 9.4l5.6-1.8Z" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M9 22h6" />
    </svg>
  );
}
