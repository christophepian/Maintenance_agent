import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  Building2,
  Users,
  KeyRound,
  Wrench,
  Wallet,
  Scale,
  BarChart2,
  Settings,
  Terminal,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

/**
 * Manager sidebar navigation tree.
 *
 * Each top-level item has:
 *   label  — display text
 *   icon   — lucide-react component
 *   href   — direct link (leaf items or parent shortcut to first child)
 *   children? — sub-items (makes this an accordion section)
 *
 * If `children` is present, `href` is derived from the first child's href
 * (clicking the parent navigates there and expands the section).
 */
const MANAGER_NAV = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/manager",
  },
  {
    label: "Portfolio",
    icon: Building2,
    children: [
      { label: "Properties", href: "/manager/properties" },
      { label: "Buildings", href: "/admin-inventory/buildings" },
    ],
  },
  {
    label: "People",
    icon: Users,
    children: [
      { label: "Tenants", href: "/manager/people/tenants" },
      // TODO: page not yet implemented — /manager/people/owners does not exist
      { label: "Owners", href: "/manager/people/owners" },
      { label: "Contractors", href: "/manager/people/vendors" },
    ],
  },
  {
    label: "Leasing",
    icon: KeyRound,
    children: [
      { label: "Vacancies", href: "/manager/vacancies" },
      { label: "Leases", href: "/manager/leases" },
      { label: "Lease Templates", href: "/manager/leases/templates" },
    ],
  },
  {
    label: "Maintenance",
    icon: Wrench,
    children: [
      { label: "Work Requests", href: "/manager/work-requests" },
      // No standalone appliances list page — using buildings list which shows unit appliances
      { label: "Appliances", href: "/admin-inventory/buildings" },
      { label: "Appliance Models", href: "/admin-inventory/asset-models" },
    ],
  },
  {
    label: "Finance",
    icon: Wallet,
    children: [
      { label: "Overview", href: "/manager/finance" },
      { label: "Charges & Payments", href: "/manager/finance/charges" },
      { label: "Invoices & Bills", href: "/manager/finance/invoices" },
      { label: "Expenses", href: "/manager/finance/expenses" },
      { label: "Ledger", href: "/manager/finance/ledger" },
      { label: "Billing Entities", href: "/manager/finance/billing-entities" },
    ],
  },
  {
    label: "Legal & Compliance",
    icon: Scale,
    children: [
      { label: "Rules & Category Mappings", href: "/manager/legal/rules" },
      { label: "Depreciation", href: "/manager/legal/depreciation" },
      { label: "Evaluations", href: "/manager/legal/evaluations" },
      { label: "RFPs", href: "/manager/rfps" },
    ],
  },
  {
    label: "Reports",
    icon: BarChart2,
    href: "/manager/reports",
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/manager/settings",
  },
  {
    label: "Dev Tools",
    icon: Terminal,
    children: [
      { label: "Email Sink", href: "/manager/emails" },
      { label: "Tenant Login", href: "/tenant" },
    ],
  },
];

/**
 * Collect all hrefs belonging to a nav item (itself + children).
 */
function allHrefs(item) {
  if (item.children) {
    return item.children.map((c) => c.href);
  }
  return item.href ? [item.href] : [];
}

/**
 * Determine which top-level section is active for the current path.
 * Returns the index of the matching section, or -1.
 */
function findActiveSection(pathname) {
  for (let i = 0; i < MANAGER_NAV.length; i++) {
    const item = MANAGER_NAV[i];
    const hrefs = allHrefs(item);
    for (const h of hrefs) {
      // Exact match or starts-with for nested routes
      if (pathname === h || pathname.startsWith(h + "/")) {
        return i;
      }
    }
  }
  // Fallback: Dashboard for any /manager/* route
  if (pathname.startsWith("/manager")) return 0;
  return -1;
}

export default function ManagerSidebar() {
  const router = useRouter();
  const pathname = router.asPath.split("?")[0]; // strip query params

  const activeSection = useMemo(() => findActiveSection(pathname), [pathname]);
  const [expandedIndex, setExpandedIndex] = useState(activeSection);

  // Keep expanded section in sync when route changes
  useEffect(() => {
    if (activeSection >= 0) {
      setExpandedIndex(activeSection);
    }
  }, [activeSection]);

  function handleTopLevelClick(item, index) {
    if (item.children) {
      // Toggle expand and navigate to first child
      if (expandedIndex === index) {
        // Already expanded — collapse
        setExpandedIndex(-1);
      } else {
        setExpandedIndex(index);
        router.push(item.children[0].href);
      }
    }
    // Items without children navigate via their <Link>
  }

  function isSubItemActive(href) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="flex flex-col gap-1 py-2">
      {MANAGER_NAV.map((item, index) => {
        const Icon = item.icon;
        const isExpanded = expandedIndex === index;
        const isActive = index === activeSection;
        const hasChildren = !!item.children;
        const resolvedHref = hasChildren ? item.children[0].href : item.href;

        return (
          <div key={item.label}>
            {/* Top-level item */}
            {hasChildren ? (
              <button
                type="button"
                onClick={() => handleTopLevelClick(item, index)}
                className={[
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  "hover:bg-slate-100 hover:text-slate-900",
                  isActive
                    ? "bg-slate-50 text-slate-900 font-semibold"
                    : "text-slate-600",
                ].join(" ")}
              >
                <Icon size={18} className="shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {isExpanded ? (
                  <ChevronDown size={16} className="shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight size={16} className="shrink-0 text-slate-400" />
                )}
              </button>
            ) : (
              <Link
                href={resolvedHref}
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
            )}

            {/* Sub-items (accordion) */}
            {hasChildren && isExpanded && (
              <div className="mt-0.5 flex flex-col gap-0.5">
                {item.children.map((child) => {
                  const childActive = isSubItemActive(child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={[
                        "block rounded-lg py-1.5 pl-10 pr-3 text-sm transition-colors",
                        childActive
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
                      ].join(" ")}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
