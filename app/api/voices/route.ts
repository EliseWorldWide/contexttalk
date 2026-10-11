import { getProvider } from '../../../lib/ai';
import { AIError } from '../../../lib/errors';
import { env } from '../../../lib/ai/gemini';
import { isLanguageCode } from '../../../lib/languages';
import { errorResponse, guard, json, readJson } from '../../../lib/server/http';
import { VoiceService } from '../../../lib/voice/voice-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Создание replicated-голоса: образец 10–30 с + запись фразы согласия. Записи не сохраняются на сервере.
export async function POST(req: Request) {
  try {
    guard(req, { maxBytes: 9_000_000, weight: 10 });
    const b = await readJson<Record<string, any>>(req);
    if (!isLanguageCode(b.language) || (b.role !== 'user' && b.role !== 'partner')) throw new AIError('bad_request', 'role and language required', 400);
    if (typeof b.referenceWavBase64 !== 'string' || typeof b.consentWavBase64 !== 'string') throw new AIError('bad_request', 'audio required', 400);
    const store = env('GEMINI_VOICE_STORE') !== 'false';
    const profile = await new VoiceService(getProvider()).createVoiceProfile({
      role: b.role, language: b.language, displayName: String(b.displayName ?? '').slice(0, 60),
      referenceWavBase64: b.referenceWavBase64, consentWavBase64: b.consentWavBase64,
      consentConfirmed: b.consentConfirmed === true, store,
    }, req.signal);
    return json(profile, 201);
  } catch (e) { return errorResponse(e); }
}
