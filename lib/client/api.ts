import type { ConversationContext, TranslationMode, TranslationResult, SpeakerRole, VoiceProfile, ModelFact, Entity, Relationship } from '../types.ts';

export class ApiError extends Error {
  code: string;
  status: number;
  detail?: string;
  constructor(code: string, message: string, status = 0, detail?: string) { super(message); this.name = 'ApiError'; this.code = code; this.status = status; this.detail = detail; }
}

const NETWORK_MSG = 'Не удалось подключиться к AI. Проверь интернет-соединение.';

async function call(path: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try { res = await fetch(path, init); }
  catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new ApiError('network', NETWORK_MSG);
  }
  if (!res.ok) {
    let code = 'upstream', message = 'AI сейчас недоступен. Повторите через несколько секунд.', detail: string | undefined;
    try { const j = await res.json(); code = j?.error?.code ?? code; message = j?.error?.message ?? message; detail = j?.error?.detail; } catch { /* not json */ }
    throw new ApiError(code, message, res.status, detail);
  }
  return res;
}
const post = (path: string, body: unknown, signal?: AbortSignal) =>
  call(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });

export interface TranslateBody { text?: string; audio?: { mime: string; data: string }; context: ConversationContext; mode: TranslationMode; source: 'voice' | 'text' }
export interface LiveTokenInfo { token: string; model: string; wsUrl: string; setup: Record<string, unknown>; expiresAt: string }

export const api = {
  translate: async (b: TranslateBody, signal?: AbortSignal): Promise<TranslationResult> => (await post('/api/translate', b, signal)).json(),
  extractContext: async (text: string, context: ConversationContext): Promise<{ facts: ModelFact[]; entities: Entity[]; relationships: Relationship[] }> => (await post('/api/context', { text, context })).json(),
  liveToken: async (): Promise<LiveTokenInfo> => (await post('/api/live-token', {})).json(),
  tts: async (b: { text: string; language: string; targetRole: SpeakerRole; speakers: Record<SpeakerRole, { voiceId?: string }> }, signal?: AbortSignal): Promise<ArrayBuffer> =>
    (await post('/api/tts', b, signal)).arrayBuffer(),
  createVoice: async (b: { role: SpeakerRole; language: string; displayName: string; referenceWavBase64: string; consentWavBase64: string; consentConfirmed: boolean }): Promise<VoiceProfile> =>
    (await post('/api/voices', b)).json(),
  deleteVoice: async (p: Pick<VoiceProfile, 'voiceId' | 'storage'>): Promise<void> => {
    if (p.storage === 'stateful') await call(`/api/voices/${encodeURIComponent(p.voiceId)}`, { method: 'DELETE' });
  },
};
export type Api = typeof api;
