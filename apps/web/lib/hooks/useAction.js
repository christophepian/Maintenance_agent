import { useState, useCallback } from "react";

/**
 * useAction — thin pending-state wrapper for page mutations.
 *
 * Manages a single pending key (string | true | null) so buttons can
 * show loading state and disable during async operations.
 *
 * Usage:
 *   const { pending, run } = useAction();
 *
 *   // Keyed (multiple actions):
 *   await run("approve", async () => { ... });
 *   disabled={!!pending}
 *   {pending === "approve" ? "Approving…" : "Approve"}
 *
 *   // Boolean (single action):
 *   await run(async () => { ... });
 *   disabled={!!pending}
 *
 * The hook only manages pending state. All business logic (fetch, alerts,
 * confirms, redirects, refreshes) stays in the caller's async function.
 */
export function useAction() {
  const [pending, setPending] = useState(null);

  const run = useCallback(async (keyOrFn, maybeFn) => {
    const key = typeof keyOrFn === "function" ? true : keyOrFn;
    const fn = typeof keyOrFn === "function" ? keyOrFn : maybeFn;
    setPending(key);
    try {
      await fn();
    } finally {
      setPending(null);
    }
  }, []);

  return { pending, run };
}
