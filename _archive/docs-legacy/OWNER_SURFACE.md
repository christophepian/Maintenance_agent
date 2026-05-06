# Owner Surface Segregation Rules

Owner-facing surfaces must follow a strict separation of responsibilities:

- **Owner Dashboard = live + actionable**
- **Owner Reporting = historical + explanatory**

## Dashboard owns
Dashboard is the operational control surface. It should answer:
> What needs my attention right now?

Dashboard content should be:
- live
- actionable
- workflow-oriented
- compact
- frequently revisited

Dashboard examples:
- live KPIs that support current action
- approvals awaiting decision
- invoices needing action
- RFP workflow/status
- vacancies as active issues
- alerts / expiring soon / operational watchlist
- quick links / navigation / refresh state

Dashboard should avoid:
- long-form performance storytelling
- trend-heavy narrative sections
- deep historical comparison tables
- strategic recommendation sections that belong to reporting

## Reporting owns
Reporting is the analytical / investor-review surface. It should answer:
> How is my property performing, why, and what does it mean?

Reporting content should be:
- period-based
- explanatory
- comparative
- narrative
- calmer and less workflow-heavy

Reporting examples:
- monthly / quarterly / YTD KPIs
- income / expense / net result analysis
- performance drivers
- variance analysis
- move-ins / move-outs
- trend charts
- building / portfolio comparisons
- strategic recommendations

Reporting should avoid:
- operational action queues
- approvals backlog
- invoice workflow lists
- RFP workflow lists
- real-time task lists already owned by dashboard

## Shared-topic rule
Some topics may appear in both surfaces, but only with clearly different framing.

Allowed shared topics:
- vacancy
- lease expiries
- building health
- portfolio health
- financials at a high level

Required framing:
- Dashboard vacancy = current vacant units / action required
- Reporting vacancy = vacancy trend / explanation
- Dashboard lease expiry = upcoming task
- Reporting lease expiry = renewal opportunity / risk context
- Dashboard building health = alert / watchlist
- Reporting building health = performance interpretation
- Dashboard financials = exposure / liabilities
- Reporting financials = income / expenses / net result

Do not render the same list or table on both surfaces unless there is a strong reason and the framing is materially different.

## Implementation preference
When owner dashboard and owner reporting overlap:
1. first solve via frontend information segregation
2. avoid backend changes unless the target surface truly lacks required read-model data
3. preserve existing business logic and source-of-truth calculations
4. prefer reuse of shared presentational patterns without duplicating interpretation logic

## Copy guidance
Use distinct language by surface:

Dashboard language:
- needs attention
- awaiting decision
- open items
- due soon
- outstanding
- view all

Reporting language:
- this month
- performance drivers
- compared to last month
- what changed
- highlights
- recommendations
- trend
- variance
