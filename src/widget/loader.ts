/**
 * DocsBot embed loader — paste on any site:
 *   <script src="https://YOUR-APP/widget.js" data-bot-id="BOT_ID" async></script>
 * Renders a floating bubble inside a Shadow DOM (no CSS clashes) and lazily opens the chat in
 * an iframe served by the DocsBot app. The iframe is protected by CSP frame-ancestors, and the
 * config endpoint refuses origins that are not on the bot's allowed-domain list.
 */
type WidgetConfig = { id: string; name: string; brandColor: string; welcomeMessage: string };

declare global {
  interface Window {
    DocsBot?: { open: () => void; close: () => void; toggle: () => void };
    __docsbotLoaded?: Record<string, boolean>;
  }
}

(() => {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>('script[data-bot-id]');
  const botId = script?.dataset.botId;
  if (!script || !botId) return;
  const loaded = (window.__docsbotLoaded ??= {});
  if (loaded[botId]) return;
  loaded[botId] = true;
  const base = new URL(script.src).origin;
  const position = script.dataset.position === 'left' ? 'left' : 'right';

  const icons = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  };

  const css = (color: string) => `
    :host { all: initial; }
    .root { position: fixed; ${position}: 20px; bottom: 20px; z-index: 2147483000; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
    .bubble { width: 56px; height: 56px; border-radius: 50%; border: 0; cursor: pointer; background: ${color}; color: #fff; display: grid; place-items: center; box-shadow: 0 8px 24px rgba(0,0,0,.18), 0 2px 6px rgba(0,0,0,.12); transition: transform .15s ease; }
    .bubble:hover { transform: scale(1.06); }
    .bubble svg { width: 26px; height: 26px; }
    .panel { position: absolute; ${position}: 0; bottom: 72px; width: 380px; height: min(620px, calc(100vh - 110px)); border-radius: 16px; overflow: hidden; background: #fff; box-shadow: 0 24px 64px rgba(0,0,0,.22), 0 4px 16px rgba(0,0,0,.08); opacity: 0; transform: translateY(12px) scale(.98); pointer-events: none; transition: opacity .18s ease, transform .18s ease; }
    .panel.open { opacity: 1; transform: none; pointer-events: auto; }
    .panel iframe { width: 100%; height: 100%; border: 0; display: block; }
    .teaser { position: absolute; ${position}: 0; bottom: 70px; max-width: 260px; background: #fff; color: #18181b; font-size: 14px; line-height: 1.4; padding: 12px 14px; border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.15); cursor: pointer; animation: pop .25s ease; }
    .teaser button { position: absolute; top: -8px; ${position === 'right' ? 'left' : 'right'}: -8px; width: 22px; height: 22px; border-radius: 50%; border: 0; background: #27272a; color: #fff; font-size: 13px; cursor: pointer; line-height: 22px; }
    @keyframes pop { from { opacity: 0; transform: translateY(6px); } }
    @media (max-width: 480px) { .panel { position: fixed; inset: 0; width: 100vw; height: 100dvh; bottom: 0; border-radius: 0; } .root.is-open .bubble { display: none; } }
  `;

  function mount(cfg: WidgetConfig) {
    const host = document.createElement('div');
    host.setAttribute('data-docsbot', cfg.id);
    const shadow = host.attachShadow({ mode: 'open' });
    const color = /^#[0-9a-f]{6}$/i.test(cfg.brandColor) ? cfg.brandColor : '#4f46e5';
    shadow.innerHTML = `<style>${css(color)}</style><div class="root"><div class="panel" role="dialog" aria-label="${cfg.name.replace(/"/g, '')} chat"></div><button class="bubble" aria-label="Open chat" aria-expanded="false">${icons.chat}</button></div>`;
    document.body.appendChild(host);

    const root = shadow.querySelector<HTMLDivElement>('.root')!;
    const panel = shadow.querySelector<HTMLDivElement>('.panel')!;
    const bubble = shadow.querySelector<HTMLButtonElement>('.bubble')!;
    let iframe: HTMLIFrameElement | undefined;
    let iframeReady = false;
    let isOpen = false;
    let teaser: HTMLDivElement | undefined;

    const open = () => {
      teaser?.remove();
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.title = `${cfg.name} chat`;
        iframe.allow = 'clipboard-write';
        iframe.src = `${base}/embed/${encodeURIComponent(cfg.id)}?origin=${encodeURIComponent(location.origin)}`;
        iframe.addEventListener('load', () => {
          iframeReady = true;
          if (isOpen) iframe?.contentWindow?.postMessage({ type: 'docsbot:opened' }, base);
        });
        panel.appendChild(iframe);
      }
      isOpen = true;
      panel.classList.add('open');
      root.classList.add('is-open');
      bubble.innerHTML = icons.close;
      bubble.setAttribute('aria-expanded', 'true');
      bubble.setAttribute('aria-label', 'Close chat');
      if (iframeReady) iframe.contentWindow?.postMessage({ type: 'docsbot:opened' }, base);
    };
    const close = () => {
      isOpen = false;
      panel.classList.remove('open');
      root.classList.remove('is-open');
      bubble.innerHTML = icons.chat;
      bubble.setAttribute('aria-expanded', 'false');
      bubble.setAttribute('aria-label', 'Open chat');
    };
    const toggle = () => (isOpen ? close() : open());
    bubble.addEventListener('click', toggle);
    window.addEventListener('message', (e) => {
      if (e.origin !== base || !iframe || e.source !== iframe.contentWindow) return;
      if ((e.data as { type?: string })?.type === 'docsbot:close') close();
    });
    window.DocsBot = { open, close, toggle };

    // One gentle greeting per browser session.
    try {
      const key = `docsbot:teaser:${cfg.id}`;
      if (!sessionStorage.getItem(key) && script!.dataset.teaser !== 'off') {
        sessionStorage.setItem(key, '1');
        setTimeout(() => {
          if (isOpen) return;
          teaser = document.createElement('div');
          teaser.className = 'teaser';
          teaser.textContent = cfg.welcomeMessage;
          const x = document.createElement('button');
          x.textContent = '×';
          x.setAttribute('aria-label', 'Dismiss');
          x.addEventListener('click', (ev) => {
            ev.stopPropagation();
            teaser?.remove();
          });
          teaser.appendChild(x);
          teaser.addEventListener('click', open);
          root.appendChild(teaser);
        }, 1500);
      }
    } catch {
      /* storage blocked: skip the teaser */
    }
  }

  const start = () =>
    fetch(`${base}/api/v1/bots/${encodeURIComponent(botId)}/widget-config`, { credentials: 'omit' })
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as WidgetConfig & {
          error?: { message?: string };
        };
        if (!r.ok) throw new Error(body.error?.message ?? `HTTP ${r.status}`);
        mount(body);
      })
      .catch((err: Error) => console.warn(`[DocsBot] widget not loaded: ${err.message}`));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

export {};
