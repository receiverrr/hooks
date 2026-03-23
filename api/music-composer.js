/**
 * Crustocean Hook: Music Composer (/compose)
 *
 * Metadata
 * - Command: /compose
 * - Description: Generate original music tracks, beats, songs or instrumentals from a text prompt
 * - Creator: @crustobeats
 *
 * This endpoint is intentionally scaffolded for the next integration step where
 * an AI music provider will be called. For now, it validates input and returns
 * a consistent response envelope:
 *   { success, message, data }
 */

/**
 * Validate and normalize prompt input from request body.
 * Accepts string values only and enforces a practical max length.
 */
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

/**
 * Stub for future model integration.
 * Keep this function boundary so generation logic can be added without
 * changing API response behavior in the route handler.
 */
async function composeMusicFromPrompt(prompt) {
  return {
    prompt,
    status: 'queued',
    provider: null,
    track_url: null,
    title: null,
    lyrics: null,
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
    const { prompt, error } = parsePrompt(req.body || {});
    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
        data: null,
      });
    }

    const composition = await composeMusicFromPrompt(prompt);

    return res.status(200).json({
      success: true,
      message: 'Compose request accepted. Music generation integration is ready for the next step.',
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
