import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import {
  LayoutDashboard,
  Inbox,
  Wrench,
  Home,
  Search,
} from "lucide-react";

const TENANT_NAV = [
  { id: "dashboard",  icon: LayoutDashboard, href: "/tenant" },
  { id: "inbox",      icon: Inbox,           href: "/tenant/inbox" },
  { id: "requests",   icon: Wrench,          href: "/tenant/requests" },
  { id: "myHome",     icon: Home,            href: "/tenant/leases" },
  { id: "apply",      icon: Search,          href: "/listings" },
];

export default function TenantSidebar() {
  const router = useRouter();
  const pathname = router.asPath.split("?")[0];
  const { t } = useTranslation("tenant");

  const activeIndex = useMemo(() => {
    for (let i = TENANT_NAV.length - 1; i >= 0; i--) {
      const h = TENANT_NAV[i].href;
      if (pathname === h || pathname.startsWith(h + "/")) return i;
    }
    return -1;
  }, [pathname]);

  return (
    <nav aria-label="Tenant navigation" className="flex flex-col gap-1 py-2">
      {TENANT_NAV.map((item, index) => {
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
