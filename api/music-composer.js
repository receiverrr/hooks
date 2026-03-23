/**
 * Crustocean Hook: Music Composer (/compose)
 *
 * Metadata
 * - Command: /compose
 * - Description: Generate original music tracks, beats, songs or instrumentals from a text prompt
 * - Creator: @crustobeats
 *
 * This endpoint uses Suno generation APIs and returns a consistent response envelope:
 *   { success, message, data }
 *
 * Basic rate-limiting note:
 * - Avoid rapid retries from clients.
 * - Polling uses a conservative interval to reduce API pressure.
 */

const SUNO_API_BASE_URL = process.env.SUNO_API_BASE_URL || 'https://api.sunoapi.org';
const SUNO_MODEL = 'v3.5';
const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 45;

function parsePrompt(body) {
  const rawPrompt = body?.prompt;

  if (typeof rawPrompt !== 'string') {
    return { error: 'Invalid input: "prompt" must be a string.' };
  }

  const prompt = rawPrompt.trim();
  if (!prompt) {
    return { error: 'Invalid input: "prompt" is required.' };
  }

  if (prompt.length > 2000) {
    return { error: 'Invalid input: "prompt" must be 2000 characters or fewer.' };
  }

  return { prompt };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTaskId(payload) {
  return (
    payload?.task_id ||
    payload?.taskId ||
    payload?.id ||
    payload?.data?.task_id ||
    payload?.data?.taskId ||
    payload?.data?.id ||
    null
  );
}

function getFirstTrack(payload) {
  const candidates = [
    payload?.data?.songs,
    payload?.data?.clips,
    payload?.data?.results,
    payload?.songs,
    payload?.clips,
    payload?.results,
  ];

  for (const group of candidates) {
    if (Array.isArray(group) && group.length > 0) {
      return group[0];
    }
  }
  return payload?.data?.song || payload?.song || null;
}

function isTerminalStatus(status) {
  const s = String(status || '').toLowerCase();
  return ['completed', 'succeeded', 'success', 'done', 'failed', 'error', 'cancelled'].includes(s);
}

function isSuccessStatus(status) {
  const s = String(status || '').toLowerCase();
  return ['completed', 'succeeded', 'success', 'done'].includes(s);
}

async function sunoRequest(path, options) {
  const apiKey = process.env.SUNO_API_KEY;
  if (!apiKey) {
    throw new Error('Missing SUNO_API_KEY environment variable.');
  }

  const response = await fetch(`${SUNO_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiError = payload?.message || payload?.error || `Suno API error (${response.status})`;
    throw new Error(apiError);
  }

  return payload;
}

async function createSunoTask(prompt) {
  // "custom mode" request body for prompt-led generation on v3.5.
  const payload = await sunoRequest('/api/v1/generate', {
    method: 'POST',
    body: JSON.stringify({
      model: SUNO_MODEL,
      prompt,
      custom: true,
    }),
  });

  const taskId = getTaskId(payload);
  if (!taskId) {
    throw new Error('Suno API did not return a task id.');
  }
  return taskId;
}

async function getSunoTaskStatus(taskId) {
  // Common Suno status endpoint pattern for generation tasks.
  return sunoRequest(`/api/v1/generate/${taskId}`, {
    method: 'GET',
  });
}

async function waitForSunoTask(taskId) {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
    const payload = await getSunoTaskStatus(taskId);
    const status =
      payload?.status ||
      payload?.data?.status ||
      payload?.data?.state ||
      payload?.state ||
      'pending';

    if (isTerminalStatus(status)) {
      if (!isSuccessStatus(status)) {
        const errorMessage =
          payload?.message || payload?.error || payload?.data?.error || `Suno task ended with status "${status}".`;
        throw new Error(errorMessage);
      }
      return payload;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error('Timed out waiting for Suno music generation to complete.');
}

function toClientResponse(prompt, payload) {
  const track = getFirstTrack(payload) || {};

  return {
    title: track.title || track.name || null,
    audio_url: track.audio_url || track.audioUrl || track.stream_url || track.streamUrl || null,
    image_url: track.image_url || track.imageUrl || track.cover_url || track.coverUrl || null,
    lyrics: track.lyrics || track.caption || null,
    duration: track.duration || track.duration_seconds || track.durationSeconds || null,
    prompt,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST for /compose.',
      data: null,
    });
  }

  try {
    // Input contract: req.body.prompt
    const { prompt, error } = parsePrompt(req.body || {});
    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
        data: null,
      });
    }

    const taskId = await createSunoTask(prompt);
    const completedPayload = await waitForSunoTask(taskId);
    const composition = toClientResponse(prompt, completedPayload);

    return res.status(200).json({
      success: true,
      message: 'Music generated successfully.',
      data: composition,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('music-composer handler error:', err);

    return res.status(500).json({
      success: false,
      message: `Failed to process compose request: ${message}`,
      data: null,
    });
  }
}
