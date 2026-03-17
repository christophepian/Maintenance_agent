# RFP Epic

> Read PROJECT_STATE.md, apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md, and blueprint.js first and obey all guardrails exactly. Preserve existing behavior unless explicitly required for consistency or safety.

## Before proposing or writing code:

- Review docs/AUDIT.md for any open findings relevant to the files in scope and call them out.
- Review blueprint.js and existing routes/pages/components so you do not duplicate existing functionality, pages, route handlers, workflow entry points, or DTO shapes.
- Reuse existing page patterns, workflows, repositories, include constants, route conventions, notification patterns, and manager/owner selection UX where they already exist.

## Architecture rules:

- Keep routes thin.
- Put orchestration in workflows.
- Keep Prisma access in repositories.
- Keep status rules in workflows/transitions.ts.
- Emit domain events only from workflows.
- If an API contract changes, update DTOs, Prisma includes, OpenAPI, packages/api-client, and tests in the same slice.
- Follow manager UI guardrails in PROJECT_STATE.md exactly.
- For repeated stateful UI, extract shared components per F-UI5.
- Do not invent parallel implementations if a related one already exists in the codebase.

---

## 1. Product Goal

Extend the current maintenance-request-to-RFP flow into a complete MVP that supports:

- contractor discovery of relevant open RFPs
- contractor submission of one locked quote per RFP
- manager/owner review of multiple quotes inside one RFP
- award selection with threshold-aware owner approval rules
- fallback actions when no quote is acceptable
- post-award scheduling handshake between tenant and selected contractor
- completion confirmation and mutual ratings later in the journey

This scope starts from the current state where:

- a maintenance request can generate an RFP
- /manager/rfps exists but is not yet useful
- contractor-side RFP visibility/quote submission is effectively missing
- scheduling behavior has not been formally defined

---

## 2. Canonical User Journey

### Standard path

1. tenant submits maintenance request
2. legal engine and/or manager action creates an RFP when appropriate
3. matching contractors can discover the RFP
4. invited contractors can also receive the RFP directly
5. contractor opens RFP detail and submits one quote
6. multiple contractors submit one quote each
7. manager and/or owner reviews all quotes under the same RFP
8. one quote is selected as the winner
9. if building approval rules require owner approval above threshold, award waits for owner approval
10. otherwise manager can award directly
11. losing contractors receive polite rejection notification
12. winning contractor is notified in-app
13. tenant and awarded contractor coordinate an appointment
14. if no appointment is arranged within 72 hours of award, manager is notified
15. after work completion, tenant and contractor confirm and rate each other

### Valid fallback paths

- manager/owner bypasses quote collection and directly assigns a contractor
- manager re-invites more contractors if submitted quotes are insufficient
- RFP can close without award and return to manager action

---

## 3. Core Product Decisions Already Established

### Contractor visibility

- only contractors matching the relevant work category should see an RFP
- example: electricians should not see sink/plumbing RFPs

### Discovery model

Both models are valid:

- invited contractors can receive specific RFPs
- matching contractors can browse open RFPs in their trade

### Pre-award information visible to contractors

**Visible:**

- category
- description of what needs to be fixed
- photos / attachments uploaded by tenant
- postal code
- appliance / asset context if available
- other useful non-sensitive job context as already available in the request

**Not visible pre-award:**

- full address
- tenant identity/contact details
- tenant-provided estimated cost (to be removed from tenant workflow eventually)

### Clarifications

- no contractor clarification / messaging flow in MVP
- contractor submits quote based on visible information only

### Quote requirements

Each contractor quote must include:

- total estimated price
- currency
- VAT included / excluded
- estimated duration
- earliest availability
- line-item breakdown
- narrative work plan
- assumptions / exclusions
- validity date

### Quote submission rules

- one quote per contractor per RFP
- once submitted, it is locked
- no drafts
- no revisions for now
- manager/owner only see submitted quotes, never drafts

### Award authority

- manager may award directly when building rules permit
- if building rules require owner approval above a configured CHF threshold, owner approval is required
- award occurs at the quote level under one RFP
- exactly one quote can win

### Rejected / losing quotes

- losing contractors receive a polite rejection notification
- they do not need detailed rejection reasoning in MVP

### Fallback after failed quote collection

- manager may re-invite more contractors
- manager may bypass quote collection and directly assign a contractor

### Manager/owner review priorities

Quote comparison should emphasize:

- total price
- speed
- earliest availability
- contractor rating/history
- travel distance
- preferred vendor status

### Review UI pattern

- use expandable detail cards per quote
- include a "select winner" CTA on each quote
- borrow the same interaction principles as existing owner tenant-selection patterns where appropriate

### Scheduling approach

- after award, contractor proposes concrete slots first
- tenant and contractor coordinate from there
- no full calendar integration yet
- if no appointment is booked within 72 hours, notify manager
- appointment details do not need a full long-term scheduling subsystem in MVP

### Notification priorities

In-app notifications are required now for:

- quote submitted
- quote rejected / RFP closed
- winning contractor selected
- 72-hour no-booking escalation to manager

Design all notification-triggering states so email/SMS can be added later.

### Contractor auth / onboarding

- contractor registration/approval is out of scope
- use existing auth tokens / contractor auth plumbing already present
- wire the operational flow first

### Quote quality guardrails

Require at minimum:

- non-empty quote description/work plan
- total price
- rough breakdown
- validity date
- earliest availability
- any other required fields listed above

---

## 4. MVP Boundaries

### In scope for this initiative

- meaningful manager RFP list/detail
- contractor-visible RFP list/detail
- contractor quote submission
- manager/owner quote comparison and selection
- threshold-aware award approval routing
- in-app notifications for quote lifecycle
- fallback actions for failed quote collection
- lightweight post-award scheduling handshake
- later completion confirmation + mutual ratings

### Out of scope for initial MVP slices

- contractor self-registration / approval
- anonymous public contractor marketplace
- contractor/manager clarifying questions or messaging
- editable quote drafts
- full calendar sync with Google/Outlook
- rich long-term appointment history beyond what is needed operationally
- payments
- sophisticated automatic quote scoring
- redesign of unrelated existing request/job/invoice flows

---

## 5. Target Product Surfaces

### Manager

- /manager/rfps should become a meaningful inbox/list
- manager should open one RFP and review all submitted quotes in context
- manager should award directly when permitted
- manager should trigger owner approval when required
- manager should be notified if awarded contractor fails to book with tenant within 72 hours
- manager should be able to re-invite contractors or directly assign one

### Owner

- owner should be able to review quotes on RFPs that require owner approval
- owner should approve/reject high-cost quote selections
- owner should see the same RFP detail context, without duplicate page concepts if shared UI can be reused

### Contractor

- contractor should see open/invited RFPs relevant to their category
- contractor should open an RFP detail page
- contractor should view description, photos, postal code, and other allowed context
- contractor should submit exactly one locked quote
- contractor should receive notification if selected or rejected

### Tenant

- tenant does not participate in quote review
- after award, tenant participates in appointment arrangement with selected contractor
- tenant later confirms completion and rates contractor

---

## 6. Functional Requirements by Area

### A. RFP list/detail on manager and owner side

RFP list rows should surface valuable summary information, not empty shells. Include:

- RFP identifier / request linkage
- request number
- category
- short description
- postal code
- number of invited contractors
- number of submitted quotes
- current RFP status
- created date
- award decision state

RFP detail should show:

- linked request context
- legal/operational reason the RFP exists if available
- photos / attachments availability
- quote count
- current status
- quote cards with detailed breakdown and selection CTA

### B. Contractor marketplace / inbox

Contractor-side RFP surfaces should support both:

- invited RFPs
- open RFPs in the contractor's trade/category

Contractor should not see irrelevant categories.

### C. Quote submission

- Each contractor can submit exactly one quote per RFP.
- Submitted quote becomes immutable in MVP.

### D. Award workflow

Award should:

- select one quote as winner
- notify the winner
- reject/close the others with notification
- route through owner approval when building rules require it
- remain manager-authorized when below threshold

### E. Fallback

Manager must be able to:

- re-invite more contractors
- directly assign a contractor instead of continuing quote collection

### F. Scheduling handshake

After award:

- contractor proposes concrete slots
- tenant accepts one or continues negotiation
- if no appointment is agreed within 72 hours, manager is notified

### G. Completion + ratings

Later slice:

- contractor marks work complete
- tenant confirms work complete
- both sides rate each other

---

## 7. Suggested Domain Concepts

> Do not implement blindly without first checking existing models/routes/workflows/pages in blueprint.js, Prisma schema, and current route inventory.

You will likely need some combination of:

- RFP
- RFP invitation
- RFP quote
- awarded quote reference on RFP
- lightweight scheduling proposal / appointment negotiation record

But first inspect whether adjacent concepts already exist or can be extended without duplication.

---

## 8. UX Principles

- Prefer existing app patterns over new ones
- Manager/owner quote review should use expandable cards, not a heavy comparison spreadsheet first
- Contractor experience should be simple and transactional
- Hide sensitive location/identity info pre-award
- Use in-app notifications now, but preserve future path for email/SMS
- Preserve current page shells, tab-strip conventions, Panel structure, and shared component strategy

---

## 9. Delivery Strategy

Implement this initiative as a sequence of small slices. Do not attempt the entire system in one slice.

**Recommended slice order:**

1. Manager RFP list/detail becomes meaningful
2. Contractor sees relevant open/invited RFPs
3. Contractor submits one locked quote
4. Manager/owner reviews and awards quote
5. Fallback actions: re-invite or direct assign
6. Scheduling handshake with 72-hour escalation
7. Completion confirmation + mutual ratings

---

## 9A. Slice Order and Descriptions

All slices must follow the conventions defined in section 10. Slice Conventions (mandatory).

Each slice must:

- check docs/AUDIT.md
- inspect blueprint.js
- reuse existing routes/pages/components/workflows when available
- preserve existing behavior unless explicitly required
- obey ARCHITECTURE_LOW_CONTEXT_GUIDE.md layer rules.

---

### Slice 1

```
Slice name: rfp-manager-view

Goal:
Make /manager/rfps and the RFP detail page meaningful so managers and owners
can see real RFP information instead of placeholder rows.

Primary workflow affected:
evaluateLegalRoutingWorkflow

Files to modify — in this order:
1. workflows/evaluateLegalRoutingWorkflow.ts
2. repositories/requestRepository.ts
3. workflows/transitions.ts — only if RFP status transitions must be introduced
4. validation/<schema>.ts — only if request → RFP payload validation changes
5. Routes, DTOs, OpenAPI, api-client, tests — only after the above are stable

Auth: requireRole

In scope:
* Populate /manager/rfps with meaningful RFP summary data
* Show request linkage, category, description preview, postal code
* Show number of invited contractors and number of submitted quotes
* Show current RFP status
* Provide link to RFP detail view
* RFP detail page shows request summary, attachments, and RFP metadata

Out of scope:
* contractor marketplace
* quote submission
* quote review and award
* scheduling

Definition of done:
* npx tsc --noEmit — 0 errors
* npm test — all existing tests pass
* npm run blueprint — docs sync cleanly
* /manager/rfps shows real RFP summaries and opens a working detail view
```

---

### Slice 2

```
Slice name: contractor-rfp-marketplace

Goal:
Allow contractors to see open or invited RFPs that match their work category.

Primary workflow affected:
evaluateLegalRoutingWorkflow

Files to modify — in this order:
1. workflows/evaluateLegalRoutingWorkflow.ts
2. repositories/requestRepository.ts
3. workflows/transitions.ts — only if RFP visibility status rules are introduced
4. validation/<schema>.ts — only if RFP exposure payload changes
5. Routes, DTOs, OpenAPI, api-client, tests — only after the above are stable

Auth: requireRole

In scope:
* contractor-facing RFP list endpoint
* filtering RFP visibility by contractor category
* contractor RFP detail page
* contractor can see description, category, photos, postal code
* hide tenant identity and full address
* support two discovery modes:
  - invited RFPs
  - open RFPs in contractor trade

Out of scope:
* quote submission
* award logic
* scheduling
* contractor onboarding

Definition of done:
* npx tsc --noEmit — 0 errors
* npm test — all existing tests pass
* npm run blueprint — docs sync cleanly
* contractor can browse relevant RFPs and open their detail page
```

---

### Slice 3

```
Slice name: rfp-quote-submission

Goal:
Allow contractors to submit exactly one locked quote for an RFP.

Primary workflow affected:
submitQuoteWorkflow

Files to modify — in this order:
1. workflows/submitQuoteWorkflow.ts
2. repositories/requestRepository.ts
3. workflows/transitions.ts — only if quote-related states are added
4. validation/quoteSchema.ts
5. Routes, DTOs, OpenAPI, api-client, tests — only after the above are stable

Auth: requireRole

In scope:
* contractor submits quote
* enforce single quote per contractor per RFP
* quote becomes locked after submission
* quote fields include:
  - total price
  - currency
  - VAT inclusion
  - estimated duration
  - earliest availability
  - line-item breakdown
  - work plan narrative
  - assumptions/exclusions
  - validity date
* emit domain event when quote submitted
* trigger in-app notification

Out of scope:
* quote editing
* quote drafts
* award logic
* scheduling

Definition of done:
* npx tsc --noEmit — 0 errors
* npm test — all existing tests pass
* npm run blueprint — docs sync cleanly
* contractor can submit a quote and cannot modify it afterwards
```

---

### Slice 4

```
Slice name: rfp-quote-review-award

Goal:
Allow manager or owner to review all quotes under one RFP and award a
winning contractor.

Primary workflow affected:
awardQuoteWorkflow

Files to modify — in this order:
1. workflows/awardQuoteWorkflow.ts
2. repositories/requestRepository.ts
3. workflows/transitions.ts — if RFP or quote states change
4. validation/awardQuoteSchema.ts
5. Routes, DTOs, OpenAPI, api-client, tests — only after the above are stable

Auth: requireRole

In scope:
* RFP detail page shows expandable quote cards
* show contractor info, total price, earliest availability
* show contractor rating/history
* show travel distance and preferred vendor status
* allow manager to select winning quote
* apply building threshold rule for owner approval
* notify winning contractor
* notify rejected contractors

Out of scope:
* scheduling
* contractor messaging
* quote revisions

Definition of done:
* npx tsc --noEmit — 0 errors
* npm test — all existing tests pass
* npm run blueprint — docs sync cleanly
* manager can select a winning quote and award contractor
```

---

### Slice 5

```
Slice name: rfp-fallback-actions

Goal:
Allow managers to recover when quotes are insufficient.

Primary workflow affected:
assignContractorWorkflow

Files to modify — in this order:
1. workflows/assignContractorWorkflow.ts
2. repositories/requestRepository.ts
3. workflows/transitions.ts — only if fallback states added
4. validation/<schema>.ts — only if new inputs added
5. Routes, DTOs, OpenAPI, api-client, tests — only after the above are stable

Auth: requireRole

In scope:
* manager can re-invite additional contractors
* manager can bypass quote collection
* manager can directly assign contractor to request

Out of scope:
* scheduling
* quote submission logic
* contractor onboarding

Definition of done:
* npx tsc --noEmit — 0 errors
* npm test — all existing tests pass
* npm run blueprint — docs sync cleanly
* manager can re-invite contractors or directly assign one
```

---

### Slice 6

```
Slice name: rfp-scheduling-handshake

Goal:
Enable tenant and selected contractor to agree on an appointment slot.

Primary workflow affected:
completeJobWorkflow

Files to modify — in this order:
1. workflows/<schedulingWorkflow>.ts
2. repositories/jobRepository.ts
3. workflows/transitions.ts — if scheduling states added
4. validation/<schema>.ts — if scheduling inputs added
5. Routes, DTOs, OpenAPI, api-client, tests — only after the above are stable

Auth: requireAnyRole

In scope:
* contractor proposes appointment slots
* tenant selects slot
* if no appointment within 72 hours → manager notification
* minimal scheduling storage only

Out of scope:
* calendar integration
* recurring availability
* calendar syncing

Definition of done:
* npx tsc --noEmit — 0 errors
* npm test — all existing tests pass
* npm run blueprint — docs sync cleanly
* tenant and contractor can agree on an appointment slot
```

---

### Slice 7

```
Slice name: job-completion-ratings

Goal:
Allow tenant and contractor to confirm job completion and rate each other.

Primary workflow affected:
completeJobWorkflow

Files to modify — in this order:
1. workflows/completeJobWorkflow.ts
2. repositories/jobRepository.ts
3. workflows/transitions.ts — if completion states updated
4. validation/<schema>.ts — if rating payload added
5. Routes, DTOs, OpenAPI, api-client, tests — only after the above are stable

Auth: requireAnyRole

In scope:
* contractor marks job completed
* tenant confirms completion
* both parties rate each other
* ratings stored for contractor history

Out of scope:
* payment processing
* dispute management

Definition of done:
* npx tsc --noEmit — 0 errors
* npm test — all existing tests pass
* npm run blueprint — docs sync cleanly
* tenant and contractor can confirm job completion and submit ratings
```

---

> If you'd like, I can also produce a visual system architecture of the RFP flow
> (request → RFP → quotes → award → job) so Copilot and future agents can reason
> about this subsystem without re-reading the entire spec.

---

## 10. Slice Conventions (mandatory)

Use this exact scoping convention for every slice in this initiative:

> Read PROJECT_STATE.md, apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md, and blueprint.js first and obey all guardrails exactly. Preserve existing behavior unless explicitly required for consistency or safety.

> Keep routes thin. Move orchestration into workflows. Keep Prisma access in repositories. Keep status rules in transitions. Emit domain events only from workflows. Update DTO / include / OpenAPI / api-client / tests together when contracts change.

> Check docs/AUDIT.md for any open findings relevant to the files you are about to touch and flag them before writing code.

> Review blueprint.js and existing routes/pages/components first so you do not duplicate existing functionality, routes, pages, workflows, include constants, or UI patterns.

```
Slice name: <short name>
Goal: <what user-visible capability this slice adds>
Primary workflow affected: <workflow name>

Files to modify — in this order:
1. workflows/<workflow>.ts
2. repositories/<repo>.ts
3. workflows/transitions.ts — only if status rules change
4. validation/<schema>.ts — only if input shape changes
5. Routes, DTOs, OpenAPI, api-client, tests — only after the above are stable

Auth: <which helper to use for any new routes — requireRole / requireAnyRole / requireTenantSession / no auth changes>

In scope:
* <item>

Out of scope:
* <item>

Definition of done:
* npx tsc --noEmit — 0 errors
* npm test — all existing tests pass
* npm run blueprint — docs sync cleanly
* <slice-specific acceptance criterion>
```

### Notes:

- You may drop the auth line only if the slice truly does not touch routes.
- You may drop the AUDIT line only once relevant findings are fully cleared.
- You must explicitly state whether blueprint.js revealed an existing reusable route/page/component/pattern before creating a new one.

---

## 11. Non-Negotiable Engineering Guardrails

- No schema drift
- No `prisma db push`
- No stub services in production paths
- No ad-hoc Prisma include trees when canonical includes exist
- No DTO changes without include + OpenAPI + api-client + tests updates
- No new route without explicit auth handling
- No inline styles / new CSS files for repeated UI
- No duplicated table/page pattern if an existing shared component can be reused
- No backend orchestration in routes

---

## 12. Expected Output for the First Slice Planning Pass

Before implementation, produce:

- a quick inventory of existing RFP-related routes/pages/components/models already present
- any open docs/AUDIT.md findings relevant to RFP/contractor/owner/notification flows
- recommended first slice from the sequence above
- exact files that first slice should touch
- any existing code that should be extended instead of duplicated
