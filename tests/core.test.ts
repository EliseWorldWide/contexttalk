import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ContextEngine } from '../lib/context/engine.ts';
import { restrictToSelected } from '../lib/languages.ts';
import { AIError } from '../lib/errors.ts';
import { buildTranslationPrompt, parseModelJson, runDetect, runProcessContext, runTranslation } from '../lib/ai/translate-flow.ts';
import type { Message } from '../lib/types.ts';

const mkEngine = (extra: Parameters<typeof ContextEngine.create>[0]['selectedLanguages'] = ['en']) =>
  ContextEngine.create({ userLanguage: 'ru', partnerLanguage: 'zh', selectedLanguages: extra });

// «Модель» для тестов: возвращает заранее заданный JSON. Проверяется детерминированная логика вокруг модели.
const model = (obj: unknown, log?: string[]) => async (prompt: string) => { log?.push(prompt); return JSON.stringify(obj); };
const msg = (over: Partial<Message>): Message => ({
  id: 'm' + Math.random(), speakerId: 'user', language: 'ru', targetLanguage: 'zh',
  originalText: 'Привет', translatedText: '你好', timestamp: Date.now(), confidence: 1, status: 'translated', source: 'text', ...over,
});

// ---------- определение языка и ограничение выбранными ----------
test('selected-language restriction: язык вне списка не принимается', () => {
  assert.equal(restrictToSelected({ en: 0.9, ru: 0.1 }, ['ru', 'zh'])?.language, 'ru');
  assert.equal(restrictToSelected({ en: 1 }, ['ru', 'zh']), null);
});

test('language detection: "ni hao" по контексту — китайский, а не английский', async () => {
  const e = mkEngine(['en']);
  const r = await runTranslation(
    { text: 'ni hao', context: e.state, mode: 'contextual', source: 'voice' },
    model({ detectedLanguage: 'zh', languageProbabilities: { zh: 0.9, en: 0.1 }, confidence: 0.9, transcript: '你好', translation: 'Привет', targetLanguage: 'ru' }),
  );
  assert.equal(r.detectedLanguage, 'zh');
  assert.equal(r.transcript, '你好');
});

test('language detection: модель назвала невыбранный язык → берём лучший выбранный или отказ', async () => {
  const e = mkEngine([]);
  const ok = await runTranslation(
    { text: 'x', context: e.state, mode: 'contextual', source: 'text' },
    model({ detectedLanguage: 'fr', languageProbabilities: { ru: 0.7, zh: 0.3 }, translation: '你好', targetLanguage: 'zh' }),
  );
  assert.equal(ok.detectedLanguage, 'ru');
  await assert.rejects(
    runTranslation({ text: 'x', context: e.state, mode: 'contextual', source: 'text' },
      model({ detectedLanguage: 'fr', languageProbabilities: { fr: 1 }, translation: 'x', targetLanguage: 'zh' })),
    (err: unknown) => err instanceof AIError && err.code === 'language_not_selected',
  );
});

test('detectLanguage возвращает только выбранные языки', async () => {
  const r = await runDetect({ text: 'hola', selectedLanguages: ['ru', 'es'] },
    model({ detectedLanguage: 'es', languageProbabilities: { es: 0.95, ru: 0.05 }, confidence: 0.95 }));
  assert.equal(r.language, 'es');
});

// ---------- маршрутизация ----------
test('Russian → Chinese: говорит USER, перевод на язык PARTNER', async () => {
  const e = mkEngine();
  const r = await runTranslation({ text: 'Привет', context: e.state, mode: 'contextual', source: 'text' },
    model({ detectedLanguage: 'ru', languageProbabilities: { ru: 1 }, confidence: 0.99, transcript: 'Привет', translation: '你好', targetLanguage: 'zh' }));
  assert.equal(r.route.speakerId, 'user');
  assert.equal(r.route.targetSpeakerId, 'partner');
  assert.equal(r.targetLanguage, 'zh');
});

test('Chinese → Russian: говорит PARTNER, озвучивать голосом USER', async () => {
  const e = mkEngine();
  const r = await runTranslation({ text: '你好', context: e.state, mode: 'contextual', source: 'voice' },
    model({ detectedLanguage: 'zh', languageProbabilities: { zh: 1 }, confidence: 0.99, transcript: '你好', translation: 'Привет', targetLanguage: 'ru' }));
  assert.equal(r.route.speakerId, 'partner');
  assert.equal(r.route.targetSpeakerId, 'user');
  assert.equal(r.targetLanguage, 'ru');
});

test('English (третий выбранный язык): собеседник, перевод на язык пользователя, помечено неточным', async () => {
  const e = mkEngine(['en']);
  const r = await runTranslation({ text: 'Hello', context: e.state, mode: 'contextual', source: 'text' },
    model({ detectedLanguage: 'en', languageProbabilities: { en: 0.98 }, translation: 'Привет', targetLanguage: 'ru' }));
  assert.equal(r.route.speakerId, 'partner');
  assert.equal(r.route.uncertain, true);
  assert.equal(r.targetLanguage, 'ru');
});

test('неверное направление перевода: одна повторная попытка с принудительным направлением', async () => {
  const e = mkEngine();
  const prompts: string[] = [];
  let n = 0;
  const call = async (p: string) => { prompts.push(p); n++;
    return JSON.stringify(n === 1
      ? { detectedLanguage: 'ru', translation: 'Привет', targetLanguage: 'ru' }
      : { detectedLanguage: 'ru', translation: '你好', targetLanguage: 'zh' }); };
  const r = await runTranslation({ text: 'Привет', context: e.state, mode: 'contextual', source: 'text' }, call);
  assert.equal(n, 2);
  assert.match(prompts[1], /already been determined: ru\. Translate into zh/);
  assert.equal(r.translation, '你好');
  n = 0;
  const bad = async () => JSON.stringify({ detectedLanguage: 'ru', translation: 'x', targetLanguage: 'ru' });
  await assert.rejects(runTranslation({ text: 'Привет', context: e.state, mode: 'contextual', source: 'text' }, bad),
    (err: unknown) => err instanceof AIError && err.code === 'bad_model_output');
});

// ---------- контекст ----------
test('context persistence: факты и реплики доходят до промпта следующего запроса', async () => {
  const e = mkEngine();
  e.addConfirmedByUser('Анна — подруга пользователя, она девушка.');
  e.recordMessage(msg({ originalText: 'Это моя подруга Анна.', translatedText: '这是我的朋友安娜。' }));
  const log: string[] = [];
  await runTranslation({ text: 'Она пришла', context: e.state, mode: 'contextual', source: 'text' },
    model({ detectedLanguage: 'ru', translation: '她来了', targetLanguage: 'zh' }, log));
  assert.match(log[0], /Анна — подруга/);
  assert.match(log[0], /Это моя подруга Анна\./);
});

test('context reset: новая беседа не помнит факты и реплики, но сохраняет участников', () => {
  const e = mkEngine();
  const oldId = e.state.conversationId;
  e.addConfirmedByUser('Анна — подруга');
  e.recordMessage(msg({}));
  e.reset();
  assert.notEqual(e.state.conversationId, oldId);
  assert.equal(e.state.facts.length, 0);
  assert.equal(e.state.recentMessages.length, 0);
  assert.equal(e.state.speakers.partner.language, 'zh');
});

test('pronoun resolution: подтверждённый пол попадает в промпт, а неизвестный — в unresolved', async () => {
  const e = mkEngine();
  e.addConfirmedByUser('Речь идёт о девушке по имени Анна');
  e.addEntities([{ name: 'Анна', type: 'person', gender: 'female' }]);
  const prompt = buildTranslationPrompt({ text: 'Он сказал, что придёт', context: e.state, mode: 'contextual', source: 'text' });
  assert.match(prompt, /"gender":"female"/);
  assert.match(prompt, /他\/她\/它/);
  assert.match(prompt, /list it in "unresolved" instead of guessing/);
  const r = await runTranslation({ text: '他来了', context: mkEngine().state, mode: 'contextual', source: 'voice' },
    model({ detectedLanguage: 'zh', translation: 'Пришёл(ла) человек', targetLanguage: 'ru', unresolved: [{ reference: '他', note: 'gender not established' }] }));
  assert.equal(r.unresolved[0].reference, '他');
});

test('speaker tracking: currentSpeaker и языковая история обновляются, при одном языке — чередование', () => {
  const e = mkEngine();
  e.recordMessage(msg({ speakerId: 'user' }));
  assert.equal(e.state.currentSpeaker, 'user');
  e.recordMessage(msg({ speakerId: 'partner', language: 'zh', targetLanguage: 'ru' }));
  assert.equal(e.state.currentSpeaker, 'partner');
  assert.deepEqual(e.state.languageHistory.map((h) => h.speakerId), ['user', 'partner']);
  const same = ContextEngine.create({ userLanguage: 'en', partnerLanguage: 'en' });
  const a = same.resolveRoute('en');
  same.recordMessage(msg({ speakerId: a.speakerId, language: 'en', targetLanguage: 'en' }));
  const b = same.resolveRoute('en');
  assert.notEqual(a.speakerId, b.speakerId);
  assert.equal(b.uncertain, true);
});

// ---------- никаких выдуманных фактов ----------
test('no invented facts: CONFIRMED без цитаты-основания понижается до INFERENCE', () => {
  const e = mkEngine();
  const added = e.acceptModelFacts([
    { text: 'Анна — подруга', kind: 'confirmed', evidence: 'моя подруга Анна' },
    { text: 'Анна — девушка', kind: 'confirmed', evidence: 'она красивая' },
    { text: 'Они знакомы давно', kind: 'confirmed' },
    { text: 'Возможно, они в кафе', kind: 'uncertain' },
  ], 'Это моя подруга Анна.');
  const kinds = Object.fromEntries(added.map((f) => [f.text, f.kind]));
  assert.equal(kinds['Анна — подруга'], 'confirmed');
  assert.equal(kinds['Анна — девушка'], 'inference');
  assert.equal(kinds['Они знакомы давно'], 'inference');
  assert.equal(kinds['Возможно, они в кафе'], 'uncertain');
  const p = e.promptContext();
  assert.deepEqual(p.confirmedFacts, ['Анна — подруга']);
});

test('no invented facts: processContext тоже проверяет цитату', async () => {
  const e = mkEngine();
  const r = await runProcessContext({ text: 'Это моя подруга Анна', context: e.state },
    model({ facts: [{ text: 'Анна — подруга', kind: 'confirmed', evidence: 'моя подруга Анна' }, { text: 'Анна замужем', kind: 'confirmed', evidence: 'она замужем' }] }));
  assert.equal(r.facts[0].kind, 'confirmed');
  assert.equal(r.facts[1].kind, 'inference');
});

// ---------- ошибки ----------
test('error handling: пустая реплика и мусор от модели дают типизированные ошибки', async () => {
  const e = mkEngine();
  await assert.rejects(runTranslation({ text: '  ', context: e.state, mode: 'contextual', source: 'text' }, model({})),
    (err: unknown) => err instanceof AIError && err.code === 'bad_request');
  assert.throws(() => parseModelJson('no json here'), (err: unknown) => err instanceof AIError && err.code === 'bad_model_output');
  assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 });
  await assert.rejects(runTranslation({ text: 'x', context: e.state, mode: 'contextual', source: 'text' }, async () => { throw new AIError('network', 'down', 503); }),
    (err: unknown) => err instanceof AIError && err.code === 'network');
});
