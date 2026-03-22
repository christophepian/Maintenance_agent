import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  Inbox,
  Wrench,
  Home,
  Search,
} from "lucide-react";

const TENANT_NAV = [
  { label: "Dashboard",  icon: LayoutDashboard, href: "/tenant" },
  { label: "Inbox",      icon: Inbox,           href: "/tenant/inbox" },
  { label: "Requests",   icon: Wrench,          href: "/tenant/requests" },
  { label: "My Home",    icon: Home,            href: "/tenant/leases" },
  { label: "Apply",      icon: Search,          href: "/listings" },
];

export default function TenantSidebar() {
  const router = useRouter();
  const pathname = router.asPath.split("?")[0];

  const activeIndex = useMemo(() => {
    for (let i = TENANT_NAV.length - 1; i >= 0; i--) {
      const h = TENANT_NAV[i].href;
      if (pathname === h || pathname.startsWith(h + "/")) return i;
    }
    return -1;
  }, [pathname]);

  return (
    <nav className="flex flex-col gap-1 py-2">
      {TENANT_NAV.map((item, index) => {
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
