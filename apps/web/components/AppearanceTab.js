/**
 * AppearanceTab
 *
 * Dark / Light mode toggle for settings pages.
 *
 * Props:
 *   t   — useTranslation function
 *   ns  — i18n namespace string (e.g. "manager", "owner", etc.)
 */
import { useTheme } from "../hooks/useTheme";
import { cn } from "../lib/utils";

export default function AppearanceTab({ t, ns }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid gap-6">
      <div className="card grid gap-4">
        <div className="font-semibold text-sm text-foreground">
          {t(`${ns}:settings.appearance.colorScheme`)}
        </div>

        {/* Light option */}
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-muted-dark">
              {t(`${ns}:settings.appearance.light`)}
            </p>
            <p className="text-xs text-muted">
              {t(`${ns}:settings.appearance.lightDescription`)}
            </p>
          </div>
          <button
            type="button"
            role="radio"
            aria-checked={theme === "light"}
            aria-label={t(`${ns}:settings.appearance.light`)}
            onClick={() => setTheme("light")}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
              "transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
              theme === "light" ? "bg-blue-600" : "bg-surface-border",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out", /* no-token: toggle thumb is always white */
                theme === "light" ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
        </label>

        {/* Dark option */}
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-muted-dark">
              {t(`${ns}:settings.appearance.dark`)}
            </p>
            <p className="text-xs text-muted">
              {t(`${ns}:settings.appearance.darkDescription`)}
            </p>
          </div>
          <button
            type="button"
            role="radio"
            aria-checked={theme === "dark"}
            aria-label={t(`${ns}:settings.appearance.dark`)}
            onClick={() => setTheme("dark")}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
              "transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
              theme === "dark" ? "bg-blue-600" : "bg-surface-border",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out", /* no-token: toggle thumb is always white */
                theme === "dark" ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
        </label>
      </div>
    </div>
  );
}
