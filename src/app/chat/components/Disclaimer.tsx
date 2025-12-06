export function Disclaimer() {
  return (
    <div className="text-xs text-stone-500 mt-2 space-y-0.5 border-t border-stone-200 pt-2">
      <p>This is informational only, not legal advice.</p>
      <p>Current through Sep 30, 2025</p>
      <p>
        Always verify:{' '}
        <a
          href="https://planning.lacity.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          planning.lacity.org
        </a>
      </p>
    </div>
  );
}
