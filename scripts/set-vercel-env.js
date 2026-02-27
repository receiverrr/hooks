#!/usr/bin/env node
/**
 * Push Crustocean env vars to Vercel, including CRUSTOCEAN_HOOK_KEY.
 * Gets the global hook key from the API (creates/fetches commands if needed), then runs vercel env add.
 *
 * Run from dicebot folder: npm run env:vercel  or  node scripts/set-vercel-env.js
 *
 * Requires in .env: CRUSTOCEAN_USER, CRUSTOCEAN_PASS, WEBHOOK_URL, CRUSTOCEAN_AGENCY_ID.
 * Run `npm run setup` first if commands aren't registered yet.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { HOOK } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../../.env') });

const API_URL = process.env.CRUSTOCEAN_API_URL || 'https://api.crustocean.chat';
const WEBHOOK_URL = process.env.WEBHOOK_URL || process.env.DICE_WEBHOOK_URL;
const AGENCY_ID = process.env.CRUSTOCEAN_AGENCY_ID;
const USER = process.env.CRUSTOCEAN_USER;
const PASS = process.env.CRUSTOCEAN_PASS;
const CWD = resolve(__dirname, '..');

const EXPLORE_METADATA = {
  display_name: HOOK.display_name,
  slug: HOOK.slug,
  at_name: HOOK.at_name,
  creator: `@${HOOK.creator?.replace(/^@/, '') || HOOK.at_name}`,
  description: HOOK.description,
};

async function login() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Login failed: ${res.status}`);
  }
  const data = await res.json();
  return data.token;
}

async function getOrCreateHookKey(token) {
  const listRes = await fetch(`${API_URL}/api/custom-commands/${AGENCY_ID}/commands`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) throw new Error(`List commands failed: ${listRes.status}`);
  const commands = await listRes.json();
  const cmdWithUrl = commands.find((c) => c.webhook_url === WEBHOOK_URL);
  if (cmdWithUrl) {
    const keyRes = await fetch(
      `${API_URL}/api/custom-commands/${AGENCY_ID}/commands/${cmdWithUrl.id}/hook-key`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (!keyRes.ok) {
      const err = await keyRes.json().catch(() => ({}));
      throw new Error(err.error || `Get hook key failed: ${keyRes.status}`);
    }
    const data = await keyRes.json();
    return data.hookKey;
  }
  console.log('No command found with this webhook URL. Creating first command...');
  const createRes = await fetch(`${API_URL}/api/custom-commands/${AGENCY_ID}/commands`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: 'getshells',
      webhook_url: WEBHOOK_URL,
      description: 'Get 1,000 Shells',
      creator: HOOK.creator || HOOK.at_name,
      explore_metadata: EXPLORE_METADATA,
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error || `Create command failed: ${createRes.status}`);
  }
  const data = await createRes.json();
  if (data.hookKey) return data.hookKey;
  throw new Error('No hookKey in response. Run npm run setup first to register all commands.');
}

function vercelEnvAdd(name, value, env = 'production', force = true) {
  const tmp = join(tmpdir(), `vercel-env-${Date.now()}-${name}.txt`);
  writeFileSync(tmp, value, 'utf8');
  try {
    const forceFlag = force ? ' --force' : '';
    const cmd = process.platform === 'win32'
      ? `type "${tmp}" | vercel env add ${name} ${env}${forceFlag}`
      : `cat "${tmp}" | vercel env add ${name} ${env}${forceFlag}`;
    execSync(cmd, { cwd: CWD, shell: true, stdio: 'inherit' });
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

async function main() {
  if (!USER || !PASS) {
    console.error('Set CRUSTOCEAN_USER and CRUSTOCEAN_PASS in .env');
    process.exit(1);
  }
  if (!WEBHOOK_URL || !AGENCY_ID) {
    console.error('Set WEBHOOK_URL (or DICE_WEBHOOK_URL) and CRUSTOCEAN_AGENCY_ID in .env');
    process.exit(1);
  }
  console.log('Logging in...');
  const token = await login();
  console.log('Getting hook key from Crustocean...');
  const hookKey = await getOrCreateHookKey(token);
  if (!hookKey) {
    console.error('Could not get hook key. Run npm run setup first.');
    process.exit(1);
  }
  console.log('Adding CRUSTOCEAN_API_URL to Vercel...');
  vercelEnvAdd('CRUSTOCEAN_API_URL', API_URL);
  console.log('Adding CRUSTOCEAN_HOOK_KEY to Vercel...');
  vercelEnvAdd('CRUSTOCEAN_HOOK_KEY', hookKey);
  console.log('\nDone! Redeploy for changes to take effect: vercel --prod');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
