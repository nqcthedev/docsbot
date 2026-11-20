/**
 * Incremental Server-Sent Events parser. Used both server-side (provider streams)
 * and in the browser widget (our own /api/v1/chat stream).
 */
export type SseEvent = { event: string; data: string };

export class SseParser {
  private buffer = "";
  private dataLines: string[] = [];
  private eventName = "message";

  /** Feed a decoded text chunk; returns the events completed by it. */
  push(chunk: string): SseEvent[] {
    this.buffer += chunk;
    const out: SseEvent[] = [];
    let idx: number;
    while ((idx = this.buffer.search(/\r\n|\n|\r/)) !== -1) {
      const line = this.buffer.slice(0, idx);
      const sepLen = this.buffer.startsWith("\r\n", idx) ? 2 : 1;
      this.buffer = this.buffer.slice(idx + sepLen);
      if (line === "") {
        if (this.dataLines.length) out.push({ event: this.eventName, data: this.dataLines.join("\n") });
        this.dataLines = [];
        this.eventName = "message";
        continue;
      }
      if (line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "data") this.dataLines.push(value);
      else if (field === "event") this.eventName = value;
    }
    return out;
  }

  /** Flush a trailing event that was not terminated by a blank line. */
  end(): SseEvent[] {
    const out = this.buffer ? this.push("\n\n") : [];
    if (this.dataLines.length) out.push({ event: this.eventName, data: this.dataLines.join("\n") });
    this.dataLines = [];
    return out;
  }
}

export async function* readSse(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  try {
    while (true) {
      if (signal?.aborted) throw signal.reason ?? new Error("aborted");
      const { done, value } = await reader.read();
      if (done) break;
      for (const ev of parser.push(decoder.decode(value, { stream: true }))) yield ev;
    }
    for (const ev of parser.push(decoder.decode())) yield ev;
    for (const ev of parser.end()) yield ev;
  } finally {
    reader.releaseLock();
  }
}

export function encodeSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
