import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * AccordionSection — collapsible content block for dashboards and reporting.
 *
 * On desktop set forceOpen={true} to act as a plain non-collapsible section.
 * On mobile it collapses by default (except when defaultOpen={true}).
 * The collapse toggle is hidden when forceOpen is true.
 *
 * Props:
 *   title       — section heading shown in the header bar
 *   badge       — optional short summary shown in the header when collapsed (e.g. "CHF 4,230")
 *   defaultOpen — whether the section starts expanded (default false)
 *   forceOpen   — when true, always expanded and not togglable (desktop use)
 *   children    — section body content
 */
export default function AccordionSection({
  title,
  badge,
  defaultOpen = false,
  forceOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forceOpen || open;

  return (
    <div className="border border-slate-200 rounded-xl mb-3 overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => { if (!forceOpen) setOpen((o) => !o); }}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          'text-sm font-semibold text-slate-800 bg-white transition-colors text-left',
          !forceOpen && 'hover:bg-slate-50 cursor-pointer',
          forceOpen && 'cursor-default',
        )}
        aria-expanded={isOpen}
        disabled={forceOpen}
      >
        <span>{title}</span>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {badge && !isOpen && (
            <span className="text-xs font-medium text-slate-500">{badge}</span>
          )}
          {!forceOpen && (
            <ChevronRight
              size={16}
              className={cn('text-slate-400 transition-transform duration-200', isOpen && 'rotate-90')}
              aria-hidden="true"
            />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  );
}
