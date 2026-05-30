import { useRouter } from 'next/router';
import { cn } from '../lib/utils';

/**
 * Compact locale toggle — globe icon + current locale code.
 * Cycles through LOCALES on each click.
 * Add entries to LOCALES when DE / IT are added to next-i18next.config.js.
 */
const LOCALES = ['en', 'fr'];
// const LOCALES = ['en', 'fr', 'de', 'it'];

export default function LocaleSwitcher() {
  const router = useRouter();
  const current = router.locale || 'en';

  function handleClick() {
    const next = LOCALES[(LOCALES.indexOf(current) + 1) % LOCALES.length];
    router.push(router.asPath, undefined, { locale: next });
  }

  return (
    <button
      onClick={handleClick}
      aria-label={`Switch language, current: ${current.toUpperCase()}`}
      className={cn(
        'flex items-center gap-1 rounded-full px-2 py-1',
        'text-xs font-semibold text-muted hover:text-foreground',
        'hover:bg-surface-hover transition-colors focus-visible:ring focus-visible:ring-blue-500'
      )}
    >
      {/* Globe icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20A14.5 14.5 0 0 0 12 2z" />
        <path d="M2 12h20" />
      </svg>
      <span>{current.toUpperCase()}</span>
    </button>
  );
}

