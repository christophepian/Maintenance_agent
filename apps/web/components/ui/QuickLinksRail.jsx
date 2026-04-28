// QuickLinksRail.jsx
// Icon-rail quick links — most compact mobile pattern.
// Horizontal row of 4–5 icon tiles with short labels and optional count badges.
// Best when destinations are FREQUENT and ICONS are RECOGNIZABLE (≤5 items).

import Link from "next/link";

export default function QuickLinksRail({ items }) {
  return (
    <nav aria-label="Quick links" className="flex justify-between gap-1 py-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex flex-1 flex-col items-center gap-1.5 no-underline text-inherit"
          aria-label={
            item.count > 0 ? `${item.label} (${item.count})` : item.label
          }
        >
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            {item.icon}
            {item.count > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5
                           rounded-full bg-destructive border-2 border-white
                           min-w-[18px] px-1 py-px
                           text-[10px] font-bold leading-none text-white
                           text-center tabular-nums"
              >
                {item.count > 99 ? "99+" : item.count}
              </span>
            )}
          </span>
          <span className="text-[11px] font-medium text-slate-600 text-center -tracking-[0.005em]">
            {item.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
