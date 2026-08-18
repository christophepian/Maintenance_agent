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
  Mail,
} from "lucide-react";

/**
 * Manager sidebar — primary navigation, grouped.
 *
 * Dashboard and Settings sit ungrouped (entry point / account); the rest split
 * into what you *run* (Gestion) and what you *read* (Analyse). Group headings
 * are presentational only — the flat MANAGER_NAV order below still drives
 * active-route matching, so ordering here and grouping stay independent.
 * Sub-sections live as in-page tab strips on each page.
 */
const MANAGER_NAV = [
  { id: "dashboard", icon: LayoutDashboard, href: "/manager" },
  { id: "properties", icon: Building2, href: "/manager/inventory", aliases: ["/manager/vacancies"] },
  { id: "requests",  icon: Wrench,    href: "/manager/requests" },
  { id: "leases",    icon: KeyRound,  href: "/manager/leases" },
  { id: "finances",  icon: Wallet,    href: "/manager/finance" },
  { id: "contacts",        icon: Users,     href: "/manager/people" },
  { id: "correspondence",  icon: Mail,      href: "/manager/correspondence" },
  { id: "settings",        icon: Settings,  href: "/manager/settings" },
];

// Render order: null heading = ungrouped block (no label rendered).
const MANAGER_NAV_GROUPS = [
  { id: null,           items: ["dashboard"] },
  { id: "management",   items: ["properties", "requests", "leases", "contacts", "correspondence"] },
  { id: "analysis",     items: ["finances"] },
  { id: null,           items: ["settings"] },
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

  const renderItem = (id) => {
    const index = MANAGER_NAV.findIndex((n) => n.id === id);
    const item = MANAGER_NAV[index];
    if (!item) return null;
    const Icon = item.icon;
    const isActive = index === activeIndex;
    return (
      <Link
        key={item.id}
        href={item.href}
        className={[
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          "hover:bg-surface hover:text-foreground",
          isActive
            ? "bg-surface text-foreground font-semibold"
            : "text-muted-text",
        ].join(" ")}
      >
        <Icon size={18} className="shrink-0" />
        <span>{t(`nav.${item.id}`)}</span>
      </Link>
    );
  };

  return (
    <nav aria-label="Manager navigation" className="flex flex-col gap-1 py-2">
      {MANAGER_NAV_GROUPS.map((group, gi) => (
        <div key={group.id ?? `ungrouped-${gi}`} className={gi > 0 ? "mt-4" : undefined}>
          {group.id && (
            <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-foreground-dim">
              {t(`nav.group.${group.id}`)}
            </div>
          )}
          <div className="flex flex-col gap-1">{group.items.map(renderItem)}</div>
        </div>
      ))}
    </nav>
  );
}
