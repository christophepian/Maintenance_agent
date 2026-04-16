import { cn } from "../../lib/utils";

/**
 * Input — styled text input with optional label.
 * Replaces raw <input style={{...}}> with Tailwind-backed component.
 */
export default function Input({
  label,
  className,
  wrapperClassName,
  ...props
}) {
  return (
    <div className={wrapperClassName}>
      {label && <label className="filter-label">{label}</label>}
      <input
        className={cn(
          "filter-input w-full",
          className
        )}
        {...props}
      />
    </div>
  );
}
