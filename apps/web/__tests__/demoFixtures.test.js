import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { demoFixtureFor } from '../lib/demo/serve.js';
import { DEMO_BUILDING_ID } from '../lib/demo/constants.js';

// The fixture layer sits in front of EVERY API proxy route, so what matters
// most is what it REFUSES to answer: a fixture served on a real path would show
// a logged-in user fabricated data.

describe('demo fixtures — what is served', () => {
  it('serves the demo building\'s reporting endpoints', () => {
    for (const p of [
      `/buildings/${DEMO_BUILDING_ID}`,
      `/buildings/${DEMO_BUILDING_ID}/period-report`,
      `/buildings/${DEMO_BUILDING_ID}/units`,
      `/buildings/${DEMO_BUILDING_ID}/vendor-spend`,
    ]) {
      assert.ok(demoFixtureFor('GET', p), `expected a fixture for ${p}`);
    }
  });

  it('ignores the query string — one snapshot covers every window', () => {
    assert.deepEqual(
      demoFixtureFor('GET', `/buildings/${DEMO_BUILDING_ID}/period-report?from=2025-01-01&to=2025-12-31`),
      demoFixtureFor('GET', `/buildings/${DEMO_BUILDING_ID}/period-report`),
    );
  });

  it('answers an un-snapshotted demo path with an empty payload', () => {
    // Rather than falling through to a backend call that would 401 without a
    // session and surface to the visitor as an error banner.
    assert.deepEqual(
      demoFixtureFor('GET', `/buildings/${DEMO_BUILDING_ID}/correspondence`),
      { data: [] },
    );
  });
});

describe('demo fixtures — what is refused', () => {
  it('never answers for a real building id', () => {
    for (const p of [
      '/buildings/4d17aa6b-0000-0000-0000-000000000000/period-report',
      '/buildings/abc123',
      '/buildings',
    ]) {
      assert.equal(demoFixtureFor('GET', p), null, `must not serve ${p}`);
    }
  });

  it('never answers un-scoped routes, which would shadow real users', () => {
    // /financials/portfolio-summary is the trap: the demo page calls it, but
    // serving it would hand every logged-in user the demo's numbers.
    for (const p of [
      '/financials/portfolio-summary',
      '/market-prices/1203',
      '/invoices',
      '/requests',
    ]) {
      assert.equal(demoFixtureFor('GET', p), null, `must not serve ${p}`);
    }
  });

  it('requires the demo id to be a whole path segment', () => {
    assert.equal(demoFixtureFor('GET', `/buildings/not-${DEMO_BUILDING_ID}x/period-report`), null);
    assert.equal(demoFixtureFor('GET', `/buildings/${DEMO_BUILDING_ID}x`), null);
  });

  it('answers GET only — mutations fall through', () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal(demoFixtureFor(m, `/buildings/${DEMO_BUILDING_ID}`), null);
    }
  });
});
