// Проверка настоящего Gemini: node --experimental-strip-types scripts/live-check.ts  (нужен GEMINI_API_KEY)
import { GeminiProvider } from '../lib/ai/gemini.ts';
import { ContextEngine } from '../lib/context/engine.ts';

if (!process.env.GEMINI_API_KEY) { console.error('Задайте GEMINI_API_KEY'); process.exit(1); }
const p = new GeminiProvider();
const e = ContextEngine.create({ userLanguage: 'ru', partnerLanguage: 'zh', selectedLanguages: ['en'] });
const step = async (name: string, f: () => Promise<unknown>) => {
  try { console.log(`✓ ${name}:`, JSON.stringify(await f()).slice(0, 220)); }
  catch (err) { console.log(`✗ ${name}:`, (err as Error).message); process.exitCode = 1; }
};
await step('ru → zh', async () => { const r = await p.translate({ text: 'Привет, как твои дела?', context: e.state, mode: 'contextual', source: 'text' }); return { to: r.targetLanguage, translation: r.translation, speaker: r.route.speakerId }; });
await step('zh → ru', async () => { const r = await p.translate({ text: '我很好，谢谢！', context: e.state, mode: 'contextual', source: 'text' }); return { to: r.targetLanguage, translation: r.translation, speaker: r.route.speakerId }; });
await step('"ni hao" не английский', async () => (await p.translate({ text: 'ni hao', context: e.state, mode: 'contextual', source: 'voice' })).detectedLanguage);
await step('TTS (prebuilt Kore)', async () => { const a = await p.synthesizeSpeech({ text: 'Привет', voice: 'Kore', language: 'ru' }); return { mime: a.mimeType, bytesBase64: a.data.length }; });
await step('Live: временный токен', async () => { const s = await p.realtimeSession(); return { model: s.model, tokenPrefix: s.token.slice(0, 12) + '…' }; });
