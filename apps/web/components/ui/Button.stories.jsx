import { Plus, Check, Trash2, Download, ArrowRight } from "lucide-react";
import Button from "./Button";

const variants = [
  ["primary", "Main action — one per view"],
  ["secondary", "Secondary action alongside primary"],
  ["destructive", "Irreversible / dangerous action"],
  ["destructiveGhost", "Low-emphasis destructive"],
  ["success", "Positive confirmation"],
  ["warning", "Caution — needs attention"],
  ["warningGhost", "Low-emphasis caution"],
  ["neutral", "Muted solid, non-semantic"],
  ["ghost", "Minimal — toolbars, dense UI"],
  ["link", "Inline text action"],
];
const sizes = [
  ["xs", "~24px · dense tables"],
  ["sm", "~30px · compact"],
  ["md", "~38px · default"],
  ["lg", "~44px · prominent"],
];

// ── layout helpers (story-only; inline styles are fine here) ──
const label = { fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#94a3b8" };
const Row = ({ children }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>{children}</div>
);
const Field = ({ title, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={label}>{title}</div>
    {children}
  </div>
);

export default {
  title: "UI/Button",
  component: Button,
  argTypes: {
    variant: {
      control: "select",
      options: variants.map((v) => v[0]),
      description: "Visual + semantic intent. Colors come from the semantic tokens (bg-brand, bg-destructive, …).",
      table: { defaultValue: { summary: "primary" } },
    },
    size: {
      control: "inline-radio",
      options: sizes.map((s) => s[0]),
      description: "Padding + text-size tier. Height is consistent per size across all variants.",
      table: { defaultValue: { summary: "md" } },
    },
    children: { control: "text", description: "Button label (and/or an icon)." },
    disabled: { control: "boolean", description: "Native disabled — dims to 50% and blocks interaction." },
    onClick: { action: "clicked", table: { disable: true } },
  },
  args: { variant: "primary", size: "md", children: "Save changes" },
};

/** Interactive — tweak every prop in the Controls panel. */
export const Playground = {};

/** All ten variants. Each maps to a semantic token set, not a raw color. */
export const Variants = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16, maxWidth: 680 }}>
      {variants.map(([v, use]) => (
        <div key={v} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
          <Button variant={v}>{v}</Button>
          <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>{use}</span>
        </div>
      ))}
    </div>
  ),
};

/** Four sizes, consistent height per tier. */
export const Sizes = {
  render: () => (
    <Field title="size">
      <Row>
        {sizes.map(([s, note]) => (
          <div key={s} style={{ textAlign: "center" }}>
            <Button size={s}>Button {s}</Button>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>{note}</div>
          </div>
        ))}
      </Row>
    </Field>
  ),
};

/** Icons sit inside the label via the built-in gap. Use lucide at 16px. */
export const WithIcons = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Field title="leading icon">
        <Row>
          <Button><Plus size={16} /> Add unit</Button>
          <Button variant="secondary"><Download size={16} /> Export</Button>
          <Button variant="success"><Check size={16} /> Approve</Button>
          <Button variant="destructive"><Trash2 size={16} /> Delete</Button>
        </Row>
      </Field>
      <Field title="trailing icon">
        <Row>
          <Button variant="link">View report <ArrowRight size={16} /></Button>
        </Row>
      </Field>
      <Field title="icon only — always pass aria-label">
        <Row>
          <Button aria-label="Add" className="!px-2.5"><Plus size={18} /></Button>
          <Button variant="secondary" aria-label="Download" className="!px-2.5"><Download size={18} /></Button>
          <Button variant="ghost" aria-label="Delete" className="!px-2.5"><Trash2 size={18} /></Button>
        </Row>
      </Field>
    </div>
  ),
};

/** Default vs disabled — every variant dims to 50% and blocks pointer events. */
export const States = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Field title="default">
        <Row>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
        </Row>
      </Field>
      <Field title="disabled">
        <Row>
          <Button disabled>Primary</Button>
          <Button variant="secondary" disabled>Secondary</Button>
          <Button variant="destructive" disabled>Destructive</Button>
        </Row>
      </Field>
    </div>
  ),
};

/** Real usage — a form action bar. Primary leads; destructive is low-emphasis, pushed left. */
export const InContext = {
  parameters: { layout: "padded" },
  render: () => (
    <div style={{ width: 440, border: "1px solid #e2e8f0", borderRadius: 16, padding: 20, background: "#fff" }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>Edit lease</div>
      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 20 }}>
        Rue du Rhône 12 · Unit 3A
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", alignItems: "center" }}>
        <Button variant="destructiveGhost" style={{ marginRight: "auto" }}>
          <Trash2 size={16} /> End lease
        </Button>
        <Button variant="ghost">Cancel</Button>
        <Button><Check size={16} /> Save changes</Button>
      </div>
    </div>
  ),
};
