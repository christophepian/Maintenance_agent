/**
 * Swiss residential NET rental-yield benchmark.
 *
 * The Profitability tab's yield is a NET operating yield: annual NOI ÷ value,
 * where NOI = income − operating opex (management, maintenance, insurance,
 * taxes), BEFORE financing, tax shield and capex. The band below is the national
 * net-operating-income yield range for Swiss residential, aggregated from
 * several public + institutional sources so it doesn't rest on a single figure.
 * Keep it multi-source: to tighten reliability, add a source and re-derive the
 * band — don't just swap one citation.
 *
 * Sources (accessed 2026-07):
 *  - Neho, "Rendement locatif : définition" — regional GROSS 2–6 % (Geneva 2–3,
 *    Zurich 2.5–3.5, Lausanne 3–4, Basel 4–5, Bern 3–4, rural 5–6); net example ~4 %.
 *    https://neho.ch/fr/blog/rendement-locatif-definition
 *  - Julius Baer Real Estate, "Immeubles de rendement suisses 2025" — residential
 *    total return 6.2 % incl. 2.8 % capital growth ⇒ ~3.4 % implied income yield.
 *    https://realestate.juliusbaer.com/fr/market-insights-1/real-estate-market/immeubles-de-rendement-suisses-comparaison-des-performances-en-2025-et-perspectives/
 *  - Raiffeisen, "Rendement locatif" (lexique) — gross example 5 %; net = after
 *    management/maintenance/vacancy; strong regional spread (low in ZH/GE).
 *    https://immo.raiffeisen.ch/fr/connaissance/lexique/rendement-locatif/
 *  - Aggregate market data 2025 — national gross ~2.9 %; individual-landlord net
 *    ~1.5–2.5 %; Geneva ~2.25 %, Vaud periphery 4–5 %.
 *
 * Derived: national net operating-income yield ~2.5–3.5 %; regional spread
 * ~2–5 % (tight in Geneva/Zurich, wider in peripheral/rural cantons).
 */
export const SWISS_RESIDENTIAL_NET_YIELD = {
  basis: "net", // NOI ÷ value, before financing / tax / capex
  lowPct: 2.5, // national "typical" band, low
  highPct: 3.5, // national "typical" band, high
  regionalLowPct: 2.0, // regional spread, low (Geneva / Zurich)
  regionalHighPct: 5.0, // regional spread, high (peripheral / rural)
  sources: [
    { name: "Neho", url: "https://neho.ch/fr/blog/rendement-locatif-definition" },
    { name: "Julius Baer Real Estate (2025)", url: "https://realestate.juliusbaer.com/fr/market-insights-1/real-estate-market/immeubles-de-rendement-suisses-comparaison-des-performances-en-2025-et-perspectives/" },
    { name: "Raiffeisen", url: "https://immo.raiffeisen.ch/fr/connaissance/lexique/rendement-locatif/" },
  ],
};

/**
 * Classify a net yield (%) against the national typical band.
 * @returns {"below"|"inRange"|"above"|null}
 */
export function classifyNetYield(pct, band = SWISS_RESIDENTIAL_NET_YIELD) {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (pct < band.lowPct) return "below";
  if (pct > band.highPct) return "above";
  return "inRange";
}

/**
 * Position (0–1) of a yield on the regional-spread track, clamped to the ends.
 * Used to place the marker on the benchmark meter.
 */
export function yieldTrackPosition(pct, band = SWISS_RESIDENTIAL_NET_YIELD) {
  const span = band.regionalHighPct - band.regionalLowPct;
  if (span <= 0) return 0;
  const raw = (pct - band.regionalLowPct) / span;
  return Math.min(1, Math.max(0, raw));
}
