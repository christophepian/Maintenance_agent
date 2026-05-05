import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import NotificationBell from "./NotificationBell";
import LocaleSwitcher from "./LocaleSwitcher";
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

  const showSwitcher = true;

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
        ) : null}
      </aside>

      <main id="main-content" className="min-w-0 overflow-x-hidden px-3 py-6 pb-24 md:px-6 md:pb-6">
        {/* Header with notification bell */}
        {(role === "MANAGER" || role === "OWNER" || role === "TENANT" || role === "CONTRACTOR") && (
          <div className="flex justify-end items-center gap-3 mb-4 pr-2">
            <LocaleSwitcher />
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
