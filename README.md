# Accountant

A two-person Canadian household finance dashboard with a responsive website and installable PWA. The local Node server stores demo data in JSON; the Vercel deployment uses serverless API functions and Neon for persistent household state.

## Run locally

1. Install Node.js 20 or newer.
2. From this folder, run `npm start`.
3. Open `http://localhost:3000`.
4. Choose Partner A or Partner B and use the local demo passcode `1234`.

The local server stores changes in `.local-data/household.json` and leaves the tracked `data/household.json` demo seed unchanged. Local data and the demo passcode are for demonstration only.

## Deploy on Vercel

Vercel Functions are stateless, so the deployed app stores household state in Neon rather than relying on local files or in-memory sessions.

1. Create a Neon project with PostgreSQL. Better Auth is not needed; the app already provides its own passcode-based household login. In the Neon SQL Editor, run [`neon/schema.sql`](./neon/schema.sql).
2. Create a **private** GitHub repository and push this project. The Vercel project uses [`vercel.json`](./vercel.json) to serve only the `public/` website files and route `/api/*` to a shared Node.js Function.
3. In Vercel, choose **Add New → Project**, import the repository, and deploy. No framework or build command is needed.
4. In Vercel **Settings → Environment Variables**, add:
   - `DATABASE_URL` — the Neon pooled connection string from the project’s **Connect** dialog. Keep it server-only; never put it in browser code.
   - `DEMO_PASSCODE` — a long, unique passphrase to share privately with your wife.
   - `SESSION_SECRET` — a separate random secret; generate one locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`.
5. Apply the environment variables to **Production**, then redeploy. The first successful household data request seeds the Neon row from `data/household.json`.
6. Share the HTTPS deployment URL and `DEMO_PASSCODE` privately. Both of you can select Partner A or Partner B in the shared household workspace.

The database connection string is used only by the Vercel Function, and writes use a version check to reduce concurrent updates. Use separate Neon branches or projects for preview deployments if you do not want them sharing household data.

The Vercel demo supports CSV imports and the rest of the shared household workflows. Plaid bank linking is intentionally disabled in the Vercel adapter until its access tokens can be stored securely in a persistent server-side connection table. Do not enter real financial or identity information in this demo.

## Install on phones

The PWA manifest, Apple/Android icons, and service worker live in `public/`. The service worker caches only the static app shell; it never caches household API responses, so login and financial data require an internet connection.

- **Android:** Open the HTTPS deployment in Chrome and choose **Install app** (or **Add to Home screen**) from the browser menu.
- **iPhone/iPad:** Open the HTTPS deployment in Safari, tap **Share**, then **Add to Home Screen**.

It also continues to work as a normal website on desktop and mobile browsers.

## Data connections

- CSV imports accept Date, Description/Merchant, and Amount columns, or separate Debit and Credit columns. Imports are deduplicated using transaction date, amount, account last four digits, and transaction type.
- The Q&A assistant is a deterministic summary of verified household ledger data; it does not send financial data to an external AI service.
- The local Node server has optional Plaid Link endpoints; the Vercel adapter currently directs users to CSV import instead.

Expected paydays and bills remain separate from actual balances. The app includes the 55/5/10/15/15 budget split, transaction routing, reconciliation, debt and investment views, and tax receipt export.
