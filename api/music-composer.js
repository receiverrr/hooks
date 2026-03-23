/**
 * Crustocean Hooks — Music Composer
 * Handles: /compose
 * Deploy to Vercel (serverless); add Vercel KV when you add persisted state.
 * Fork: edit config.js (MUSIC_COMPOSER_HOOK) and use your own webhook URL (e.g. …/api/music-composer).
 */

import { MUSIC_COMPOSER_HOOK } from '../config.js';

const COMMANDS = ['compose'];

// Colors for content_spans (granular formatting)
const C = {
  accent: '#a8d8ff',
  success: '#4ade80',
  error: '#ff6b6b',
  gold: '#e6d84a',
  muted: '#94a3b8',
};

async function handleCompose(agencyId, sender, positional) {
  const prompt = positional.join(' ').trim();
  if (!prompt) {
    return {
      content:
        'Usage: /compose <prompt> — describe the track, genre, mood, tempo, or instruments you want.',
      type: 'tool_result',
      broadcast: false,
      ephemeral: true,
      metadata: {
        content_spans: [
          { text: 'Usage: ', color: C.muted },
          { text: '/compose', color: C.accent },
          { text: ' <prompt> — describe the track, genre, mood, tempo, or instruments you want.', color: C.muted },
        ],
      },
    };
  }
  const name = sender.displayName || sender.username;
  const line = `${name} requested music: ${prompt}`;
  return {
    content: line,
    type: 'tool_result',
    broadcast: true,
    metadata: {
      content_spans: [
        { text: name, color: C.accent },
        { text: ' requested music: ', color: C.muted },
        { text: prompt, color: C.gold },
      ],
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { agencyId, command, positional = [], sender } = req.body || {};
  if (!agencyId || !command || !sender?.userId) {
    return res.status(400).json({ error: 'Invalid payload: agencyId, command, sender required' });
  }
  const cmd = String(command).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!COMMANDS.includes(cmd)) {
    return res.status(400).json({ error: `Unknown command: ${cmd}` });
  }
  try {
    let result;
    switch (cmd) {
      case 'compose':
        result = await handleCompose(agencyId, sender, positional);
        break;
      default:
        result = { content: `Unknown command: ${cmd}`, type: 'system', broadcast: false, ephemeral: true };
    }
    return res.status(200).json({
      content: result.content,
      type: result.type || 'tool_result',
      metadata: {
        ...(result.metadata || {}),
        style: {
          sender_color: '#a8d8ff',
          content_color: '#a8d8ff',
          ...(result.metadata?.style || {}),
        },
      },
      broadcast: result.broadcast !== false,
      ephemeral: result.ephemeral === true,
      sender_username: MUSIC_COMPOSER_HOOK.at_name,
      sender_display_name: `@${MUSIC_COMPOSER_HOOK.at_name}`,
    });
  } catch (err) {
    console.error('Music composer error:', err);
    const msg = err.message || 'Unknown error';
    return res.status(500).json({
      content: `Something went wrong: ${msg}`,
      type: 'system',
      broadcast: false,
      ephemeral: true,
      sender_username: MUSIC_COMPOSER_HOOK.at_name,
      sender_display_name: `@${MUSIC_COMPOSER_HOOK.at_name}`,
      metadata: {
        style: { sender_color: '#a8d8ff' },
        content_spans: [
          { text: 'Something went wrong: ', color: C.muted },
          { text: msg, color: C.error },
        ],
      },
    });
  }
}
