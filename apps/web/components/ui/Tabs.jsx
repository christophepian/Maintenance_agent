import * as RTabs from "@radix-ui/react-tabs";
import { cn } from "../../lib/utils";

export function Tabs({ value, onValueChange, defaultValue, className, children }) {
  return (
    <RTabs.Root
      value={value}
      onValueChange={onValueChange}
      defaultValue={defaultValue}
      className={className}
    >
      {children}
    </RTabs.Root>
  );
}

export function TabsList({ className, children, unstyled = false }) {
  return (
    <RTabs.List className={unstyled ? cn(className) : cn("tab-strip", className)}>
      {children}
    </RTabs.List>
  );
}

export function TabsTrigger({ value, children, className, unstyled = false }) {
  return (
    <RTabs.Trigger
      value={value}
      className={unstyled
        ? cn("cursor-pointer focus-visible:outline-none", className)
        : cn(
            "px-5 py-2.5 text-sm font-medium bg-transparent",
            "border-0 border-b-2 -mb-px cursor-pointer whitespace-nowrap transition-colors",
            "text-slate-500 border-transparent hover:text-slate-700",
            "data-[state=active]:text-brand data-[state=active]:border-brand",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
            className
          )
      }
    >
      {children}
    </RTabs.Trigger>
  );
}

export function TabsContent({ value, children, className }) {
  return (
    <RTabs.Content value={value} className={cn("focus:outline-none", className)}>
      {children}
    </RTabs.Content>
  );
}
