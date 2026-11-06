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

function getClient() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key, baseURL: GROQ_BASE_URL });
}

function resolveModel(task) {
  if (task === 'strong') {
    return process.env.LLM_MODEL_STRONG || 'llama-3.1-70b-versatile';
  }
  return process.env.LLM_MODEL_FAST || 'llama-3.1-8b-instant';
}

/**
 * Generate a completion.
 * @param {object} opts
 * @param {string} opts.task          'fast' | 'strong'
 * @param {Array}  opts.messages      OpenAI-style messages array
 * @param {boolean} [opts.json]       Request JSON output
 * @param {number} [opts.maxTokens]   Max tokens (default 400)
 * @param {number} [opts.temperature] Temperature (default 0.2)
 * @returns {Promise<string>} Raw text response
 */
async function generate({ task = 'fast', messages, json = false, maxTokens = 400, temperature = 0.2 }) {
  const client = getClient();
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
async function* stream({ task = 'fast', messages, json = false, maxTokens = 400, temperature = 0.2 }) {
  const client = getClient();
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

