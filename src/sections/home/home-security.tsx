import { ShieldCheck } from 'lucide-react';

// ----------------------------------------------------------------------

const SAFEGUARDS = [
  'Postgres + pgvector with hybrid (vector + full-text) search',
  'Per-IP and per-bot rate limits on the public chat API',
  'Widget locked to your domains with CSP frame-ancestors',
  'SSRF-safe crawler that refuses private network addresses',
  'scrypt-hashed passwords and httpOnly session cookies',
  'Prompt-injection hardening: documents are data, not instructions',
];

// ----------------------------------------------------------------------

export function HomeSecurity() {
  return (
    <section id="security" className="border-t border-zinc-100 bg-zinc-50/60 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-6 text-brand-600" />
          <h2 className="text-3xl font-semibold tracking-tight">Production-minded by default</h2>
        </div>
        <ul className="mt-8 grid gap-4 text-sm text-zinc-700 sm:grid-cols-2 lg:grid-cols-3">
          {SAFEGUARDS.map((safeguard) => (
            <li
              key={safeguard}
              className="flex gap-2 rounded-xl border border-zinc-200 bg-white p-4"
            >
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand-500" />
              {safeguard}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
