import { useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

/**
 * ScrollableTabs — drop-in replacement for <div className="tab-strip">.
 *
 * On mobile the tab strip scrolls horizontally (handled by global .tab-strip CSS).
 * This component additionally scrolls the active tab into view on mount and on change.
 * On desktop the behaviour is identical to a plain .tab-strip div.
 *
 * Usage:
 *   <ScrollableTabs activeIndex={currentTab}>
 *     <button className={currentTab === 0 ? 'tab-btn-active' : 'tab-btn'}>Tab 1</button>
 *     <button className={currentTab === 1 ? 'tab-btn-active' : 'tab-btn'}>Tab 2</button>
 *   </ScrollableTabs>
 *
 * Props:
 *   activeIndex — zero-based index of the currently active tab child
 *   className   — additional classes merged onto the tab-strip wrapper
 *   children    — tab button elements (direct children indexed by activeIndex)
 */
export default function ScrollableTabs({ children, activeIndex, className }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || activeIndex == null) return;
    const buttons = ref.current.children;
    const active = buttons[activeIndex];
    if (active) {
      active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, [activeIndex]);

  return (
    <div ref={ref} className={cn('tab-strip', className)}>
      {children}
    </div>
  );
}
