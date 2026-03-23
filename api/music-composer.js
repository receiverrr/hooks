/**
 * Crustocean Hook: Music Composer (/compose)
 *
 * Metadata
 * - Command: /compose
 * - Description: Generate original music tracks, beats, songs or instrumentals from a text prompt
 * - Creator: @crustobeats
 *
 * This endpoint uses https://api.sunoapi.org and returns a consistent response envelope:
 *   { success, message, data }
 *
 * Basic rate-limiting note:
 * - Avoid rapid retries from clients.
 * - Polling runs every ~10 seconds to reduce API pressure.
 */

const SUNO_API_BASE_URL = 'https://api.sunoapi.org';
const SUNO_MODEL = 'V4_5ALL';
const POLL_INTERVAL_MS = 10000; // 10 seconds
const MAX_POLL_ATTEMPTS = 18; // ~3 minutes total

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

function sanitizeTitleFromPrompt(prompt) {
  const cleaned = prompt
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .trim();
  const short = cleaned.slice(0, 40).trim() || 'Untitled';
  return `Crustobeats - ${short}`;
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
  // Default to custom mode so title/style can be controlled.
  const payload = await sunoRequest('/api/v1/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      customMode: true,
      style: 'various genres, energetic, cinematic, etc.',
      title: sanitizeTitleFromPrompt(prompt),
      instrumental: false,
      model: SUNO_MODEL,
    }),
  });

  const taskId = payload?.data?.taskId;
  if (!taskId) {
    throw new Error(payload?.msg || payload?.message || 'Suno API did not return data.taskId.');
  }
  return taskId;
}

async function getSunoTaskStatus(taskId) {
  // Poll task status until SUCCESS or timeout.
  return sunoRequest(`/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
    method: 'GET',
  });
}

async function waitForSunoTask(taskId) {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
    const payload = await getSunoTaskStatus(taskId);
    const status = String(payload?.data?.status || payload?.status || 'PENDING').toUpperCase();

    if (status === 'SUCCESS') {
      return payload;
    }

    if (status === 'FAILED' || status === 'ERROR') {
      const errMessage =
        payload?.data?.errorMessage ||
        payload?.msg ||
        payload?.message ||
        `Suno task failed with status "${status}".`;
      throw new Error(errMessage);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error('Timed out waiting for Suno music generation (about 3 minutes).');
}

function toClientResponse(prompt, payload) {
  // Expected shape from docs: response.data[0]
  const track = payload?.data?.response?.data?.[0] || {};
  const duration =
    track.duration ??
    track.duration_seconds ??
    track.durationSeconds ??
    null;

  return {
    title: track.title || track.name || null,
    audio_url: track.audio_url || track.audioUrl || track.stream_url || track.streamUrl || null,
    image_url: track.image_url || track.imageUrl || track.cover_url || track.coverUrl || track.image || null,
    lyrics: track.lyrics || track.caption || null,
    duration,
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
      message: 'Track generated successfully',
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
