import {
  LayoutDashboard, Wrench, Building2, Wallet, TrendingUp, Users, Inbox, Settings,
  Search, Plus, X, ArrowRight, ArrowLeft, ChevronDown, MoreVertical, Edit, Trash2,
  Download, Filter, Check, AlertTriangle, KeyRound, FileText, ClipboardCheck,
  BarChart2, Receipt, FileSearch, Home, Bell, Calendar,
} from "lucide-react";

// The app uses lucide-react. Icons inherit color from `currentColor` (use the
// text-* tokens) and a 2px stroke (lucide default).
export default {
  title: "Foundations/Icons",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

const sys = "system-ui, sans-serif";

const groups = [
  ["Navigation", [
    ["LayoutDashboard", LayoutDashboard], ["Wrench", Wrench], ["Building2", Building2],
    ["Wallet", Wallet], ["TrendingUp", TrendingUp], ["Users", Users],
    ["Inbox", Inbox], ["Home", Home], ["Settings", Settings], ["Bell", Bell],
  ]],
  ["Actions & UI", [
    ["Search", Search], ["Plus", Plus], ["X", X], ["ArrowRight", ArrowRight],
    ["ArrowLeft", ArrowLeft], ["ChevronDown", ChevronDown], ["MoreVertical", MoreVertical],
    ["Edit", Edit], ["Trash2", Trash2], ["Download", Download], ["Filter", Filter],
    ["Check", Check], ["AlertTriangle", AlertTriangle], ["Calendar", Calendar],
  ]],
  ["Domain", [
    ["KeyRound", KeyRound], ["FileText", FileText], ["ClipboardCheck", ClipboardCheck],
    ["BarChart2", BarChart2], ["Receipt", Receipt], ["FileSearch", FileSearch],
  ]],
];

const sizes = [
  [16, "inline — table actions, badges"],
  [18, "navigation — sidebar items"],
  [20, "action buttons"],
  [24, "display — empty states, hero"],
];

export const SizeScale = {
  name: "Size scale",
  render: () => (
    <div style={{ padding: 32, fontFamily: sys, color: "#0f172a" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Size scale</h2>
      <div style={{ display: "flex", gap: 40, alignItems: "flex-end" }}>
        {sizes.map(([size, use]) => (
          <div key={size} style={{ textAlign: "center" }}>
            <div style={{ height: 32, display: "flex", alignItems: "flex-end", justifyContent: "center", color: "#4f46e5" }}>
              <Wrench size={size} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>{size}px</div>
            <div style={{ fontSize: 11, color: "#94a3b8", maxWidth: 120 }}>{use}</div>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const Library = {
  render: () => (
    <div style={{ padding: 32, fontFamily: sys, color: "#0f172a" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Common icons</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
        From <code>lucide-react</code>. Icons inherit <code>currentColor</code> — color them with
        the <code>text-*</code> tokens (default <code>text-muted</code>, active <code>text-foreground</code>).
      </p>
      {groups.map(([title, icons]) => (
        <div key={title} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 12 }}>{title}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12, maxWidth: 780 }}>
            {icons.map(([name, Icon]) => (
              <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 8px", border: "1px solid #e2e8f0", borderRadius: 12, color: "#334155" }}>
                <Icon size={20} />
                <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};
