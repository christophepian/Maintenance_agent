import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import NotificationBell from "./NotificationBell";
import ManagerSidebar from "./ManagerSidebar";
import OwnerSidebar from "./OwnerSidebar";
import ContractorSidebar from "./ContractorSidebar";
import TenantSidebar from "./TenantSidebar";
import BottomNav from "./mobile/BottomNav";

function decodeRoleFromToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(atob(parts[1]));
    return payload?.role || null;
  } catch {
    return null;
  }
}

function getCurrentRole() {
  if (typeof window === "undefined") return null;
  const storedRole = localStorage.getItem("role");
  if (storedRole) return storedRole;
  const token = localStorage.getItem("authToken");
  return decodeRoleFromToken(token);
}

export default function AppShell({ role: roleProp, children }) {
  const router = useRouter();
  const [role, setRole] = useState(roleProp || null);
  const [authRole, setAuthRole] = useState(null); // tracks which role has been bootstrapped

  useEffect(() => {
    if (roleProp) {
      setRole(roleProp);
      return;
    }
    setRole(getCurrentRole());
  }, [roleProp]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (role !== "MANAGER" && role !== "OWNER" && role !== "CONTRACTOR") return;
    if (authRole === role) return; // already bootstrapped for this role

    // Each role stores its token under a role-specific localStorage key.
    // Manager uses "authToken" (legacy), others use "<role>Token".
    const tokenKey = role === "CONTRACTOR" ? "contractorToken" : "authToken";

    // Check if existing token matches current role
    const existingToken = localStorage.getItem(tokenKey);
    if (existingToken) {
      try {
        const payload = JSON.parse(atob(existingToken.split(".")[1]));
        if (payload?.role === role) {
          setAuthRole(role);
          return;
        }
        // Token is for a different role — re-login
      } catch {
        // Invalid token — re-login
      }
    }

    const credsByRole = {
      CONTRACTOR: { email: "contractor@local.dev", password: "devpassword", name: "Dev Contractor", role: "CONTRACTOR" },
      OWNER: { email: "owner@local.dev", password: "devpassword", name: "Dev Owner", role: "OWNER" },
      MANAGER: { email: "manager@local.dev", password: "devpassword", name: "Dev Manager", role: "MANAGER" },
    };
    const creds = credsByRole[role];

    async function ensureAuth() {
      try {
        let res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: creds.email, password: creds.password }),
        });
        let data = await res.json();
        if (!res.ok) {
          res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(creds),
          });
          data = await res.json();
        }
        const token = data?.data?.token;
        if (token) {
          localStorage.setItem(tokenKey, token);
        }
      } catch {
        // ignore auth bootstrap errors
      } finally {
        setAuthRole(role);
      }
    }

    ensureAuth();
  }, [role, authRole]);

  const managerNav = useMemo(
    () => [
      {
        section: "Overview",
        items: [
          { label: "Dashboard", href: "/manager" },
        ],
      },
      {
        section: "Properties",
        items: [
          { label: "Properties", href: "/manager/properties" },
          { label: "Inventory", href: "/manager/inventory" },
          { label: "Buildings", href: "/admin-inventory/buildings" },
          { label: "Inventory admin", href: "/admin-inventory" },
        ],
      },
      {
        section: "People",
        items: [
          { label: "People overview", href: "/manager/people" },
          { label: "Tenants", href: "/manager/people/tenants" },
          { label: "Contractors", href: "/manager/people/vendors" },
        ],
      },
      {
        section: "Appliances",
        items: [
          { label: "Appliance models", href: "/admin-inventory/asset-models" },
        ],
      },
      {
        section: "Rental Applications",
        items: [
          { label: "Vacancies", href: "/manager/vacancies" },
        ],
      },
      {
        section: "Work Requests",
        items: [
          { label: "Work Requests", href: "/manager/work-requests" },
          { label: "RFPs", href: "/manager/rfps" },
        ],
      },
      {
        section: "Finance",
        items: [
          { label: "Finance overview", href: "/manager/finance" },
          { label: "Invoices & Bills", href: "/manager/finance/invoices" },
          { label: "Billing Entities", href: "/manager/finance/billing-entities" },
          { label: "Ledger", href: "/manager/finance/ledger" },
        ],
      },
      {
        section: "Leases",
        items: [
          { label: "Leases", href: "/manager/leases" },
          { label: "Lease Templates", href: "/manager/leases/templates" },
        ],
      },
      {
        section: "Settings",
        items: [{ label: "Settings", href: "/manager/settings" }],
      },
      {
        section: "Dev Tools",
        items: [
          { label: "Email Sink", href: "/manager/emails" },
          { label: "Tenant Login", href: "/tenant" },
        ],
      },
    ],
    []
  );

  const ownerNav = useMemo(
    () => [
      {
        section: "Overview",
        items: [
          { label: "Dashboard", href: "/owner" },
          { label: "Vacancies", href: "/owner/vacancies" },
        ],
      },
      {
        section: "Approvals",
        items: [{ label: "Pending Approvals", href: "/owner/approvals" }],
      },
      {
        section: "Jobs & Invoices",
        items: [
          { label: "Jobs", href: "/owner/jobs" },
          { label: "Invoices", href: "/owner/invoices" },
          { label: "Billing Entities", href: "/owner/billing-entities" },
        ],
      },
      {
        section: "Properties",
        items: [
          { label: "Properties", href: "/manager/properties" },
          { label: "Inventory admin", href: "/admin-inventory" },
        ],
      },
      {
        section: "Work Requests",
        items: [{ label: "Work Requests", href: "/owner/work-requests" }],
      },
      {
        section: "RFPs",
        items: [{ label: "RFPs", href: "/owner/rfps" }],
      },
    ],
    []
  );

  const contractorNav = useMemo(
    () => [
      {
        section: "Overview",
        items: [
          { label: "Dashboard", href: "/contractor" },
        ],
      },
      {
        section: "Jobs",
        items: [
          { label: "Jobs", href: "/contractor/jobs" },
          { label: "Status updates", href: "/contractor/status-updates" },
        ],
      },
      {
        section: "Bidding",
        items: [
          { label: "RFPs", href: "/contractor/rfps" },
        ],
      },
      {
        section: "Finance",
        items: [
          { label: "Invoices", href: "/contractor/invoices" },
          { label: "Estimates", href: "/contractor/estimates" },
        ],
      },
    ],
    []
  );

  const tenantNav = useMemo(
    () => [
      {
        section: "Overview",
        items: [
          { label: "Dashboard", href: "/tenant" },
          { label: "Inbox", href: "/tenant/inbox" },
        ],
      },
      {
        section: "Work Requests",
        items: [
          { label: "Submit Work Request", href: "/tenant-form" },
          { label: "My Requests", href: "/tenant/requests" },
          { label: "Chat intake", href: "/tenant-chat" },
        ],
      },
      {
        section: "My Tenancy",
        items: [
          { label: "My Leases", href: "/tenant/leases" },
          { label: "My Invoices", href: "/tenant/invoices" },
          { label: "My unit & assets", href: "/tenant/assets" },
        ],
      },
      {
        section: "Applications",
        items: [
          { label: "Browse Listings", href: "/listings" },
          { label: "Apply for a unit", href: "/apply" },
        ],
      },
    ],
    []
  );

  const nav = role === "CONTRACTOR" ? contractorNav : role === "TENANT" ? tenantNav : role === "OWNER" ? ownerNav : managerNav;
  const showSwitcher = true;

  function isActive(href) {
    return router.asPath === href || router.asPath.startsWith(`${href}/`);
  }

  function setRoleAndRoute(nextRole) {
    if (typeof window !== "undefined") {
      localStorage.setItem("role", nextRole);
    }
    setRole(nextRole);
    if (nextRole === "CONTRACTOR") {
      router.push("/contractor");
    } else if (nextRole === "TENANT") {
      router.push("/tenant-form");
    } else if (nextRole === "OWNER") {
      router.push("/owner");
    } else {
      router.push("/manager");
    }
  }

  function navLinkClass(active) {
    return [
      "block rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
      active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    ].join(" ");
  }

  return (
    <div
      className="min-h-screen md:grid md:grid-cols-[260px_1fr] bg-white text-slate-900 font-sans overflow-hidden"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg focus:ring-2 focus:ring-blue-500"
      >
        Skip to main content
      </a>
      <aside className="hidden md:block border-r border-slate-200 px-4 py-5 bg-slate-100" aria-label="Sidebar navigation">
        <div className="font-bold text-lg mb-5">
          Maintenance Agent
        </div>

        {showSwitcher ? (
          <div className="mb-5">
            <div className="text-sm text-slate-500 mb-2">
              Role
            </div>
            <select
              value={role || "MANAGER"}
              onChange={(e) => setRoleAndRoute(e.target.value)}
              aria-label="Switch role"
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 cursor-pointer"
            >
              <option value="MANAGER">Manager</option>
              <option value="OWNER">Owner</option>
              <option value="CONTRACTOR">Contractor</option>
              <option value="TENANT">Tenant</option>
            </select>
          </div>
        ) : null}

        {role === "MANAGER" ? (
          <ManagerSidebar />
        ) : role === "OWNER" ? (
          <OwnerSidebar />
        ) : role === "CONTRACTOR" ? (
          <ContractorSidebar />
        ) : role === "TENANT" ? (
          <TenantSidebar />
        ) : (
          nav.map((group) => (
            <div key={group.section} className="mb-4">
              <div className="text-xs uppercase text-slate-400 mb-1.5">
                {group.section}
              </div>
              <div className="grid gap-1.5">
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} className={navLinkClass(isActive(item.href))}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </aside>

      <main id="main-content" className="min-w-0 overflow-x-hidden p-6 pb-24 md:pb-6">
        {/* Header with notification bell */}
        {(role === "MANAGER" || role === "OWNER" || role === "TENANT" || role === "CONTRACTOR") && (
          <div className="flex justify-end mb-4 pr-2">
            <NotificationBell role={role} />
          </div>
        )}
        {children}
      </main>

      {/* Mobile bottom navigation — self-hides above md via md:hidden */}
      <BottomNav role={role} />
    </div>
  );
}
