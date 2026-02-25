/**
 * In-process domain event bus.
 *
 * Provides a lightweight pub/sub mechanism so route handlers can emit
 * events without knowing what listeners exist.  Listeners are
 * registered at startup (see `events/handlers.ts`).
 *
 * Design decisions:
 *  • Synchronous dispatch within the request — handlers that fail
 *    are logged but never crash the request.
 *  • Handlers run sequentially (ordered registration) so the audit
 *    persist handler always runs first.
 *  • No distributed transport; single-process only (M5+ may add
 *    Redis Streams or similar).
 */

import { DomainEvent, DomainEventType, DomainEventMap } from "./types";

type EventHandler<T extends DomainEventType> = (event: DomainEvent<T>) => Promise<void>;

/* Listeners stored per event type */
const listeners = new Map<DomainEventType, EventHandler<any>[]>();

/**
 * Subscribe to a specific event type.
 *
 * Example:
 *   on("OWNER_APPROVED", async (event) => {
 *     // event.payload is RequestApprovedPayload
 *   });
 */
export function on<T extends DomainEventType>(
  type: T,
  handler: EventHandler<T>,
): void {
  const handlers = listeners.get(type) || [];
  handlers.push(handler);
  listeners.set(type, handlers);
}

/**
 * Subscribe to ALL event types (wildcard listener).
 * Used primarily by the audit/persist handler.
 */
export function onAll(handler: (event: DomainEvent) => Promise<void>): void {
  // Store under a synthetic key; emit() checks this separately.
  const handlers = listeners.get("*" as any) || [];
  handlers.push(handler);
  listeners.set("*" as any, handlers);
}

/**
 * Emit a domain event.
 *
 * Runs all matching handlers sequentially.  If any handler throws,
 * the error is logged but does NOT propagate to the caller.
 *
 * Returns the event (with timestamp filled in).
 */
export async function emit<T extends DomainEventType>(
  event: DomainEvent<T>,
): Promise<DomainEvent<T>> {
  const stamped = { ...event, timestamp: event.timestamp || new Date().toISOString() };

  /* Run wildcard handlers first (audit/persist) */
  const wildcardHandlers = listeners.get("*" as any) || [];
  for (const handler of wildcardHandlers) {
    try {
      await handler(stamped);
    } catch (err) {
      console.error(`[EVENT BUS] Wildcard handler error for ${stamped.type}:`, err);
    }
  }

  /* Run type-specific handlers */
  const typeHandlers = listeners.get(event.type) || [];
  for (const handler of typeHandlers) {
    try {
      await handler(stamped);
    } catch (err) {
      console.error(`[EVENT BUS] Handler error for ${stamped.type}:`, err);
    }
  }

  return stamped;
}

/**
 * Remove all listeners.  Used in tests to reset the bus.
 */
export function clearAllListeners(): void {
  listeners.clear();
}

/**
 * Get current listener count (for diagnostics/tests).
 */
export function listenerCount(type?: DomainEventType): number {
  if (type) return (listeners.get(type) || []).length;
  let total = 0;
  for (const handlers of listeners.values()) {
    total += handlers.length;
  }
  return total;
}
