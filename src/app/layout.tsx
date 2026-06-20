import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'ContextCast — AI media intelligence',
  description: 'Timestamped summaries, searchable transcripts, and vertical clips from long-form media.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand" aria-label="ContextCast home">
            Context<span>Cast</span>
          </Link>
          <Link href="/" className="header-action">New upload</Link>
        </header>
        <main className="app-shell">{children}</main>
      </body>
    </html>
  );
}
