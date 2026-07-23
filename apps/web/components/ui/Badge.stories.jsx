import Badge from "./Badge";

const variants = [
  ["default", "Neutral — draft, new, inactive"],
  ["brand", "Highlighted / featured"],
  ["success", "Completed, approved, paid"],
  ["destructive", "Rejected, cancelled, error"],
  ["warning", "Pending, awaiting action"],
  ["info", "Active, in progress, issued"],
  ["muted", "Low-emphasis neutral"],
];
const sizes = ["sm", "md", "lg"];

// Real domain statuses → semantic variant (mirrors lib/statusVariants.js)
const requestStatuses = [
  ["DRAFT", "default"],
  ["PENDING_REVIEW", "warning"],
  ["IN_PROGRESS", "info"],
  ["COMPLETED", "success"],
  ["REJECTED", "destructive"],
];

const label = { fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#94a3b8" };
const Field = ({ title, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={label}>{title}</div>
    {children}
  </div>
);

export default {
  title: "UI/Badge",
  component: Badge,
  argTypes: {
    variant: {
      control: "select",
      options: variants.map((v) => v[0]),
      description: "Semantic color band. Pick by meaning, not hue.",
      table: { defaultValue: { summary: "default" } },
    },
    size: {
      control: "inline-radio",
      options: sizes,
      table: { defaultValue: { summary: "md" } },
    },
    children: { control: "text", description: "Short label — a word or two." },
  },
  args: { variant: "brand", size: "md", children: "Featured" },
};

/** Interactive — tweak variant, size, and label. */
export const Playground = {};

/** The semantic bands. Choose by meaning; color follows. */
export const Variants = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, maxWidth: 680 }}>
      {variants.map(([v, use]) => (
        <div key={v} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Badge variant={v}>{v}</Badge>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>{use}</span>
        </div>
      ))}
    </div>
  ),
};

/** Three sizes — all use text-xs except lg (text-sm). */
export const Sizes = {
  render: () => (
    <Field title="size">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {sizes.map((s) => (
          <Badge key={s} variant="brand" size={s}>{s}</Badge>
        ))}
      </div>
    </Field>
  ),
};

/** Domain status → variant. In app code this mapping lives in statusVariants.js. */
export const StatusMapping = {
  parameters: { layout: "padded" },
  render: () => (
    <Field title="request status → variant">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {requestStatuses.map(([status, variant]) => (
          <div key={status} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Badge variant={variant}>{status}</Badge>
            <code style={{ fontSize: 12, color: "#94a3b8" }}>requestVariant("{status}") → "{variant}"</code>
          </div>
        ))}
      </div>
    </Field>
  ),
};

/** In context — badges as row-level status in a list. */
export const InContext = {
  parameters: { layout: "padded" },
  render: () => (
    <div style={{ width: 420, border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
      {[
        ["Window seal — Unit 1B", "PENDING_REVIEW", "warning"],
        ["Lock repair — Unit 3A", "IN_PROGRESS", "info"],
        ["Boiler service — Common", "COMPLETED", "success"],
      ].map(([title, status, variant], i) => (
        <div key={title} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: i ? "1px solid #f1f5f9" : "none" }}>
          <span style={{ fontSize: 14, color: "#0f172a" }}>{title}</span>
          <Badge variant={variant}>{status}</Badge>
        </div>
      ))}
    </div>
  ),
};
