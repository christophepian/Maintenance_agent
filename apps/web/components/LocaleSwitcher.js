import { useRouter } from 'next/router';
import { cn } from '../lib/utils';

/**
 * Locale switcher dropdown.
 * Extend LOCALE_LABELS when DE / IT are added to next-i18next.config.js —
 * no other change needed.
 */
const LOCALE_LABELS = {
  en: 'English',
  fr: 'Français',
  // de: 'Deutsch',
  // it: 'Italiano',
};

export default function LocaleSwitcher() {
  const router = useRouter();

  function handleChange(e) {
    router.push(router.asPath, undefined, { locale: e.target.value });
  }

  return (
    <select
      value={router.locale || 'en'}
      onChange={handleChange}
      aria-label="Select language"
      className={cn(
        'text-sm bg-transparent border border-slate-300 rounded px-2 py-1',
        'cursor-pointer focus-visible:ring focus-visible:ring-blue-500',
        'text-slate-700 hover:border-slate-400 transition-colors'
      )}
    >
      {Object.entries(LOCALE_LABELS).map(([code, label]) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
}
