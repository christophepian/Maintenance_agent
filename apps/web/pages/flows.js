// ARCHIVED: This file has been replaced by index.js as the main launcher. Safe to delete or keep for reference.
// ARCHIVED: This file has been replaced by index.js as the main launcher. Safe to delete or keep for reference.
// apps/web/pages/flows.js
import Link from "next/link";
import { useMemo } from "react";

export default function FlowsPage() {
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
        title: "Home (tenant UI)",
        path: "/",
        desc: "Landing page for tenants",
      },
      {
        title: "Flows index (this page)",
        path: "/flows",
        desc: "UI launcher for all flows/pages",
      },
    ],
    []
  );

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
                target="_blank"
                rel="noreferrer"
                style={ui.secondaryBtn}
                title="Open in a new tab"
              >
                New tab
              </a>
            </div>
          </div>
        ))}
      </div>

      <div style={ui.footer}>
        <div style={ui.footerTitle}>If a link shows “Not found”</div>
        <div style={ui.footerText}>
          It means the page route doesn’t exist yet. Either create the page file under{" "}
          <code style={ui.codeSmall}>apps/web/pages</code> or change the{" "}
          <code style={ui.codeSmall}>path</code> in <code style={ui.codeSmall}>pages/flows.js</code>{" "}
          to match your actual route.
        </div>
      </div>
    </div>
  );
}

const ui = {
  page: {
    maxWidth: 980,
    margin: "40px auto",
    padding: 16,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  },
  header: { marginBottom: 18 },
  h1: { margin: 0, marginBottom: 8, fontSize: 28 },
  subtle: { color: "#555", fontSize: 13 },
  code: {
    padding: "2px 6px",
    borderRadius: 6,
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
  },
  codeSmall: {
    padding: "1px 6px",
    borderRadius: 6,
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
    fontSize: 12,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 14,
  },
  card: {
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  },
  cardTop: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  cardTitle: { fontWeight: 700, fontSize: 16 },
  path: {
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 999,
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
  },
  cardDesc: { color: "#444", fontSize: 13, marginBottom: 12 },
  row: { display: "flex", gap: 10, alignItems: "center" },
  primaryBtn: {
    display: "inline-block",
    textDecoration: "none",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
  },
  secondaryBtn: {
    display: "inline-block",
    textDecoration: "none",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
    color: "#111",
    cursor: "pointer",
  },
  footer: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    background: "#fafafa",
    border: "1px solid #eee",
  },
  footerTitle: { fontWeight: 700, marginBottom: 6 },
  footerText: { fontSize: 13, color: "#555" },
};
