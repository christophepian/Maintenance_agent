import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
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
  { id: "dashboard", icon: LayoutDashboard, href: "/manager" },
  { id: "properties", icon: Building2, href: "/manager/inventory", aliases: ["/manager/vacancies"] },
  { id: "requests",  icon: Wrench,    href: "/manager/requests" },
  { id: "leases",    icon: KeyRound,  href: "/manager/leases" },
  { id: "finances",  icon: Wallet,    href: "/manager/finance" },
  { id: "contacts",  icon: Users,     href: "/manager/people" },
  { id: "settings",  icon: Settings,  href: "/manager/settings" },
];

export default function ManagerSidebar() {
  const router = useRouter();
  const pathname = router.asPath.split("?")[0];
  const { t } = useTranslation("manager");

  const activeIndex = useMemo(() => {
    // Check longest-prefix first so /manager doesn't shadow /manager/requests etc.
    for (let i = MANAGER_NAV.length - 1; i >= 0; i--) {
      const h = MANAGER_NAV[i].href;
      const aliases = MANAGER_NAV[i].aliases || [];
      if (pathname === h || pathname.startsWith(h + "/")) return i;
      if (aliases.some((a) => pathname === a || pathname.startsWith(a + "/"))) return i;
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
            key={item.id}
            href={item.href}
            className={[
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "hover:bg-white hover:text-slate-900",
              isActive
                ? "bg-white text-slate-900 font-semibold"
                : "text-slate-600",
            ].join(" ")}
          >
            <Icon size={18} className="shrink-0" />
            <span>{t(`nav.${item.id}`)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
