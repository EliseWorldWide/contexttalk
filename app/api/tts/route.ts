import { getProvider } from '../../../lib/ai';
import { base64ToBytes } from '../../../lib/audio';
import { AIError } from '../../../lib/errors';
import { isLanguageCode } from '../../../lib/languages';
import { errorResponse, guard, readJson } from '../../../lib/server/http';
import { parseText } from '../../../lib/server/validate';
import { VoiceService } from '../../../lib/voice/voice-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const okVoice = (v: unknown): string | undefined => (typeof v === 'string' && /^(voice_|voicekey_)[A-Za-z0-9_\-+/=]{3,4000}$/.test(v) ? v : undefined);

// Озвучивает перевод голосом того, кому принадлежит целевой язык (клонированный профиль или prebuilt-голос).
export async function POST(req: Request) {
  try {
    guard(req, { weight: 2 });
    const b = await readJson<Record<string, any>>(req);
    const text = parseText(b.text, 1500);
    if (!text || !isLanguageCode(b.language)) throw new AIError('bad_request', 'text and language required', 400);
    const role = b.targetRole === 'partner' ? 'partner' : 'user';
    const speakers = { user: { voiceId: okVoice(b.speakers?.user?.voiceId) }, partner: { voiceId: okVoice(b.speakers?.partner?.voiceId) } };
    const audio = await new VoiceService(getProvider()).synthesize({ text, language: b.language, targetRole: role, speakers, style: typeof b.style === 'string' ? b.style.slice(0, 200) : undefined }, req.signal);
    return new Response(base64ToBytes(audio.data) as unknown as BodyInit, { headers: { 'Content-Type': audio.mimeType, 'Cache-Control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}
