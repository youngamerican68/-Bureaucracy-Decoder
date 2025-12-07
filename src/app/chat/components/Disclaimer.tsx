import Link from 'next/link';

export function Disclaimer() {
  return (
    <div className="text-xs text-stone-500 mt-2 border-t border-stone-200 pt-2">
      <p>
        Informational only — not legal advice. Verify with{' '}
        <a
          href="https://codelibrary.amlegal.com/codes/los_angeles"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-600 hover:underline"
        >
          official sources
        </a>
        .{' '}
        <Link href="/terms" className="text-amber-600 hover:underline">
          Terms
        </Link>
      </p>
    </div>
  );
}
