import './globals.css';

import type { Metadata } from 'next';

import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';

export const metadata: Metadata = {
  title: { default: 'DocsBot — AI support chatbot trained on your docs', template: '%s · DocsBot' },
  description:
    'Train a support chatbot on your website, PDFs and FAQs. Grounded answers with citations, lead capture and analytics. Embed it with one line.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
