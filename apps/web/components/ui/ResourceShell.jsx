import ErrorBanner from "./ErrorBanner";

/**
 * ResourceShell — standardizes loading / error / not-found guards for detail pages.
 *
 * Wraps the page shell (AppShell > PageShell > PageContent) provided by the caller
 * and renders one of four states:
 *   1. loading  → "Loading…" text (or custom loadingText)
 *   2. error    → ErrorBanner
 *   3. !hasData → not-found message
 *   4. ready    → children
 *
 * Usage:
 *   <AppShell>
 *     <PageShell>
 *       <PageContent>
 *         <ResourceShell loading={loading} error={error} hasData={!!data}
 *           emptyTitle="Not found" emptyMessage="Record not found.">
 *           {() => <Panel>…</Panel>}
 *         </ResourceShell>
 *       </PageContent>
 *     </PageShell>
 *   </AppShell>
 *
 * Props:
 *   loading       — boolean
 *   error         — string | null
 *   hasData       — boolean (typically !!resource)
 *   loadingText   — optional, default "Loading…"
 *   emptyMessage  — shown when !hasData and not loading/error
 *   children      — render function or ReactNode; rendered only when data is ready
 */
export default function ResourceShell({
  loading,
  error,
  hasData,
  loadingText = "Loading…",
  emptyMessage = "Record not found.",
  children,
}) {
  if (loading) {
    return <p className="loading-text">{loadingText}</p>;
  }

  if (error) {
    return <ErrorBanner error={error} />;
  }

  if (!hasData) {
    return <ErrorBanner error={emptyMessage} />;
  }

  return typeof children === "function" ? children() : children;
}
