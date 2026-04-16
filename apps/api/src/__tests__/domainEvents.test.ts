/**
 * Unit tests for M4: Domain event bus.
 */
import { emit, on, onAll, clearAllListeners, listenerCount } from "../events/bus";
import type { DomainEvent } from "../events/types";

beforeEach(() => {
  clearAllListeners();
});

describe("Event bus basics", () => {
  test("emit with no listeners does not throw", async () => {
    const event = await emit({
      type: "OWNER_APPROVED",
      orgId: "org-1",
      payload: { requestId: "req-1" },
    });
    expect(event.type).toBe("OWNER_APPROVED");
    expect(event.timestamp).toBeDefined();
  });

  test("type-specific listener receives matching events", async () => {
    const received: DomainEvent<"OWNER_APPROVED">[] = [];
    on("OWNER_APPROVED", async (e) => {
      received.push(e);
    });

    await emit({
      type: "OWNER_APPROVED",
      orgId: "org-1",
      payload: { requestId: "req-1", comment: "looks good" },
    });

    expect(received).toHaveLength(1);
    expect(received[0].payload.requestId).toBe("req-1");
    expect(received[0].payload.comment).toBe("looks good");
  });

  test("listener does NOT receive non-matching events", async () => {
    const received: any[] = [];
    on("REQUEST_REJECTED", async (e) => {
      received.push(e);
    });

    await emit({
      type: "OWNER_APPROVED",
      orgId: "org-1",
      payload: { requestId: "req-1" },
    });

    expect(received).toHaveLength(0);
  });

  test("wildcard listener receives all events", async () => {
    const received: DomainEvent[] = [];
    onAll(async (e) => {
      received.push(e);
    });

    await emit({
      type: "OWNER_APPROVED",
      orgId: "org-1",
      payload: { requestId: "req-1" },
    });
    await emit({
      type: "INVOICE_PAID",
      orgId: "org-1",
      payload: { invoiceId: "inv-1", amount: 100 },
    });

    expect(received).toHaveLength(2);
    expect(received[0].type).toBe("OWNER_APPROVED");
    expect(received[1].type).toBe("INVOICE_PAID");
  });

  test("wildcard runs before type-specific handlers", async () => {
    const order: string[] = [];
    onAll(async () => {
      order.push("wildcard");
    });
    on("OWNER_APPROVED", async () => {
      order.push("type-specific");
    });

    await emit({
      type: "OWNER_APPROVED",
      orgId: "org-1",
      payload: { requestId: "req-1" },
    });

    expect(order).toEqual(["wildcard", "type-specific"]);
  });
});

describe("Error isolation", () => {
  test("handler error is caught and does not propagate", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    on("OWNER_APPROVED", async () => {
      throw new Error("handler crashed");
    });

    // Should NOT throw
    const event = await emit({
      type: "OWNER_APPROVED",
      orgId: "org-1",
      payload: { requestId: "req-1" },
    });

    expect(event.type).toBe("OWNER_APPROVED");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[EVENT BUS]"),
      expect.anything(),
    );

    consoleSpy.mockRestore();
  });

  test("wildcard error does not prevent type-specific from running", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const received: string[] = [];

    onAll(async () => {
      throw new Error("wildcard crashed");
    });
    on("OWNER_APPROVED", async () => {
      received.push("ran");
    });

    await emit({
      type: "OWNER_APPROVED",
      orgId: "org-1",
      payload: { requestId: "req-1" },
    });

    expect(received).toEqual(["ran"]);
    consoleSpy.mockRestore();
  });
});

describe("Utility functions", () => {
  test("clearAllListeners removes everything", () => {
    on("OWNER_APPROVED", async () => {});
    on("INVOICE_PAID", async () => {});
    onAll(async () => {});

    expect(listenerCount()).toBeGreaterThan(0);
    clearAllListeners();
    expect(listenerCount()).toBe(0);
  });

  test("listenerCount by type", () => {
    on("OWNER_APPROVED", async () => {});
    on("OWNER_APPROVED", async () => {});
    on("INVOICE_PAID", async () => {});

    expect(listenerCount("OWNER_APPROVED")).toBe(2);
    expect(listenerCount("INVOICE_PAID")).toBe(1);
    expect(listenerCount("REQUEST_REJECTED")).toBe(0);
  });

  test("emit auto-fills timestamp", async () => {
    const before = new Date().toISOString();
    const event = await emit({
      type: "OWNER_APPROVED",
      orgId: "org-1",
      payload: { requestId: "req-1" },
    });
    const after = new Date().toISOString();

    expect(event.timestamp).toBeDefined();
    expect(event.timestamp! >= before).toBe(true);
    expect(event.timestamp! <= after).toBe(true);
  });

  test("emit preserves provided timestamp", async () => {
    const ts = "2025-01-01T00:00:00.000Z";
    const event = await emit({
      type: "OWNER_APPROVED",
      orgId: "org-1",
      payload: { requestId: "req-1" },
      timestamp: ts,
    });
    expect(event.timestamp).toBe(ts);
  });
});
