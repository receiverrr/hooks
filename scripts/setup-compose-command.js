#!/usr/bin/env node
/**
 * Register the Music Composer slash command (/compose) with Crustocean.
 * Run after deploying api/music-composer to Vercel.
 *
 * Usage: npm run setup:music   (from the hooks folder)
 *        or: node scripts/setup-compose-command.js
 *
 * Requires in .env:
 *   CRUSTOCEAN_API_URL, CRUSTOCEAN_USER, CRUSTOCEAN_PASS, CRUSTOCEAN_AGENCY_ID
 *   MUSIC_WEBHOOK_URL — e.g. https://your-app.vercel.app/api/music-composer
 *
 * Dice commands stay on npm run setup (setup-dice-commands.js + WEBHOOK_URL).
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MUSIC_COMPOSER_HOOK } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../../.env') });

const API_URL = process.env.CRUSTOCEAN_API_URL || 'https://api.crustocean.chat';
const WEBHOOK_URL =
  process.env.MUSIC_WEBHOOK_URL || process.env.COMPOSE_WEBHOOK_URL || process.env.WEBHOOK_URL_MUSIC;
const AGENCY_ID = process.env.CRUSTOCEAN_AGENCY_ID;

const EXPLORE_METADATA = {
  display_name: MUSIC_COMPOSER_HOOK.display_name,
  slug: MUSIC_COMPOSER_HOOK.slug,
  at_name: MUSIC_COMPOSER_HOOK.at_name,
  creator: `@${MUSIC_COMPOSER_HOOK.creator?.replace(/^@/, '') || MUSIC_COMPOSER_HOOK.at_name}`,
  description: MUSIC_COMPOSER_HOOK.description,
};

const COMMANDS = [
  {
    name: MUSIC_COMPOSER_HOOK.command,
    description: 'Generate music from a prompt: /compose <your idea>',
  },
];

async function login() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.CRUSTOCEAN_USER,
      password: process.env.CRUSTOCEAN_PASS,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Login failed: ${res.status}`);
  }
  const data = await res.json();
  return data.token;
}

async function main() {
  if (!WEBHOOK_URL || !AGENCY_ID) {
    console.error(
      'Set MUSIC_WEBHOOK_URL (or COMPOSE_WEBHOOK_URL) and CRUSTOCEAN_AGENCY_ID in .env\n' +
        'Example: MUSIC_WEBHOOK_URL=https://your-app.vercel.app/api/music-composer'
    );
    process.exit(1);
  }
  console.log('Logging in...');
  const token = await login();
  console.log('Fetching existing commands...');
  const existing = await fetch(`${API_URL}/api/custom-commands/${AGENCY_ID}/commands`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`List failed: ${r.status}`))));
  const existingByName = new Map(existing.map((c) => [c.name, c]));
  let hookKey = null;

  for (const cmd of COMMANDS) {
    const existingCmd = existingByName.get(cmd.name);
    if (existingCmd) {
      const meta =
        typeof existingCmd.explore_metadata === 'string'
          ? (() => {
              try {
                return JSON.parse(existingCmd.explore_metadata || '{}');
              } catch {
                return {};
              }
            })()
          : existingCmd.explore_metadata || {};
      const needsMetadata = !meta.display_name || !meta.slug || !meta.at_name || !meta.creator;
      const wrongUrl = existingCmd.webhook_url && existingCmd.webhook_url !== WEBHOOK_URL;

      if (needsMetadata || wrongUrl) {
        console.log(`  Updating /${cmd.name} (metadata and/or webhook URL)...`);
        const res = await fetch(`${API_URL}/api/custom-commands/${AGENCY_ID}/commands/${existingCmd.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            webhook_url: WEBHOOK_URL,
            description: cmd.description,
            explore_metadata: EXPLORE_METADATA,
            creator: MUSIC_COMPOSER_HOOK.creator || MUSIC_COMPOSER_HOOK.at_name,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Update ${cmd.name} failed: ${res.status}`);
        }
        console.log(`  ✓ /${cmd.name} (updated)`);
      } else {
        console.log(`  ${cmd.name} — already registered, skipping`);
      }
      continue;
    }

    console.log(`  Creating /${cmd.name}...`);
    const res = await fetch(`${API_URL}/api/custom-commands/${AGENCY_ID}/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: cmd.name,
        webhook_url: WEBHOOK_URL,
        description: cmd.description,
        creator: MUSIC_COMPOSER_HOOK.creator || MUSIC_COMPOSER_HOOK.at_name,
        explore_metadata: EXPLORE_METADATA,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Create ${cmd.name} failed: ${res.status}`);
    }
    const data = await res.json();
    if (data.hookKey) {
      hookKey = data.hookKey;
      console.log(`  ✓ /${cmd.name} (hookKey received — run npm run env:vercel to set in Vercel)`);
    } else {
      console.log(`  ✓ /${cmd.name}`);
    }
  }

  if (hookKey) {
    console.log('\nHook key received. Run: npm run env:vercel');
    console.log('  to add CRUSTOCEAN_HOOK_KEY to your Vercel project, then redeploy.');
  }
  console.log('\nDone! /compose registered for music-composer.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
