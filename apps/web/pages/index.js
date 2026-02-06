
import Link from "next/link";
import { useMemo } from "react";

export default function Home() {
  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    "http://127.0.0.1:3001";

  // Index all main pages for navigation
  const flows = useMemo(
    () => [
      {
        title: "Tenant request (by phone)",
        path: "/tenant-form",
        desc: "Phone-based tenant identity + submit a maintenance request",
      },
      {
        title: "Admin inventory",
        path: "/admin-inventory",
        desc: "Buildings → Units → Appliances (create & browse inventory)",
      },
      {
        title: "Manager dashboard",
        path: "/manager",
        desc: "Approve, review, and track all maintenance requests",
      },
      {
        title: "Contractor portal",
        path: "/contractor",
        desc: "Contractor view for assigned jobs and appliance info",
      },
      {
        title: "Contractors admin",
        path: "/contractors",
        desc: "Add, edit, and manage contractors",
      },
      {
        title: "Login",
        path: "/login",
        desc: "Sign in or register (manager / contractor)",
      },
      // Removed 'Home (tenant UI)' and 'Flows index (this page)' as this is now the home page
    ],
    []
  );

  // Inline styles from flows.js (to be refactored to global.css in next step)
  const ui = {
    page: {
      maxWidth: 900,
      margin: "40px auto",
      padding: 16,
      fontFamily: "system-ui",
    },
    header: { marginBottom: 24 },
    h1: { marginBottom: 6 },
    subtle: { color: "#555", fontSize: 13, marginBottom: 16 },
    code: {
      padding: "2px 6px",
      borderRadius: 6,
      background: "#f3f4f6",
      border: "1px solid #e5e7eb",
      fontFamily: "monospace",
    },
    grid: {
      display: "grid",
      gap: 18,
      gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
      marginBottom: 32,
    },
    card: {
      border: "1px solid #ddd",
      borderRadius: 12,
      padding: 18,
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      minHeight: 120,
    },
    cardTop: { display: "flex", alignItems: "center", gap: 12 },
    cardTitle: { fontWeight: 600, fontSize: 18 },
    path: {
      fontFamily: "monospace",
      fontSize: 13,
      color: "#888",
      background: "#f6f6f6",
      borderRadius: 6,
      padding: "2px 6px",
      marginLeft: 8,
    },
    cardDesc: { color: "#555", fontSize: 14 },
    row: { display: "flex", gap: 10, alignItems: "center", marginTop: 4 },
    primaryBtn: {
      padding: "8px 16px",
      borderRadius: 8,
      border: "1px solid #111",
      background: "#111",
      color: "#fff",
      cursor: "pointer",
      fontWeight: 600,
      textDecoration: "none",
    },
    secondaryBtn: {
      padding: "8px 16px",
      borderRadius: 8,
      border: "1px solid #ddd",
      background: "#fff",
      color: "#111",
      cursor: "pointer",
      fontWeight: 600,
      textDecoration: "none",
    },
    footer: { marginTop: 40, color: "#888", fontSize: 13 },
    footerTitle: { fontWeight: 600, marginBottom: 6 },
    footerText: { marginBottom: 0 },
    codeSmall: {
      fontFamily: "monospace",
      fontSize: 12,
      color: "#888",
      background: "#f6f6f6",
      borderRadius: 6,
      padding: "1px 6px",
      marginLeft: 4,
    },
  };

  return (
    <div style={ui.page}>
      <header style={ui.header}>
        <h1 style={ui.h1}>Maintenance Agent – UI Launcher</h1>
        <div style={ui.subtle}>
          Frontend: <code style={ui.code}>http://localhost:3000</code> • Backend:{" "}
          <code style={ui.code}>{API_BASE}</code>
        </div>
      </header>

      <div style={ui.grid}>
        {flows.map((f) => (
          <div key={f.path} style={ui.card}>
            <div style={ui.cardTop}>
              <div style={ui.cardTitle}>{f.title}</div>
              <code style={ui.path}>{f.path}</code>
            </div>

            <div style={ui.cardDesc}>{f.desc}</div>

            <div style={ui.row}>
              <Link href={f.path} style={ui.primaryBtn}>
                Open
              </Link>
              <a
                href={f.path}
                style={ui.secondaryBtn}
                target="_blank"
                rel="noopener noreferrer"
              >
                New tab
              </a>
            </div>
          </div>
        ))}
      </div>

      <footer style={ui.footer}>
        <div style={ui.footerTitle}>If a link shows “Not found”</div>
        <div style={ui.footerText}>
          Make sure the page exists in <code style={ui.codeSmall}>apps/web/pages</code> or change the <code style={ui.codeSmall}>path</code> in <code style={ui.codeSmall}>pages/index.js</code>.
        </div>
      </footer>
    </div>
  );
}
