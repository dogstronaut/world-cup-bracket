import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Miranda & Friends Family World Cup Bracket 🏆',
  description: 'Who knows the beautiful game best? Fill out your 2026 World Cup knockout bracket!',
  openGraph: {
    title: 'Miranda & Friends Family World Cup Bracket',
    description: 'Who knows the beautiful game best?',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a1628] text-white">
        <header className="bg-[#050d1a] border-b border-[#1a3a60] sticky top-0 z-50 shadow-lg">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="flex flex-col items-center text-center">
              {/* Family badge */}
              <span className="text-xs font-semibold bg-[#FFD700] text-[#050d1a] rounded-full px-3 py-0.5 mb-2 tracking-wide">
                👨‍👩‍👧‍👦 Family Bracket Challenge
              </span>
              {/* Main title */}
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                ⚽ Miranda &amp; Friends{' '}
                <span className="text-[#FFD700]">World Cup</span>{' '}
                Knockout Bracket 🏆
              </h1>
              {/* Subheadline */}
              <p className="text-sm text-[#8899aa] mt-1 font-medium">
                Who knows the beautiful game best?
              </p>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          {children}
        </main>

        <footer className="mt-12 pb-8 text-center text-[#8899aa] text-xs">
          <p>⚽ 2026 FIFA World Cup • USA • Canada • Mexico</p>
          <p className="mt-1">June 28 – July 19, 2026</p>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
