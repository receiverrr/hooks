# Deploy hooks to Vercel

This is the prescribed deployment method for the reference implementation: **Vercel** (serverless).

## 1. Deploy the app

From the repo root (this folder):

```bash
npm install
vercel
```

When prompted, set the **root directory** to this folder if you’re in a parent monorepo. Follow the prompts to link a new or existing Vercel project.

Your webhook URL will be:

`https://<your-project>.vercel.app/api/dice-game`

Use this as `WEBHOOK_URL` in `.env` when running `npm run setup`.

## 2. Add Vercel KV (storage)

The dice game uses **Vercel KV** for balances and pending bets.

1. In [Vercel Dashboard](https://vercel.com) → your project → **Storage**
2. Create a **KV** database
3. Connect it to the project (Vercel adds the required env vars automatically)

## 3. Environment variables (Vercel)

Run from this folder (with `.env` containing `CRUSTOCEAN_USER`, `CRUSTOCEAN_PASS`, `WEBHOOK_URL`, `CRUSTOCEAN_AGENCY_ID`):

```bash
npm run env:vercel
```

This generates the global hook key from Crustocean and pushes `CRUSTOCEAN_API_URL` and `CRUSTOCEAN_HOOK_KEY` to your Vercel project. The hook key is required for `/dicebet @username` (resolving usernames).

| Variable | Description | Set by |
|----------|-------------|--------|
| `CRUSTOCEAN_API_URL` | `https://api.crustocean.chat` | `npm run env:vercel` |
| `CRUSTOCEAN_HOOK_KEY` | Global hook key (one per webhook) | `npm run env:vercel` |


**Do not** commit `.env` or store secrets in the repo. Use Vercel’s env UI or CLI for production.

## 4. Register commands with Crustocean

After deploy, register your slash commands so Crustocean knows where to send webhook requests:

1. Copy `.env.example` to `.env` in this folder.
2. Set `CRUSTOCEAN_USER`, `CRUSTOCEAN_PASS`, `CRUSTOCEAN_AGENCY_ID`, and `WEBHOOK_URL` (your Vercel URL, e.g. `https://<project>.vercel.app/api/dice-game`).
3. Run:

```bash
npm run setup
npm run env:vercel
```

This creates/updates the custom commands in the given agency. Users in that agency can then use `/custom` to list commands and (if the hook is installable) others can run `/hook install dicebot` in their own agencies (after you’ve published from a public agency).

## 5. Local development

```bash
vercel link
vercel env pull
npm run dev
```

Use **ngrok** or similar to expose `http://localhost:3000/api/dice-game` if you need to test against Crustocean from your machine.

## Summary

1. Deploy → `vercel`  
2. Add KV storage and connect to project  
3. Set `.env` locally with `CRUSTOCEAN_USER`, `CRUSTOCEAN_PASS`, `CRUSTOCEAN_AGENCY_ID`, `WEBHOOK_URL`  
4. Run `npm run setup` to register commands  
5. Run `npm run env:vercel` to push `CRUSTOCEAN_HOOK_KEY` to Vercel  
6. Redeploy: `vercel --prod`
