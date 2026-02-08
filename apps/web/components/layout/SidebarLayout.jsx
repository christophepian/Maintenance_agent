import { cn } from "../../lib/utils";

export default function SidebarLayout({ sidebar, children, className }) {
  return (
    <div className={cn("grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]", className)}>
      <aside className="w-full">{sidebar}</aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
