/**
 * Chat UI that runs inside the DocsBot iframe (widget, playground and standalone page).
 * Dependency-free: renders with the shared safe Markdown renderer and streams answers over SSE.
 */
import { citationLabel, escapeHtml, renderMarkdown, type CitationRef } from "../shared/markdown";
import { SseParser } from "../shared/sse";

type Config = {
  botId: string;
  name: string;
  brandColor: string;
  welcomeMessage: string;
  leadCapture: boolean;
  mode: "widget" | "playground" | "standalone";
  pageOrigin: string | null;
  blocked: boolean;
};

type Msg = {
  role: "user" | "assistant";
  text: string;
  citations?: CitationRef[];
  offerLead?: boolean;
  leadDone?: boolean;
  pending?: boolean;
  error?: boolean;
  question?: string;
};

const cfg = JSON.parse(document.getElementById("docsbot-config")!.textContent!) as Config;
const app = document.getElementById("app")!;
const channel = cfg.mode === "playground" ? "playground" : "widget";

// ---- storage (third-party iframes may have storage blocked: fall back to memory) -----------
const memory = new Map<string, string>();
const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return memory.get(k) ?? null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      memory.set(k, v);
    }
  },
  remove(k: string) {
    try {
      localStorage.removeItem(k);
    } catch {
      memory.delete(k);
    }
  },
};
const key = (s: string) => `docsbot:${cfg.botId}:${channel}:${s}`;

function randomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

let visitorId = store.get(`docsbot:${cfg.botId}:visitor`) ?? "";
if (!/^[a-zA-Z0-9_-]{8,64}$/.test(visitorId)) {
  visitorId = randomId();
  store.set(`docsbot:${cfg.botId}:visitor`, visitorId);
}
let conversationId: string | undefined = store.get(key("conversation")) ?? undefined;
let messages: Msg[] = [];
try {
  messages = (JSON.parse(store.get(key("messages")) ?? "[]") as Msg[]).filter((m) => !m.pending).slice(-40);
} catch {
  messages = [];
}
let busy = false;

const persist = () => {
  store.set(key("messages"), JSON.stringify(messages.filter((m) => !m.pending).slice(-40)));
  if (conversationId) store.set(key("conversation"), conversationId);
};

// ---- rendering -------------------------------------------------------------------------------
const icon = {
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 14-7-4 16-3-7-7-2z"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v7H3V3h7"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
};

app.innerHTML = `
  <div class="chat">
    <header class="head">
      <div class="avatar">${escapeHtml(cfg.name.trim().charAt(0).toUpperCase() || "D")}</div>
      <div class="title"><strong>${escapeHtml(cfg.name)}</strong><span>AI assistant · answers from our docs</span></div>
      <button class="icon-btn" data-action="reset" title="New conversation" aria-label="New conversation">${icon.reset}</button>
      ${cfg.mode === "widget" ? `<button class="icon-btn" data-action="close" title="Close" aria-label="Close chat">${icon.close}</button>` : ""}
    </header>
    <div class="log" role="log" aria-live="polite"></div>
    <form class="composer">
      <textarea rows="1" placeholder="Ask a question…" aria-label="Your message" maxlength="2000"></textarea>
      <button type="submit" class="send" aria-label="Send">${icon.send}</button>
    </form>
    <div class="brand">Powered by <b>DocsBot</b></div>
  </div>`;

const log = app.querySelector<HTMLDivElement>(".log")!;
const form = app.querySelector<HTMLFormElement>(".composer")!;
const input = form.querySelector("textarea")!;
const sendBtn = form.querySelector<HTMLButtonElement>(".send")!;

function sourcesHtml(citations: CitationRef[]) {
  if (!citations.length) return "";
  const seen = new Set<string>();
  const items = citations
    .filter((c) => {
      const k = `${c.url ?? c.title}|${c.page ?? ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((c) => {
      const label = escapeHtml(citationLabel(c).replace(/ \| .*$/, ""));
      return c.url && /^https?:\/\//.test(c.url)
        ? `<a class="source" href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer">${icon.link}<span>${label}</span></a>`
        : `<span class="source">${icon.doc}<span>${label}</span></span>`;
    })
    .join("");
  return `<div class="sources"><span class="sources-label">Sources</span>${items}</div>`;
}

function leadHtml(m: Msg, i: number) {
  if (!m.offerLead || !cfg.leadCapture) return "";
  if (m.leadDone) return `<div class="lead done">Thanks! The team will get back to you by email.</div>`;
  return `<form class="lead" data-index="${i}">
    <p>Want a person to follow up? Leave your email and we'll reply.</p>
    <input type="email" name="email" placeholder="you@example.com" required aria-label="Email" maxlength="254">
    <textarea name="question" rows="2" aria-label="Your question" maxlength="2000">${escapeHtml(m.question ?? "")}</textarea>
    <div class="lead-row"><span class="lead-error" role="alert"></span><button type="submit">Send to team</button></div>
  </form>`;
}

function render() {
  const welcome = `<div class="msg assistant"><div class="bubble answer">${renderMarkdown(cfg.welcomeMessage)}</div></div>`;
  const blocked = cfg.blocked ? `<div class="notice">This chat isn't enabled on this website.</div>` : "";
  log.innerHTML =
    welcome +
    blocked +
    messages
      .map((m, i) => {
        if (m.role === "user") return `<div class="msg user"><div class="bubble">${escapeHtml(m.text)}</div></div>`;
        const body = m.pending && !m.text ? `<div class="typing"><span></span><span></span><span></span></div>` : renderMarkdown(m.text, m.citations ?? []);
        return `<div class="msg assistant${m.error ? " error" : ""}"><div class="bubble answer">${body}${m.pending ? "" : sourcesHtml(m.citations ?? [])}</div>${m.pending ? "" : leadHtml(m, i)}</div>`;
      })
      .join("");
  log.scrollTop = log.scrollHeight;
  sendBtn.disabled = busy || cfg.blocked;
  input.disabled = cfg.blocked;
}

// ---- networking ------------------------------------------------------------------------------
async function ask(question: string) {
  busy = true;
  messages.push({ role: "user", text: question });
  const reply: Msg = { role: "assistant", text: "", pending: true, question };
  messages.push(reply);
  render();

  try {
    const res = await fetch("/api/v1/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ botId: cfg.botId, message: question, conversationId, visitorId, channel, pageOrigin: cfg.pageOrigin ?? undefined }),
    });
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(body.error?.message ?? "Something went wrong. Please try again.");
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    let frame = 0;
    const scheduleRender = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        render();
      });
    };
    for (;;) {
      const { done, value } = await reader.read();
      const events = done ? parser.end() : parser.push(decoder.decode(value, { stream: true }));
      for (const ev of events) {
        const data = JSON.parse(ev.data) as Record<string, unknown>;
        if (ev.event === "meta") conversationId = data.conversationId as string;
        else if (ev.event === "token") {
          reply.text += data.text as string;
          scheduleRender();
        } else if (ev.event === "done") {
          if (typeof data.replaceWith === "string") reply.text = data.replaceWith;
          reply.citations = data.citations as CitationRef[];
          reply.offerLead = Boolean(data.offerLead);
          reply.pending = false;
        } else if (ev.event === "error") throw new Error((data.message as string) ?? "Something went wrong.");
      }
      if (done) break;
    }
    reply.pending = false;
  } catch (err) {
    reply.pending = false;
    reply.error = true;
    reply.text = (err as Error).message || "Network error. Please try again.";
  } finally {
    busy = false;
    persist();
    render();
    input.focus();
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q || busy || cfg.blocked) return;
  input.value = "";
  input.style.height = "";
  void ask(q);
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
});

log.addEventListener("submit", async (e) => {
  const target = e.target as HTMLFormElement;
  if (!target.classList.contains("lead")) return;
  e.preventDefault();
  const msg = messages[Number(target.dataset.index)];
  const data = new FormData(target);
  const error = target.querySelector<HTMLSpanElement>(".lead-error")!;
  const button = target.querySelector("button")!;
  button.disabled = true;
  error.textContent = "";
  try {
    const res = await fetch("/api/v1/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ botId: cfg.botId, conversationId, email: data.get("email"), question: data.get("question") || msg?.question || "(no question)" }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; details?: Record<string, string> } };
      throw new Error(body.error?.details?.email ?? body.error?.message ?? "Could not send. Please try again.");
    }
    if (msg) msg.leadDone = true;
    persist();
    render();
  } catch (err) {
    error.textContent = (err as Error).message;
    button.disabled = false;
  }
});

app.addEventListener("click", (e) => {
  const action = (e.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset.action;
  if (action === "close") window.parent.postMessage({ type: "docsbot:close" }, "*");
  if (action === "reset") {
    messages = [];
    conversationId = undefined;
    store.remove(key("messages"));
    store.remove(key("conversation"));
    render();
    input.focus();
  }
});

window.addEventListener("message", (e) => {
  if ((e.data as { type?: string })?.type === "docsbot:opened") input.focus();
});

render();
