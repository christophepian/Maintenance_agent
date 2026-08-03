import { Wallet, TrendingUp, Wrench, AlertTriangle } from "lucide-react";
import KpiCard from "./KpiCard";

const accents = [
  ["brand", "Default / neutral metric"],
  ["success", "Positive / on-target"],
  ["warning", "Needs attention"],
  ["destructive", "Problem / overdue"],
  ["muted", "Low-emphasis"],
];

export default {
  title: "UI/KpiCard",
  component: KpiCard,
  parameters: { layout: "padded" },
  argTypes: {
    label: { control: "text", description: "Uppercase metric label." },
    value: { control: "text", description: "The headline number (pre-formatted — use lib/format.js)." },
    subtitle: { control: "text", description: "Optional context line under the label." },
    accent: {
      control: "select",
      options: accents.map((a) => a[0]),
      description: "Colors the value to signal status.",
      table: { defaultValue: { summary: "brand" } },
    },
    href: { control: "text", description: "Optional — turns the whole card into a link." },
  },
  args: { label: "Open Requests", value: "42", subtitle: "3 overdue", accent: "warning" },
};

/** Interactive — tweak label, value, subtitle, accent. */
export const Playground = {
  render: (args) => (
    <div style={{ width: 260 }}>
      <KpiCard {...args} />
    </div>
  ),
};

/** Accent colors the value to signal metric status at a glance. */
export const Accents = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, maxWidth: 780 }}>
      {accents.map(([accent, use]) => (
        <KpiCard key={accent} label={`Accent: ${accent}`} value="1,240" subtitle={use} accent={accent} />
      ))}
    </div>
  ),
};

/** With a leading icon in the label. */
export const WithIcon = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 240px)", gap: 12 }}>
      <KpiCard icon={<Wallet size={14} />} label="Net operating income" value="CHF 412k" subtitle="YTD" accent="success" />
      <KpiCard icon={<Wrench size={14} />} label="Open requests" value="42" subtitle="3 overdue" accent="warning" />
    </div>
  ),
};

/** A real KPI row — the dashboard header pattern. */
export const KpiRow = {
  parameters: { layout: "padded" },
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, maxWidth: 940 }}>
      <KpiCard icon={<Wallet size={14} />} label="Portfolio value" value="CHF 24.6M" subtitle="+3.1% YoY" accent="brand" />
      <KpiCard icon={<TrendingUp size={14} />} label="Net yield" value="4.2%" subtitle="On appraisal" accent="success" />
      <KpiCard icon={<Wrench size={14} />} label="Open requests" value="42" subtitle="3 overdue" accent="warning" />
      <KpiCard icon={<AlertTriangle size={14} />} label="Vacancy" value="6.4%" subtitle="2 units" accent="destructive" />
    </div>
  ),
};

/** As a link — the whole card becomes clickable (renders an anchor). */
export const AsLink = {
  render: () => (
    <div style={{ width: 260 }}>
      <KpiCard label="Overdue invoices" value="CHF 18,200" subtitle="View all →" accent="destructive" href="#invoices" />
    </div>
  ),
};
