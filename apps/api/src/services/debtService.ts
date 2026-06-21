/**
 * debtService — mortgage amortization + cost of capital.
 *
 * Pure functions (no Prisma). Turns mortgage terms into a year-by-year debt
 * schedule (interest / principal / outstanding balance) and computes the
 * weighted cost of debt and WACC used by the levered (FCFE) NPV layer.
 *
 * Swiss reality notes:
 *   - 1st-rank mortgages are commonly INTEREST_ONLY (no mandatory amortization).
 *   - 2nd-rank tranches amortize (LINEAR or ANNUITY), often to 65% LTV.
 *   - Interest is income-tax deductible (modelled as a shield in the NPV layer).
 *
 * All monetary values in CHF, rates in percent.
 */

export type AmortizationType = "INTEREST_ONLY" | "LINEAR" | "ANNUITY";

/** Default annuity term (years) when a mortgage has no maturity date set. */
const DEFAULT_ANNUITY_TERM_YEARS = 25;

export interface MortgageTerms {
  currentBalanceChf: number;
  interestRatePct: number;
  amortizationType: AmortizationType;
  /** LINEAR: principal repaid per year. Optional otherwise. */
  annualAmortizationChf?: number | null;
  /** Years from projection start until maturity (annuity term anchor). */
  termYears?: number | null;
}

export interface DebtYearFlow {
  /** 1-based year offset from projection start */
  yearOffset: number;
  openingBalanceChf: number;
  interestChf: number;
  principalChf: number;
  /** interest + principal */
  paymentChf: number;
  closingBalanceChf: number;
}

/**
 * Year-by-year amortization schedule for a single mortgage over `horizonYears`.
 * Principal is capped so the balance never goes negative; once repaid, all
 * subsequent flows are zero.
 */
export function buildAmortizationSchedule(terms: MortgageTerms, horizonYears: number): DebtYearFlow[] {
  const r = terms.interestRatePct / 100;
  const flows: DebtYearFlow[] = [];
  let balance = Math.max(0, terms.currentBalanceChf);

  // Annuity constant payment, derived from the remaining term.
  let annuityPayment = 0;
  if (terms.amortizationType === "ANNUITY") {
    const n = Math.max(1, terms.termYears ?? DEFAULT_ANNUITY_TERM_YEARS);
    annuityPayment = r === 0 ? balance / n : (balance * r) / (1 - Math.pow(1 + r, -n));
  }

  for (let y = 1; y <= horizonYears; y++) {
    const openingBalanceChf = balance;
    const interestChf = openingBalanceChf * r;

    let principalChf = 0;
    if (openingBalanceChf > 0) {
      if (terms.amortizationType === "LINEAR") {
        principalChf = terms.annualAmortizationChf ?? (terms.termYears ? openingBalanceChf / terms.termYears : 0);
      } else if (terms.amortizationType === "ANNUITY") {
        principalChf = annuityPayment - interestChf;
      }
      // INTEREST_ONLY → principalChf stays 0
    }
    principalChf = Math.max(0, Math.min(principalChf, openingBalanceChf));

    const closingBalanceChf = openingBalanceChf - principalChf;
    flows.push({
      yearOffset: y,
      openingBalanceChf: Math.round(openingBalanceChf),
      interestChf: Math.round(interestChf),
      principalChf: Math.round(principalChf),
      paymentChf: Math.round(interestChf + principalChf),
      closingBalanceChf: Math.round(closingBalanceChf),
    });
    balance = closingBalanceChf;
  }

  return flows;
}

/**
 * Sum multiple mortgages' schedules into one portfolio-of-debt schedule.
 * Returns a zero-filled schedule (all flows 0) when there are no mortgages.
 */
export function aggregateDebtSchedule(termsList: MortgageTerms[], horizonYears: number): DebtYearFlow[] {
  const empty: DebtYearFlow[] = Array.from({ length: horizonYears }, (_, i) => ({
    yearOffset: i + 1,
    openingBalanceChf: 0,
    interestChf: 0,
    principalChf: 0,
    paymentChf: 0,
    closingBalanceChf: 0,
  }));
  if (termsList.length === 0) return empty;

  const schedules = termsList.map((t) => buildAmortizationSchedule(t, horizonYears));
  return empty.map((_, i) => {
    const year = i + 1;
    let opening = 0, interest = 0, principal = 0, payment = 0, closing = 0;
    for (const s of schedules) {
      opening += s[i].openingBalanceChf;
      interest += s[i].interestChf;
      principal += s[i].principalChf;
      payment += s[i].paymentChf;
      closing += s[i].closingBalanceChf;
    }
    return {
      yearOffset: year,
      openingBalanceChf: opening,
      interestChf: interest,
      principalChf: principal,
      paymentChf: payment,
      closingBalanceChf: closing,
    };
  });
}

/**
 * Balance-weighted average cost of debt, %. Returns null when no debt exists.
 */
export function weightedCostOfDebtPct(
  mortgages: { currentBalanceChf: number; interestRatePct: number }[],
): number | null {
  const totalBalance = mortgages.reduce((s, m) => s + Math.max(0, m.currentBalanceChf), 0);
  if (totalBalance <= 0) return null;
  const weighted = mortgages.reduce((s, m) => s + Math.max(0, m.currentBalanceChf) * m.interestRatePct, 0);
  return Math.round((weighted / totalBalance) * 100) / 100;
}

export interface WaccInput {
  /** Building market value, CHF (V). Equity E = max(0, V − D). */
  marketValueChf: number;
  /** Total outstanding debt, CHF (D). */
  totalDebtChf: number;
  /** Cost of equity, % (the owner's hurdle — the existing discount rate). */
  costOfEquityPct: number;
  /** Pre-tax cost of debt, %. */
  costOfDebtPct: number;
  /** Marginal tax rate, % (interest deductibility). */
  taxRatePct: number;
}

/**
 * Weighted average cost of capital, %.
 * WACC = (E/V)·Re + (D/V)·Rd·(1 − tax), with E = max(0, marketValue − debt).
 * Falls back to cost of equity when there is no value or no debt.
 */
export function waccPct(input: WaccInput): number {
  const equity = Math.max(0, input.marketValueChf - input.totalDebtChf);
  const debt = Math.max(0, input.totalDebtChf);
  const v = equity + debt;
  if (v <= 0) return input.costOfEquityPct;
  const afterTaxDebt = input.costOfDebtPct * (1 - input.taxRatePct / 100);
  const wacc = (equity / v) * input.costOfEquityPct + (debt / v) * afterTaxDebt;
  return Math.round(wacc * 100) / 100;
}
