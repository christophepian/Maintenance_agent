// Visual reference for the semantic color tokens (light theme) defined in
// styles/globals.css @theme. Values mirror the CSS custom properties.
export default {
  title: "Foundations/Colors",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

const families = [
  { name: "brand", roles: [["base", "#4f46e5"], ["light", "#eef2ff"], ["dark", "#3730a3"], ["ring", "#a5b4fc"]] },
  { name: "destructive", roles: [["base", "#dc2626"], ["light", "#fef2f2"], ["dark", "#991b1b"], ["ring", "#fca5a5"], ["text", "#b91c1c"]] },
  { name: "success", roles: [["base", "#16a34a"], ["light", "#f0fdf4"], ["dark", "#166534"], ["ring", "#86efac"], ["text", "#15803d"]] },
  { name: "warning", roles: [["base", "#d97706"], ["light", "#fffbeb"], ["dark", "#92400e"], ["ring", "#fcd34d"], ["text", "#b45309"]] },
  { name: "info", roles: [["base", "#0284c7"], ["light", "#f0f9ff"], ["dark", "#0369a1"], ["ring", "#7dd3fc"], ["text", "#0369a1"]] },
  { name: "muted", roles: [["base", "#64748b"], ["light", "#f1f5f9"], ["dark", "#334155"], ["ring", "#cbd5e1"], ["text", "#475569"]] },
  { name: "orange", roles: [["base", "#ea580c"], ["light", "#fff7ed"], ["dark", "#9a3412"], ["ring", "#fdba74"], ["text", "#c2410c"]] },
  { name: "purple", roles: [["base", "#9333ea"], ["light", "#faf5ff"], ["dark", "#6b21a8"], ["ring", "#d8b4fe"], ["text", "#7e22ce"]] },
  { name: "violet", roles: [["base", "#7c3aed"], ["light", "#f5f3ff"], ["dark", "#5b21b6"], ["ring", "#c4b5fd"], ["text", "#6d28d9"]] },
  { name: "teal", roles: [["base", "#0d9488"], ["light", "#f0fdfa"], ["dark", "#115e59"], ["ring", "#5eead4"], ["text", "#0f766e"]] },
];

const surfaces = [
  ["surface", "#ffffff"], ["surface-raised", "#ffffff"], ["surface-subtle", "#f8fafc"],
  ["surface-border", "#e2e8f0"], ["surface-hover", "#f1f5f9"], ["surface-divider", "#f1f5f9"],
  ["track", "#e2e8f0"], ["foreground", "#0f172a"], ["foreground-dim", "#94a3b8"],
];

const cell = { display: "flex", flexDirection: "column", gap: 5, width: 132 };
const box = { height: 52, borderRadius: 8, border: "1px solid #e2e8f0" };
const label = { fontSize: 12, color: "#334155", fontWeight: 500 };
const val = { fontSize: 11, color: "#94a3b8", fontFamily: "monospace" };
const cssVarStyle = { fontSize: 10, color: "#6366f1", fontFamily: "monospace" };

function Row({ name, roles }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
      <div style={{ width: 96, fontSize: 14, fontWeight: 600, color: "#0f172a", paddingTop: 16 }}>
        {name}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {roles.map(([role, hex]) => {
          const varName = role === "base" ? `--color-${name}` : `--color-${name}-${role}`;
          return (
            <div key={role} style={cell}>
              <div style={{ ...box, background: hex }} />
              <div style={label}>{role}</div>
              <div style={val}>{hex}</div>
              <div style={cssVarStyle}>{varName}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const StatusAndAccents = {
  name: "Status & Accents",
  render: () => (
    <div style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>
        Semantic color families
      </h2>
      {families.map((f) => (
        <Row key={f.name} name={f.name} roles={f.roles} />
      ))}
    </div>
  ),
};

export const Surfaces = {
  render: () => (
    <div style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>
        Surfaces, foreground & table
      </h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {surfaces.map(([role, hex]) => (
          <div key={role} style={cell}>
            <div style={{ ...box, background: hex }} />
            <div style={label}>{role}</div>
            <div style={val}>{hex}</div>
            <div style={cssVarStyle}>{`--color-${role}`}</div>
          </div>
        ))}
      </div>
    </div>
  ),
};
