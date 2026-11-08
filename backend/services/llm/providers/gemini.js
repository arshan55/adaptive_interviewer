/**
 * Gemini provider — wraps @google/generative-ai.
 *
 * Env vars consumed:
 *   GOOGLE_AI_API_KEY    — required; if absent the provider is skipped
 *   GEMINI_MODEL_FAST    — model for fast turns  (default: gemini-2.0-flash-lite)
 *   GEMINI_MODEL_STRONG  — model for reports     (default: gemini-2.0-flash)
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Support comma-separated keys for pool rotation: GOOGLE_AI_API_KEYS="key1,key2" or GOOGLE_AI_API_KEY="key1"
function getKeys() {
  const raw = process.env.GOOGLE_AI_API_KEYS || process.env.GOOGLE_AI_API_KEY || '';
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

let keyIndex = 0;

function getNextClient(customApiKey = null) {
  if (customApiKey) {
    return new GoogleGenerativeAI(customApiKey);
  }

  const keys = getKeys();
  if (keys.length === 0) return null;

  const selectedKey = keys[keyIndex % keys.length];
  keyIndex = (keyIndex + 1) % keys.length;
  return new GoogleGenerativeAI(selectedKey);
}

function resolveModel(task) {
  if (task === 'strong') {
    return process.env.GEMINI_MODEL_STRONG || 'gemini-3.5-flash';
  }
  return process.env.GEMINI_MODEL_FAST || 'gemini-3.5-flash';
}

/**
 * Convert OpenAI-style messages array to Gemini format.
 * Gemini uses { role: 'user'|'model', parts: [{text}] }.
 * System messages are prepended to the first user message.
 */
function convertMessages(messages) {
  let systemText = '';
  const geminiMessages = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n' : '') + msg.content;
    } else {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      let content = msg.content;
      // Prepend accumulated system prompt to the first user message
      if (role === 'user' && systemText) {
        content = systemText + '\n\n' + content;
        systemText = '';
      }
      geminiMessages.push({ role, parts: [{ text: String(content || '') }] });
    }
  }

  return geminiMessages;
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
async function generate({ task = 'fast', messages, json = false, maxTokens = 400, temperature = 0.2, apiKey = null }) {
  const client = getNextClient(apiKey);
  if (!client) {
    const err = new Error('GOOGLE_AI_API_KEY not configured — skipping Gemini provider');
    err.skipProvider = true;
    throw err;
  }

  const modelName = resolveModel(task);
  const generationConfig = {
    maxOutputTokens: maxTokens,
    temperature,
    ...(json ? { responseMimeType: 'application/json' } : {}),
  };

  const model = client.getGenerativeModel({ model: modelName, generationConfig });
  const geminiMessages = convertMessages(messages);

  // Single-turn: last message is the user prompt; prior messages are history
  const history = geminiMessages.slice(0, -1);
  const lastMsg = geminiMessages[geminiMessages.length - 1];

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(lastMsg.parts);
  const text = result?.response?.text();

  if (typeof text !== 'string') {
    throw new Error('Gemini returned unexpected response shape');
  }
  return text;
}

/**
 * Stream a completion — async generator of text chunks.
 * @param {object} opts  Same as generate()
 * @yields {string} Text delta chunks
 */
async function* stream({ task = 'fast', messages, json = false, maxTokens = 400, temperature = 0.2, apiKey = null }) {
  const client = getNextClient(apiKey);
  if (!client) {
    const err = new Error('GOOGLE_AI_API_KEY not configured — skipping Gemini provider');
    err.skipProvider = true;
    throw err;
  }

  const modelName = resolveModel(task);
  const generationConfig = {
    maxOutputTokens: maxTokens,
    temperature,
    ...(json ? { responseMimeType: 'application/json' } : {}),
  };

  const model = client.getGenerativeModel({ model: modelName, generationConfig });
  const geminiMessages = convertMessages(messages);

  const history = geminiMessages.slice(0, -1);
  const lastMsg = geminiMessages[geminiMessages.length - 1];
  const chat = model.startChat({ history });

  const streamResult = await chat.sendMessageStream(lastMsg.parts);
  for await (const chunk of streamResult.stream) {
    const delta = chunk?.text?.();
    if (delta) yield delta;
  }
}

module.exports = { generate, stream, name: 'gemini' };

