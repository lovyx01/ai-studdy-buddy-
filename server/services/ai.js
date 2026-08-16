// ------------------------------------------------------------------
// AI PROVIDER SERVICE
// Talks to any OpenAI-compatible Chat Completions API.
// Configured entirely from server-side environment variables, so the
// API key never reaches the client.
//
//   OPENAI_API_KEY   - your key (the only required setting)
//   OPENAI_BASE_URL  - endpoint base (default OpenAI)
//   OPENAI_MODEL     - model name (default gpt-4o-mini)
//   AI_MAX_TOKENS    - response cap
// ------------------------------------------------------------------

let baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const maxTokens = Number(process.env.AI_MAX_TOKENS || 1200);

// Distinguish "not configured yet" (for friendly errors) from real failures.
export function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

class AiNotConfiguredError extends Error {
  constructor() {
    super('AI_NOT_CONFIGURED');
  }
}

/**
 * Core chat completion call.
 * @param {Array<{role:'system'|'user'|'assistant', content:string}>} messages
 * @param {number} temperature
 */
export async function chat(messages, { temperature = 0.7, json = false } = {}) {
  if (!isAiConfigured()) throw new AiNotConfiguredError();

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (json) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`AI API error ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  return json ? safeParseJson(content) : content;
}

/**
 * Robust JSON extraction: some providers wrap JSON in code fences or prose.
 */
export function safeParseJson(text) {
  // Try direct parse first.
  try {
    return JSON.parse(text);
  } catch (_) { /* fall through */ }

  // Strip markdown fences.
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  // Grab the first balanced {...} block.
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  return JSON.parse(cleaned);
}

/**
 * Extracts usable text from an uploaded PDF (or other text-ish file).
 * Kept dependency-free: returns raw decoded text; for scanned PDFs the
 * AI vision/text step in routes handles OCR via the provider.
 */
export function pdfToText(buf) {
  // Minimal heuristic: look for a text layer between "stream" markers is not
  // reliable. Instead we return an empty extraction and rely on the AI to
  // read a page image. For text-based PDFs, a lightweight regex over the
  // raw bytes recovers most visible text via Tj/TJ operators.
  const raw = buf.toString('latin1');
  const pieces = [];
  const re = /\((?:[^()\\]|\\.)*\)\s*Tj|\[([^\]]*)\]\s*TJ/g;
  let m;
  while ((m = re.exec(raw))) {
    const seg = m[1]
      ? m[1].match(/\((?:[^()\\]|\\.)*\)/g)
      : [m[0]];
    if (seg) {
      for (const s of seg) {
        pieces.push(
          s
            .replace(/^\(|\)$/g, '')
            .replace(/\\([nrt\\()])/g, (_, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c))
            .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
        );
      }
    }
  }
  return pieces.join(' ').replace(/\s+/g, ' ').trim();
}

export { AiNotConfiguredError };
