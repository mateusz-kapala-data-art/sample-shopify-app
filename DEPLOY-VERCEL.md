# Deploying to Vercel (serverless + Postgres)

This app used to run as a long-lived Node process with SQLite + an interval worker. To run
on Vercel (serverless) it now uses **hosted Postgres** and applies webhooks **inline**. This
runbook takes you from zero to a stable public URL you can install on multiple stores.

> You need to run these steps yourself — they require your Vercel, database, and Shopify
> logins. The code changes are done and build clean; the Postgres + serverless **runtime**
> is verified here, on deploy.

## 1. Create a free Postgres (Neon)

1. Sign up at <https://neon.tech> and create a project (any region near the venue).
2. Copy **two** connection strings from the dashboard:
   - **Pooled** (host contains `-pooler`) — use for `DATABASE_URL` (serverless runtime).
   - **Direct** (no `-pooler`) — use once for migrations in step 2.
   (Supabase works too; use its pooled + direct URLs.)

## 2. Create the tables (run once, from your laptop)

```bash
# use the DIRECT url for migrations (pooled/pgBouncer can block Prisma's advisory locks)
DATABASE_URL="postgresql://…direct…/neondb?sslmode=require" npx prisma migrate deploy
```

You should see `0_init` applied. This creates `Session`, `Store`, `WebhookEvent`.

## 3. Import the repo into Vercel

1. Push this repo to GitHub/GitLab, then "Add New Project" in Vercel and import it.
2. Vercel reads `vercel.json` (build command `prisma generate && react-router build`) and
   `react-router.config.ts` applies the Vercel preset because `VERCEL=1` is set on Vercel.
   Leave the framework preset as detected; do not override the build command in the UI.

## 4. Set Vercel environment variables

Project → Settings → Environment Variables (Production + Preview):

| Name | Value |
|---|---|
| `DATABASE_URL` | the **pooled** Neon URL (host has `-pooler`), `…?sslmode=require` |
| `SHOPIFY_API_KEY` | your app's client id (`shopify.app.toml` → `client_id`) |
| `SHOPIFY_API_SECRET` | your app's client secret |
| `SHOPIFY_CLIENT_SECRETS` | comma-separated secrets (rotation) — at minimum the current secret |
| `SCOPES` | `read_products,read_themes` |
| `SHOPIFY_APP_URL` | your Vercel URL, e.g. `https://your-app.vercel.app` (set after first deploy, then redeploy) |

## 5. Deploy, then point Shopify at the Vercel URL

1. Deploy. Note the production URL (`https://your-app.vercel.app`).
2. Set `SHOPIFY_APP_URL` to that URL (step 4) and redeploy so OAuth builds correct links.
3. Update the app's URLs to the Vercel domain (keep the existing paths):
   - `shopify.app.toml` → `application_url = "https://your-app.vercel.app"` and
     `redirect_urls = [ "https://your-app.vercel.app/api/auth" ]`, then run `shopify app deploy`.
   - (Or edit the same URLs in the Partner Dashboard.)

## 6. Install on multiple stores

Open the app's install link for each dev store (from the Partner Dashboard, or
`https://your-app.vercel.app/auth?shop=<store>.myshopify.com`). Each install runs `afterAuth`
→ writes a `Store` row in Postgres. The **Registry** route now shows every store, and renaming
a store fires `shop/update`, which is applied inline and shows in the **Webhook log**.

## Known serverless limitations (flagged, not yet solved)

- **Degraded-mode rehearsal (Registry "Simulate degraded mode", slide C4)** — the `degraded`
  flag is in-memory module state, so on serverless it won't reliably persist between requests.
  If you need this demo on the hosted app, ask and I'll move the flag into Postgres (a tiny
  one-row table) so it survives cold starts.
- **Admin-token cache** — the in-memory `Map` re-mints a client-credentials token per cold
  start. Harmless (just an extra grant now and then); no action needed for the demo.
- **Webhook backstop** — the interval worker does not run on Vercel; inline application in
  `/webhooks` covers it. If an inline apply ever fails, the row stays `processedAt = null`;
  a redelivery reapplies it. There is no periodic drain on serverless.

## Local development after this change

Local dev no longer uses SQLite. Put a `DATABASE_URL` (a Neon branch, or a local Postgres)
in your `.env`, then `shopify app dev` as before. `prisma migrate deploy` (or a Neon branch)
sets up the local tables. The `Dockerfile` / `npm start` container path still works if you
ever want a non-serverless host — it's left in place as a fallback.
