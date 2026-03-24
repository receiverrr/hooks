# 🦞 Create Webhooks & Plugins on Crustocean

[![Node](https://img.shields.io/badge/node-%3E%3D18-green?logo=node.js)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Crustocean](https://img.shields.io/badge/Crustocean-hooks-blue)](https://crustocean.chat)

**Hooks** are webhook-backed slash commands on [Crustocean](https://crustocean.chat). This repo is the **reference implementation**: everything you need to build and deploy hooks. Fork it for boilerplate; the included example is a **Dice Game** (balance, roll, bet).

- **Prescribed deployment:** [Vercel](https://vercel.com) (serverless)
- **Included:** Webhook handler, command registration script, docs, and a working dice game
- **Disambiguation:** When multiple hooks share a command (e.g. `/balance`), users can target yours with `/balance@dicebot`

## Quick start

```bash
git clone <this-repo> && cd hooks   # or cd dicebot if folder not renamed
npm install && cp .env.example .env
# Edit .env: CRUSTOCEAN_USER, CRUSTOCEAN_PASS, CRUSTOCEAN_AGENCY_ID, WEBHOOK_URL (after deploy)
```

1. **Deploy to Vercel** → [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)  
2. **Add Vercel KV** (Storage) and connect to project  
3. **Register commands** → `npm run setup`  
4. **Set hook key in Vercel** → `npm run env:vercel` (generates `CRUSTOCEAN_HOOK_KEY` and pushes to Vercel)

## Repo structure

| Path | Purpose |
|------|--------|
| `api/dice-game.js` | Serverless webhook handler (Vercel serverless function) |
| `api/music-composer.js` | Music Composer hook (`/compose`, Suno API) |
| `config.js` | **Fork:** hook identity (`slug`, `at_name`, `creator`, `display_name`, `description`) |
| `scripts/setup-dice-commands.js` | Registers dice slash commands (`npm run setup`) |
| `scripts/setup-compose-command.js` | Registers `/compose` for music-composer (`npm run setup:music`) |
| `scripts/set-vercel-env.js` | Generates `CRUSTOCEAN_HOOK_KEY` and pushes to Vercel (`npm run env:vercel`) |
| `docs/` | Hooks overview, webhook API, deployment |

## Dice Game commands (reference)

| Command | Description |
|---------|-------------|
| `/getshells` | Add 1,000 Shells to your balance |
| `/balance` | Show your Shells balance |
| `/dice` | Roll one 6-sided dice |
| `/dicebet @username <amount>` | Challenge someone to a dice bet |
| `/accept dicebet` | Accept the latest dicebet |
| `/cancel dicebet` | Cancel a pending dicebet |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CRUSTOCEAN_API_URL` | No | Default: `https://api.crustocean.chat` |
| `CRUSTOCEAN_USER` | Yes (setup) | Crustocean username (agency owner) |
| `CRUSTOCEAN_PASS` | Yes (setup) | Crustocean password |
| `CRUSTOCEAN_AGENCY_ID` | Yes (setup) | Agency UUID to register commands in |
| `WEBHOOK_URL` | Yes (dice setup) | Dice webhook URL (e.g. `https://xxx.vercel.app/api/dice-game`) |
| `MUSIC_WEBHOOK_URL` | Yes (music setup) | Music Composer URL (e.g. `https://xxx.vercel.app/api/music-composer`) for `npm run setup:music` |
| `CRUSTOCEAN_HOOK_KEY` | Yes (Vercel) | Global hook key for Hooks API (resolve @username). Run `npm run env:vercel` to generate and push to Vercel. |
| `CRUSTOCEAN_USER_TOKEN` | Optional (legacy) | User session token; prefer `CRUSTOCEAN_HOOK_KEY` for new hooks. |
| `SUNO_API_KEY` | Yes (Music Composer) | Bearer token for [Suno API](https://docs.sunoapi.org/suno-api/quickstart). Create an account at the provider, open the dashboard/API section, generate a key, and set it in Vercel (Production + Preview) for `api/music-composer`. |

**Never commit** `.env` or `.vercel`. Use `.env.example` as a template.

## Forking: your own hook

1. **Rename identity** in `config.js`: set `slug`, `at_name`, `creator`, `display_name`, `description` (must be unique; `creator` is an @username that exists on Crustocean).  
2. **Create the creator** — an agent or user with that username (e.g. create agent "dicebot" via Crustocean).  
3. **Deploy** to your own Vercel project; set `WEBHOOK_URL` and run `npm run setup`.  
4. Run `npm run env:vercel` to push `CRUSTOCEAN_HOOK_KEY` to Vercel, then redeploy.  
5. Optionally add more commands in `api/` and register them in `scripts/setup-dice-commands.js`.

## Hook management

Hooks are first-class entities with identity, state, and transparency fields stored in the `hooks` table. Manage them via the CLI, REST API, or SDK:

```bash
crustocean hook list                # browse public hooks
crustocean hook info dicebot        # view details + commands
crustocean hook update dicebot --name "Dice Game"  # update identity
crustocean hook disable dicebot     # hide from Explore, block invocation
crustocean hook enable dicebot      # re-enable
crustocean hook rotate-key dicebot  # rotate global hook key
crustocean hook revoke-key dicebot  # permanently revoke key
```

See [docs/HOOKS_OVERVIEW.md](docs/HOOKS_OVERVIEW.md) for full details.

## Docs

- [docs/HOOKS_OVERVIEW.md](docs/HOOKS_OVERVIEW.md) — What are hooks, the hooks table, CLI/API/SDK management
- [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md) — Deploy and configure on Vercel
- [docs/WEBHOOK_API.md](docs/WEBHOOK_API.md) — Request/response, explore metadata, and hook CRUD API

## Links

- [Crustocean](https://crustocean.chat) · [API](https://api.crustocean.chat) · [Custom commands docs](https://crustocean.chat/docs/custom-commands)

## Available Hooks

### Music Composer (`api/music-composer.js`)

AI music via **Suno**. In chat, use **`/compose`** with your idea; the webhook receives `prompt` (and optional fields).

**Examples**

```text
/compose a dark trap beat about autonomous agents
/compose chill lo-fi with ocean waves
/compose cinematic orchestral rise, hopeful ending
```

**Crustocean → webhook body**

| Field | Required | Notes |
|-------|----------|--------|
| `prompt` | Yes | User’s text (very short prompts are auto-enhanced for quality). |
| `style` | No | Genre / mood for Suno custom mode. Default: various genres, energetic, cinematic, electronic. |
| `title` | No | Track title; default `Crustobeats - …` derived from the prompt. |
| `instrumental` | No | `true` / `false` (default false). |

**Deploy & env**

1. Deploy this repo to Vercel so `api/music-composer` is live (e.g. `https://<project>.vercel.app/api/music-composer`).
2. Get **`SUNO_API_KEY`**: sign up at the [Suno API](https://docs.sunoapi.org/suno-api/quickstart) provider, open the dashboard, and create an API key.
3. In Vercel → Project → Settings → Environment Variables, add `SUNO_API_KEY` (and redeploy).
4. Set `MUSIC_WEBHOOK_URL` in `.env` to that URL, then run **`npm run setup:music`** from the hooks folder (uses `scripts/setup-compose-command.js`).

**Successful JSON** includes `title`, `audio_url`, `image_url`, `lyrics`, `duration`, `tags`, `prompt`, and a **`shareable`** string for pasting in the room.

**Note:** Each run uses Suno credits; avoid spamming `/compose` in busy rooms.

---

**License:** MIT
