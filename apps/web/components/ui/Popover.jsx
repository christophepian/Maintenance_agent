import * as RPopover from "@radix-ui/react-popover";
import { cn } from "../../lib/utils";

export function Popover({ open, onOpenChange, children }) {
  return <RPopover.Root open={open} onOpenChange={onOpenChange}>{children}</RPopover.Root>;
}

export const PopoverTrigger = RPopover.Trigger;
export const PopoverClose = RPopover.Close;

export function PopoverContent({ children, className, align = "end", sideOffset = 4 }) {
  return (
    <RPopover.Portal>
      <RPopover.Content
        align={align}
        sideOffset={sideOffset}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "z-50 rounded-lg border border-slate-200 bg-white shadow-lg",
          "focus:outline-none",
          className
        )}
      >
        {children}
      </RPopover.Content>
    </RPopover.Portal>
  );
}
