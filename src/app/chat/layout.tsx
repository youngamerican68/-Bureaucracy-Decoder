'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamically import UserButton to avoid SSR issues when Clerk isn't configured
const UserButton = dynamic(
  () => import('@clerk/nextjs').then(mod => mod.UserButton),
  {
    ssr: false,
    loading: () => <div className="w-8 h-8 rounded-full bg-stone-200 animate-pulse" />
  }
);

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="h-16 border-b border-stone-200 bg-white flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-stone-800">Compliance Compass</span>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            LA
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/analyze"
            className="text-sm text-stone-600 hover:text-stone-900"
          >
            Full Analysis
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
