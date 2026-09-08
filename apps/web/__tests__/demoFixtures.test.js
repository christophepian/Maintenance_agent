import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { demoFixtureFor } from '../lib/demo/serve.js';
import { DEMO_BUILDING_ID, DEMO_PLAN_ID } from '../lib/demo/constants.js';

// The fixture layer sits in front of EVERY API proxy route, so what matters
// most is what it REFUSES to answer: a fixture served on a real path would show
// a logged-in user fabricated data.

describe('demo fixtures — what is served', () => {
  it('serves the whole journey, not just the reporting tab', () => {
    for (const p of [
      `/buildings/${DEMO_BUILDING_ID}`,
      `/buildings/${DEMO_BUILDING_ID}/period-report`,
      `/buildings/${DEMO_BUILDING_ID}/units`,
      `/buildings/${DEMO_BUILDING_ID}/vendor-spend`,
      // yield comparison → renovation ranking → investment simulation
      `/buildings/${DEMO_BUILDING_ID}/yield-goalseek`,
      `/buildings/${DEMO_BUILDING_ID}/renovation-opportunities`,
      `/cashflow-plans/${DEMO_PLAN_ID}`,
      `/cashflow-plans/${DEMO_PLAN_ID}/npv-scenarios`,
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

  it('requires a demo id to be a WHOLE path segment', () => {
    // The prefix must start the segment, not appear inside it.
    assert.equal(demoFixtureFor('GET', `/buildings/not-${DEMO_BUILDING_ID}/period-report`), null);
    assert.equal(demoFixtureFor('GET', '/buildings/xdemo-building'), null);
  });

  it('never matches a real UUID — the property the whole design rests on', () => {
    // Every real id in this system is a UUID, and no UUID can start with
    // "demo-". That is what makes serving fixtures by id-prefix safe.
    const uuids = [
      '4d17aa6b-0000-0000-0000-000000000000',
      'b6bd48d1-1234-5678-9abc-def012345678',
      '00000000-0000-0000-0000-000000000000',
    ];
    for (const id of uuids) {
      assert.equal(demoFixtureFor('GET', `/buildings/${id}`), null);
      assert.equal(demoFixtureFor('GET', `/buildings/${id}/period-report`), null);
      assert.equal(demoFixtureFor('GET', `/units/${id}/condition-reports`), null);
      assert.equal(demoFixtureFor('GET', `/cashflow-plans/${id}`), null);
    }
  });

  it('answers GET only — mutations fall through', () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal(demoFixtureFor(m, `/buildings/${DEMO_BUILDING_ID}`), null);
    }
  });
});
