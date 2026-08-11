/**
 * FeedbackWidget — sandbox-only "tell us what's wrong" button for beta testers.
 *
 * Why this exists: Vercel Comments requires every commenter to create a Vercel
 * account, which is a hard sell for régie testers. This keeps testers inside
 * the app they're already logged into and posts to Slack instead.
 *
 * To make a report actionable without a screenshot, the tester can point at the
 * element they mean; we capture its data-testid, visible text and nearest
 * heading alongside the deep-linked URL, role and build SHA.
 *
 * Rendered only when NEXT_PUBLIC_SANDBOX === "true" (see _app.js).
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import Button from './ui/Button';
import { Modal, ModalFooter } from './ui/Modal';
import { authHeaders } from '../lib/api';

const FEEDBACK_TYPES = ['bug', 'confusing', 'idea'];

/** Attribute marking our own chrome so the picker never selects itself. */
const UI_MARKER = 'data-feedback-ui';

/**
 * Summarise a DOM element well enough to find it again from a Slack message.
 * Everything is best-effort: any field may legitimately come back empty.
 */
function describeElement(el) {
  if (!el || el.nodeType !== 1) return null;

  const testIdHost = el.closest('[data-testid]');
  const labelled = el.closest('[aria-label]');

  // Nearest heading above the element: walk up until an ancestor contains one.
  let heading = '';
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    const found = node.querySelector('h1, h2, h3, h4');
    if (found?.innerText?.trim()) {
      heading = found.innerText.trim();
      break;
    }
  }

  return {
    tag: el.tagName?.toLowerCase() || '',
    testId: testIdHost?.getAttribute('data-testid') || '',
    label: labelled?.getAttribute('aria-label') || el.getAttribute?.('title') || '',
    text: (el.innerText || el.value || '').trim().slice(0, 120),
    heading,
  };
}

export default function FeedbackWidget() {
  const { t } = useTranslation('common');
  const router = useRouter();

  const [mode, setMode] = useState('idle'); // idle | picking | form | sent
  const [element, setElement] = useState(null);
  const [highlight, setHighlight] = useState(null); // bounding rect of hovered node
  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const startPicking = useCallback(() => {
    setElement(null);
    setError('');
    setMode('picking');
  }, []);

  const skipPicking = useCallback(() => {
    setElement(null);
    setError('');
    setMode('form');
  }, []);

  // Picker: highlight whatever is under the cursor, and swallow the click that
  // selects it so the underlying app doesn't also act on it.
  useEffect(() => {
    if (mode !== 'picking') return undefined;

    const isOwnUi = (node) => node?.closest?.(`[${UI_MARKER}]`);

    const onMove = (e) => {
      const target = e.target;
      if (isOwnUi(target)) return setHighlight(null);
      const rect = target?.getBoundingClientRect?.();
      if (rect) setHighlight({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };

    const onClick = (e) => {
      if (isOwnUi(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      setElement(describeElement(e.target));
      setHighlight(null);
      setMode('form');
    };

    const onKey = (e) => {
      if (e.key === 'Escape') {
        setHighlight(null);
        setMode('idle');
      }
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';

    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.cursor = previousCursor;
    };
  }, [mode]);

  const close = () => {
    setMode('idle');
    setMessage('');
    setElement(null);
    setError('');
  };

  async function send() {
    if (!message.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          type,
          message,
          context: {
            url: window.location.href,
            path: router.asPath,
            locale: router.locale || '',
            viewport: `${window.innerWidth}×${window.innerHeight}`,
            commit: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || '',
            element,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'failed');
      }
      setMode('sent');
      setMessage('');
      setTimeout(close, 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Launcher — clears the mobile BottomNav (z-40, bottom-0) on small screens. */}
      {mode === 'idle' && (
        <button
          {...{ [UI_MARKER]: 'true' }}
          type="button"
          onClick={startPicking}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 rounded-full bg-brand text-white shadow-lg px-4 py-3 text-sm font-medium hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-ring"
        >
          {t('feedback.launcher', 'Feedback')}
        </button>
      )}

      {mode === 'picking' && (
        <>
          {highlight && (
            <div
              {...{ [UI_MARKER]: 'true' }}
              className="fixed z-[60] pointer-events-none border-2 border-brand bg-brand/10 rounded"
              style={{ top: highlight.top, left: highlight.left, width: highlight.width, height: highlight.height }} /* no-token: geometry measured at runtime via getBoundingClientRect — no Tailwind equivalent */
            />
          )}
          <div
            {...{ [UI_MARKER]: 'true' }}
            className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[61] bg-surface border border-surface-border shadow-lg rounded-lg px-4 py-3 text-sm flex items-center gap-3"
          >
            <span>{t('feedback.pickPrompt', 'Click the part of the page you want to report')}</span>
            <Button variant="ghost" size="sm" onClick={skipPicking}>
              {t('feedback.skipPick', 'Skip')}
            </Button>
          </div>
        </>
      )}

      {(mode === 'form' || mode === 'sent') && (
        <div {...{ [UI_MARKER]: 'true' }}>
          <Modal
            title={t('feedback.title', 'Send feedback')}
            description={t('feedback.description', 'Goes straight to our team. Tell us what you expected to happen.')}
            onClose={close}
          >
            {mode === 'sent' ? (
              <p className="text-sm text-success-dark py-4">{t('feedback.sent', 'Thank you — sent!')}</p>
            ) : (
              <>
                <div className="flex gap-2 mb-3">
                  {FEEDBACK_TYPES.map((option) => (
                    <Button
                      key={option}
                      variant={type === option ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setType(option)}
                    >
                      {t(`feedback.type.${option}`, option)}
                    </Button>
                  ))}
                </div>

                {element && (
                  <p className="text-xs text-muted-text mb-3">
                    {t('feedback.attached', 'Attached:')}{' '}
                    {element.testId || element.text || element.tag}
                    {element.heading ? ` — ${element.heading}` : ''}
                  </p>
                )}

                <textarea
                  autoFocus
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  placeholder={t('feedback.placeholder', 'What happened?')}
                  className="w-full rounded-lg border border-surface-border bg-surface p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-ring"
                />

                {error && <p className="text-sm text-destructive-text mt-2">{error}</p>}

                <ModalFooter className="mt-4">
                  <Button variant="secondary" onClick={close}>
                    {t('action.cancel', 'Cancel')}
                  </Button>
                  <Button variant="primary" onClick={send} disabled={!message.trim() || sending}>
                    {sending ? t('feedback.sending', 'Sending…') : t('feedback.send', 'Send')}
                  </Button>
                </ModalFooter>
              </>
            )}
          </Modal>
        </div>
      )}
    </>
  );
}
