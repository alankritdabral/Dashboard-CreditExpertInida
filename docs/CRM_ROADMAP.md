# CRM & WhatsApp — dashboard roadmap

Status: **work in progress.** This draft PR tracks the dashboard (screens and
API routes) side of the CRM work. The data and business rules live in a **new
standalone CRM backend service** (its own repository and its own database).
`NodeBankend-Server` keeps its current job (credit reports, loans, auth) and is
not changed by this work.

The dashboard keeps its current stack (Next.js, React, Tailwind, Firebase for
staff accounts and logs) and stays on Vercel. It never connects to the database;
it calls the backend's internal API, as it does today for leads and credit reports.

## Planned screens, by phase

1. **Branches and assignment** — branch-scoped lead views, a manager role, an "unassigned" list, lead-limit indicators on the lead team.
2. **Excel / CSV import** — upload, validation preview, duplicate report, error download.
3. **Follow-ups** — due dates on a lead, today / overdue lists, manager escalation view.
4. **Consent** — consent and opt-out status on a customer; blocked sends are explained.
5. **Shared WhatsApp inbox** — conversation list, replies, delivery status, 24-hour rule, "someone else is replying" lock.
6. **Reports** — response times, lead sources, workload, conversions, audit trail.

## Rules for every phase

- Own branch/PR per phase, based on `main`; changes stay behind the existing session checks.
- Admin-only actions stay admin-only; managers see only their branch.
- No secrets, tokens, phone numbers or customer data in commits or PR text.
- Each phase works against the matching backend phase and is tested before review.

## Phase 1: what is in this branch

- **Branch managers.** A manager is a normal branch user with a `manager` flag in the signed session. It is deliberately a flag and not a new role: existing `role === "branch"` checks (credit reports, history) keep applying, so a manager gets no extra access to anything except leads.
- **Manager scope.** A manager sees their branch's leads (routed to it, held by its staff, or owned by nobody yet), can assign them to their own branch's employees (one or in bulk), change status, and resend the welcome message. Every action re-checks the lead against the manager's branch on the server, so another branch's lead cannot be touched by guessing its id. Deleting, Excel export and unassigning stay admin-only. A manager flag without a real branch grants nothing.
- **Lead team (admin).** Role, open-lead limit and current open count per person; inline limit editing.
- **City rules (admin).** Which branch a city goes to.
- **Unassigned leads.** Shown with the reason, a branch badge, and a "Retry assignment" button.

Requires the CRM backend to be deployed (own database, own API key) and `CRM_BACKEND_API_URL` / `CRM_BACKEND_API_KEY` to be set. While `CRM_BACKEND_API_URL` is unset the dashboard keeps using the main backend for leads, exactly as today, so switching is one environment variable and easy to undo. The two services have different keys; each key is sent only to its own service. The screens read `role`, `maxOpenLeads`, `openCount`, `branch` and `unassignedReason` from the CRM backend.

Credit reports still come from the main backend. The CRM backend's lead list carries no reports yet, so the report badges on a lead are empty until that is added.

## Progress

- [x] Branch and draft PR created
- [x] Phase 1 — branches and assignment (needs the CRM backend deployed first)
- [ ] Phase 2 — Excel import
- [ ] Phase 3 — follow-ups
- [ ] Phase 4 — consent
- [ ] Phase 5 — inbox
- [ ] Phase 6 — reports
