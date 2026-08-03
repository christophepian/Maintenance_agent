import { mapWithConcurrency } from "../utils/concurrency";

describe("mapWithConcurrency", () => {
  it("preserves input order regardless of completion order", async () => {
    // Later items resolve faster, so completion order != input order.
    const out = await mapWithConcurrency([0, 1, 2, 3, 4], 2, async (n) => {
      await new Promise((r) => setTimeout(r, (5 - n) * 5));
      return n * 10;
    });
    expect(out).toEqual([0, 10, 20, 30, 40]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 3, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1); // actually ran concurrently
  });

  it("returns [] for empty input and passes the index", async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
    const idx = await mapWithConcurrency(["a", "b", "c"], 10, async (_v, i) => i);
    expect(idx).toEqual([0, 1, 2]);
  });

  it("rejects if any task rejects (Promise.all semantics)", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      }),
    ).rejects.toThrow("boom");
  });
});
