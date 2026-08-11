import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSlackPayload,
  describeElementContext,
  validateSubmission,
  clean,
} from '../lib/feedbackPayload.js';

// Run with:  node --test apps/web/__tests__/feedbackPayload.test.js

// ─── validateSubmission ─────────────────────────────────────────────────────

describe('validateSubmission', () => {
  it('rejects an empty message', () => {
    assert.equal(validateSubmission({ message: '   ' }).ok, false);
  });

  it('rejects a message over the cap', () => {
    assert.equal(validateSubmission({ message: 'x'.repeat(2001) }).ok, false);
  });

  it('accepts and trims a valid message', () => {
    assert.deepEqual(validateSubmission({ message: '  the total is wrong ' }), {
      ok: true,
      message: 'the total is wrong',
    });
  });
});

// ─── clean ──────────────────────────────────────────────────────────────────

describe('clean', () => {
  it('collapses whitespace and truncates', () => {
    assert.equal(clean('a\n\n  b', 10), 'a b');
    assert.equal(clean('abcdefghij', 5), 'abcd…');
  });
});

// ─── describeElementContext ─────────────────────────────────────────────────

describe('describeElementContext', () => {
  it('prefers the testid and adds the heading', () => {
    assert.equal(
      describeElementContext({ tag: 'button', testId: 'generate-report', text: 'Générer', heading: 'Charges 2025' }),
      '`generate-report` "Générer" — under “Charges 2025”'
    );
  });

  it('falls back to the tag name when nothing else is known', () => {
    assert.equal(describeElementContext({ tag: 'div' }), '<div>');
  });

  it('returns empty string when no element was picked', () => {
    assert.equal(describeElementContext(null), '');
  });
});

// ─── buildSlackPayload ──────────────────────────────────────────────────────

const base = {
  type: 'bug',
  message: 'the total does not match the statement',
  context: {
    url: 'https://sandbox.example.com/buildings/4d17/reporting',
    path: '/buildings/4d17/reporting',
    locale: 'fr',
    viewport: '1440×900',
    commit: 'abc1234',
    element: { tag: 'button', testId: 'generate-report', heading: 'Charges 2025' },
  },
  identity: { email: 'tester@regie.ch', role: 'OWNER' },
};

describe('buildSlackPayload', () => {
  it('puts identity from the token into the metadata line', () => {
    const { blocks } = buildSlackPayload(base);
    const context = blocks.find((b) => b.type === 'context');
    assert.match(context.elements[0].text, /tester@regie\.ch/);
    assert.match(context.elements[0].text, /OWNER/);
    assert.match(context.elements[0].text, /build abc1234/);
  });

  it('links the page and names the element', () => {
    const { blocks } = buildSlackPayload(base);
    const details = blocks[1].text.text;
    assert.match(details, /<https:\/\/sandbox\.example\.com\/buildings\/4d17\/reporting\|/);
    assert.match(details, /generate-report/);
  });

  it('always provides standalone fallback text', () => {
    assert.match(buildSlackPayload(base).text, /tester@regie\.ch/);
  });

  it('omits the details block when there is no url or element', () => {
    const { blocks } = buildSlackPayload({ ...base, context: {} });
    assert.equal(blocks.filter((b) => b.type === 'section').length, 1);
  });

  it('defaults an unknown type to bug', () => {
    assert.match(buildSlackPayload({ ...base, type: 'nonsense' }).text, /Bug/);
  });
});
