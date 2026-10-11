import { AIError } from '../errors.ts';
import type { TranslationResult } from '../types.ts';
import type {
  AIProvider, CreateVoiceRequest, DetectRequest, DetectResult, ProcessContextRequest, ProcessContextResult,
  RealtimeSessionInfo, SynthesizeRequest, SynthesizedAudio, TranslateRequest, VoiceInfo, AudioInput,
} from './provider.ts';
import { runDetect, runProcessContext, runTranslation } from './translate-flow.ts';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const env = (name: string): string | undefined =>
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env?.[name]?.trim() || undefined;

export const models = () => ({
  text: env('GEMINI_TEXT_MODEL') ?? 'gemini-3.8-flash',
  live: env('GEMINI_LIVE_MODEL') ?? 'gemini-3.8-live',
  tts: env('GEMINI_TTS_MODEL') ?? 'gemini-3.8-flash-tts',
});

// Live-сессия используется как «уши»: стримит аудио и возвращает транскрипт.
// Озвучивает перевод не Live, а TTS (только TTS поддерживает клонированные голоса).
export const LIVE_SYSTEM_INSTRUCTION =
  'You are a silent speech relay for an interpreter app. Only listen and transcribe. Never answer, never speak, never comment.';

export function liveSetup(model: string): Record<string, unknown> {
  return {
    setup: {
      model: `models/${model}`,
      responseModalities: ['AUDIO'],
      inputAudioTranscription: {},
      systemInstruction: { parts: [{ text: LIVE_SYSTEM_INSTRUCTION }] },
    },
  };
}

function apiKey(): string {
  const k = env('GEMINI_API_KEY');
  if (!k) throw new AIError('not_configured', 'GEMINI_API_KEY is not set', 500);
  return k;
}

interface FetchOpts { method?: string; body?: unknown; signal?: AbortSignal; timeoutMs?: number; kind?: 'voice' }

// Единственное место, где сервер ходит в Gemini. Ключ — только в заголовке, никогда не логируется.
async function gFetch(path: string, opts: FetchOpts = {}): Promise<Record<string, any>> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 45000);
  const onAbort = () => ctl.abort();
  opts.signal?.addEventListener('abort', onAbort);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? 'POST',
      headers: { 'x-goog-api-key': apiKey(), 'Content-Type': 'application/json' },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: ctl.signal,
    });
  } catch (e) {
    if (e instanceof AIError) throw e;
    throw new AIError('network', 'Cannot reach Gemini API', 503);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
  if (res.status === 204) return {};
  const text = await res.text();
  let json: Record<string, any> = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* non-JSON body */ }
  if (!res.ok) {
    const detail = String(json?.error?.message ?? text).slice(0, 300);
    if (res.status === 401 || res.status === 403) throw new AIError('auth', `Gemini rejected the key: ${detail}`, 502);
    if (res.status === 429) throw new AIError('rate_limited', detail, 429);
    if (opts.kind === 'voice' && (res.status === 400 || res.status >= 500)) throw new AIError('voice_rejected', detail, 422);
    if (res.status === 400) throw new AIError('bad_request', detail, 400);
    throw new AIError('upstream', detail, 502);
  }
  return json;
}

async function generateText(prompt: string, audio: AudioInput | undefined, signal?: AbortSignal, temperature = 0.2): Promise<string> {
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  if (audio) parts.push({ inlineData: { mimeType: audio.mime, data: audio.data } });
  const data = await gFetch(`/models/${models().text}:generateContent`, {
    signal,
    body: { contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature } },
  });
  if (data.promptFeedback?.blockReason) throw new AIError('bad_request', `Blocked: ${data.promptFeedback.blockReason}`, 400);
  const out = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  if (!out) throw new AIError('bad_model_output', 'Empty model response', 502);
  return out;
}

export const VOICE_ID_RE = /^voice_[A-Za-z0-9_-]{3,200}$/;

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';

  translate(req: TranslateRequest, signal?: AbortSignal): Promise<TranslationResult> {
    const temp = req.mode === 'literal' ? 0.1 : req.mode === 'natural' ? 0.5 : 0.3;
    return runTranslation(req, (prompt, audio) => generateText(prompt, audio, signal, temp));
  }

  detectLanguage(req: DetectRequest, signal?: AbortSignal): Promise<DetectResult> {
    return runDetect(req, (prompt, audio) => generateText(prompt, audio, signal, 0));
  }

  processContext(req: ProcessContextRequest, signal?: AbortSignal): Promise<ProcessContextResult> {
    return runProcessContext(req, (prompt) => generateText(prompt, undefined, signal, 0));
  }

  // Браузер получает одноразовый токен вместо ключа. Токен привязан к Live-модели.
  async realtimeSession(): Promise<RealtimeSessionInfo> {
    const key = apiKey();
    const model = models().live;
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey: key });
    const expire = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const fresh = new Date(Date.now() + 60 * 1000).toISOString();
    let token: { name?: string };
    try {
      token = await client.authTokens.create({
        config: { uses: 1, expireTime: expire, newSessionExpireTime: fresh, liveConnectConstraints: { model } },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/40[13]|API key|permission/i.test(msg)) throw new AIError('auth', msg.slice(0, 200), 502);
      throw new AIError('upstream', `Cannot create ephemeral token: ${msg.slice(0, 200)}`, 502);
    }
    if (!token?.name) throw new AIError('upstream', 'Ephemeral token missing', 502);
    return {
      token: token.name,
      model,
      wsUrl: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained',
      setup: liveSetup(model),
      expiresAt: expire,
    };
  }

  // gemini-3.8-flash-tts: текст трактуется как дословный транскрипт. Голос — prebuilt (Kore, Puck...) или voice_/voicekey_.
  async synthesizeSpeech(req: SynthesizeRequest, signal?: AbortSignal): Promise<SynthesizedAudio> {
    const content: Record<string, unknown> = { type: 'text', text: req.text };
    if (req.style) content.annotations = [{ type: 'speech_metadata', style: req.style }];
    const data = await gFetch('/interactions', {
      signal,
      body: {
        model: models().tts,
        input: [{ type: 'user_input', content: [content] }],
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice: req.voice }] },
      },
    });
    const audio = ((data.steps ?? []) as { type?: string; content?: { type?: string; data?: string; mime_type?: string }[] }[])
      .filter((s) => s.type === 'model_output')
      .flatMap((s) => s.content ?? [])
      .filter((c) => c.type === 'audio' && c.data)
      .pop();
    if (!audio?.data) throw new AIError('bad_model_output', 'TTS returned no audio', 502);
    return { mimeType: audio.mime_type ?? 'audio/wav', data: audio.data };
  }

  async createVoice(req: CreateVoiceRequest, signal?: AbortSignal): Promise<VoiceInfo> {
    const data = await gFetch('/voices', {
      signal, timeoutMs: 90000, kind: 'voice',
      body: {
        store: req.store,
        voice: {
          model: models().tts,
          type: 'replicated',
          display_name: req.displayName,
          replicated: {
            source_audio: { mime_type: 'audio/wav', data: req.referenceWavBase64 },
            consent_audio: { mime_type: 'audio/wav', data: req.consentWavBase64 },
          },
        },
      },
    });
    const id: string | undefined = data.id ?? (typeof data.name === 'string' ? data.name.split('/').pop() : undefined);
    const key: string | undefined = data.key;
    if (!id && !key) throw new AIError('bad_model_output', 'Voices API returned no voice id', 502);
    return { id: (req.store ? id : key) ?? (id as string), key, displayName: req.displayName, type: 'replicated' };
  }

  async getVoice(id: string, signal?: AbortSignal): Promise<VoiceInfo> {
    if (!VOICE_ID_RE.test(id)) throw new AIError('bad_request', 'Invalid voice id', 400);
    const d = await gFetch(`/voices/${id}`, { method: 'GET', signal });
    return { id: d.id ?? id, displayName: d.display_name ?? d.displayName, type: d.type };
  }

  async deleteVoice(id: string, signal?: AbortSignal): Promise<void> {
    if (!VOICE_ID_RE.test(id)) throw new AIError('bad_request', 'Invalid voice id', 400);
    await gFetch(`/voices/${id}`, { method: 'DELETE', signal });
  }
}

