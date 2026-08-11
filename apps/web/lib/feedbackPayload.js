/**
 * feedbackPayload — pure builders for the sandbox tester-feedback flow.
 *
 * Kept free of DOM and network access so the Slack message shape can be
 * unit-tested without a browser or a live webhook. The API route owns the
 * transport; this module owns the formatting.
 */

// Slack rejects oversized blocks; these caps keep us well inside its limits
// and stop a runaway paste from filling the channel.
const MAX_MESSAGE = 2000;
const MAX_FIELD = 200;

const TYPE_LABELS = {
  bug: ':bug: Bug',
  idea: ':bulb: Idea',
  confusing: ':thinking_face: Confusing',
};

/** Trim, collapse whitespace, and cap a free-text field. */
export function clean(value, max = MAX_FIELD) {
  if (typeof value !== 'string') return '';
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
}

/**
 * Validate an inbound feedback submission.
 * Returns { ok: true, message } or { ok: false, error }.
 */
export function validateSubmission(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid body' };
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return { ok: false, error: 'message is required' };
  if (message.length > MAX_MESSAGE) return { ok: false, error: 'message too long' };
  return { ok: true, message };
}

/**
 * Human-readable one-liner for the element the tester pointed at.
 * Falls back progressively: testid → label → text → tag name.
 */
export function describeElementContext(element) {
  if (!element) return '';
  const parts = [];
  if (element.testId) parts.push(`\`${clean(element.testId, 60)}\``);
  const label = clean(element.label || element.text, 80);
  if (label) parts.push(`"${label}"`);
  if (!parts.length && element.tag) parts.push(`<${clean(element.tag, 20)}>`);
  const described = parts.join(' ');
  const heading = clean(element.heading, 80);
  return heading ? `${described} — under “${heading}”` : described;
}

/**
 * Build the Slack Block Kit payload for one feedback submission.
 *
 * `identity` comes from the server-side token (never from the client body),
 * so a tester can't post as someone else.
 */
export function buildSlackPayload({ type, message, context = {}, identity = {} }) {
  const typeLabel = TYPE_LABELS[type] || TYPE_LABELS.bug;
  const url = clean(context.url, 300);
  const element = describeElementContext(context.element);

  // Fallback text: what shows in notifications and on clients that can't
  // render blocks. Must stand alone.
  const fallback = `${typeLabel} from ${identity.email || 'unknown tester'}: ${clean(message, 140)}`;

  const detailLines = [];
  if (element) detailLines.push(`*Element:* ${element}`);
  if (url) detailLines.push(`*Page:* <${url}|${clean(context.path || url, 120)}>`);

  const metaBits = [
    identity.email && clean(identity.email, 80),
    identity.role && clean(identity.role, 30),
    context.locale && clean(context.locale, 10),
    context.viewport && clean(context.viewport, 20),
    context.commit && `build ${clean(context.commit, 7)}`,
  ].filter(Boolean);

  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `${typeLabel}\n>${clean(message, MAX_MESSAGE).replace(/\n/g, '\n>')}` },
    },
  ];

  if (detailLines.length) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: detailLines.join('\n') } });
  }

  if (metaBits.length) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: metaBits.join(' · ') }],
    });
  }

  return { text: fallback, blocks };
}
