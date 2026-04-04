# Tenant Multichannel Conversational Interface — Implementation Prompts

This file contains five sequential implementation slices. Run them in order. Each slice
is self-contained and includes its own inspection, architecture, and definition-of-done
instructions. Do not start a later slice until the earlier one passes its DoD.

---

## Context for all slices

**What this feature is:**
A channel-agnostic AI conversational interface for tenants, allowing them to ask
questions, report issues, request documents, and track maintenance — via in-app chat
first, then WhatsApp, then Voice/IVR. The same `conversationService.ts` core handles all
channels; adapters handle inbound normalisation and outbound delivery.

**Derisking sequence:**
1. Build the data model and channel-agnostic core (Slice 1).
2. Build the in-app chat widget (Slice 2) — validates the full conversation loop before
   introducing telephony dependencies.
3. Only once in-app chat works end-to-end, add the WhatsApp adapter (Slice 3).
4. Add the Voice/IVR adapter last (Slice 4).
5. Add proactive outbound notifications (Slice 5) — status-change pushes to WhatsApp.

**Key design decisions:**
- **Channel-agnostic core**: `conversationService.ts` receives a normalised
  `ConversationMessage` and returns a `ConversationReply`. It never knows whether the
  channel is in-app, WhatsApp, or Voice.
- **Identity**: tenants are identified by their existing phone-number-first E.164 session
  (`TenantSession`). The `ConversationThread` is keyed on `tenantUserId + channel`.
- **Persistence**: every turn (inbound + outbound) is stored as a `ConversationMessage`
  record for audit and continuity.
- **LLM**: Claude API (Anthropic SDK). The system prompt is injected from a server-side
  template — never from client input.
- **Action execution**: the service resolves intents (report issue, track request,
  request document) and calls existing tenant repositories/services — no new database
  writes from the LLM path, only reads and targeted mutations through existing workflows.
- **WhatsApp provider**: Twilio Messaging API (webhook inbound, REST outbound).
- **Voice provider**: Twilio Voice (TwiML for IVR flow, STT via Twilio transcription or
  Deepgram). Swiss German is the primary dialect — notes on handling in Slice 4.
- **Outbound notifications**: `WhatsAppOutbox` table, processed by a background job
  (same pattern as `EmailOutbox`). Domain events trigger inserts; the job sends.

**Out of scope for all slices:**
- Multilingual UI translation (French/Italian) — localization is a separate epic.
- End-to-end encryption at rest beyond standard Prisma/Postgres defaults.
- Billing for Twilio usage — procurement is a separate track.
- LLM fine-tuning — use prompt engineering only.

---

## Slice 1 of 5 — Data model and channel-agnostic conversation core

Read `PROJECT_OVERVIEW.md` first (entry point), then
`apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md` (lookup), then `PROJECT_STATE.md`
(canonical reference), `docs/AUDIT.md`, and `apps/api/blueprint.js`. Obey all guardrails
exactly. Preserve existing behaviour unless explicitly required for this slice.

### Slice name: `tenant-chat-data-model`

**Goal:** Introduce `ConversationThread` and `ConversationMessage` Prisma models, a
`conversationService.ts` skeleton (Claude API wired, intent routing stubs), and a
minimal `POST /tenant/conversation` endpoint that accepts a message and returns a reply.
No UI yet — validate with curl.

### Before writing code

1. Read `apps/api/prisma/schema.prisma`. Record:
   - The `TenantUser` and `TenantSession` model shapes (id fields, orgId, phone).
   - The `MaintenanceRequest` model shape (id, status, description, buildingId, unitId).
   - The `Document` model shape if it exists (for document-request intent).
2. Read `apps/api/src/routes/tenantPortal.ts` (or wherever `requireTenantSession()` is
   used). Understand:
   - How `tenantUserId` and `orgId` are extracted from the session.
   - What the `withTenantAuth` / `requireTenantSession` middleware returns.
3. Read `apps/api/src/services/` directory listing. Note any service already handling
   tenant-facing operations (requests, documents, rent). These will be called from
   `conversationService` for action execution — do not duplicate them.
4. Read `packages/api-client/src/index.ts` to understand the existing `TenantPortalAPI`
   client shape.
5. Output a short implementation plan before writing any code:
   - Which existing service methods you will call for intent execution.
   - The exact schema additions and why each field is needed.
   - How `ConversationThread` deduplication will work (one thread per tenant+channel).

### Architecture rules

- `conversationService.ts` must be channel-agnostic — it receives a plain
  `{ tenantUserId, orgId, channel, messageText }` object and returns
  `{ replyText, intent, actionTaken }`. Zero channel-specific code inside.
- Routes stay thin. The tenant conversation route calls the service and persists the
  reply. No LLM calls in the route handler.
- Prisma access from `conversationRepository.ts` only (G9).
- The Claude API key is read from `process.env.ANTHROPIC_API_KEY`. Add it to
  `.env.example` with a placeholder comment. Do not hardcode.
- System prompt template lives in
  `apps/api/src/services/conversationPrompts.ts` — a plain TypeScript string template,
  not a database record.
- Emit a `CONVERSATION_TURN` domain event from the workflow (not the service) after each
  successful turn.

### Schema additions

Add to `apps/api/prisma/schema.prisma`:

```prisma
model ConversationThread {
  id            String              @id @default(cuid())
  orgId         String
  tenantUserId  String
  channel       ConversationChannel @default(IN_APP)
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  tenantUser TenantUser            @relation(fields: [tenantUserId], references: [id])
  messages   ConversationMessage[]

  @@unique([tenantUserId, channel])
  @@index([orgId])
}

model ConversationMessage {
  id         String              @id @default(cuid())
  threadId   String
  role       ConversationRole
  content    String              @db.Text
  intent     String?             // resolved intent label, e.g. "REPORT_ISSUE"
  createdAt  DateTime            @default(now())

  thread ConversationThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
}

enum ConversationChannel {
  IN_APP
  WHATSAPP
  VOICE
}

enum ConversationRole {
  TENANT
  ASSISTANT
}
```

Generate and apply the migration:
```bash
cd apps/api && npx prisma migrate dev --name add_conversation_thread
```

### New files — in this order

1. `apps/api/src/repositories/conversationRepository.ts`
   - Export `THREAD_INCLUDE` constant (thread + last N messages).
   - `findOrCreateThread(prisma, tenantUserId, orgId, channel)` — upsert on unique.
   - `addMessage(prisma, threadId, role, content, intent?)`.
   - `getRecentMessages(prisma, threadId, limit)` — last N messages for context window.

2. `apps/api/src/services/conversationPrompts.ts`
   - Export `buildSystemPrompt(orgId, tenantUserId, buildingName)` — returns a string.
   - The prompt should describe: role (Swiss property management AI), available actions
     (report issue, track requests, request document, ask general question), response
     language (match tenant's language), tone (professional, concise), and limitations
     (no legal advice, no financial commitments, escalate to manager for complex issues).

3. `apps/api/src/services/conversationService.ts`
   - `handleTurn(prisma, { tenantUserId, orgId, channel, messageText })`:
     1. Load or create thread via `conversationRepository`.
     2. Fetch recent messages for context (last 10 turns).
     3. Build messages array for Claude API: system prompt + conversation history +
        new user message.
     4. Call Claude API (`claude-haiku-4-5-20251001` for latency) with a tool-use schema
        for structured intent resolution. Tools: `reportIssue`, `trackRequest`,
        `requestDocument`, `generalAnswer`.
     5. If tool use returned: execute the action against existing services, compose reply.
     6. Persist inbound message and outbound reply via `conversationRepository`.
     7. Return `{ replyText, intent, actionTaken }`.
   - Export intent types: `ConversationIntent` union.

4. `apps/api/src/workflows/conversationWorkflow.ts`
   - `processTurnWorkflow(ctx, { tenantUserId, channel, messageText })`:
     - Calls `conversationService.handleTurn`.
     - Emits `CONVERSATION_TURN` domain event.
     - Returns the reply.

5. `apps/api/src/routes/tenantConversation.ts`
   - `POST /tenant/conversation` — `requireTenantSession()`, calls
     `processTurnWorkflow`, returns `{ data: { replyText, intent } }`.
   - `GET /tenant/conversation/history` — `requireTenantSession()`, returns last 20
     messages for the IN_APP thread.
   - Register in the main router file (check `ARCHITECTURE_LOW_CONTEXT_GUIDE.md` for
     where routes are registered).

### Files to modify

- `apps/api/prisma/schema.prisma` — schema additions above.
- `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md` — add conversation domain section,
  update route/repo/workflow/service counts in the header.
- `SCHEMA_REFERENCE.md` — add `ConversationThread`, `ConversationMessage`,
  `ConversationChannel`, `ConversationRole`; update model and enum counts.
- `CONTRIBUTING.md` — claim port 3224 for `tenantConversation.test.ts`; update next
  available to 3225.
- `PROJECT_STATE.md` — update Document Integrity table counts.
- `.env.example` — add `ANTHROPIC_API_KEY=your-key-here`.
- `apps/api/package.json` — add `@anthropic-ai/sdk` dependency.
- `packages/api-client/src/index.ts` — add `sendConversationMessage(text)` and
  `getConversationHistory()` to `TenantPortalAPI`.
- `apps/api/openapi.yaml` — add `POST /tenant/conversation` and
  `GET /tenant/conversation/history` specs.
- `apps/api/src/__tests__/contracts.test.ts` — add contract tests for both endpoints.

### Auth notes

Both conversation endpoints use `requireTenantSession()` — same pattern as all other
tenant portal endpoints. The `tenantUserId` and `orgId` come from the session, never from
the request body. Do not accept `tenantUserId` as a body parameter.

### In scope
- `ConversationThread` + `ConversationMessage` schema + migration.
- `conversationService` with real Claude API call (haiku model).
- Intent tool-use schema with at minimum `reportIssue` and `generalAnswer` tools wired.
- `POST /tenant/conversation` and `GET /tenant/conversation/history` endpoints.
- Contract tests for both endpoints.

### Out of scope
- UI widget (Slice 2).
- WhatsApp/Voice adapters (Slices 3 & 4).
- Outbound notifications (Slice 5).
- Localisation of system prompt beyond English/German.

### Definition of done

- [ ] `npx tsc --noEmit --project apps/api/tsconfig.json` — zero errors.
- [ ] `npm test --prefix apps/api` — all suites pass.
- [ ] `curl -X POST http://localhost:3001/tenant/conversation -H "Content-Type: application/json" -d '{"message":"Hello, I have a leaking tap"}'` with a valid tenant session cookie returns a JSON reply with `replyText` and `intent`.
- [ ] `GET /tenant/conversation/history` returns the stored exchange.
- [ ] Blueprint doc sync: `node apps/api/blueprint.js` exits with no errors, no count mismatches.

---

## Slice 2 of 5 — In-app chat widget (tenant portal UI)

Read `PROJECT_OVERVIEW.md` first, then `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md`,
then `PROJECT_STATE.md`. Slice 1 must be complete and green before starting this slice.

### Slice name: `tenant-chat-ui`

**Goal:** Add a floating chat widget to the tenant portal that calls the conversation
endpoints from Slice 1. This is the primary validation surface — if the full loop
(UI → API → Claude → reply → UI) works in-app, the architecture is sound before
introducing telephony.

### Before writing code

1. Read `apps/web/pages/tenant/` to understand the current tenant portal page structure,
   shared layout, and how `TenantPortalAPI` from `packages/api-client` is used.
2. Read `apps/web/pages/tenant/index.js` (or dashboard) to find the root layout where a
   floating widget should be injected.
3. Read `docs/FRONTEND_INVENTORY.md` to understand the page and proxy file count
   conventions before adding new files.
4. Read `apps/web/pages/api/` to understand the proxy file pattern used across the app.
   Note: proxy files call `proxyToBackend` — do not call the backend directly from
   browser-side code.
5. Note the tenant session cookie name and how it is forwarded by existing proxy files.

### Architecture rules

- The chat widget is a React component (`ChatWidget.js`) placed in
  `apps/web/components/tenant/`.
- It must be rendered inside the existing tenant layout (not as a full page).
- All API calls go through Next.js proxy files (`apps/web/pages/api/tenant/conversation/`
  and `apps/web/pages/api/tenant/conversation/history.js`).
- Do not call `http://localhost:3001` directly from browser code.
- Widget state is local React state — no Redux or global state manager.
- The widget should be lazy — do not load conversation history until the widget is opened.
- Markdown in LLM replies should be rendered (use `react-markdown` if already in
  dependencies; otherwise render as plain text with newline support).

### New files — in this order

1. `apps/web/pages/api/tenant/conversation/index.js` — proxy POST to backend
   `/tenant/conversation`.
2. `apps/web/pages/api/tenant/conversation/history.js` — proxy GET to backend
   `/tenant/conversation/history`.
3. `apps/web/components/tenant/ChatWidget.js`:
   - Floating button (bottom-right corner, chat bubble icon).
   - Slide-up panel: message history list + text input + send button.
   - On open: fetch `/api/tenant/conversation/history`, render messages.
   - On send: POST to `/api/tenant/conversation`, optimistically append user message,
     show typing indicator, append reply on response.
   - Error state: "Sorry, I couldn't process your message. Please try again."
   - Accessible: ARIA roles, keyboard-navigable, focus trap when open.

### Files to modify

- The tenant portal layout file (whichever file wraps all tenant pages) — import and
  render `<ChatWidget />` once, outside the page content area.
- `docs/FRONTEND_INVENTORY.md` — add new pages/proxy files, update counts.
- `PROJECT_STATE.md` — update Document Integrity table if page/API counts change.

### Auth notes

The Next.js proxy files must forward the tenant session cookie to the backend. Check how
existing tenant proxy files (e.g. `/api/tenant/requests`) handle cookie forwarding —
replicate exactly.

### In scope
- `ChatWidget.js` component with open/close, history, send, typing indicator.
- Two Next.js proxy files for conversation endpoints.
- Integration into tenant layout.
- Accessibility basics (ARIA, keyboard nav).

### Out of scope
- Push notifications / real-time updates (polling on focus is acceptable for v1).
- Chat history pagination beyond the last 20 messages.
- File attachment support.
- WhatsApp/Voice channels (Slices 3 & 4).

### Definition of done

- [ ] `npx tsc --noEmit --project apps/api/tsconfig.json` — zero errors.
- [ ] `npm test --prefix apps/api` — all suites pass.
- [ ] Widget renders on tenant portal, opens/closes, sends a message, displays the reply.
- [ ] Network tab shows requests going through `/api/tenant/conversation` proxy, not
  directly to port 3001.
- [ ] `docs/FRONTEND_INVENTORY.md` counts are consistent with `blueprint.js` output.

---

## Slice 3 of 5 — WhatsApp adapter (Twilio inbound webhook + outbound)

Read `PROJECT_OVERVIEW.md` first, then `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md`,
then `PROJECT_STATE.md`. Slices 1 and 2 must be complete and green before starting.

### Slice name: `tenant-whatsapp`

**Goal:** Add a Twilio WhatsApp webhook that normalises inbound messages to the same
`conversationService` interface, and a `WhatsAppOutbox` table + background job for
outbound delivery. Tenants with a verified phone number in `TenantUser` can chat via
WhatsApp using the same conversation logic as in-app.

### Before writing code

1. Read `apps/api/src/services/conversationService.ts` (from Slice 1). Confirm the
   exact input/output interface of `handleTurn` — the WhatsApp adapter will call it
   with `channel: "WHATSAPP"`.
2. Read `apps/api/prisma/schema.prisma`. Look for `EmailOutbox` or any existing outbox
   model. Record the exact field pattern — `WhatsAppOutbox` must mirror it.
3. Read any existing background job or cron setup in the API (look for files referencing
   `setInterval` or a job runner). Understand how the `EmailOutbox` drain job is
   triggered.
4. Read `apps/api/src/routes/` for any existing webhook route (e.g. Stripe, Twilio
   invoices). Understand whether there is a shared webhook auth pattern.
5. Confirm `TenantUser.phone` is stored in E.164 format — Twilio sends `From` as
   `whatsapp:+41791234567`; you will strip the `whatsapp:` prefix to match.

### Architecture rules

- The Twilio webhook handler is a thin adapter — it extracts `From`, `Body`, resolves
  `tenantUserId` via `TenantUser.phone`, calls `processTurnWorkflow`, and enqueues the
  reply in `WhatsAppOutbox`. No LLM logic in the adapter.
- Twilio webhook signature validation (`X-Twilio-Signature`) must be verified using
  `twilio` SDK's `validateRequest`. Skip in `NODE_ENV === 'test'` only.
- The `WhatsAppOutbox` drain job calls Twilio's Messages API. Failures: mark
  `status = 'FAILED'`, max 3 retries (store `retryCount`), then give up.
- Tenant lookup by phone number: if no `TenantUser` found for the `From` number, reply
  with a polite "I don't recognise your number — please contact your property manager"
  and return 200 to Twilio (Twilio requires 200 for all webhooks).
- Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` to `.env.example`.

### Schema additions

Add to `apps/api/prisma/schema.prisma`:

```prisma
model WhatsAppOutbox {
  id           String            @id @default(cuid())
  orgId        String
  toPhone      String            // E.164
  body         String            @db.Text
  status       OutboxStatus      @default(PENDING)
  retryCount   Int               @default(0)
  errorMessage String?
  createdAt    DateTime          @default(now())
  sentAt       DateTime?

  @@index([status, createdAt])
}

enum OutboxStatus {
  PENDING
  SENT
  FAILED
}
```

Check whether `OutboxStatus` already exists (the EmailOutbox may define it). If so, reuse
it — do not create a duplicate enum.

Generate and apply the migration:
```bash
cd apps/api && npx prisma migrate dev --name add_whatsapp_outbox
```

### New files — in this order

1. `apps/api/src/repositories/whatsAppOutboxRepository.ts`
   - `enqueue(prisma, orgId, toPhone, body)`.
   - `dequeuePending(prisma, limit)` — fetch PENDING with `retryCount < 3`, order by
     `createdAt`.
   - `markSent(prisma, id)`, `markFailed(prisma, id, errorMessage)`.
   - `incrementRetry(prisma, id)`.

2. `apps/api/src/services/whatsAppService.ts`
   - `sendMessage(toPhone, body)` — calls Twilio REST API using SDK.
   - `drainOutbox(prisma)` — fetches pending, calls `sendMessage` for each, updates
     status. Called by the background job.

3. `apps/api/src/routes/twilioWebhook.ts`
   - `POST /webhooks/twilio/whatsapp` — Twilio webhook (no session auth, Twilio signature
     validation instead).
   - Extract `From` → strip `whatsapp:` prefix → E.164 phone.
   - Look up `TenantUser` by phone. If not found → polite reply, 200.
   - Call `processTurnWorkflow` with `channel: "WHATSAPP"`.
   - Enqueue reply in `WhatsAppOutbox`.
   - Return `<Response/>` TwiML (empty — outbound is asynchronous via the outbox job).
   - Register in main router.

4. Extend the existing background job (or create
   `apps/api/src/jobs/whatsAppOutboxJob.ts` if no job runner exists) to call
   `drainOutbox` every 30 seconds.

### Files to modify

- `apps/api/prisma/schema.prisma` — schema additions.
- `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md` — update counts.
- `SCHEMA_REFERENCE.md` — add `WhatsAppOutbox`, `OutboxStatus` (or note reuse).
- `CONTRIBUTING.md` — claim port 3225 for `twilioWebhook.test.ts`; update next available.
- `PROJECT_STATE.md` — update Document Integrity table.
- `.env.example` — add Twilio vars.
- `apps/api/package.json` — add `twilio` SDK dependency.
- `apps/api/openapi.yaml` — add `POST /webhooks/twilio/whatsapp` (note: Twilio-facing,
  not manager/tenant-facing, mark accordingly).

### Auth notes

The Twilio webhook uses Twilio signature verification, not JWT or tenant session. The
route must NOT have `requireTenantSession()` applied — instead apply a
`verifyTwilioSignature` middleware that reads `TWILIO_AUTH_TOKEN` from env. In test mode
(`NODE_ENV === 'test'`), skip signature verification.

### In scope
- Inbound WhatsApp message → `conversationService` → `WhatsAppOutbox`.
- `WhatsAppOutbox` drain job (outbound delivery).
- Twilio signature verification middleware.
- Unknown-phone handling (polite refusal, 200 response).

### Out of scope
- WhatsApp template messages for proactive notifications (Slice 5).
- Media messages (images, voice notes) — text only for v1.
- Group chats — one-to-one only.

### Definition of done

- [ ] `npx tsc --noEmit --project apps/api/tsconfig.json` — zero errors.
- [ ] `npm test --prefix apps/api` — all suites pass including `twilioWebhook.test.ts`.
- [ ] Simulated Twilio POST to `/webhooks/twilio/whatsapp` (skip sig validation in test)
  creates a `ConversationMessage` with `channel: WHATSAPP` and enqueues a
  `WhatsAppOutbox` record.
- [ ] `drainOutbox` (unit-tested with mocked Twilio SDK) marks records SENT on success,
  FAILED after 3 retries.
- [ ] Blueprint doc sync exits clean.

---

## Slice 4 of 5 — Voice / IVR adapter (Twilio Voice + STT)

Read `PROJECT_OVERVIEW.md` first, then `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md`,
then `PROJECT_STATE.md`. Slices 1–3 must be complete and green before starting.

### Slice name: `tenant-voice-ivr`

**Goal:** Add a Twilio Voice webhook that implements a simple IVR flow: Twilio calls the
tenant (or tenant calls in), speech is transcribed via Twilio's `<Gather>` with
`input="speech"`, the transcript is sent to `conversationService`, and the reply is
spoken back via `<Say>`. Swiss German handling is addressed in the notes below.

### Before writing code

1. Read `apps/api/src/routes/twilioWebhook.ts` (from Slice 3). The Voice webhook
   follows the same structure (no session auth, Twilio signature validation, TwiML
   response).
2. Read `apps/api/src/services/conversationService.ts`. Confirm `handleTurn` accepts
   `channel: "VOICE"`. The service is already channel-agnostic — the adapter only needs
   to normalise the STT transcript.
3. Read Twilio's `<Gather>` TwiML reference (you know this from training data). Key
   attributes: `input="speech"`, `language`, `speechTimeout`, `action` (callback URL).
4. Note the conversation history for VOICE threads: because voice is stateless between
   calls, the `ConversationThread` for VOICE is per-call (not persistent across calls).
   The `findOrCreateThread` in `conversationRepository` will create a new thread on each
   inbound call — implement a `resetVoiceThread` method that deletes and recreates the
   thread for each new call.

### Swiss German handling notes

Twilio's `<Gather>` `language` attribute accepts BCP-47 codes. Swiss German has no
dedicated BCP-47 code — use `de-CH` which Twilio maps to standard German (Hochdeutsch)
STT. This is a known limitation. Mitigation strategy for v1:
- Set `language="de-CH"` in `<Gather>`.
- In `conversationService`'s system prompt (from `conversationPrompts.ts`), add a note:
  "The tenant may speak Swiss German dialects. Interpret phonetically transcribed dialect
  words charitably. For example, 'Härdöpfel' = 'Kartoffel' (potato). Respond in standard
  German (Hochdeutsch) for clarity."
- This is a best-effort v1 — if a full Swiss German STT solution is needed later, it
  should be a separate epic (e.g. Deepgram with a `de` model and dialect training).

Do not over-engineer the Swiss German handling. A code comment pointing to this note is
sufficient.

### Architecture rules

- The Voice webhook is a thin adapter — same principle as the WhatsApp adapter.
- The IVR flow is two-part:
  1. `POST /webhooks/twilio/voice/inbound` — initial call webhook. Responds with TwiML
     `<Gather>` to collect speech. `action` points to step 2.
  2. `POST /webhooks/twilio/voice/gather` — Twilio calls this with the transcript.
     Calls `processTurnWorkflow`, then responds with TwiML `<Say>` (reply) + another
     `<Gather>` for the next turn. On silence or unrecognised input, prompt the tenant
     to repeat.
- Text-to-Speech voice: `alice` voice, `language="de-CH"` in `<Say>`.
- Session continuity: pass `threadId` as a query parameter in the `action` URL so the
  gather handler can load the correct thread without session cookies.
- Outbound voice calls (manager-triggered) are out of scope for this slice.

### New files — in this order

1. `apps/api/src/routes/twilioVoice.ts`
   - `POST /webhooks/twilio/voice/inbound` — creates/resets VOICE thread, returns
     `<Gather>` TwiML with `action="/webhooks/twilio/voice/gather?threadId=..."`.
   - `POST /webhooks/twilio/voice/gather` — reads `SpeechResult` from Twilio POST body,
     calls `processTurnWorkflow`, returns `<Say>` + `<Gather>` for next turn.
   - Both routes use Twilio signature validation (same middleware as Slice 3, skip in
     test).
   - Register in main router.

2. Extend `conversationRepository.ts` — add `resetVoiceThread(prisma, tenantUserId,
   orgId)`: delete existing VOICE thread for tenant, call `findOrCreateThread` with
   `channel: VOICE`.

### Files to modify

- `apps/api/src/services/conversationPrompts.ts` — add Swiss German dialect note to
  system prompt.
- `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md` — update route count.
- `CONTRIBUTING.md` — claim port 3226 for `twilioVoice.test.ts`; update next available.
- `PROJECT_STATE.md` — update Document Integrity table.
- `apps/api/openapi.yaml` — add voice webhook endpoints (marked as Twilio-facing).
- `.env.example` — no new vars needed if `TWILIO_AUTH_TOKEN` is already present from
  Slice 3.

### Auth notes

Same as Slice 3: Twilio signature validation, not JWT. The `threadId` in the URL is not
a secret — it is a Prisma CUID used only for continuity within a call. It does not grant
any additional permissions; tenant identity is re-validated via the Twilio `From` number
on each gather callback.

### In scope
- Two-part IVR flow: `<Gather>` → `<Say>` loop.
- Swiss German `de-CH` language hint + system prompt note.
- `resetVoiceThread` for per-call state isolation.
- Twilio signature validation (reused from Slice 3).

### Out of scope
- Outbound voice calls (manager-initiated calls to tenants).
- Voicemail handling.
- DTMF (keypad) input — speech-only for v1.
- Swiss German fine-tuned STT beyond the `de-CH` language hint.

### Definition of done

- [ ] `npx tsc --noEmit --project apps/api/tsconfig.json` — zero errors.
- [ ] `npm test --prefix apps/api` — all suites pass including `twilioVoice.test.ts`.
- [ ] Simulated Twilio POST to `/webhooks/twilio/voice/inbound` returns valid TwiML with
  `<Gather input="speech" language="de-CH">`.
- [ ] Simulated gather callback with `SpeechResult="Ich habe ein Problem mit dem Heizung"`
  returns TwiML with `<Say language="de-CH">` containing a reply from `conversationService`.
- [ ] Blueprint doc sync exits clean.

---

## Slice 5 of 5 — Proactive outbound WhatsApp notifications

Read `PROJECT_OVERVIEW.md` first, then `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md`,
then `PROJECT_STATE.md`. Slices 1–4 must be complete and green before starting.

### Slice name: `tenant-whatsapp-notifications`

**Goal:** Send proactive WhatsApp messages to tenants when maintenance request status
changes (e.g. SCHEDULED, COMPLETED) and when a new document (e.g. rent statement) is
available for them. Uses the `WhatsAppOutbox` from Slice 3 — domain events trigger
inserts; the existing drain job handles delivery.

### Before writing code

1. Read `apps/api/src/workflows/` to find where `MaintenanceRequest` status transitions
   are emitted as domain events. Record the exact event names and payload shapes.
2. Read `apps/api/src/services/` for any existing `EmailOutbox`/email notification
   service. The WhatsApp notification handler mirrors its structure.
3. Read `apps/api/prisma/schema.prisma`. Confirm `TenantUser.phone` and the relation
   path from `MaintenanceRequest` to the responsible tenant.
4. Understand which tenant has a WhatsApp-capable phone number: for v1, treat all
   `TenantUser.phone` values as WhatsApp-capable (opted in by default). A proper opt-in
   flow is out of scope.
5. Check `packages/api-client/src/index.ts` for notification preference APIs — if none
   exist, do not create one for this slice.

### Architecture rules

- Notification logic lives in `apps/api/src/services/tenantNotificationService.ts`.
  This service reads the domain event payload, resolves the tenant phone, and calls
  `whatsAppOutboxRepository.enqueue`. It does not call Twilio directly.
- Domain event listeners are registered in the same place as all other listeners (find
  the existing event bus registration file — check `ARCHITECTURE_LOW_CONTEXT_GUIDE.md`
  for the event bus entry point).
- Message templates live in
  `apps/api/src/services/notificationTemplates.ts` — plain TypeScript string templates,
  not database records.
- Do not add new domain events — subscribe to existing ones only. If a required status
  transition does not emit an event, add the event emission to the relevant workflow
  (one atomic commit: workflow change + notification handler).

### Notification triggers (v1)

| Event | Template |
|-------|----------|
| `REQUEST_STATUS_CHANGED` to `SCHEDULED` | "Your maintenance request [title] has been scheduled for [date]. We'll be in touch if anything changes." |
| `REQUEST_STATUS_CHANGED` to `COMPLETED` | "Your maintenance request [title] has been completed. Please let us know if you have any questions." |
| `DOCUMENT_PUBLISHED` (if event exists) | "A new document is available for you: [title]. Log in to your tenant portal to view it." |

All messages must be in the tenant's preferred language if `TenantUser.preferredLanguage`
exists; fall back to German if the field does not exist or is null.

### New files — in this order

1. `apps/api/src/services/notificationTemplates.ts`
   - Export typed template functions:
     `requestScheduled(title, date, lang)`,
     `requestCompleted(title, lang)`,
     `documentPublished(title, lang)`.
   - German and English variants for v1. Add a comment noting French/Italian as a future
     addition.

2. `apps/api/src/services/tenantNotificationService.ts`
   - `notifyRequestStatusChanged(prisma, requestId, newStatus)`:
     - Resolves tenant phone from request → unit → tenantUser.
     - If no phone, logs a warning and returns (silent fail — notification is
       best-effort).
     - Picks template based on `newStatus`.
     - Calls `whatsAppOutboxRepository.enqueue`.
   - `notifyDocumentPublished(prisma, documentId, tenantUserId)` (if `DOCUMENT_PUBLISHED`
     event exists; otherwise stub with a TODO comment).

3. Register listeners in the event bus file:
   - `REQUEST_STATUS_CHANGED` → `tenantNotificationService.notifyRequestStatusChanged`.
   - `DOCUMENT_PUBLISHED` → `tenantNotificationService.notifyDocumentPublished` (if
     applicable).

### Files to modify

- The event bus registration file (check `ARCHITECTURE_LOW_CONTEXT_GUIDE.md`).
- `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md` — add notification service to
  service index, update counts.
- `CONTRIBUTING.md` — claim port 3227 for `tenantNotifications.test.ts`; update next
  available.
- `PROJECT_STATE.md` — update Document Integrity table.

### Auth notes

No HTTP auth involved — this is an internal service called from domain event handlers.
The `WhatsAppOutbox` drain job (Slice 3) handles the actual Twilio API call with the
stored credentials.

### In scope
- Notification templates for request SCHEDULED, COMPLETED, and (if event exists)
  document published.
- Domain event listeners that enqueue to `WhatsAppOutbox`.
- German + English template variants.

### Out of scope
- Tenant opt-in/opt-out preference management.
- Push notifications (web push or APNs/FCM) — WhatsApp only.
- Rich media (images, documents) in WhatsApp messages — text only.
- French/Italian templates.

### Definition of done

- [ ] `npx tsc --noEmit --project apps/api/tsconfig.json` — zero errors.
- [ ] `npm test --prefix apps/api` — all suites pass including `tenantNotifications.test.ts`.
- [ ] Integration test: transition a `MaintenanceRequest` to `SCHEDULED` via workflow →
  verify a `WhatsAppOutbox` record is created with the correct phone and message body.
- [ ] Integration test: transition to `COMPLETED` → verify second `WhatsAppOutbox` record.
- [ ] Blueprint doc sync exits clean.
