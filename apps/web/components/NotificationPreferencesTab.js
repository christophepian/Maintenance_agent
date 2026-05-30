/**
 * NotificationPreferencesTab
 *
 * Reusable toggle grid for per-event notification preferences.
 * Opt-out model: absent preference row = enabled (true).
 *
 * Props:
 *   authHeaders  — function returning auth headers { Authorization: ... }
 *   eventGroups  — array of { groupKey, events: [eventType, ...] }
 *   t            — useTranslation function
 *   ns           — i18n namespace string (e.g. "manager", "owner", etc.)
 */
import { useState, useEffect, useCallback } from "react";
import { cn } from "../lib/utils";

export default function NotificationPreferencesTab({ authHeaders, eventGroups, t, ns }) {
  const [prefs, setPrefs] = useState({}); // { [eventType]: boolean }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/notifications/preferences", { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load preferences");
      // Build map from eventType → inApp; absent = true
      const map = {};
      for (const p of json?.data ?? []) {
        map[p.eventType] = p.inApp;
      }
      setPrefs(map);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  function toggle(eventType) {
    setPrefs((prev) => ({ ...prev, [eventType]: !(prev[eventType] ?? true) }));
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      // Build prefs array — only include events in eventGroups
      const allEvents = eventGroups.flatMap((g) => g.events);
      const prefsPayload = allEvents.map((eventType) => ({
        eventType,
        inApp: prefs[eventType] ?? true,
      }));
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ prefs: prefsPayload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to save preferences");
      // Refresh from server
      const map = {};
      for (const p of json?.data ?? []) { map[p.eventType] = p.inApp; }
      setPrefs(map);
      setNotice(t(`${ns}:settings.notifications.saved`));
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="loading-text">{t(`${ns}:settings.notifications.loading`)}</p>;
  }

  return (
    <div className="px-4 py-4 grid gap-6">
      {error && (
        <div className="notice notice-err" role="alert">
          <strong>{t(`${ns}:settings.notifications.error`)}</strong> {error}
        </div>
      )}
      {notice && (
        <div className="notice notice-ok">
          <strong>{t(`${ns}:settings.notifications.ok`)}</strong> {notice}
        </div>
      )}

      {eventGroups.map((group) => (
        <div key={group.groupKey} className="card grid gap-3">
          <div className="font-semibold text-sm text-slate-800">
            {t(`${ns}:settings.notifications.group.${group.groupKey}`)}
          </div>
          <div className="grid gap-2">
            {group.events.map((eventType) => {
              const enabled = prefs[eventType] ?? true;
              return (
                <label
                  key={eventType}
                  className="flex items-center justify-between gap-3 cursor-pointer"
                >
                  <span className="text-sm text-slate-700">
                    {t(`${ns}:settings.notifications.event.${eventType}`)}
                  </span>
                  {/* Toggle switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={t(`${ns}:settings.notifications.event.${eventType}`)}
                    onClick={() => toggle(eventType)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
                      "transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                      enabled ? "bg-blue-600" : "bg-slate-200",
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out",
                        enabled ? "translate-x-5" : "translate-x-0",
                      )}
                    />
                  </button>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <button
          className="button-primary"
          onClick={save}
          disabled={saving}
        >
          {saving
            ? t(`${ns}:settings.notifications.saving`)
            : t(`${ns}:settings.notifications.saveButton`)}
        </button>
      </div>
    </div>
  );
}
