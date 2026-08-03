/**
 * financeMath — generic time-value-of-money helpers.
 *
 * Pure functions, no Prisma. Used by the levered (FCFE) NPV layer to turn an
 * equity cash-flow series into a present value and an internal rate of return.
 *
 * Convention: cashFlows[0] is the t0 flow (typically the negative initial
 * equity outlay); cashFlows[t] is the flow at the end of year t. Rates are
 * expressed in percent (e.g. 5 = 5%).
 */

/** Net present value of a cash-flow series discounted at `ratePct` per period. */
export function npvAtRate(cashFlows: number[], ratePct: number): number {
  const r = ratePct / 100;
  let pv = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    pv += cashFlows[t] / Math.pow(1 + r, t);
  }
  return pv;
}

/**
 * Internal rate of return (the rate at which NPV = 0), in percent.
 *
 * Solved by bisection over a bracketed range. Returns null when the series has
 * no sign change (no real IRR) or no bracket can be found — this is why IRR is
 * a footgun on unconventional flows and we surface it only for the
 * single-sign-change equity series.
 *
 * @param cashFlows series with cashFlows[0] at t0
 * @param loPct lower bound of the search range (default -99%)
 * @param hiPct upper bound of the search range (default 1000%)
 */
export function irr(cashFlows: number[], loPct = -99, hiPct = 1000): number | null {
  if (cashFlows.length < 2) return null;
  const hasPos = cashFlows.some((c) => c > 0);
  const hasNeg = cashFlows.some((c) => c < 0);
  if (!hasPos || !hasNeg) return null; // need at least one inflow and one outflow

  let lo = loPct;
  let hi = hiPct;
  let fLo = npvAtRate(cashFlows, lo);
  let fHi = npvAtRate(cashFlows, hi);

  // If the endpoints don't bracket a root, scan for a sign change.
  if (fLo * fHi > 0) {
    let prevRate = lo;
    let prevVal = fLo;
    let found = false;
    for (let rate = lo + 1; rate <= hi; rate += 1) {
      const val = npvAtRate(cashFlows, rate);
      if (prevVal * val <= 0) {
        lo = prevRate;
        hi = rate;
        fLo = prevVal;
        fHi = val;
        found = true;
        break;
      }
      prevRate = rate;
      prevVal = val;
    }
    if (!found) return null;
  }

  // Bisection
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npvAtRate(cashFlows, mid);
    if (Math.abs(fMid) < 1e-6 || (hi - lo) < 1e-7) return Math.round(mid * 100) / 100;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return Math.round(((lo + hi) / 2) * 100) / 100;
}
