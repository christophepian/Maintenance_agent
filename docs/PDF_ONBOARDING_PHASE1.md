# PDF → package onboarding — Phase 1 spec

**Goal:** drop a régie's year-end PDF (*Décompte de gestion / Rapport annuel* —
rent roll + general ledger + balance sheet + income statement + general info) and
have it hydrate the whole building (units, tenants, leases, invoices, ledger,
building identity), format-agnostically, through the onboarding flow we already
have.

Phase 1 of the larger systematization (see the pipeline discussion): the biggest
unlock, mostly additive.

## Key architectural choice: PDF → *canonical CSV* → existing pipeline

Do **not** build a parallel PDF-onboarding path. Instead, make the LLM emit the
**exact CSV format the deterministic mappers already consume**, then feed those
synthetic CSVs into the existing package `analyze → commit`. Benefits:
- maximal reuse (detect, map, reconcile, commit, review all unchanged),
- a **reviewable CSV intermediate** the manager can eyeball before commit,
- the LLM never writes records — it only produces CSV text; the deterministic,
  human-gated commit does the writing (same trust boundary as today).

## Data flow

```
PDF → Azure Doc Intelligence OCR              (existing)
    → Claude: classify sections               (extend classifyPages)
    → Claude: per-section extract → emit canonical CSV strings:
          rentroll.csv · grandlivre.csv · bilan.csv · resultat.csv · infos.csv
    → analyzePackageForNewBuilding(files)      (EXISTING — detect + reconcile + extract building)
    → manager review preview                   (EXISTING — + extracted rows + confidence chips)
    → commitPackage / create+commit            (EXISTING — units/tenants/leases/invoices/ledger/building)
```

## Backend build (3 new pieces; everything else reused)

1. **Two new Claude extraction tools** in `apps/api/src/services/scanners/azureDocumentIntelligenceScanner.ts`,
   next to `FINANCIAL_STATEMENT_BALANCE_TOOL` / `FINANCIAL_STATEMENT_INVOICE_TOOL`:
   - **`extractRentRoll`** → rows shaped to the deterministic `RentRollRow`
     (`rentRollMapper.ts`): `objet`, `tenantName` ("Vacant" if empty), `type_objet`,
     `etage`, `pieces`, `m2`, `entree` (dd.mm.yyyy), `sortie`,
     `loyer_net_mensuel_chf`, `charges_acompte_chf`, `confidence`. Prompt anchors on
     the *Etat locatif* section, the `objet` code pattern (`531100.01.xxxx`), and the
     "net rent × 12 must tie to the P&L rental-income line" invariant.
   - **`extractBuildingInfo`** → the `ExtractedBuildingInfo` fields already parsed by
     `packageDetector.parseBuildingInfo` (`immeuble_adresse` → name/address/city/postal,
     `immeuble_reference`, `periode` → fiscalYear).
2. **Extend `classifyPages`** to also label `RENT_ROLL` and `GENERAL_INFO` sections
   (today it only groups balance-sheet / income-statement / invoice pages).
3. **Orchestrator + CSV emitter** — `extractPackageFromPdf(buffer)` (broadening
   `extractFinancialStatementWithClaude`): OCR → classify → per-section extract →
   **serialize each section to the canonical `;`-delimited CSV** (the headers the
   mappers expect) → return `PackageFile[]` (the `{ fileName, text }` shape the
   package flow already takes).
4. **One route branch** — the package `analyze`/`commit` routes already exist; add a
   PDF branch (sniff `application/pdf`): if the upload is a PDF, run
   `extractPackageFromPdf` first, then hand the resulting `PackageFile[]` to the
   *existing* `analyzePackageForNewBuilding` / `commitPackage`. No new ventilation code.

## Frontend (small)

`apps/web/components/PackageOnboardingPanel.jsx` already does analyze → confirm →
commit. Add `application/pdf` to the accept filter; when a PDF is present, POST to
the PDF-aware analyze. The preview, building-confirm, fiscal-year, billing-mode and
commit UI are unchanged. Add a "detected from PDF (n% confidence)" chip per section
and an optional "view extracted CSV" toggle so the manager can eyeball the intermediate.

## Reused vs new

| Reused as-is | New |
|---|---|
| OCR (Azure), `analyzePackage`/`commitPackage`, all mappers (`rentRollMapper`, `regieLedgerMapper`, `csvAccountingMapper`), reconciliation, `commitOnboarding`/`commitInvoiceOnboarding`/`approveStatement`, the review + commit UI, `createBuilding` | `extractRentRoll` + `extractBuildingInfo` tools + prompts, `classifyPages` extension, `extractPackageFromPdf` + CSV emitter, one PDF branch on the route, PDF accept + confidence chips in the panel |

## Safeguards

- **LLM never writes records** — produces CSV only; deterministic mappers + the
  human-gated `commitPackage` do the writing.
- **Reconciliation is the automated grader** — the cross-document invariants
  (rent-roll net × 12 vs P&L rental income; Actif = Passif; GL vs income statement;
  `objet` codes ↔ *Avances loyer*) run on the extracted data; ties out → trust it,
  off by X → flagged in the preview, same as CSV today.
- **Per-field confidence** from the extraction tools; low-confidence rows highlighted
  for review before commit (mirrors the invoice-confidence gate).
- **Reviewable CSV intermediate** — no black box.

## Sequence

1. `extractRentRoll` + `extractBuildingInfo` tools + prompts (the bulk — getting
   extraction robust against a real sample PDF).
2. `classifyPages` extension + `extractPackageFromPdf` + CSV emitter.
3. Route PDF branch (thin).
4. Panel: accept PDF + confidence chips.
5. End-to-end test on the real *Décompte de gestion* PDF; tune prompts against the
   reconciliation invariants.

## Dependencies / blockers to start

- **A real sample PDF** (the *Décompte de gestion* itself — not just the
  `infos_generales.csv`) to design and tune the extraction tools.
- The extraction path runs on **Azure Document Intelligence + Anthropic** (the
  `azure` scanner provider), i.e. it validates on staging, not on a local box with
  `DOCUMENT_SCAN_PROVIDER=local` (local has no LLM).

## Later phases (not Phase 1)

- **Phase 2** — a canonical package schema both PDF-extraction and CSV-mapping emit;
  collapse both paths onto it; one review UI.
- **Phase 3** — LLM fallback for unknown *CSV* layouts (escalate UNKNOWN /
  `MappingError` to Claude).
- **Phase 4** — wrap extraction + reconciliation in a self-correcting agent loop
  (extract → run invariants → re-extract the offending section → escalate only the
  unresolved/low-confidence to the human) for the long-tail formats.
