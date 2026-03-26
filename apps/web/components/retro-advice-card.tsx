"use client";

import { useState, useRef } from "react";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface StoryContext {
  title: string;
  storyPoints: number;
  status: string;
  category: string;
  devHours?: number;
  testHours?: number;
}

interface SprintContext {
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  plannedPoints: number;
  stories: StoryContext[];
}

interface RetroAdviceCardProps {
  sprints: SprintContext[];
}

export function RetroAdviceCard({ sprints }: RetroAdviceCardProps) {
  const [advice, setAdvice] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  async function fetchAdvice() {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setAdvice("");
    setExpanded(true);

    try {
      const res = await fetch("/api/retro-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sprints }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        setAdvice(buffer);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message || "Failed to get advice");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-indigo-100 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-indigo-900">AI Retrospective Advisor</h3>
          <span className="text-xs text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full">
            Powered by Claude
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAdvice}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            {advice ? "Regenerate" : "Analyse"}
          </button>
          {advice && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-indigo-400 hover:text-indigo-600 transition-colors"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-5 py-4">
          {!advice && !loading && !error && (
            <p className="text-sm text-gray-400 text-center py-6">
              Click <strong>Analyse</strong> to get AI-powered retrospective insights based on your sprint data.
            </p>
          )}

          {loading && !advice && (
            <div className="flex items-center gap-3 py-6 justify-center">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
              <span className="text-sm text-gray-400">Analysing sprint data…</span>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {advice && (
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
              <MarkdownRenderer content={advice} />
              {loading && (
                <span className="inline-block w-1.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-base font-semibold text-gray-900 mt-4 mb-1 first:mt-0">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-lg font-bold text-gray-900 mt-4 mb-2 first:mt-0">
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2 text-gray-600">
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-gray-700 my-1">
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
