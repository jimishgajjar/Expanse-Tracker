import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.AI_MODEL || 'claude-opus-4-8';

// Stable teaching framework. Kept first + cached so repeated calls reuse the
// prefix; the per-lesson context (which varies) goes in the user turn.
const TUTOR_SYSTEM = `You are an expert, encouraging programming tutor embedded in a full-stack web-development learning dashboard. A learner is studying a specific lesson and has a question about it.

Teaching style:
- Answer the question directly — no preamble, no "great question", no restating the prompt.
- Be concrete and practical. Prefer a short explanation plus a small, real code example over abstract theory.
- Use analogies when a concept is tricky, and point out the common mistake or gotcha.
- Calibrate depth to the question: a quick clarification gets a couple of sentences; "explain X" gets a structured walk-through.
- When asked to quiz the learner, ask 3 focused questions and stop — do not answer them unless asked.

Formatting (Markdown):
- Short paragraphs. **Bold** key terms on first use.
- Fenced code blocks with a language tag for any code.
- Bullet or numbered lists for steps and comparisons.
- Keep it skimmable. Don't pad.`;

export function hasServerKey() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function aiError(err) {
  const status = err?.status;
  if (status === 401) return 'Invalid API key (401). Check the key you pasted.';
  if (status === 403) return 'This key is not permitted to use the model (403).';
  if (status === 404) return `Model "${MODEL}" not found (404). Set AI_MODEL to a valid model.`;
  if (status === 429) return 'Rate limited (429). Wait a moment and try again.';
  if (status === 529) return 'The model is temporarily overloaded (529). Try again shortly.';
  return err?.error?.error?.message || err?.message || 'AI request failed.';
}

/**
 * Streams a tutor answer to the HTTP response as plain-text chunks.
 * Returns { started } so the caller knows whether any bytes were written
 * (and therefore whether it can still send a clean JSON error on failure).
 */
export async function streamTutor(res, { apiKey, lesson = {}, question }) {
  const client = new Anthropic({ apiKey });

  const ctx = [
    lesson.lesson && `Lesson: ${lesson.lesson}`,
    lesson.track && `Track: ${lesson.track}`,
    lesson.module && `Module: ${lesson.module}`,
    lesson.points && `Key points:\n${lesson.points}`,
    lesson.learn && `Sub-topics it covers: ${lesson.learn}`,
  ].filter(Boolean).join('\n');

  const userText = `${ctx ? ctx + '\n\n' : ''}Question: ${question}`;

  let started = false;
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: [{ type: 'text', text: TUTOR_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userText }],
  });

  stream.on('text', (delta) => {
    if (!started) {
      started = true;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
    }
    res.write(delta);
  });

  await stream.finalMessage();
  return { started };
}
