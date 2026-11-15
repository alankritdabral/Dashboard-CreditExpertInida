This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Credit reports are stored in RDS (through the backend)

The RDS database is private to the backend's network, so the dashboard never connects to it.
Every bureau pull is handed to `NodeBankend-Server` (on EC2), which saves it and serves the report
lists back. Firestore is still used for staff accounts, logs and WhatsApp, but no longer for credit
reports.

```
dashboard ──(IDSPay)──► bureau
    │
    └─ POST /internal/dashboard-reports ──► NodeBankend-Server ──► RDS  (credit report + who pulled it)
                                                              └──► S3   (raw response + bureau PDF)
```

**Environment (`.env.local` and the hosting platform):**

| Variable | Value |
| --- | --- |
| `BACKEND_API_URL` | Backend base URL including its prefix, e.g. `https://api.example.com/api/v1` |
| `BACKEND_API_KEY` | Shared secret. Must equal `DASHBOARD_API_KEY` in the backend's `.env`. |

Without both, the report APIs answer `503`; if the backend cannot be reached they answer `502`.
In both cases the fetch form still shows the report and warns that it was not saved.
The dashboard needs no database, PAN-encryption or AWS settings — those live on the backend only.

**What the backend does per pull** (`src/modules/dashboard-reports` in the backend repo):

- Finds the applicant's user by mobile number, or creates it. An existing profile is never overwritten.
- Parses the raw response and saves the credit report (accounts, enquiries, addresses, scores) exactly as it does for its own pulls, then archives the raw response and the bureau PDF to S3.
- Records who pulled the report, the branch and the source, plus the raw response the report viewer renders. This record is written even when the bureau has no history for the person or the response cannot be parsed.

**Where the code is:**

- `src/lib/cibil/backendApi.ts` — HTTP client (adds the key, unwraps the backend's response envelope).
- `src/lib/cibil/saveReport.ts`, `reportStore.ts` — save / list / open / delete / stats / activity, used by `src/app/api/reports/*`.
- `src/lib/cibil/bureau.ts` — decides whether an IDSPay answer is a usable report (same rules as the backend).

**Importing the old Firestore reports** (one-off, repeatable):

```bash
npm run backfill:rds -- --dry-run     # count only
npm run backfill:rds -- --limit 20    # try a few
npm run backfill:rds                  # everything
```

This sends each old record to the backend so it appears in the lists. It creates no user and no
credit report for past applicants, and never changes Firestore.
