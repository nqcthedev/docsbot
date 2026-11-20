import { paths } from 'src/routes/paths';

import { CONFIG } from 'src/config-global';

// ----------------------------------------------------------------------

export function MainFooter() {
  return (
    <footer className="border-t border-zinc-100 py-8 text-center text-sm text-zinc-500">
      {`Built by ${CONFIG.author} — full stack & AI developer. `}
      <a
        href={paths.hire}
        className="font-medium text-brand-600 hover:underline"
        target="_blank"
        rel="noreferrer"
      >
        Available for hire on Fiverr
      </a>
    </footer>
  );
}
