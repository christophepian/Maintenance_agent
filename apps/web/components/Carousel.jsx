import { useState, useRef, useLayoutEffect, useCallback } from "react";
import { cn } from "../lib/utils";

/**
 * Infinite left/right carousel that shows one slide at a time and resizes its
 * height to the active slide. Navigation: prev/next arrows, dot indicators
 * (tap to jump), touch-swipe, and ←/→ keys when focused. Each `slides` entry is
 * a self-contained card; `labels` (optional) name the dots for a11y.
 */
export default function Carousel({ slides, labels = [] }) {
  const n = slides.length;
  const [i, setI] = useState(0);
  const [h, setH] = useState(undefined);
  const slideRefs = useRef([]);
  const touchX = useRef(null);

  const go = useCallback((next) => { if (n > 0) setI(((next % n) + n) % n); }, [n]);

  // Clamp during render (not via setState-in-effect) so a shrinking slide count
  // — e.g. the vendors slide appearing/disappearing — can't strand the index.
  const active = n > 0 ? Math.min(i, n - 1) : 0;

  // Size the viewport to the active slide, and follow its content changes
  // (e.g. an inner "show all" expand) via a ResizeObserver.
  useLayoutEffect(() => {
    const el = slideRefs.current[active];
    if (!el) return;
    const measure = () => setH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active, n]);

  if (n === 0) return null;

  return (
    <div
      className="relative"
      role="group"
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") { e.preventDefault(); go(active - 1); }
        else if (e.key === "ArrowRight") { e.preventDefault(); go(active + 1); }
      }}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div className="overflow-hidden transition-[height] duration-300 ease-out" style={{ height: h /* no-token: measured active-slide height */ }}>
        <div className="flex items-start transition-transform duration-300 ease-out" style={{ transform: `translateX(-${active * 100}%)` /* no-token: dynamic slide offset */ }}>
          {slides.map((s, idx) => (
            <div
              key={idx}
              ref={(el) => { slideRefs.current[idx] = el; }}
              className="w-full shrink-0"
              aria-hidden={idx !== active}
            >
              {s}
            </div>
          ))}
        </div>
      </div>

      {n > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => go(active - 1)}
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-surface shadow-md text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <span className="-mt-0.5 text-lg leading-none">‹</span>
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => go(active + 1)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-surface shadow-md text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <span className="-mt-0.5 text-lg leading-none">›</span>
          </button>
          <div className="mt-3 flex items-center justify-center gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={labels[idx] || `Slide ${idx + 1}`}
                aria-current={idx === active}
                onClick={() => setI(idx)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  idx === active ? "w-5 bg-brand" : "w-2 bg-surface-border hover:bg-muted-ring",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
