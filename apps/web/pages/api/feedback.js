/**
 * POST /api/feedback — sandbox tester feedback → Slack.
 *
 * Deliberately does NOT use proxyToBackend: feedback isn't domain data and
 * shouldn't become a table. This route reads the note, attaches identity from
 * the caller's token, and posts to a Slack Incoming Webhook. Nothing persists.
 *
 * Disabled unless SLACK_FEEDBACK_WEBHOOK_URL is set, so it is inert on any
 * environment that hasn't opted in (i.e. production).
 */

import { buildSlackPayload, validateSubmission } from '../../lib/feedbackPayload';

// Best-effort throttle. Serverless means this is per-instance rather than
// global — enough to stop an accidental loop, not a determined abuser. The
// route requires a session token, so the blast radius is our own testers.
const RATE_LIMIT = { max: 5, windowMs: 5 * 60 * 1000 };
const recent = new Map();

function isRateLimited(key) {
  const now = Date.now();
  const hits = (recent.get(key) || []).filter((t) => now - t < RATE_LIMIT.windowMs);
  hits.push(now);
  recent.set(key, hits);
  return hits.length > RATE_LIMIT.max;
}

/**
 * Read identity from the bearer token's payload.
 *
 * The signature is not verified here: this route grants no access to data, and
 * a forged identity only mislabels a Slack message on the sandbox. Anything
 * that reads or writes real data must keep going through the backend, which
 * does verify.
 */
function identityFromRequest(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    return {
      email: payload.email || payload.sub || 'unknown',
      role: payload.role || payload.app_metadata?.appRole || '',
    };
  } catch {
    // Malformed token still counts as "logged in enough" to leave feedback.
    return { email: 'unknown', role: '' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const webhookUrl = process.env.SLACK_FEEDBACK_WEBHOOK_URL;
  if (!webhookUrl) return res.status(503).json({ error: 'feedback is not configured' });

  const identity = identityFromRequest(req);
  if (!identity) return res.status(401).json({ error: 'sign in to send feedback' });

  const validation = validateSubmission(req.body);
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  if (isRateLimited(identity.email)) {
    return res.status(429).json({ error: 'too many messages, try again shortly' });
  }

  const payload = buildSlackPayload({
    type: req.body.type,
    message: validation.message,
    context: req.body.context || {},
    identity,
  });

  try {
    const slackRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!slackRes.ok) {
      const detail = await slackRes.text().catch(() => '');
      console.error('[feedback] slack rejected:', slackRes.status, detail);
      return res.status(502).json({ error: 'could not deliver feedback' });
    }
  } catch (err) {
    console.error('[feedback] slack request failed:', err.message);
    return res.status(502).json({ error: 'could not deliver feedback' });
  }

  return res.status(200).json({ ok: true });
}
