/**
 * Groq provider — uses the openai npm package pointed at Groq's
 * OpenAI-compatible endpoint (https://api.groq.com/openai/v1).
 *
 * Env vars consumed:
 *   GROQ_API_KEY        — required; if absent the provider is skipped
 *   LLM_MODEL_FAST      — model for fast turns  (default: llama-3.1-8b-instant)
 *   LLM_MODEL_STRONG    — model for reports     (default: llama-3.3-70b-versatile)
 */

const OpenAI = require('openai');

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

// Support comma-separated keys for pool rotation: GROQ_API_KEYS="key1,key2" or GROQ_API_KEY="key1"
function getKeys() {
  const raw = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '';
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

let keyIndex = 0;
// Map to track per-key cooldowns: key -> expiration timestamp ms
const keyCooldowns = new Map();

function markKeyCooldown(key, cooldownMs = 60000) {
  if (!key) return;
  keyCooldowns.set(key, Date.now() + cooldownMs);
}

function getNextClient(customApiKey = null) {
  if (customApiKey) {
    return { client: new OpenAI({ apiKey: customApiKey, baseURL: GROQ_BASE_URL }), key: customApiKey };
  }

  const keys = getKeys();
  if (keys.length === 0) return null;

  const now = Date.now();
  // Find a healthy key that is not in cooldown
  for (let i = 0; i < keys.length; i++) {
    const candidateIdx = (keyIndex + i) % keys.length;
    const candidateKey = keys[candidateIdx];
    const cooldownUntil = keyCooldowns.get(candidateKey) || 0;

    if (now >= cooldownUntil) {
      keyIndex = (candidateIdx + 1) % keys.length;
      return { client: new OpenAI({ apiKey: candidateKey, baseURL: GROQ_BASE_URL }), key: candidateKey };
    }
  }

  // All keys currently in cooldown; use the one that expires soonest
  const sorted = [...keys].sort((a, b) => (keyCooldowns.get(a) || 0) - (keyCooldowns.get(b) || 0));
  const fallbackKey = sorted[0];
  return { client: new OpenAI({ apiKey: fallbackKey, baseURL: GROQ_BASE_URL }), key: fallbackKey };
}

function resolveModel(task) {
  if (task === 'strong') {
    return process.env.LLM_MODEL_STRONG || 'llama3-70b-8192';
  }
  return process.env.LLM_MODEL_FAST || 'llama3-8b-8192';
}

/**
 * Generate a completion.
 * @param {object} opts
 * @param {string} opts.task          'fast' | 'strong'
 * @param {Array}  opts.messages      OpenAI-style messages array
 * @param {boolean} [opts.json]       Request JSON output
 * @param {number} [opts.maxTokens]   Max tokens (default 400)
 * @param {number} [opts.temperature] Temperature (default 0.2)
 * @param {string} [opts.apiKey]      Optional BYOK user API key
 * @returns {Promise<string>} Raw text response
 */
async function generate({ task = 'fast', messages, json = false, maxTokens = 400, temperature = 0.2, apiKey = null }) {
  const next = getNextClient(apiKey);
  if (!next) {
    const err = new Error('GROQ_API_KEY not configured — skipping Groq provider');
    err.skipProvider = true;
    throw err;
  }
  const { client, key } = next;

  const model = resolveModel(task);

  const params = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  if (json) {
    params.response_format = { type: 'json_object' };
  }

  try {
    const completion = await client.chat.completions.create(params);
    const content = completion?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('Groq returned unexpected response shape');
    }
    return content;
  } catch (err) {
    if (err.status === 429 || err?.message?.includes('rate limit')) {
      markKeyCooldown(key, 60000);
    }
    throw err;
  }
}

/**
 * Stream a completion — async generator of text chunks.
 * @param {object} opts  Same as generate()
 * @yields {string} Text delta chunks
 */
async function* stream({ task = 'fast', messages, json = false, maxTokens = 400, temperature = 0.2, apiKey = null }) {
  const next = getNextClient(apiKey);
  if (!next) {
    const err = new Error('GROQ_API_KEY not configured — skipping Groq provider');
    err.skipProvider = true;
    throw err;
  }
  const { client, key } = next;

  const model = resolveModel(task);
  const params = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: true,
  };
  if (json) params.response_format = { type: 'json_object' };

  let streamResponse;
  try {
    streamResponse = await client.chat.completions.create(params);
  } catch (err) {
    if (err.status === 429 || err?.message?.includes('rate limit')) {
      markKeyCooldown(key, 60000);
    }
    throw err;
  }
  for await (const chunk of streamResponse) {
    const delta = chunk?.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}

module.exports = { generate, stream, name: 'groq' };

