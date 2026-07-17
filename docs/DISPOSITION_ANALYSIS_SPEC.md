# Disposition Analysis — Specification

> **Status:** Draft for review (2026-07-17). Companion to the shipped **Unit profitability** sub-tab (PR #83).
> **Purpose:** let owners of a building compare **Hold** vs **Sell-and-redeploy** vs **Split** (partition among co-owners, or constitute PPE and sell units) on a net-of-tax, per-owner basis.
> **Grounding:** schema/service inventory done 2026-07-17. EXISTS/MISSING map in [Appendix A](#appendix-a--existsmissing-inventory).

---

## 1. Thesis

Reporting answers *"how did it perform,"* the NPV engine answers *"invest/defer/neglect on a building you're **keeping**."* Neither answers the owners' actual question — **what to do with the asset**. This is a capital-allocation / disposition decision, and it needs three things the platform doesn't have yet: a **cost basis**, **ownership shares**, and a **disposal-economics** layer that turns a gross valuation into **net proceeds**.

The analytical spine is already shipped: the **yield-on-value spread** per unit (Unit profitability sub-tab). Low-yield / high-value units are sell/PPE candidates; high-yield units are keepers. This spec builds the scenario engine on top of it.

## 2. The three scenarios and their variables

### A — Hold (baseline)
Mostly covered today: per-unit + building NOI ✓, forward capex (renovation opportunities + NPV Invest/Defer/Neglect) ✓, levered LTV/DSCR ✓, income-tax shield ✓, terminal value ✓ (gross, crude). Gaps: terminal value is **not net-of-tax**; no per-unit debt allocation. This is the reference the other two are measured against.

### B — Sell the whole building & redeploy
`Net proceeds = gross sale price − selling costs − real-estate capital-gains tax − mortgage payoff − prepayment penalty`, then reinvest at a hurdle less acquisition costs on the replacement.

| Variable | Status |
|---|---|
| Gross sale price (`marketValueChf`), mortgage payoff (`currentBalanceChf`), hurdle/discount rate | ✅ |
| **Acquisition price + date** → cost basis **and holding period** | ❌ |
| **Capital-gains tax** (impôt sur les gains immobiliers — cantonal, **degressive with holding period**) | ❌ |
| Selling costs (agent/notary); **droits de mutation** on the replacement | ❌ |
| Mortgage **prepayment penalty** | ❌ |
| Reinvestment / alternative-asset return | ❌ (input) |
| **SELL / reinvest-at-hurdle** branch in the engine | ❌ |

> **Swiss specific — no rollover.** There is **no 1031-style deferral** for investment property (Ersatzbeschaffung is owner-occupied/business only). The capital-gains tax is an **immediate cash cost** on redeployment. Because the rate is **degressive with holding period**, the acquisition date can flip the decision (short hold → punitive tax → Hold wins; long hold → low tax → Sell viable). The missing acquisition basis is the keystone.

### C — Split
Disambiguate — two distinct actions, same missing plumbing:
- **(i) Partition the co-ownership** (sortie d'indivision): each co-owner takes specific units instead of an undivided share; needs an equalisation payment (*soulte*) when unit values differ.
- **(ii) Constitute PPE and sell units individually**: condominiumisation → retail exit.

| Variable | Status |
|---|---|
| **Per-unit value** (intrinsic + market estimate) | ✅ shipped |
| **Ownership shares / quote-parts** on `BuildingOwner` | ❌ pure join, no share |
| **PPE lots + millièmes** (saleable lots with quote-parts) | ❌ only lot *counts* + billing-only `fixedSharePermille` |
| **Block-vs-retail premium** (Σ unit values typically 10–30 % > block value) | ❌ |
| **Sitting-tenant discount** (occupied units sell for less) | occupancy ✓, discount ❌ |
| **LDTR feasibility** (GE/VD restrict rental → PPE-for-sale) | ❌ — can be *dispositive* |
| PPE constitution costs, absorption timeline + carrying costs, per-unit gains, *soulte* | ❌ |

> **LDTR is a gate.** In Geneva/Vaud, converting occupied rentals to PPE-for-sale may be prohibited or require authorisation. Check feasibility **before** modelling scenario C — don't present an illegal option.

## 3. Data model additions

### 3.1 Ownership shares — `BuildingOwner` (highest leverage, cheapest)
Add to the join:
```
sharePermille  Int?     // ownership quote-part, ‰ 0–1000 (co-ownership weight)
isPrimary      Boolean  @default(false)
```
Unlocks: per-owner NOI/value/proceeds allocation, the multi-owner reconciliation the strategy engine already gestures at, and the partition scenario. Guardrail: shares should sum to 1000 per building (validation warning, not hard fail — legacy data).

### 3.2 Acquisition basis — `Building` (the keystone)
```
acquisitionValueChf  Int?
acquiredAt           DateTime?
acquisitionCostsChf  Int?   // notary/transfer paid at purchase, adds to basis
```
Unlocks: cost basis → capital-gains base, **total return**, and true **IRR/MOIC**.

### 3.3 Disposal economics — new `DispositionAssumption` (per building, editable)
```
model DispositionAssumption {
  buildingId               String @unique
  // sale side
  sellingCostPct           Float?   // agent + notary, % of price
  capitalGainsTaxSchedule  Json?    // canton degressive table (holdingYears → rate), see Appendix B
  mortgagePrepaymentPct    Float?   // break cost, % of balance (or a flat field)
  // reinvestment
  reinvestHurdlePct        Float?   // target return on redeployed proceeds
  acquisitionTransferPct   Float?   // droits de mutation on the replacement
  // split / PPE
  blockToRetailPremiumPct  Float?   // Σ unit retail vs block value uplift
  sittingTenantDiscountPct Float?   // haircut on occupied-unit sale
  ppeConstitutionCostChf   Int?
  absorptionMonths         Int?     // time to sell all units
  ldtrStatus               LdtrStatus @default(UNKNOWN) // ALLOWED | RESTRICTED | PROHIBITED | UNKNOWN
}
```
Canton-scoped defaults (capital-gains schedule, transfer-tax rate, typical selling cost) seed from `LegalVariable` (the canton-scoped infra already used for the energy/MuKEn work), owner-overridable.

## 4. Engine extension (`npvService`)

Keep the engine's design: callers supply the numbers; the disposal math lives in a new pure helper.

- **`disposalEconomics.ts` (pure):** `netSaleProceeds(grossPrice, sellingCostPct, gainsTax(basis, holdingYears, schedule), mortgagePayoff, prepaymentPct)`. Unit-tested against the cantonal schedule.
- **SELL scenario:** cash flows to the horizon = hold cash flows up to sale year, then a one-time **net proceeds** inflow, compared against reinvesting those proceeds at `reinvestHurdlePct` (less `acquisitionTransferPct`). Add as a fourth scenario alongside Invest/Defer/Neglect, or a separate `hold-vs-sell` result.
- **Net-of-tax terminal value:** apply `disposalEconomics` to the existing `terminalValueChf` so even the Hold scenario's exit is realistic.
- **SPLIT scenario:** Σ per-unit retail value × (1 + blockToRetailPremiumPct) × (1 − sittingTenantDiscountPct for occupied) − PPE costs − per-unit gains − carrying over `absorptionMonths`; gated by `ldtrStatus`.
- **IRR/MOIC:** once acquisition basis exists, anchor the FCFE series with the purchase outflow + disposal inflow → real asset-level IRR/MOIC (needs a light `CashFlowEvent` table or a synthesised series from basis + snapshots).

## 5. Surface (reuse)

- Extend the building Reporting tab with a **"Scenarios"** sub-tab: three cards — **Hold NPV** / **Sell-and-redeploy NPV** / **Split (retail) NPV** — each net-of-tax, plus a **per-owner** breakdown (using the new shares). Reuses the NPV engine + the shipped Unit profitability table (the sell/keep candidates feed the split card).
- An editable **DispositionAssumption** panel (like the energy/financing panels).
- Per-owner view keyed on `BuildingOwner.sharePermille`.

## 6. Phasing

| Phase | Scope | Unlocks |
|---|---|---|
| **D1** | `BuildingOwner.sharePermille` + `isPrimary`; acquisition basis on `Building`; surface both in the building editor | Per-owner allocation; cost basis; total return |
| **D2** | `disposalEconomics.ts` + `DispositionAssumption` + cantonal gains/transfer/LDTR seed data | Net proceeds; the tax reality |
| **D3** | SELL scenario + net-of-tax terminal in `npvService`; "Scenarios" sub-tab (Hold vs Sell) | The hold-vs-sell answer |
| **D4** | SPLIT/PPE scenario (retail premium, sitting-tenant discount, LDTR gate, *soulte*) + per-owner partition | The split answer |
| **D5** | IRR/MOIC via acquisition-to-disposal cash-flow series | Owners' money-multiple language |

## 7. Risks & caveats
1. **Tax accuracy** — cantonal gains schedules are intricate and change; config-drive from `LegalVariable`, label as estimates, let owners override.
2. **LDTR** can make Scenario C illegal — gate it, don't model a prohibited option.
3. **No rollover** for investment property — model the gains tax as a real cash cost on redeployment (favours Hold unless the alternative return is materially higher).
4. **Ownership-share data** must be collected — legacy buildings have none; degrade gracefully to "single-owner / shares unknown."
5. **Block-vs-retail premium & sitting-tenant discount** are market assumptions, not facts — expose them as owner-set inputs with sourced defaults.

---

## Appendix A — EXISTS/MISSING inventory (2026-07-17)

**Exists:** `Building.{marketValueChf, marketValueAt, fiscalValueChf, insuranceValueChf, ppeEstimateChf, netAreaSqm, weightedAreaSqm, constructionDate, lastRenovationDate, lotsApartments/Garages/ExteriorParking}`; `Unit` valuation worksheet + `computeUnitIntrinsicValue`; `MarketPricePerZip`; per-unit financials (`getUnitFinancialSummaries`, and now `getUnitProfitability`); `Mortgage.{currentBalanceChf, interestRatePct, amortizationType, fixedUntil, maturityDate}`; `User.marginalTaxRate` (income-tax shield only); NPV Invest/Defer/Neglect with a gross terminal value.

**Missing:** building acquisition price/date/costs; `BuildingOwner` ownership shares / primary flag; PPE saleable-lot / millièmes modelling; capital-gains / transfer-tax / notary / selling-cost / disposal modelling; mortgage prepayment penalty; SELL / reinvest-at-hurdle / split scenarios; acquisition-to-disposal cash-flow history (IRR/MOIC).

## Appendix B — inputs needed to run this for a specific building
1. **Canton** — dispositive for the capital-gains schedule and LDTR/PPE feasibility.
2. **Which split** — internal partition among co-owners, or PPE-and-sell-units.
3. **Acquisition price + date (+ purchase costs)** — no cost basis ⇒ the sell/split tax math is guesswork.
4. **Ownership shares** per co-owner (quote-parts).
5. **Target reinvestment return** (for the redeploy comparison).
