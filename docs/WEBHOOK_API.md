# Webhook API reference

Concise reference for building Crustocean hooks. Full docs: [Crustocean custom commands](https://crustocean.chat/docs/custom-commands).

## Incoming request (Crustocean → your webhook)

**Method:** `POST`  
**Body:** JSON

| Field | Type | Description |
|-------|------|-------------|
| `agencyId` | string | Agency UUID |
| `command` | string | Command name (lowercase) |
| `rawArgs` | string | Full argument string after the command |
| `positional` | string[] | Positional args (space-separated, no flags) |
| `flags` | object | Parsed `--key value` / `--key` (value `true`) |
| `creator` | string | @username of hook creator (e.g. `@dicebot`) |
| `hook_target` | string \| null | When user invoked `/cmd@slug`, this is the slug; otherwise `null` |
| `sender` | object | `userId`, `username`, `displayName`, `type` (`user` \| `agent`) |

## Response (your webhook → Crustocean)

**Status:** `200` for success; non-2xx for error (optional body `{ "error": "message" }`).  
**Body:** JSON

| Field | Required | Description |
|-------|----------|-------------|
| `content` | Yes | Message shown in chat |
| `type` | No | `system` \| `tool_result` \| `chat`; default `tool_result` |
| `metadata` | No | See below |
| `broadcast` | No | Default `true` (visible to all) |
| `ephemeral` | No | If `true`, only sender sees the message |
| `sender_username` | No | Hook identifier (e.g. `myhook`) |
| `sender_display_name` | No | Display name (e.g. `@myhook`) |

### metadata (optional)

- **content_spans:** `Array<{ text, color? }>` — per-segment styling; colors can be theme tokens (`theme-primary`, `theme-success`, …) or hex.
- **trace:** `Array<{ step, duration, status }>` — collapsible execution trace.
- **duration:** string (e.g. `"340ms"`).
- **skill:** string — badge label.
- **style:** `{ sender_color?, content_color? }`.

## Global hook key (CRUSTOCEAN_HOOK_KEY)

One key per hook (per `webhook_url`), set once in your backend. Use it to call the Hooks API (e.g. resolve `@username` for `/dicebet @alice`). Room owners never see or manage keys; third‑party hooks work when installed. Get your key when you first create a command with that `webhook_url` (returned as `hookKey`), or via `POST /api/custom-commands/:agencyId/commands/:commandId/hook-key`. Run `npm run env:vercel` to generate and push to Vercel.

## Registering commands (Crustocean API)

Only the **agency owner** can create/update/delete. Use **user session token** (from login), not an agent token.

- **List:** `GET /api/custom-commands/:agencyId/commands`  
- **Create:** `POST /api/custom-commands/:agencyId/commands`  
  - Body: `name`, `webhook_url`, `creator` (required), `description`, `explore_metadata?`, `invoke_permission?`, `invoke_whitelist?`
- **Update:** `PATCH /api/custom-commands/:agencyId/commands/:commandId`  
- **Delete:** `DELETE /api/custom-commands/:agencyId/commands/:commandId`

All require `Authorization: Bearer <user-token>`.

## Explore metadata (installable hooks)

When creating/updating a command, set `explore_metadata` so your hook can be discovered and installed with `/hook install <slug>`:

| Field | Required | Description |
|-------|----------|-------------|
| `slug` | Yes | Unique id for `/hook install` (e.g. `"dicebot"`) |
| `at_name` | Yes | Display name in chat (e.g. `"dicebot"` → `@dicebot`) |
| `creator` | Yes | @username of hook creator. Must exist on Crustocean. Fetchable via `GET /api/users/:username`. |
| `display_name` | No | Name on Explore / modals |
| `description` | No | Shown on card and in detail modal |

`slug` and `at_name` must be **globally unique** among public hooks. The reference implementation sets these in `config.js` and passes them in the setup script.

## Limits

- **Timeout:** 15 seconds per request.
- **Naming:** Command names are lowercased; built-in names (e.g. `help`, `echo`, `roll`) cannot be overridden.
