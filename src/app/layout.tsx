import 'src/global.css';

import type { Metadata } from 'next';

import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';

import { CONFIG } from 'src/config-global';

// ----------------------------------------------------------------------

export const metadata: Metadata = {
  title: `${CONFIG.appName} — ${CONFIG.appTagline}`,
  description: CONFIG.appDescription,
};

type Props = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
