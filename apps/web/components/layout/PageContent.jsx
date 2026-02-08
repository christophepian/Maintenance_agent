import { cn } from "../../lib/utils";

export default function PageContent({ children, className }) {
  return <div className={cn("mt-6 space-y-6", className)}>{children}</div>;
}
