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

/** First day of the fiscal year the snapshot covers. The demo deep-links the
 *  building page to this window so the period label matches the data shown —
 *  otherwise the page opens on the current month and labels the snapshot with
 *  the wrong year. */
export const DEMO_PERIOD_ANCHOR = `${meta.fiscalYear}-01-01`;

export const demoMeta = meta;
