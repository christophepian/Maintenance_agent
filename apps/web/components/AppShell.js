import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import NotificationBell from "./NotificationBell";

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
  const [authBootstrapped, setAuthBootstrapped] = useState(false);

  useEffect(() => {
    if (roleProp) {
      setRole(roleProp);
      return;
    }
    setRole(getCurrentRole());
  }, [roleProp]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (role !== "MANAGER") return;
    if (authBootstrapped) return;
    if (localStorage.getItem("authToken")) {
      setAuthBootstrapped(true);
      return;
    }

    const email = "manager@local.dev";
    const password = "devpassword";

    async function ensureManagerAuth() {
      try {
        let res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        let data = await res.json();
        if (!res.ok) {
          res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, name: "Dev Manager", role: "MANAGER" }),
          });
          data = await res.json();
        }
        const token = data?.data?.token;
        if (token) {
          localStorage.setItem("authToken", token);
        }
      } catch {
        // ignore auth bootstrap errors
      } finally {
        setAuthBootstrapped(true);
      }
    }

    ensureManagerAuth();
  }, [role, authBootstrapped]);

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
        items: [{ label: "Work Requests", href: "/manager/work-requests" }],
      },
      {
        section: "Finance",
        items: [
          { label: "Finance overview", href: "/manager/finance" },
          { label: "Charges", href: "/manager/finance/charges" },
          { label: "Payments", href: "/manager/finance/payments" },
          { label: "Invoices & Bills", href: "/manager/finance/invoices" },
          { label: "Billing Entities", href: "/manager/finance/billing-entities" },
          { label: "Expenses", href: "/manager/finance/expenses" },
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
        section: "Reports",
        items: [{ label: "Reports", href: "/manager/reports" }],
      },
      {
        section: "Settings",
        items: [{ label: "Settings", href: "/manager/settings" }],
      },
      {
        section: "Dev Tools",
        items: [{ label: "Email Sink", href: "/manager/emails" }],
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
        items: [{ label: "Work Requests", href: "/manager/work-requests" }],
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
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        background: "#f7f7f8",
        color: "#111",
        fontFamily: "system-ui",
      }}
    >
      <aside
        style={{
          borderRight: "1px solid #e5e5e5",
          padding: "20px 16px",
          background: "#ffffff",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "20px" }}>
          Maintenance Agent
        </div>

        {showSwitcher ? (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "8px" }}>
              Role
            </div>
            <select
              value={role || "MANAGER"}
              onChange={(e) => setRoleAndRoute(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #ddd",
                background: "#fafafa",
                color: "#111",
                cursor: "pointer",
              }}
            >
              <option value="MANAGER">Manager</option>
              <option value="OWNER">Owner</option>
              <option value="CONTRACTOR">Contractor</option>
              <option value="TENANT">Tenant</option>
            </select>
          </div>
        ) : null}

        {nav.map((group) => (
          <div key={group.section} style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "#888", marginBottom: "6px" }}>
              {group.section}
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className={navLinkClass(isActive(item.href))}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </aside>

      <main style={{ padding: "24px" }}>
        {/* Header with notification bell */}
        {(role === "MANAGER" || role === "OWNER" || role === "TENANT" || role === "CONTRACTOR") && (
          <div style={{ 
            display: "flex", 
            justifyContent: "flex-end", 
            marginBottom: "16px",
            paddingRight: "8px"
          }}>
            <NotificationBell role={role} />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
