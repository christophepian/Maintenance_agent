
import Link from "next/link";
import { useMemo } from "react";

export default function Home() {
  // Only use NEXT_PUBLIC_ env vars here — non-prefixed vars exist server-side
  // only, which causes a hydration mismatch.
  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

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
        path: "/manager/people/vendors",
        desc: "Add, edit, and manage contractors",
      },
      {
        title: "Login",
        path: "/login",
        desc: "Sign in or register (manager / contractor)",
      },
      {
        title: "Tenant dashboard",
        path: "/tenant",
        desc: "Tenant portal — inbox, invoices, and requests",
      },
      {
        title: "Tenant chat",
        path: "/tenant-chat",
        desc: "AI-assisted chat to submit maintenance requests",
      },
      {
        title: "Listings",
        path: "/listings",
        desc: "Public vacancy listings for prospective tenants",
      },
      {
        title: "Apply",
        path: "/apply",
        desc: "Submit a rental application for a listed unit",
      },
    ],
    []
  );

  return (
    <div className="max-w-4xl mx-auto p-4 font-sans">
      <header className="mb-6">
        <h1 className="mb-1">Maintenance Agent &ndash; UI Launcher</h1>
        <div className="text-slate-500 text-sm mb-4">
          Frontend: <code className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-xs">http://localhost:3000</code> &bull; Backend:{" "}
          <code className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-xs">{API_BASE}</code>
        </div>
      </header>

      <div className="mb-6 rounded-lg border border-red-300 bg-red-100 px-4 py-3 text-red-700 shadow-sm">
        Tailwind check: this box should be red, padded, and rounded.
      </div>

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(320px,1fr))] mb-8">
        {flows.map((f) => (
          <div key={f.path} className="border border-slate-300 rounded-xl p-4 bg-white flex flex-col gap-2.5 min-h-[120px]">
            <div className="flex items-center gap-3">
              <div className="font-semibold text-lg">{f.title}</div>
              <code className="font-mono text-xs text-slate-400 bg-slate-50 rounded-md px-1.5 py-0.5 ml-2">{f.path}</code>
            </div>

            <div className="text-slate-500 text-sm">{f.desc}</div>

            <div className="flex gap-2.5 items-center mt-1">
              <Link href={f.path} className="px-4 py-2 rounded-lg border border-slate-900 bg-slate-900 text-white cursor-pointer font-semibold no-underline">
                Open
              </Link>
              <a
                href={f.path}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 cursor-pointer font-semibold no-underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                New tab
              </a>
            </div>
          </div>
        ))}
      </div>

      <footer className="mt-10 text-slate-400 text-sm">
        <div className="font-semibold mb-1">If a link shows &quot;Not found&quot;</div>
        <div>
          Make sure the page exists in <code className="font-mono text-xs text-slate-400 bg-slate-50 rounded-md px-1.5 py-0.5 ml-1">apps/web/pages</code> or change the <code className="font-mono text-xs text-slate-400 bg-slate-50 rounded-md px-1.5 py-0.5 ml-1">path</code> in <code className="font-mono text-xs text-slate-400 bg-slate-50 rounded-md px-1.5 py-0.5 ml-1">pages/index.js</code>.
        </div>
      </footer>
    </div>
  );
}
