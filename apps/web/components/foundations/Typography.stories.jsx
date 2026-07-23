// Type ramp reference. Body uses the app's system-ui stack; the brand
// wordmark uses Playfair Display. Sizes mirror the Tailwind scale used
// across the primitives (see components/ui + globals.css).
export default {
  title: "Foundations/Typography",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

const sys = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

const specs = [
  { name: "Wordmark", sample: "Maintenance", font: '"Playfair Display", Georgia, serif', size: 28, weight: 700, meta: "Playfair Display · 700 · brand wordmark" },
  { name: "KPI value", sample: "CHF 1,240,000", size: 24, weight: 600, ls: "-0.02em", meta: "24px · 600 · tracking-tight" },
  { name: "Page title", sample: "Buildings", size: 20, weight: 700, meta: "text-xl · 700" },
  { name: "Card / dialog title", sample: "Building overview", size: 18, weight: 600, meta: "text-lg · 600" },
  { name: "Body base", sample: "Body copy for descriptions and paragraphs.", size: 16, weight: 400, meta: "text-base · 400" },
  { name: "Body small", sample: "Default table & form body text.", size: 14, weight: 400, meta: "text-sm · 400" },
  { name: "Caption", sample: "Helper text and subtle captions.", size: 13, weight: 400, meta: "13px · 400 · .help / .subtle" },
  { name: "Body xs", sample: "Fine print and dense metadata.", size: 12, weight: 400, meta: "text-xs · 400" },
  { name: "Label", sample: "Button & form label", size: 14, weight: 500, meta: "text-sm · 500" },
  { name: "Column header", sample: "STATUS", size: 12, weight: 600, ls: "0.05em", meta: "text-xs · 600 · uppercase tracking-wide", upper: true },
];

export const TypeScale = {
  name: "Type scale",
  render: () => (
    <div style={{ padding: 32, fontFamily: sys, color: "#0f172a" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Type scale</h2>
      {specs.map((s) => (
        <div
          key={s.name}
          style={{ display: "flex", gap: 32, alignItems: "baseline", padding: "14px 0", borderBottom: "1px solid #f1f5f9" }}
        >
          <div style={{ width: 200, flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{s.meta}</div>
          </div>
          <div
            style={{
              fontFamily: s.font || sys,
              fontSize: s.size,
              fontWeight: s.weight,
              letterSpacing: s.ls || "normal",
              textTransform: s.upper ? "uppercase" : "none",
            }}
          >
            {s.sample}
          </div>
        </div>
      ))}
    </div>
  ),
};
