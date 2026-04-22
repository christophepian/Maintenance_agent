import Link from 'next/link';
import { useRouter } from 'next/router';
import { cn } from '../../lib/utils';
import BottomSheet from './BottomSheet';

/**
 * NavDrawer — slide-up navigation overlay for overflow items in BottomNav.
 *
 * Renders as a BottomSheet pre-configured for navigation rows.
 * Each item is a full-width tappable row with icon and label.
 * Auto-closes when the user taps a navigation link.
 *
 * Props:
 *   open    — boolean controlling visibility
 *   onClose — callback fired when the drawer should close
 *   items   — Array<{ href: string, icon: ReactNode (component), label: string }>
 */
export default function NavDrawer({ open, onClose, items = [] }) {
  const router = useRouter();
  const pathname = router.asPath.split('?')[0];

  function isActive(href) {
    const rootPages = ['/manager', '/owner', '/contractor', '/tenant'];
    if (rootPages.includes(href)) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="More">
      <nav aria-label="Overflow navigation" className="flex flex-col gap-1 -mx-5 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-4 px-4 py-3.5 rounded-xl no-underline',
                'text-sm font-medium transition-colors min-h-[44px]',
                active
                  ? 'bg-brand-light text-brand-dark'
                  : 'text-slate-700 hover:bg-slate-50',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                size={20}
                className={cn('shrink-0', active ? 'text-brand' : 'text-slate-400')}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </BottomSheet>
  );
}
