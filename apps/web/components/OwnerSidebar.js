import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  ClipboardCheck,
  Wrench,
  Receipt,
  FileSearch,
  Building2,
} from "lucide-react";

const OWNER_NAV = [
  { label: "Dashboard",  icon: LayoutDashboard, href: "/owner" },
  { label: "Approvals",  icon: ClipboardCheck,  href: "/owner/approvals" },
  { label: "Jobs",       icon: Wrench,          href: "/owner/jobs" },
  { label: "Invoices",   icon: Receipt,         href: "/owner/invoices" },
  { label: "RFPs",       icon: FileSearch,      href: "/owner/rfps" },
  { label: "Properties", icon: Building2,       href: "/owner/properties" },
];

export default function OwnerSidebar() {
  const router = useRouter();
  const pathname = router.asPath.split("?")[0];

  const activeIndex = useMemo(() => {
    for (let i = OWNER_NAV.length - 1; i >= 0; i--) {
      const h = OWNER_NAV[i].href;
      if (pathname === h || pathname.startsWith(h + "/")) return i;
    }
    return -1;
  }, [pathname]);

  return (
    <nav className="flex flex-col gap-1 py-2">
      {OWNER_NAV.map((item, index) => {
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
