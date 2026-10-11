import { getProvider } from '../../../lib/ai';
import { errorResponse, guard, json, readJson } from '../../../lib/server/http';
import { parseAudio, parseContext, parseMode, parseText } from '../../../lib/server/validate';
import { AIError } from '../../../lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Единый вход для текста и голоса: определение языка → контекст → перевод (реальный вызов Gemini).
export async function POST(req: Request) {
  try {
    guard(req, { maxBytes: 6_500_000 });
    const b = await readJson<Record<string, unknown>>(req);
    const text = parseText(b.text);
    const audio = parseAudio(b.audio);
    if (!text && !audio) throw new AIError('bad_request', 'text or audio required', 400);
    const result = await getProvider().translate(
      { text, audio, context: parseContext(b.context), mode: parseMode(b.mode), source: b.source === 'voice' ? 'voice' : 'text' },
      req.signal,
    );
    return json(result);
  } catch (e) { return errorResponse(e); }
}
