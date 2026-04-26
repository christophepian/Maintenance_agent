import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  Wrench,
  Receipt,
  FileSearch,
} from "lucide-react";

const CONTRACTOR_NAV = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/contractor" },
  { label: "Jobs",      icon: Wrench,          href: "/contractor/jobs" },
  { label: "Invoices",  icon: Receipt,         href: "/contractor/invoices" },
  { label: "RFPs",      icon: FileSearch,      href: "/contractor/rfps" },
];

export default function ContractorSidebar() {
  const router = useRouter();
  const pathname = router.asPath.split("?")[0];

  const activeIndex = useMemo(() => {
    for (let i = CONTRACTOR_NAV.length - 1; i >= 0; i--) {
      const h = CONTRACTOR_NAV[i].href;
      if (pathname === h || pathname.startsWith(h + "/")) return i;
    }
    return -1;
  }, [pathname]);

  return (
    <nav aria-label="Contractor navigation" className="flex flex-col gap-1 py-2">
      {CONTRACTOR_NAV.map((item, index) => {
        const Icon = item.icon;
        const isActive = index === activeIndex;
        return (
          <Link
            key={item.label}
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
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
