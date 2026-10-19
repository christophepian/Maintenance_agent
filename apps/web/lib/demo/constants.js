/**
 * Demo constants — deliberately tiny and free of the fixture payload, so client
 * components (AppShell, the onboarding wizard) can import them without pulling
 * the ~46 kB snapshot into the browser bundle. The snapshot itself is loaded
 * only by lib/demo/serve.js, which runs server-side in the API proxy.
 */
import meta from "./meta.js";

/** The id the demo building is addressed by. Not a UUID on purpose: it can never
 *  collide with a real building's id, which is what makes serving a fixture for
 *  it safe. */
export const DEMO_BUILDING_ID = "demo-building";

/** Every id the fixtures expose is rewritten to this prefix at generation time
 *  (demo-building, demo-plan, demo-unit-0001…), which is what makes the whole
 *  demo — not just one page — resolvable without a backend. Real ids are UUIDs
 *  and can never collide with it. */
export const DEMO_ID_PREFIX = "demo-";

/** The seeded cashflow plan the simulator hands off to. */
export const DEMO_PLAN_ID = "demo-plan";

/** First day of the fiscal year the snapshot covers. The demo deep-links the
 *  building page to this window so the period label matches the data shown —
 *  otherwise the page opens on the current month and labels the snapshot with
 *  the wrong year. */
export const DEMO_PERIOD_ANCHOR = `${meta.fiscalYear}-01-01`;

export const demoMeta = meta;
