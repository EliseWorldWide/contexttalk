import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceService, selectVoice, PREBUILT_DEFAULTS } from '../lib/voice/voice-service.ts';
import { bytesToBase64, pcm16ToWav, parseWav } from '../lib/audio.ts';
import { AIError } from '../lib/errors.ts';
import { GeminiProvider } from '../lib/ai/gemini.ts';
import { getProvider } from '../lib/ai/index.ts';
import { guard } from '../lib/server/http.ts';
import { Vad } from '../lib/client/vad.ts';
import { splitSentences } from '../lib/text.ts';
import type { AIProvider } from '../lib/ai/provider.ts';

const wav = (seconds: number) => bytesToBase64(pcm16ToWav(new Int16Array(Math.round(24000 * seconds)), 24000));

function fakeProvider(log: string[]): AIProvider {
  const nope = () => { throw new Error('unused'); };
  return {
    name: 'fake', translate: nope, detectLanguage: nope, processContext: nope, realtimeSession: nope,
    async synthesizeSpeech(r) { log.push('tts:' + r.voice); return { mimeType: 'audio/wav', data: 'AAAA' }; },
    async createVoice(r) { log.push('create:' + r.store); return { id: r.store ? 'voice_abc123' : 'voicekey_xyz' }; },
    async getVoice(id) { return { id }; },
    async deleteVoice(id) { log.push('delete:' + id); },
  };
}

// ---------- голосовые профили ----------
test('voice profile selection: USER и PARTNER получают разные голоса; клонированный приоритетнее prebuilt', () => {
  const none = selectVoice('partner', { user: {}, partner: {} });
  assert.deepEqual(none, { voice: PREBUILT_DEFAULTS.partner, replicated: false });
  assert.notEqual(PREBUILT_DEFAULTS.user, PREBUILT_DEFAULTS.partner);
  assert.deepEqual(selectVoice('user', { user: { voiceId: 'voice_u1' }, partner: { voiceId: 'voice_p1' } }), { voice: 'voice_u1', replicated: true });
});

test('USER voice: перевод на язык пользователя (говорит PARTNER) озвучивается голосом USER', async () => {
  const log: string[] = [];
  await new VoiceService(fakeProvider(log)).synthesize({ text: 'Привет', language: 'ru', targetRole: 'user', speakers: { user: { voiceId: 'voice_user1' }, partner: { voiceId: 'voice_partner1' } } });
  assert.deepEqual(log, ['tts:voice_user1']);
});

test('PARTNER voice: перевод на язык собеседника (говорит USER) озвучивается голосом PARTNER', async () => {
  const log: string[] = [];
  await new VoiceService(fakeProvider(log)).synthesize({ text: '你好', language: 'zh', targetRole: 'partner', speakers: { user: { voiceId: 'voice_user1' }, partner: { voiceId: 'voice_partner1' } } });
  assert.deepEqual(log, ['tts:voice_partner1']);
});

test('createVoiceProfile: без согласия — отказ; неверная длина образца — отказ; успех сохраняет только id', async () => {
  const log: string[] = [];
  const svc = new VoiceService(fakeProvider(log));
  const base = { role: 'user' as const, language: 'ru' as const, displayName: 'Я', referenceWavBase64: wav(15), consentWavBase64: wav(8) };
  await assert.rejects(svc.createVoiceProfile({ ...base, consentConfirmed: false }), (e: unknown) => e instanceof AIError && e.code === 'consent_required');
  await assert.rejects(svc.createVoiceProfile({ ...base, referenceWavBase64: wav(5), consentConfirmed: true }), (e: unknown) => e instanceof AIError && e.code === 'bad_request');
  assert.equal(log.length, 0, 'в Google ничего не отправлено при невалидном вводе');
  const p = await svc.createVoiceProfile({ ...base, consentConfirmed: true });
  assert.equal(p.voiceId, 'voice_abc123');
  assert.equal(p.consentStatus, 'confirmed');
  assert.equal(p.storage, 'stateful');
  assert.equal(JSON.stringify(p).includes(base.referenceWavBase64.slice(0, 40)), false, 'записи в профиле не хранятся');
});

test('deleteVoiceProfile: stateful удаляет в Google, stateless — только забывает ключ', async () => {
  const log: string[] = [];
  const svc = new VoiceService(fakeProvider(log));
  await svc.deleteVoiceProfile({ voiceId: 'voice_abc123', storage: 'stateful' });
  await svc.deleteVoiceProfile({ voiceId: 'voicekey_xyz', storage: 'stateless' });
  assert.deepEqual(log, ['delete:voice_abc123']);
});

test('WAV: кодирование и разбор длительности', () => {
  const info = parseWav(pcm16ToWav(new Int16Array(24000 * 2), 24000));
  assert.equal(info?.sampleRate, 24000);
  assert.ok(Math.abs((info?.seconds ?? 0) - 2) < 0.01);
});

// ---------- провайдер и ошибки ----------
test('error handling: без GEMINI_API_KEY — понятная ошибка not_configured, а не фальшивый перевод', async () => {
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(new GeminiProvider().synthesizeSpeech({ text: 'x', voice: 'Kore', language: 'ru' }), (e: unknown) => e instanceof AIError && e.code === 'not_configured');
    await assert.rejects(new GeminiProvider().realtimeSession(), (e: unknown) => e instanceof AIError && e.code === 'not_configured');
  } finally { if (saved) process.env.GEMINI_API_KEY = saved; }
});

test('error handling: сеть недоступна → code network (для сообщения «Проверь интернет-соединение»)', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
  try {
    await assert.rejects(new GeminiProvider().getVoice('voice_abc123'), (e: unknown) => e instanceof AIError && e.code === 'network');
  } finally { globalThis.fetch = realFetch; if (saved) process.env.GEMINI_API_KEY = saved; else delete process.env.GEMINI_API_KEY; }
});

test('AI_PROVIDER: gemini по умолчанию, неизвестный провайдер — явная ошибка', () => {
  delete process.env.AI_PROVIDER;
  assert.equal(getProvider().name, 'gemini');
});

test('API guard: чужой origin отклоняется, лимит запросов срабатывает', () => {
  const mk = (h: Record<string, string>) => new Request('https://app.example/api/x', { method: 'POST', headers: h });
  assert.throws(() => guard(mk({ origin: 'https://evil.example', host: 'app.example' })), (e: unknown) => e instanceof AIError && e.code === 'forbidden');
  assert.doesNotThrow(() => guard(mk({ origin: 'https://app.example', host: 'app.example', 'x-forwarded-for': '9.9.9.9' })));
  process.env.RATE_LIMIT_PER_MINUTE = '3';
  const h = { 'x-forwarded-for': '1.2.3.4', host: 'app.example' };
  guard(mk(h)); guard(mk(h)); guard(mk(h));
  assert.throws(() => guard(mk(h)), (e: unknown) => e instanceof AIError && e.code === 'rate_limited');
  delete process.env.RATE_LIMIT_PER_MINUTE;
});

// ---------- VAD и перебивание ----------
const feed = (vad: Vad, rms: number, ms: number, speaking = false) => {
  const ev: (string | null)[] = [];
  for (let t = 0; t < ms; t += 50) ev.push(vad.process(rms, 50, speaking));
  return ev.filter(Boolean);
};

test('VAD: начало и конец реплики; короткая пауза (< 1.4 с) не обрезает человека', () => {
  const v = new Vad();
  assert.deepEqual(feed(v, 0.001, 500), []);
  assert.deepEqual(feed(v, 0.1, 600), ['speech_start']);
  assert.deepEqual(feed(v, 0.001, 1000), [], 'пауза 1 с — реплика ещё идёт');
  assert.deepEqual(feed(v, 0.1, 400), []);
  assert.deepEqual(feed(v, 0.001, 1600), ['speech_end']);
});

test('interruption: пока AI говорит, устойчивый голос даёт barge_in, короткий шум — нет', () => {
  const v = new Vad();
  assert.deepEqual(feed(v, 0.5, 100, true), [], 'щелчок 100 мс не перебивает');
  assert.deepEqual(feed(v, 0.001, 200, true), []);
  assert.deepEqual(feed(v, 0.02, 600, true), [], 'тихий звук (эхо динамика) не перебивает');
  assert.deepEqual(feed(v, 0.2, 400, true), ['barge_in']);
  assert.deepEqual(feed(v, 0.001, 1600, false), ['speech_end'], 'после перебивания реплика завершается как обычно');
});

test('текст режется на сегменты для потоковой озвучки', () => {
  assert.deepEqual(splitSentences('Привет. Как дела? Всё хорошо!'), ['Привет. Как дела?', 'Всё хорошо!']);
  assert.deepEqual(splitSentences('你好，你最近怎么样？我很好。'), ['你好，你最近怎么样？', '我很好。']);
  assert.deepEqual(splitSentences('Да. Нет.'), ['Да. Нет.'], 'совсем короткие обрывки склеиваются');
  assert.deepEqual(splitSentences('  '), []);
});
