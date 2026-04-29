import { useRef, useEffect, useState, Children, cloneElement, useCallback } from 'react';
import { cn } from '../../lib/utils';
import BottomSheet from './BottomSheet';

/**
 * ScrollableTabs — tab strip with overflow "More" bottom sheet for narrow viewports.
 *
 * wrapperRef  — full-width div with overflow:hidden; measures available width.
 * hiddenRef   — off-screen row that measures each tab's natural width.
 */
export default function ScrollableTabs({ children, activeIndex, className }) {
  const wrapperRef  = useRef(null);
  const hiddenRef   = useRef(null);
  const stripRef    = useRef(null);
  const [widths, setWidths]         = useState(null);
  const [containerW, setContainerW] = useState(null);
  const [moreOpen, setMoreOpen]     = useState(false);

  const tabs = Children.toArray(children);

  // 1. Measure each tab's natural width off-screen
  useEffect(() => {
    if (!hiddenRef.current) return;
    const buttons = Array.from(hiddenRef.current.children);
    if (buttons.length === 0) return;
    setWidths(buttons.map((el) => el.getBoundingClientRect().width));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  // 2. Track wrapper width (overflow:hidden gives true available width)
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => setContainerW(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 3. Scroll active visible tab into view
  useEffect(() => {
    if (!stripRef.current || activeIndex == null) return;
    const buttons = stripRef.current.querySelectorAll(':scope > button');
    const active = buttons[activeIndex];
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  // 4. Compute visible / overflow split
  const MORE_BTN_W = 80;

  const { visibleIndexes, overflowIndexes } = (() => {
    if (!widths || !containerW || widths.length !== tabs.length) {
      return { visibleIndexes: tabs.map((_, i) => i), overflowIndexes: [] };
    }
    const totalW = widths.reduce((s, w) => s + w, 0);
    if (totalW <= containerW) {
      return { visibleIndexes: tabs.map((_, i) => i), overflowIndexes: [] };
    }
    const available = containerW - MORE_BTN_W;
    const visible = [];
    const overflow = [];
    let used = 0;
    for (let i = 0; i < tabs.length; i++) {
      if (used + widths[i] <= available) { visible.push(i); used += widths[i]; }
      else { overflow.push(i); }
    }
    // Promote active tab out of overflow
    if (activeIndex != null && overflow.includes(activeIndex)) {
      const lastVisible = visible[visible.length - 1];
      visible[visible.length - 1] = activeIndex;
      overflow.splice(overflow.indexOf(activeIndex), 1);
      overflow.unshift(lastVisible);
    }
    return { visibleIndexes: visible, overflowIndexes: overflow };
  })();

  const hasOverflow = overflowIndexes.length > 0;
  const isMoreActive = activeIndex != null && overflowIndexes.includes(activeIndex);
  const closeMore = useCallback(() => setMoreOpen(false), []);

  return (
    <>
      {/* Hidden measurement row */}
      <div
        ref={hiddenRef}
        aria-hidden="true"
        className="fixed flex whitespace-nowrap pointer-events-none text-[15px]"
        style={{ top: -9999, left: 0, visibility: 'hidden' }}
      >
        {tabs.map((tab, i) => cloneElement(tab, { key: i, tabIndex: -1 }))}
      </div>

      {/* Outer wrapper: overflow hidden so getBoundingClientRect gives true width */}
      <div ref={wrapperRef} className={cn('w-full min-w-0 overflow-hidden', className)}>
        <div ref={stripRef} className="tab-strip">
          {visibleIndexes.map((i) => tabs[i])}
          {hasOverflow && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn('tab-btn shrink-0', isMoreActive && 'tab-btn-active')}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
            >
              More ▾
            </button>
          )}
        </div>
      </div>

      {/* Overflow bottom sheet */}
      {hasOverflow && (
        <BottomSheet open={moreOpen} onClose={closeMore} title="More">
          <div className="divide-y divide-slate-100">
            {overflowIndexes.map((i) => {
              const tab = tabs[i];
              const isActive = i === activeIndex;
              return (
                <button
                  key={i}
                  type="button"
                  className={cn(
                    'w-full text-left px-1 py-3.5 text-sm font-medium',
                    isActive ? 'text-indigo-600 font-semibold' : 'text-slate-700 hover:text-slate-900',
                  )}
                  onClick={() => { tab.props.onClick?.(); closeMore(); }}
                >
                  {tab.props.children}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
