/**
 * LLM provider layer — public interface.
 *
 * Usage:
 *   const llm = require('./services/llm');
 *   const result = await llm.generate({ task: 'fast', messages, json: true, schema: feedbackSchema });
 *   for await (const chunk of llm.stream({ task: 'fast', messages })) { ... }
 *
 * Env vars:
 *   LLM_PROVIDER_ORDER   comma-separated list (default: "groq,gemini")
 *   LLM_TIMEOUT_MS       per-call timeout in ms (default: 10000)
 *
 * Provider-specific env vars live in each provider file (see providers/).
 */

const { SAFE_FEEDBACK_DEFAULT } = require('./schemas/feedbackSchema');

const TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || '10000', 10);

/** Load provider modules in the configured order. Skip missing API keys gracefully. */
function getProviders() {
  const order = (process.env.LLM_PROVIDER_ORDER || 'groq,gemini')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const registry = {
    groq: () => require('./providers/groq'),
    gemini: () => require('./providers/gemini'),
  };

  return order
    .filter((name) => registry[name])
    .map((name) => registry[name]());
}

/** Race a promise against a timeout. */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[LLM] ${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/** Determine if an error is retryable (rate-limit / server overload). */
function isRetryable(err) {
  if (err?.skipProvider) return false; // key not configured — skip provider entirely
  const msg = String(err?.message || '');
  const status = err?.status || err?.statusCode || (err?.response?.status);
  return status === 429 || status === 503 || /429|quota|rate.?limit|too many requests|timed out/i.test(msg);
}

/** Attempt JSON repair: ask the LLM to fix a broken JSON blob (single retry). */
async function repairJson(provider, brokenJson, opts) {
  const repairMessages = [
    {
      role: 'user',
      content: `The following is broken JSON. Return ONLY the corrected JSON object with no extra text:\n${brokenJson}`,
    },
  ];
  const raw = await withTimeout(
    provider.generate({ ...opts, messages: repairMessages, json: true }),
    TIMEOUT_MS,
    `${provider.name}/repair`
  );
  return raw;
}

/** Parse and validate JSON against an optional Zod schema. Returns null on failure. */
function parseAndValidate(raw, schema) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!schema) return parsed;
  const result = schema.safeParse(parsed);
  if (result.success) return result.data;
  return null;
}

/**
 * Generate a completion, trying each provider in order with fallback.
 *
 * @param {object} opts
 * @param {string}  opts.task        'fast' | 'strong'
 * @param {Array}   opts.messages    OpenAI-style messages array
 * @param {boolean} [opts.json]      Request JSON output
 * @param {object}  [opts.schema]    Zod schema to validate the parsed JSON
 * @param {object}  [opts.safeDefault] Returned when all providers fail (defaults to SAFE_FEEDBACK_DEFAULT)
 * @param {number}  [opts.maxTokens]
 * @param {number}  [opts.temperature]
 * @returns {Promise<string|object>} Raw string when json=false; parsed+validated object when json=true
 */
async function generate(opts = {}) {
  const { schema, safeDefault = SAFE_FEEDBACK_DEFAULT, json = false } = opts;
  const providers = getProviders();

  if (providers.length === 0) {
    console.error('[LLM] No providers configured. Check LLM_PROVIDER_ORDER and API keys.');
    return json ? safeDefault : safeDefault.feedback || '';
  }

  for (const provider of providers) {
    const startMs = Date.now();
    try {
      const raw = await withTimeout(
        provider.generate(opts),
        TIMEOUT_MS,
        `${provider.name}/${opts.task || 'fast'}`
      );

      const elapsed = Date.now() - startMs;
      console.log(`[LLM] provider=${provider.name} task=${opts.task || 'fast'} ms=${elapsed}`);

      if (!json) return raw;

      // Try to parse + validate
      let result = parseAndValidate(raw, schema);
      if (result !== null) return result;

      // One repair attempt
      console.warn(`[LLM] Invalid JSON from ${provider.name}; attempting repair...`);
      try {
        const repaired = await repairJson(provider, raw, opts);
        result = parseAndValidate(repaired, schema);
        if (result !== null) {
          console.log(`[LLM] JSON repair succeeded (${provider.name})`);
          return result;
        }
      } catch (repairErr) {
        console.warn(`[LLM] JSON repair failed (${provider.name}):`, repairErr.message);
      }

      // This provider returned invalid JSON — try next
      console.warn(`[LLM] Skipping ${provider.name} after invalid JSON (even after repair)`);
    } catch (err) {
      const elapsed = Date.now() - startMs;
      if (err?.skipProvider) {
        console.warn(`[LLM] Skipping ${provider.name}: not configured`);
        continue;
      }
      if (isRetryable(err)) {
        console.warn(`[LLM] ${provider.name} rate-limited/busy (${err.message}); trying next provider`);
        continue;
      }
      console.error(`[LLM] ${provider.name} error after ${elapsed}ms:`, err.message || err);
      // Non-retryable error — still try next provider
    }
  }

  console.error('[LLM] All providers failed. Returning safe default.');
  return json ? safeDefault : (safeDefault?.feedback || 'Feedback unavailable.');
}

/**
 * Stream a completion — async generator of text chunks.
 * Falls back to a single-chunk non-streaming call if streaming fails.
 *
 * @param {object} opts  Same as generate()
 * @yields {string} Text delta chunks
 */
async function* stream(opts = {}) {
  const providers = getProviders();

  for (const provider of providers) {
    if (!provider.stream) continue;
    try {
      for await (const chunk of provider.stream(opts)) {
        yield chunk;
      }
      return; // success — stop after first working provider
    } catch (err) {
      if (err?.skipProvider || isRetryable(err)) {
        console.warn(`[LLM] stream: skipping ${provider.name} (${err.message})`);
        continue;
      }
      console.error(`[LLM] stream: ${provider.name} error:`, err.message);
    }
  }

  // Final fallback: non-streaming generate
  const result = await generate(opts);
  const text = typeof result === 'string' ? result : JSON.stringify(result);
  yield text;
}

module.exports = { generate, stream };

