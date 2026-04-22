import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  Wrench,
  KeyRound,
  Wallet,
  Users,
  Building2,
  Settings,
} from "lucide-react";

/**
 * Manager sidebar — flat 7-item primary navigation.
 * Sub-sections live as in-page tab strips on each page.
 */
const MANAGER_NAV = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/manager" },
  { label: "Inventory", icon: Building2, href: "/manager/inventory" },
  { label: "Requests",  icon: Wrench,    href: "/manager/requests" },
  { label: "Leases",    icon: KeyRound,  href: "/manager/leases" },
  { label: "Finances",  icon: Wallet,    href: "/manager/finance" },
  { label: "People",    icon: Users,     href: "/manager/people" },
  { label: "Settings",  icon: Settings,  href: "/manager/settings" },
];

export default function ManagerSidebar() {
  const router = useRouter();
  const pathname = router.asPath.split("?")[0];

  const activeIndex = useMemo(() => {
    // Check longest-prefix first so /manager doesn't shadow /manager/requests etc.
    for (let i = MANAGER_NAV.length - 1; i >= 0; i--) {
      const h = MANAGER_NAV[i].href;
      if (pathname === h || pathname.startsWith(h + "/")) return i;
    }
    return -1;
  }, [pathname]);

  return (
    <nav aria-label="Manager navigation" className="flex flex-col gap-1 py-2">
      {MANAGER_NAV.map((item, index) => {
        const Icon = item.icon;
        const isActive = index === activeIndex;
        return (
          <Link
            key={item.label}
            href={item.href}
            className={[
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "hover:bg-slate-100 hover:text-slate-900",
              isActive
                ? "bg-slate-100 text-slate-900 font-semibold"
                : "text-slate-600",
            ].join(" ")}
          >
            <Icon size={18} className="shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
