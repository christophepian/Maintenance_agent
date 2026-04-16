import { cn } from "../../lib/utils";

/**
 * Select — styled select dropdown with optional label.
 * Replaces raw <select style={{...}}> with Tailwind-backed component.
 */
export default function Select({
  label,
  options = [],
  placeholder,
  className,
  wrapperClassName,
  ...props
}) {
  return (
    <div className={wrapperClassName}>
      {label && <label className="filter-label">{label}</label>}
      <select
        className={cn("filter-select", className)}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) =>
          typeof opt === "string" ? (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ) : (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          )
        )}
      </select>
    </div>
  );
}
