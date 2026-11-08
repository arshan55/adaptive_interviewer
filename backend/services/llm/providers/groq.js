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

function getNextClient(customApiKey = null) {
  if (customApiKey) {
    return new OpenAI({ apiKey: customApiKey, baseURL: GROQ_BASE_URL });
  }

  const keys = getKeys();
  if (keys.length === 0) return null;

  const selectedKey = keys[keyIndex % keys.length];
  keyIndex = (keyIndex + 1) % keys.length;
  return new OpenAI({ apiKey: selectedKey, baseURL: GROQ_BASE_URL });
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
  const client = getNextClient(apiKey);
  if (!client) {
    const err = new Error('GROQ_API_KEY not configured — skipping Groq provider');
    err.skipProvider = true;
    throw err;
  }

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

  const completion = await client.chat.completions.create(params);
  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('Groq returned unexpected response shape');
  }
  return content;
}

/**
 * Stream a completion — async generator of text chunks.
 * @param {object} opts  Same as generate()
 * @yields {string} Text delta chunks
 */
async function* stream({ task = 'fast', messages, json = false, maxTokens = 400, temperature = 0.2, apiKey = null }) {
  const client = getNextClient(apiKey);
  if (!client) {
    const err = new Error('GROQ_API_KEY not configured — skipping Groq provider');
    err.skipProvider = true;
    throw err;
  }

  const model = resolveModel(task);
  const params = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: true,
  };
  if (json) params.response_format = { type: 'json_object' };

  const streamResponse = await client.chat.completions.create(params);
  for await (const chunk of streamResponse) {
    const delta = chunk?.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}

module.exports = { generate, stream, name: 'groq' };

