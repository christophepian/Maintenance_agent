import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import {
  LayoutDashboard,
  ClipboardCheck,
  Landmark,
  Building2,
  BarChart2,
  Settings,
} from "lucide-react";

const OWNER_NAV = [
  { id: "dashboard",  icon: LayoutDashboard, href: "/owner" },
  { id: "reporting",  icon: BarChart2,        href: "/owner/reporting" },
  { id: "properties", icon: Building2,        href: "/owner/properties" },
  { id: "approvals",  icon: ClipboardCheck,   href: "/owner/approvals" },
  { id: "finance",    icon: Landmark,         href: "/owner/finance" },
  { id: "settings",   icon: Settings,         href: "/owner/settings" },
];

export default function OwnerSidebar() {
  const router = useRouter();
  const pathname = router.asPath.split("?")[0];
  const { t } = useTranslation("owner");

  const activeIndex = useMemo(() => {
    for (let i = OWNER_NAV.length - 1; i >= 0; i--) {
      const h = OWNER_NAV[i].href;
      if (pathname === h || pathname.startsWith(h + "/")) return i;
    }
    return -1;
  }, [pathname]);

  return (
    <nav aria-label="Owner navigation" className="flex flex-col gap-1 py-2">
      {OWNER_NAV.map((item, index) => {
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
