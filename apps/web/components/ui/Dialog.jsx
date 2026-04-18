import * as RDialog from "@radix-ui/react-dialog";
import { cn } from "../../lib/utils";

export function Dialog({ open, onOpenChange, children }) {
  return <RDialog.Root open={open} onOpenChange={onOpenChange}>{children}</RDialog.Root>;
}

export function DialogTrigger({ children }) {
  return <RDialog.Trigger asChild>{children}</RDialog.Trigger>;
}

export function DialogContent({ children, className, maxWidth = "max-w-lg" }) {
  return (
    <RDialog.Portal>
      <RDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <RDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "w-full mx-4 max-h-[90vh] overflow-y-auto",
          "bg-white rounded-xl shadow-xl focus:outline-none",
          maxWidth,
          className
        )}
      >
        {children}
      </RDialog.Content>
    </RDialog.Portal>
  );
}

export function DialogHeader({ title }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
      <RDialog.Title className="text-lg font-semibold text-slate-900">{title}</RDialog.Title>
      <RDialog.Close
        className="text-slate-400 hover:text-slate-600 text-xl leading-none focus:outline-none"
        aria-label="Close"
      >
        &times;
      </RDialog.Close>
    </div>
  );
}
