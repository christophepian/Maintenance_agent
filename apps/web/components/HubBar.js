/**
 * HubBar — top strip linking the app to the docs hub.
 *
 * Mirrors the hub-bar present on every /docs/*.html page so that
 * MANAGER users can move between the live app and documentation
 * without having to remember a URL.
 *
 * Only rendered for MANAGER role (controlled by AppShell).
 */

const DOCS_BASE = "/docs";

const DOC_LINKS = [
  { href: "index.html",           label: "Overview" },
  { href: "wiki.html",            label: "Wiki" },
  { href: "blueprint.html",       label: "Blueprint" },
  { href: "product-overview.html",label: "Product" },
  { href: "roadmap.html",         label: "Roadmap" },
  { href: "design-system.html",   label: "Design" },
  { href: "pitchdeck.html",       label: "Pitch" },
];

const WEBSITE_LINKS = [
  { href: "/website/index.html",  label: "Website" },
  { href: "/website/invest.html", label: "Invest" },
];

export default function HubBar() {
  if (process.env.NEXT_PUBLIC_SANDBOX === "true") return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9000,
        height: 36,
        background: "#0f172a",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 12,
        fontWeight: 500,
        borderBottom: "1px solid rgba(255,255,255,.08)",
        gap: 0,
      }}
    >
      {/* Brand */}
      <span
        style={{
          color: "rgba(255,255,255,.9)",
          fontWeight: 700,
          paddingRight: 14,
          marginRight: 6,
          borderRight: "1px solid rgba(255,255,255,.15)",
          height: 36,
          display: "flex",
          alignItems: "center",
        }}
      >
        MA Docs
      </span>

      {/* Doc page links */}
      {DOC_LINKS.map(({ href, label }) => (
        <a
          key={href}
          href={`${DOCS_BASE}/${href}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "rgba(255,255,255,.5)",
            textDecoration: "none",
            padding: "0 8px",
            height: 36,
            display: "flex",
            alignItems: "center",
            transition: "color .12s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,.5)")}
        >
          {label}
        </a>
      ))}

      {/* Website links */}
      {WEBSITE_LINKS.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "rgba(255,255,255,.5)",
            textDecoration: "none",
            padding: "0 8px",
            height: 36,
            display: "flex",
            alignItems: "center",
            transition: "color .12s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,.5)")}
        >
          {label}
        </a>
      ))}
    </div>
  );
}
