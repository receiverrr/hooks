/**
 * Crustocean Hook: Music Composer (/compose)
 *
 * Metadata
 * - Command: /compose
 * - Description: Generate original music tracks, beats, songs or instrumentals from a text prompt
 * - Creator: @crustobeats
 *
 * This endpoint follows Suno Quickstart docs:
 * https://docs.sunoapi.org/suno-api/quickstart
 *
 * Flow:
 * 1) POST /api/v1/generate
 * 2) Poll GET /api/v1/generate/record-info?taskId=...
 * 3) When status is SUCCESS, read response.data.response.data[0]
 *
 * Returns a consistent response envelope:
 *   { success, message, data }
 *
 * Basic rate-limiting note:
 * - Avoid rapid retries from clients.
 * - Polling runs every 8 seconds to reduce API pressure.
 */

const SUNO_API_BASE_URL = 'https://api.sunoapi.org';
const DEFAULT_MODEL = 'V4_5';
const POLL_INTERVAL_MS = 8000; // 8 seconds
const MAX_POLL_ATTEMPTS = 22; // ~2m56s

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

function parseBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  return fallback;
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

function buildEnhancedPrompt(prompt) {
  // If user prompt is short, enrich it so Suno gets more musical direction.
  if (prompt.length >= 40) return prompt;
  return `${prompt}. Style: energetic, cinematic, modern production, rich instrumentation, polished mix.`;
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

function buildGeneratePayload(body, prompt) {
  // Quickstart supports simple and custom modes.
  // We default to custom mode for better control over style + title.
  const customMode = parseBoolean(body?.customMode, true);
  const model = typeof body?.model === 'string' && body.model.trim() ? body.model.trim() : DEFAULT_MODEL;
  const style = typeof body?.style === 'string' && body.style.trim()
    ? body.style.trim()
    : 'various genres, energetic, cinematic, polished production';
  const title = typeof body?.title === 'string' && body.title.trim()
    ? body.title.trim()
    : sanitizeTitleFromPrompt(prompt);
  const instrumental = parseBoolean(body?.instrumental, false);

  if (!customMode) {
    return {
      prompt: buildEnhancedPrompt(prompt),
      customMode: false,
      model,
    };
  }

  return {
    prompt: buildEnhancedPrompt(prompt),
    customMode: true,
    style,
    title,
    instrumental,
    model,
  };
}

async function createSunoTask(body, prompt) {
  const payload = await sunoRequest('/api/v1/generate', {
    method: 'POST',
    body: JSON.stringify(buildGeneratePayload(body, prompt)),
  });

  const taskId = payload?.data?.taskId;
  if (!taskId) {
    throw new Error(payload?.msg || payload?.message || 'Suno API did not return data.taskId.');
  }
  return taskId;
}

async function getSunoTaskStatus(taskId) {
  // Quickstart polling endpoint:
  // GET /api/v1/generate/record-info?taskId=<taskId>
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
  // Expected shape from Quickstart: response.data.response.data[0]
  const track = payload?.data?.response?.data?.[0] || {};
  const duration =
    track.duration ??
    track.duration_seconds ??
    track.durationSeconds ??
    null;

  return {
    title: track.title || track.name || null,
    audio_url: track.audio_url || track.audioUrl || track.stream_url || track.streamUrl || null,
    image_url: null,
    lyrics: null,
    duration,
    prompt,
    tags: track.tags || null,
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
    const body = req.body || {};
    const { prompt, error } = parsePrompt(body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
        data: null,
      });
    }

    const taskId = await createSunoTask(body, prompt);
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
