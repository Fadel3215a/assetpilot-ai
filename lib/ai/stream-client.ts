import type { AIAnalysis } from "@/types";

export interface StreamHandlers {
  onMeta?: (meta: { model: string; assetId: string; assetName: string }) => void;
  onProgress?: (step: string) => void;
  onChunk?: (text: string) => void;
  onDone?: (analysis: AIAnalysis) => void;
  onError?: (message: string) => void;
}

export interface StreamRequestOptions extends StreamHandlers {
  signal?: AbortSignal;
}

/**
 * POSTs to the SSE analysis route and fans out parsed events to the supplied
 * handlers. Resolves when the stream ends (or rejects on network/parse error).
 *
 * `body` may be either a JSON `{ assetId }` or a `FormData` (multipart upload).
 */
export async function consumeAnalysisStream(
  body: { assetId: string } | FormData,
  handlers: StreamRequestOptions,
): Promise<void> {
  const { onMeta, onProgress, onChunk, onDone, onError, signal } = handlers;

  const isForm = body instanceof FormData;
  const res = await fetch("/api/ai/stream", {
    method: "POST",
    signal,
    headers: isForm ? undefined : { "content-type": "application/json" },
    body: isForm
      ? body
      : JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    let message = `AI stream returned ${res.status}`;
    try {
      const err = await res.json();
      if (err?.error) message = err.error;
    } catch {
      /* ignore */
    }
    onError?.(message);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line.
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const raw of events) {
        const { event, data } = parseSseEvent(raw);
        if (!data) continue;
        try {
          const parsed = JSON.parse(data);
          switch (event) {
            case "meta":
              onMeta?.(parsed);
              break;
            case "progress":
              onProgress?.(parsed.step);
              break;
            case "chunk":
              onChunk?.(parsed.text);
              break;
            case "done":
              onDone?.(parsed);
              break;
            case "error":
              onError?.(parsed.message ?? "AI analysis failed.");
              break;
            default:
              break;
          }
        } catch {
          /* ignore malformed data */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseEvent(raw: string): { event: string; data: string | null } {
  let event = "message";
  let data: string | null = null;
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      data = line.slice("data:".length).trim();
    }
  }
  return { event, data };
}
