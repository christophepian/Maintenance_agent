/**
 * Domain events barrel export.
 *
 * Usage in route handlers:
 *   import { emit } from "../events";
 *   await emit({ type: "OWNER_APPROVED", orgId, payload: { requestId } });
 */
export { emit, on, onAll, clearAllListeners, listenerCount } from "./bus";
export type { DomainEvent, DomainEventType, DomainEventMap } from "./types";
export { registerEventHandlers } from "./handlers";
