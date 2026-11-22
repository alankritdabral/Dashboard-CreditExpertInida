# CRM & WhatsApp — dashboard roadmap

Status: **work in progress.** This draft PR tracks the dashboard (screens and
API routes) side of the CRM work. The data and business rules live in the
backend repo (`NodeBankend-Server`), on a branch with the same name
(`crm-work-ongoing`).

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

## Progress

- [x] Branch and draft PR created
- [ ] Phase 1 — branches and assignment
- [ ] Phase 2 — Excel import
- [ ] Phase 3 — follow-ups
- [ ] Phase 4 — consent
- [ ] Phase 5 — inbox
- [ ] Phase 6 — reports
