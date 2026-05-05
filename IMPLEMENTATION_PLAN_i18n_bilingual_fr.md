# Implementation Plan — `frontend-i18n-bilingual-fr`

> Read **PROJECT_OVERVIEW.md** first (entry point), then
> `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md` (lookup), then
> `PROJECT_STATE.md` (canonical reference), `docs/AUDIT.md`, and
> `docs/FRONTEND_INVENTORY.md`.
> Obey all guardrails exactly. Preserve existing behaviour unless explicitly
> required for the i18n wiring.

---

## Slice name
`frontend-i18n-bilingual-fr`

## Goal
Make the entire Next.js 16 (Pages Router) frontend bilingual — English (default) and French — using `next-i18next` / `react-i18next`. All hardcoded UI strings are replaced with `t('key')` calls backed by JSON message catalogues. A locale dropdown switcher is added to `AppShell`. No backend changes are required; all data stored in the database is locale-neutral.

---

## Decisions (finalised)

| # | Decision | Choice | Notes |
|---|----------|--------|-------|
| 1 | URL strategy | **URL prefix** (`/fr/manager/…`) | SEO-friendly; `next/link` handles automatically |
| 2 | French string production | **Extract EN first → LLM translation pass → QA review** | No professional translator; LLM pass over all JSON files at end of Phase 2 |
| 3 | Locale persistence | **URL + cookie** | `localeCookie` option in Next.js i18n config; browser remembers last choice |
| 4 | Additional locales | **DE and IT on roadmap** (timeline TBD) | Namespace structure and key naming must accommodate 4 locales from day 1 |
| 5 | Locale switcher style | **Dropdown** showing full locale names ("English" / "Français") | Extensible to DE/IT without redesign |
| 6 | `getStaticProps` strategy | **Shared `withTranslations(namespaces)` helper** in `lib/i18n.js` | One-line per page; adding DE/IT later requires zero page-file changes |

---

## Before Writing Code — Required Reading & Inspection

1. **Read `PROJECT_OVERVIEW.md`** — architecture rules, layout primitives, shared hooks, styling system, guardrails G1–G17.
2. **Read `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md`** — confirm no backend files need touching (data is locale-neutral).
3. **Read `PROJECT_STATE.md` §F-UI7** — the current "English only" rule that this slice lifts, and §F-UI8 for shared component conventions.
4. **Read `docs/AUDIT.md`** — confirm no open findings block this work (3 remaining: SI-2/3/4 schema doc drift, TC-11 partial — none touch the frontend string layer).
5. **Read `docs/FRONTEND_INVENTORY.md`** — understand the 91 UI pages across 4 personas + shared pages and 208 API proxy stubs (proxies are pure HTTP relay; they contain zero JSX and need no translation).
6. **Inspect `apps/web/pages/_app.js`** — understand current providers (ErrorBoundary, ToastProvider) so `appWithTranslation` wrapping is inserted in the right position.
7. **Inspect `apps/web/next.config.js`** — currently no `i18n` block; one must be added.
8. **Inspect `apps/web/components/AppShell.js`** — identify the header area where the `<LocaleSwitcher>` component will be mounted.
9. **Inspect `apps/web/lib/format.js`** — confirm `formatDate`, `formatDateTime`, `formatDateLong` use `Intl` or are SSR-safe; verify they accept or can accept a `locale` string for French month names if needed.
10. **Inspect one representative page per persona** (e.g. `pages/manager/requests/index.js`, `pages/owner/index.js`, `pages/contractor/jobs.js`, `pages/tenant/requests.js`) — understand whether any page already has `getStaticProps` / `getServerSideProps` (most do not; `serverSideTranslations` must be added to each one).

**Output a short analysis before coding covering:**
- Whether `getStaticProps` / `getServerSideProps` is already present on most pages (it is not — client-side fetch pattern dominates).
- The correct strategy for injecting `serverSideTranslations` at scale across 91 pages (options: per-page, or a shared wrapper helper).
- Whether `formatDate` / `formatDateTime` need a locale parameter threaded through.
- Whether the API proxy stubs under `pages/api/` can be confirmed as zero-JSX (they can — confirmed by inventory).

---

## Architecture Rules
- No business logic changes. This is a pure frontend string-externalisation task.
- No Prisma, no workflow, no service, no repository changes.
- No new `.css` files. Locale switcher styling uses Tailwind utilities + `cn()`.
- All dynamic className composition uses `cn()` from `lib/utils.js`.
- No inline `style={{}}`.
- If `format.js` helpers need a `locale` param, add it as an **optional** parameter with `'en-CH'` default — preserves backwards compatibility everywhere.
- Do not add `MyApp.getInitialProps` to `_app.js` — this forces all pages through SSR and breaks Radix UI on Vercel (G16). Use the per-page `getStaticProps` / `getServerSideProps` approach, or a shared `withTranslations` helper that wraps the existing props function.
- Commit frontend + backend (even if backend is unchanged) as one atomic commit (G13). Since no backend files change, a single frontend-only commit is acceptable here — but confirm with the guardrail prose in `PROJECT_STATE.md`.
- Run `cd apps/web && npm run build` locally before pushing to `main` (G17).

---

## Scope

### In scope
- Install and configure `next-i18next` + `react-i18next`.
- Add `i18n` block to `next.config.js`: locales `['en', 'fr']`, defaultLocale `'en'`.
- Create `public/locales/en/` and `public/locales/fr/` JSON catalogues, split into 5 namespaces: `common`, `manager`, `owner`, `contractor`, `tenant`.
- Replace all hardcoded UI strings in the **91 non-proxy UI pages** and **29 components** with `t('namespace:key')` calls.
- Add `<LocaleSwitcher>` to `AppShell.js` header.
- Add `serverSideTranslations` to every UI page (via `getStaticProps`, `getServerSideProps`, or a shared `withTranslations` wrapper helper).
- Lift the F-UI7 "English only" guardrail in `PROJECT_OVERVIEW.md`, `PROJECT_STATE.md`, and `copilot-instructions.md`.
- Update `docs/FRONTEND_INVENTORY.md` to note bilingual status.
- Ensure `lib/format.js` date helpers produce French month/day names when locale is `fr`.

### Out of scope
- No backend / API changes.
- No schema changes.
- No new business rules.
- No translation of user-generated content stored in the database (building names, request descriptions, notes — these remain as entered).
- No right-to-left language support.
- No German / Italian localisation (Swiss-German or Romansh).
- No redesign of any existing page layout.
- No changes to the 208 API proxy stubs under `pages/api/`.
- No changes to auth, workflows, or repositories.

---

## Inventory of Files to Change

### Infrastructure (Phase 1)
| File | Change |
|------|--------|
| `apps/web/package.json` | Add `next-i18next`, `react-i18next`, `i18next` |
| `apps/web/next.config.js` | Add `i18n` block with prefix routing + `localeCookie` |
| `apps/web/next-i18next.config.js` | Create — namespaces, `fallbackLng: 'en'`, cookie config |
| `apps/web/pages/_app.js` | Wrap export with `appWithTranslation(MyApp, nextI18NextConfig)` |
| `apps/web/lib/i18n.js` | Create — `withTranslations(namespaces)` helper + `composeWithTranslations(namespaces, existingGetProps)` for pages that already have a props function |
| `apps/web/components/AppShell.js` | Mount `<LocaleSwitcher>` in header |
| `apps/web/components/LocaleSwitcher.js` | Create — dropdown showing full locale names; extensible to DE/IT |
| `apps/web/lib/format.js` | Add optional `locale` param to `formatDate`, `formatDateTime`, `formatDateLong` |
| `public/locales/en/common.json` | Create |
| `public/locales/en/manager.json` | Create |
| `public/locales/en/owner.json` | Create |
| `public/locales/en/contractor.json` | Create |
| `public/locales/en/tenant.json` | Create |
| `public/locales/fr/common.json` | Create (populated in Phase 2 LLM pass) |
| `public/locales/fr/manager.json` | Create (populated in Phase 2 LLM pass) |
| `public/locales/fr/owner.json` | Create (populated in Phase 2 LLM pass) |
| `public/locales/fr/contractor.json` | Create (populated in Phase 2 LLM pass) |
| `public/locales/fr/tenant.json` | Create (populated in Phase 2 LLM pass) |
| `PROJECT_OVERVIEW.md` | Lift F-UI7 "English only" rule; document i18n conventions |
| `PROJECT_STATE.md` | Update F-UI7 entry |
| `.github/copilot-instructions.md` | Lift F-UI7 "English only" rule |
| `docs/FRONTEND_INVENTORY.md` | Note bilingual status |

### String Extraction — Components (Phase 2a) — 29 files
All files under `apps/web/components/` and `apps/web/components/ui/`, `layout/`, `manager/`, `mobile/`.  Primary namespace: `common`.

### String Extraction — Pages by persona (Phase 2b) — 91 files
| Persona | Pages | Namespace |
|---------|-------|-----------|
| Manager | 47 | `manager` (+ `common` for shared labels) |
| Owner | 18 | `owner` |
| Contractor | 8 | `contractor` |
| Tenant | 7 | `tenant` |
| Shared / admin-inventory / root | 11 | `common` |

For **each UI page**, add or extend `getStaticProps` / `getServerSideProps` with:
```js
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'manager'])),
    },
  };
}
```
Pages that already have `getServerSideProps` (e.g. any SSR-only page) — extend the existing function instead of adding a second one.

Pages with **no existing props function** (the majority — client-side fetch pattern): add `getStaticProps` with translation loading only. This does NOT force SSR; `getStaticProps` runs at build time and is safe.

### Format helpers (Phase 3)
`apps/web/lib/format.js` — `formatDate`, `formatDateTime`, `formatDateLong` gain an optional `locale` param defaulting to `'en-CH'`. All existing call sites remain unchanged (backwards compatible). Pages/components that need French dates pass `useRouter().locale` when calling the helper.

---

## Implementation Order

Work through phases sequentially. Do not start Phase 2 until Phase 1 builds and deploys cleanly.

### Phase 1 — Infrastructure (target: 2 days)

**Step 1.1 — Install packages**
```bash
cd apps/web
npm install next-i18next react-i18next i18next
```

**Step 1.2 — `next.config.js`**
Add the `i18n` key with URL prefix routing and cookie persistence. Keep existing `redirects`.

```js
const { i18n } = require('./next-i18next.config');

const nextConfig = {
  i18n,
  async redirects() { /* existing content unchanged */ },
};
module.exports = nextConfig;
```

**Step 1.3 — `next-i18next.config.js`**
Design namespaces to accommodate all 4 planned locales (EN, FR, DE, IT) from day 1.

```js
module.exports = {
  i18n: {
    locales: ['en', 'fr'],          // extend to ['en', 'fr', 'de', 'it'] when ready
    defaultLocale: 'en',
    localeDetection: true,          // uses Accept-Language header on first visit
    localeCookie: 'NEXT_LOCALE',    // remembers choice across sessions
  },
  defaultNS: 'common',
  ns: ['common', 'manager', 'owner', 'contractor', 'tenant'],
  fallbackLng: 'en',               // missing FR/DE/IT keys silently fall back to EN
};
```

**Step 1.4 — `_app.js`**
Wrap with `appWithTranslation`. Do NOT add `MyApp.getInitialProps` (G16).

**Step 1.5 — `lib/i18n.js` — shared `withTranslations` helper**

```js
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

/**
 * Use on pages with no existing getStaticProps / getServerSideProps:
 *   export const getStaticProps = withTranslations(['common', 'manager']);
 */
export function withTranslations(namespaces) {
  return async ({ locale }) => ({
    props: { ...(await serverSideTranslations(locale, namespaces)) },
  });
}

/**
 * Use on pages that already have a props function with real logic:
 *   export const getStaticProps = composeWithTranslations(['common'], async ({ locale, params }) => {
 *     return { props: { data: await fetchSomething(params.id) } };
 *   });
 */
export function composeWithTranslations(namespaces, getPropsFunc) {
  return async (context) => {
    const i18nProps = await serverSideTranslations(context.locale, namespaces);
    const result = await getPropsFunc(context);
    return { ...result, props: { ...i18nProps, ...(result.props ?? {}) } };
  };
}
```

When DE or IT is added later: update `next-i18next.config.js` `locales` array and add the locale files — zero page files need touching.

**Step 1.6 — Locale catalogues (seed)**
Create skeleton JSON files for all 5 namespaces × 2 locales (10 files) with ~10 representative keys each to verify the pipeline works before tackling all 91 pages. Populate FR values as empty strings initially — the LLM translation pass at the end of Phase 2 will fill them.

**Step 1.7 — `LocaleSwitcher` component**
Dropdown showing full locale names, extensible to DE/IT without layout changes.

```jsx
import { useRouter } from 'next/router';
import { cn } from '../lib/utils';

const LOCALE_LABELS = {
  en: 'English',
  fr: 'Français',
  // de: 'Deutsch',
  // it: 'Italiano',
};

export default function LocaleSwitcher() {
  const router = useRouter();
  const handleChange = (e) => {
    router.push(router.asPath, undefined, { locale: e.target.value });
  };
  return (
    <select
      value={router.locale}
      onChange={handleChange}
      aria-label="Select language"
      className={cn('text-sm bg-transparent border border-border rounded px-2 py-1 cursor-pointer focus-visible:ring')}
    >
      {Object.entries(LOCALE_LABELS).map(([code, label]) => (
        <option key={code} value={code}>{label}</option>
      ))}
    </select>
  );
}
```
Mount it in `AppShell.js` header next to `<NotificationBell>`.

**Step 1.8 — `lib/format.js` locale param**
Add optional `locale = 'en-CH'` to `formatDate`, `formatDateTime`, `formatDateLong`. Pass it to `Intl.DateTimeFormat`. All existing callers pass no argument — no regressions.

**Step 1.9 — Verify build**
```bash
cd apps/web && npm run build
```
Fix any errors before proceeding.

---

### Phase 2a — String extraction: components (target: 1.5 days)

Work through `apps/web/components/` file by file. For each:
1. Add `import { useTranslation } from 'next-i18next';`
2. Add `const { t } = useTranslation('common');` (or persona namespace where appropriate)
3. Replace every hardcoded user-visible string with `t('key')`.
4. Add the key + English value to `public/locales/en/common.json`.
5. Add the French translation to `public/locales/fr/common.json`.

**Key files** (highest string density):
- `AppShell.js` — navigation labels, header controls
- `ManagerSidebar.js`, `OwnerSidebar.js`, `ContractorSidebar.js`, `TenantSidebar.js` — nav labels
- `AssetInventoryPanel.js`, `DepreciationStandards.js` — table headers, status labels
- `DocumentsPanel.js`, `VacanciesPanel.js`, `RecommendationPanel.js` — section titles, empty states
- All `components/ui/` primitives (`EmptyState`, `ErrorBanner`, `ResourceShell`) — generic messages

**Naming convention for keys:**
- `section.label` — static labels (e.g. `nav.requests`, `table.status`)
- `action.verb` — button text (e.g. `action.save`, `action.cancel`, `action.submit`)
- `status.value` — status chips (e.g. `status.open`, `status.pending`)
- `empty.noResults` — empty state messages
- `error.generic` — error messages

---

### Phase 2b — String extraction: pages (target: 8.5 days)

Work persona by persona. For each page:
1. Identify the correct namespace (`manager`, `owner`, `contractor`, `tenant`, or `common`).
2. Add `useTranslation` hook with appropriate namespace.
3. Replace all hardcoded strings with `t('key')`.
4. Wire `getStaticProps` using the helper from `lib/i18n.js`:
   - **No existing props function** (majority of pages): `export const getStaticProps = withTranslations(['common', 'manager']);`
   - **Existing `getStaticProps` / `getServerSideProps`**: `export const getStaticProps = composeWithTranslations(['common', 'manager'], async (ctx) => { … });`
5. Add the English key+value to the appropriate `public/locales/en/*.json` file.
6. Leave the corresponding `public/locales/fr/*.json` key with an empty string (`""`) — the LLM translation pass at the end of Phase 2 will fill all of them at once.

**Suggested sub-order within Manager (47 pages):**
1. Dashboard, index
2. Requests (list + detail)
3. Jobs (list + detail)
4. Leases (list + detail)
5. Finance / cashflow / billing
6. People (tenants, vendors)
7. Inventory / assets
8. Remaining pages

**End of Phase 2 — LLM translation pass:**
Once all `en/*.json` files are complete and `fr/*.json` files have empty values, run a single LLM prompt over each namespace file:
- Input: the complete `en/manager.json`
- Output: `fr/manager.json` with all values translated to Swiss French property management terminology
- Repeat for all 5 namespaces
- Do a human QA review pass before Phase 4 (verify key terms against the glossary below)

**Swiss French terminology glossary (mandatory):**

| English | Swiss French |
|---------|-------------|
| Request | Demande |
| Job / Intervention | Intervention |
| Lease | Bail |
| Invoice | Facture |
| Tenant | Locataire |
| Contractor / Vendor | Prestataire |
| Owner | Propriétaire |
| Manager | Gérant |
| Building | Immeuble |
| Unit / Apartment | Unité / Appartement |
| Quote / Estimate | Devis |
| RFP | Appel d'offres |
| Approval | Validation |
| Dashboard | Tableau de bord |
| Settings | Paramètres |
| Status | Statut |
| Pending | En attente |
| In progress | En cours |
| Completed | Terminé |
| Cancelled | Annulé |

Avoid Québec-specific or France-specific terms where Swiss French diverges.

---

### Phase 3 — Format helpers & date locale (target: 0.5 days)

- Update `lib/format.js` (already scaffolded in Phase 1).
- Update call sites in pages/components that render dates in prose context (e.g. lease start/end in detail pages) to pass `router.locale` to `formatDate`.
- Verify French output: `15 avril 2026` (not `April 15, 2026`).

---

### Phase 4 — QA sweep (target: 1.5 days)

1. Run `npx tsc --noEmit` — 0 errors.
2. Run `npm test` — all 1001+ existing tests pass (no backend tests are affected; add a smoke test for the `LocaleSwitcher` render if desired).
3. Run `npm run blueprint` — docs sync cleanly.
4. Run `cd apps/web && npm run build` — 0 build errors.
5. Manual walkthrough in `/fr/` for each persona:
   - Manager dashboard → request → job → lease → invoice → finance
   - Owner dashboard → properties → finance
   - Contractor jobs list → job detail
   - Tenant inbox → requests → lease
6. Check for text overflow (French strings are ~20–30% longer). Fix with `truncate`, `min-w-0`, or responsive grid adjustments as needed — no new CSS files, use Tailwind utilities.
7. Verify SSR hydration — no locale mismatch between server and client render.
8. Verify `<LocaleSwitcher>` works on every persona's AppShell.
9. Verify graceful fallback: if a key is missing in `fr`, `next-i18next` falls back to `en` — confirm this is enabled in `next-i18next.config.js` via `fallbackLng: 'en'`.

---

## Guardrail Checklist (run before every commit)

```bash
cd apps/api
npx tsc --noEmit            # 0 errors
npm test                    # all suites green
npm run blueprint           # docs sync

cd apps/web
npm run build               # 0 build errors (G17)

git status && git stash list  # nothing left uncommitted (G14)
```

---

## Definition of Done

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm test` — all existing tests pass
- [ ] `npm run blueprint` — docs sync cleanly
- [ ] `cd apps/web && npm run build` — clean build
- [ ] Every UI page renders correctly in both `/en/` and `/fr/` routes
- [ ] `<LocaleSwitcher>` present and functional in all 4 persona AppShells
- [ ] Zero hardcoded user-visible English strings remain in `pages/` or `components/` (API proxy stubs exempted)
- [ ] French translations use Swiss property management terminology
- [ ] Dates render in French locale format (`15 avril 2026`) when `locale === 'fr'`
- [ ] Text overflow checked on all pages; no horizontal scroll introduced
- [ ] `fallbackLng: 'en'` set — missing French keys fall back gracefully
- [ ] F-UI7 "English only" guardrail lifted in `PROJECT_OVERVIEW.md`, `PROJECT_STATE.md`, and `copilot-instructions.md`
- [ ] `docs/FRONTEND_INVENTORY.md` updated to note bilingual status
- [ ] No inline `style={{}}` introduced
- [ ] No new `.css` files
- [ ] No `MyApp.getInitialProps` added to `_app.js` (G16)
- [ ] All dynamic classNames use `cn()` from `lib/utils.js`
- [ ] 208 API proxy stubs untouched

---

## Effort Summary

| Phase | Scope | Estimate |
|-------|-------|----------|
| Phase 1 — Infrastructure | `next-i18next` install, config, `_app.js`, `LocaleSwitcher`, `format.js` | 2 days |
| Phase 2a — Component strings | 29 components, `common` namespace | 1.5 days |
| Phase 2b — Page strings | 91 UI pages across 4 personas | 8.5 days |
| Phase 3 — Format helpers | `formatDate` locale param + call sites | 0.5 days |
| Phase 4 — QA | Build, tests, walkthrough, overflow fixes | 1.5 days |
| **Total** | | **~14 developer-days** |

With 2 contributors working in parallel on separate persona groups after Phase 1 completes: **~8–9 calendar days**.

---

## Open Audit Items Relevant to This Slice

- **SI-2/3/4** (schema doc drift) — unrelated; no schema changes in this slice.
- **TC-11** (partial test coverage) — unrelated; no workflow changes.
- No other open findings touch the frontend string layer.

---

## Key Risks

| Risk | Mitigation |
|------|-----------|
| Missing `getStaticProps` on most pages requires additions at scale | `withTranslations` helper reduces each page to one line; adding DE/IT later requires only updating `next-i18next.config.js` and adding locale files — zero page files touched |
| French strings are longer → text overflow on compact UI elements | Phase 4 QA sweep + `truncate`/`min-w-0` fixes; test at mobile viewport |
| URL prefix `/fr/…` — `<Link href>` changes | `next/link` handles locale automatically when `i18n.locales` is set; no manual href changes needed |
| SSR hydration mismatch if locale read from two sources | URL-based locale only; `localeCookie: 'NEXT_LOCALE'` uses cookie as hint but Next.js URL prefix is always authoritative |
| LLM translation quality — incorrect Swiss French terminology | Human QA review pass against the glossary above before Phase 4; key domain terms are listed explicitly |
| LLM translates non-translatable tokens (variable interpolations like `{{count}}`) | Instruct the LLM to leave `{{…}}` tokens unchanged; verify with a grep pass: `grep -r "{{" public/locales/fr/` should match `en/` |
| DE/IT namespace key naming conflicts | Keys designed generically (no EN-specific grammar assumptions); values carry all language-specific phrasing |
| Vercel deployment of `/fr/*` routes | `next.config.js` `i18n` block is sufficient; Vercel auto-routes after build |
