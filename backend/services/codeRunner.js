/**
 * Server-Side Code Execution Client (Phase 4)
 *
 * Provides execution support for compiled/non-browser languages (C++, Java, Go, Rust)
 * via an external, sandboxed Piston-compatible runner instance.
 *
 * Security & Reliability Guardrails:
 * 1. Only enabled if CODE_RUNNER_URL is explicitly configured in .env.
 * 2. NEVER executes user code inside the Express Node process.
 * 3. Enforces strict HTTP timeout (default 8000ms).
 * 4. Truncates stdout/stderr output at 64KB to avoid memory bloat.
 * 5. Handles network failures gracefully.
 */

const PISTON_URL = process.env.CODE_RUNNER_URL ? process.env.CODE_RUNNER_URL.replace(/\/+$/, '') : null;
const RUN_TIMEOUT_MS = parseInt(process.env.CODE_RUNNER_TIMEOUT_MS || '8000', 10);
const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB

// Maps common language identifiers to Piston language aliases
const LANGUAGE_MAP = {
  'c++': 'cpp',
  'cpp': 'cpp',
  'c': 'c',
  'java': 'java',
  'python': 'python',
  'python3': 'python',
  'javascript': 'javascript',
  'js': 'javascript',
  'typescript': 'typescript',
  'ts': 'typescript',
  'go': 'go',
  'rust': 'rust',
  'ruby': 'ruby',
  'c#': 'csharp',
  'csharp': 'csharp',
};

/**
 * Check if the server-side code runner is available.
 */
function isAvailable() {
  return !!PISTON_URL;
}

/**
 * Execute code via external Piston-compatible server.
 *
 * @param {object} opts
 * @param {string} opts.language  e.g. 'cpp', 'java', 'go'
 * @param {string} opts.code      User's source code
 * @param {string} [opts.stdin]   Standard input string
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number, error?: string }>}
 */
async function execute({ language, code, stdin = '' }) {
  if (!isAvailable()) {
    throw new Error('Server-side code runner is disabled. Set CODE_RUNNER_URL in backend/.env to enable.');
  }

  const normalizedLang = LANGUAGE_MAP[language.toLowerCase()] || language.toLowerCase();

  const payload = {
    language: normalizedLang,
    version: '*',
    files: [
      {
        name: 'solution',
        content: code,
      },
    ],
    stdin: String(stdin || ''),
    run_timeout: 5000,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);

  try {
    const res = await fetch(`${PISTON_URL}/api/v2/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Runner server responded with status ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const run = data.run || {};

    let stdout = String(run.stdout || '');
    let stderr = String(run.stderr || '');

    if (stdout.length > MAX_OUTPUT_BYTES) {
      stdout = stdout.slice(0, MAX_OUTPUT_BYTES) + '\n...[output truncated]';
    }
    if (stderr.length > MAX_OUTPUT_BYTES) {
      stderr = stderr.slice(0, MAX_OUTPUT_BYTES) + '\n...[stderr truncated]';
    }

    return {
      stdout,
      stderr,
      exitCode: typeof run.code === 'number' ? run.code : (run.signal ? 1 : 0),
      signal: run.signal || null,
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return {
        stdout: '',
        stderr: 'Execution timed out after 8 seconds.',
        exitCode: 124,
        error: 'Execution timed out',
      };
    }
    throw err;
  }
}

module.exports = {
  isAvailable,
  execute,
};

