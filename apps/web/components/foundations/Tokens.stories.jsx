// Spacing, radius, and elevation reference. Values are the Tailwind defaults
// actually used across the app (no theme.extend); shadows are Tailwind sm/lg/xl.
export default {
  title: "Foundations/Spacing, Radius & Elevation",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

const sys = "system-ui, sans-serif";
const spacing = [2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40, 48];
const radii = [["sm", 4], ["md", 6], ["lg", 8], ["xl", 12], ["2xl", 16], ["full", 9999]];
const shadows = [
  ["shadow-sm", "0 1px 2px 0 rgb(0 0 0 / 0.05)", "Cards · KPI tiles"],
  ["shadow-lg", "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)", "Modal · Popover"],
  ["shadow-xl", "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)", "Dialog"],
];

export const Spacing = {
  render: () => (
    <div style={{ padding: 32, fontFamily: sys, color: "#0f172a" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Spacing</h2>
      {spacing.map((px) => (
        <div key={px} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
          <div style={{ width: 90, fontSize: 12, color: "#64748b" }}>spacing/{px}</div>
          <div style={{ width: px, height: 16, background: "#4f46e5", borderRadius: 3 }} />
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{px}px</div>
        </div>
      ))}
    </div>
  ),
};

export const Radius = {
  render: () => (
    <div style={{ padding: 32, fontFamily: sys, color: "#0f172a" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Border radius</h2>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {radii.map(([name, val]) => (
          <div key={name} style={{ textAlign: "center" }}>
            <div
              style={{
                width: 72, height: 72, background: "#eef2ff",
                border: "1.5px solid #4f46e5",
                borderRadius: val === 9999 ? 36 : val,
              }}
            />
            <div style={{ fontSize: 12, fontWeight: 500, marginTop: 8 }}>{name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{val === 9999 ? "full" : `${val}px`}</div>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const Elevation = {
  render: () => (
    <div style={{ padding: 32, fontFamily: sys, color: "#0f172a", background: "#f8fafc" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Elevation</h2>
      <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
        {shadows.map(([name, shadow, usage]) => (
          <div key={name} style={{ textAlign: "center" }}>
            <div style={{ width: 180, height: 110, background: "#fff", borderRadius: 16, boxShadow: shadow }} />
            <div style={{ fontSize: 13, fontWeight: 500, marginTop: 14 }}>{name}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{usage}</div>
          </div>
        ))}
      </div>
    </div>
  ),
};
