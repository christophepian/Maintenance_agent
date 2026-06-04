import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import {
  Inbox,
  Wrench,
  Home,
  Search,
  Settings,
  Mail,
} from "lucide-react";

const TENANT_NAV = [
  { id: "myHome",    icon: Home,  href: "/tenant/myhome", aliases: ["/tenant/leases", "/tenant/invoices"] },
  { id: "inbox",     icon: Inbox, href: "/tenant/inbox" },
  { id: "requests",  icon: Wrench, href: "/tenant/requests" },
  { id: "letters",   icon: Mail,  href: "/tenant/letters" },
  { id: "apply",     icon: Search, href: "/listings" },
  { id: "settings",  icon: Settings, href: "/tenant/settings" },
];

export default function TenantSidebar() {
  const router = useRouter();
  const pathname = router.asPath.split("?")[0];
  const { t } = useTranslation("tenant");

  const activeIndex = useMemo(() => {
    for (let i = TENANT_NAV.length - 1; i >= 0; i--) {
      const item = TENANT_NAV[i];
      if (pathname === item.href || pathname.startsWith(item.href + "/")) return i;
      if (item.aliases?.some((a) => pathname === a || pathname.startsWith(a + "/"))) return i;
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
      })}
    </nav>
  );
}
