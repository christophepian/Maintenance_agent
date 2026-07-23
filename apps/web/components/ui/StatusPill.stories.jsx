import StatusPill from "./StatusPill";

const variants = [
  ["default", "Neutral", true],
  ["brand", "Featured", true],
  ["success", "Positive terminal", true],
  ["destructive", "Negative terminal", true],
  ["muted", "Low-emphasis", true],
  ["warning", "Awaiting action", false],
  ["info", "In progress", false],
  ["orange", "High severity", false],
];

export default {
  title: "UI/StatusPill",
  component: StatusPill,
  argTypes: {
    variant: { control: "select", options: variants.map((v) => v[0]) },
    size: { control: "inline-radio", options: ["sm", "md"] },
    children: { control: "text" },
  },
  args: { variant: "success", size: "md", children: "Active" },
};

/** Interactive. */
export const Playground = {};

/** All variants. Ones marked ⚠ hardcode raw Tailwind palette (see Docs). */
export const Variants = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, maxWidth: 700 }}>
      {variants.map(([v, use, tokenized]) => (
        <div key={v} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusPill variant={v}>{v}</StatusPill>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            {use}{tokenized ? "" : " · ⚠ raw palette"}
          </span>
        </div>
      ))}
    </div>
  ),
};

/** Two sizes. */
export const Sizes = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <StatusPill variant="brand" size="sm">sm</StatusPill>
      <StatusPill variant="brand" size="md">md</StatusPill>
    </div>
  ),
};
