import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  Wrench,
  Building2,
  Wallet,
  Users,
  KeyRound,
  Settings,
  ClipboardCheck,
  FileText,
  BarChart2,
  Landmark,
  Receipt,
  FileSearch,
  Inbox,
  Home,
  Search,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import NavDrawer from './NavDrawer';

/**
 * Per-role bottom navigation configuration.
 * Primary items (up to 5) are shown in the tab bar.
 * moreItems appear in the NavDrawer opened by the "More" tab.
 */
const ROLE_NAV = {
  MANAGER: {
    items: [
      { href: '/manager',           icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/manager/requests',  icon: Wrench,          label: 'Requests'  },
      { href: '/manager/inventory', icon: Building2,       label: 'Inventory' },
      { href: '/manager/finance',   icon: Wallet,          label: 'Finances'  },
      { href: '/manager/people',    icon: Users,           label: 'People'    },
    ],
    moreItems: [
      { href: '/manager/leases',   icon: KeyRound, label: 'Leases'   },
      { href: '/manager/settings', icon: Settings, label: 'Settings' },
    ],
  },
  OWNER: {
    items: [
      { href: '/owner',             icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/owner/approvals',   icon: ClipboardCheck,  label: 'Approvals' },
      { href: '/owner/invoices',    icon: FileText,        label: 'Invoices'  },
      { href: '/owner/reporting',   icon: BarChart2,       label: 'Reporting' },
      { href: '/owner/finance',     icon: Landmark,        label: 'Finance'   },
    ],
    moreItems: [
      { href: '/owner/properties', icon: Building2, label: 'Properties' },
    ],
  },
  CONTRACTOR: {
    items: [
      { href: '/contractor',          icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/contractor/jobs',     icon: Wrench,          label: 'Jobs'      },
      { href: '/contractor/invoices', icon: Receipt,         label: 'Invoices'  },
      { href: '/contractor/rfps',     icon: FileSearch,      label: 'RFPs'      },
    ],
    moreItems: [],
  },
  TENANT: {
    items: [
      { href: '/tenant',          icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/tenant/requests', icon: Wrench,          label: 'Requests'  },
      { href: '/tenant/leases',   icon: Home,            label: 'My Home'   },
      { href: '/tenant/inbox',    icon: Inbox,           label: 'Inbox'     },
      { href: '/listings',        icon: Search,          label: 'Apply'     },
    ],
    moreItems: [],
  },
};

/**
 * BottomNav — fixed bottom navigation bar for mobile (< 768px).
 * Hidden on desktop via md:hidden. Renders for all four roles.
 *
 * Props:
 *   role — 'MANAGER' | 'OWNER' | 'CONTRACTOR' | 'TENANT'
 */
export default function BottomNav({ role }) {
  const router = useRouter();
  const pathname = router.asPath.split('?')[0];
  const [drawerOpen, setDrawerOpen] = useState(false);

  const config = ROLE_NAV[role];
  if (!config) return null;

  const { items, moreItems } = config;
  const hasMore = moreItems.length > 0;

  function isActive(href) {
    // Exact match for root role pages (e.g. /manager, /owner) to avoid
    // shadowing child routes like /manager/requests
    const rootPages = ['/manager', '/owner', '/contractor', '/tenant'];
    if (rootPages.includes(href)) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className={cn(
          'md:hidden fixed bottom-0 left-0 right-0 z-40',
          'h-20 bg-white border-t border-slate-200',
          'flex items-stretch',
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px]',
                'text-[10px] font-medium transition-colors no-underline',
                active ? 'text-brand' : 'text-slate-500',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                size={22}
                className={cn('shrink-0', active ? 'text-brand' : 'text-slate-400')}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {hasMore && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px]',
              'text-[10px] font-medium text-slate-500 bg-transparent border-0 cursor-pointer',
              drawerOpen && 'text-brand',
            )}
            aria-label="More navigation options"
          >
            <MoreHorizontal
              size={22}
              className={cn('shrink-0', drawerOpen ? 'text-brand' : 'text-slate-400')}
              aria-hidden="true"
            />
            <span>More</span>
          </button>
        )}
      </nav>

      {hasMore && (
        <NavDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          items={moreItems}
        />
      )}
    </>
  );
}
