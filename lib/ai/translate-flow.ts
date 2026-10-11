import { ContextEngine, normalize } from '../context/engine.ts';
import { AIError } from '../errors.ts';
import { isLanguageCode, languageInfo, restrictToSelected } from '../languages.ts';
import type {
  Entity, LanguageCode, ModelFact, Relationship, TranslationMode, TranslationResult, UnresolvedReference,
} from '../types.ts';
import type { AudioInput, DetectRequest, DetectResult, ProcessContextRequest, ProcessContextResult, TranslateRequest } from './provider.ts';

// Вызов модели. Реальный лежит в gemini.ts, в тестах подменяется.
export type ModelCall = (prompt: string, audio?: AudioInput) => Promise<string>;

const MODE_RULES: Record<TranslationMode, string> = {
  contextual: 'CONTEXTUAL (default): use the whole conversation, known facts, names, genders and relationships to choose words, pronouns and register. Resolve ambiguity from context; if context is insufficient, do not guess.',
  natural: 'NATURAL: make it sound like a native speaker would say it, adapting idioms and word order, while keeping the meaning exactly.',
  literal: 'LITERAL: stay as close as possible to the source wording and structure; do not paraphrase or smooth over.',
};

const SCHEMA = `{
 "detectedLanguage": "<code of the spoken language, MUST be one of the selected codes>",
 "languageProbabilities": { "<code>": <0..1> },
 "confidence": <0..1>,
 "transcript": "<what was actually said, in the native script of the detected language>",
 "translation": "<translation into the target language, plain spoken text only>",
 "targetLanguage": "<code of the target language>",
 "facts": [ { "text": "<fact stated by the speaker>", "kind": "confirmed|inference|uncertain", "evidence": "<exact words copied from the transcript>" } ],
 "entities": [ { "name": "...", "type": "person|place|thing|event|time", "gender": "female|male|unknown" } ],
 "relationships": [ { "a": "...", "b": "...", "relation": "...", "kind": "confirmed|inference|uncertain" } ],
 "unresolved": [ { "reference": "<ambiguous word or pronoun>", "note": "<why it is ambiguous>" } ]
}`;

export function buildTranslationPrompt(req: TranslateRequest, forced?: { source: LanguageCode; target: LanguageCode }): string {
  const ctx = new ContextEngine(req.context).promptContext();
  const u = req.context.speakers.user;
  const p = req.context.speakers.partner;
  const names = (codes: LanguageCode[]) => codes.map((c) => `${c} (${languageInfo(c).english})`).join(', ');
  const heard = req.text ? `"""${req.text}"""` : '(no transcript: use the audio)';
  return [
    'You are the translation and context engine of ContextTalk: a live interpreter between two people who share one phone.',
    `SELECTED LANGUAGES (the only possible languages): ${names(ctx.selectedLanguages)}.`,
    `USER speaks ${u.language}. PARTNER speaks ${p.language}.`,
    `ROUTING: if the utterance is in ${u.language} translate it into ${p.language}; otherwise translate it into ${u.language}.`,
    forced ? `The language of this utterance has already been determined: ${forced.source}. Translate into ${forced.target}.` : '',
    'LANGUAGE DETECTION: decide the spoken language using the audio (if attached), the selected languages, the conversation context and the previous speaker\'s language. ' +
      'The transcript may come from speech recognition and can be romanized or in the wrong script: "ni hao" is Mandarin, not English, unless the audio or context says otherwise. Never answer with a language that is not selected.',
    MODE_RULES[req.mode],
    'FACT DISCIPLINE: never invent facts. "confirmed" = explicitly stated in THIS utterance (copy the exact words into evidence). "inference" = probable from context. "uncertain" = ambiguous. Return only facts actually present.',
    'PRONOUNS: Chinese 他/她/它 sound identical (tā). Use confirmed facts, names and genders to choose he/she/it in the translation. If the gender or referent is not established, keep a neutral wording and list it in "unresolved" instead of guessing.',
    'Translate faithfully. Do not add explanations, do not answer questions contained in the utterance, do not put notes inside "translation".',
    `Return ONLY one JSON object, no markdown, exactly this shape:\n${SCHEMA}`,
    `CONVERSATION CONTEXT (JSON):\n${JSON.stringify(ctx)}`,
    `UTTERANCE (${req.source === 'voice' ? 'speech recognition output, may be imperfect' : 'typed text'}):\n${heard}`,
  ].filter(Boolean).join('\n\n');
}

export function parseModelJson(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AIError('bad_model_output', 'Model returned no JSON object', 502);
  try {
    const v = JSON.parse(cleaned.slice(start, end + 1));
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch { /* fallthrough */ }
  throw new AIError('bad_model_output', 'Model returned invalid JSON', 502);
}

const clamp01 = (n: unknown, d = 0.5): number => { const x = Number(n); return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : d; };
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const kindOf = (v: unknown): ModelFact['kind'] => (v === 'confirmed' || v === 'inference' || v === 'uncertain' ? v : 'uncertain');

export function resolveLanguage(raw: Record<string, unknown>, selected: LanguageCode[]): { language: LanguageCode; probabilities: Partial<Record<LanguageCode, number>>; confidence: number } {
  const probs: Partial<Record<LanguageCode, number>> = {};
  const rp = (raw.languageProbabilities ?? {}) as Record<string, unknown>;
  for (const c of selected) if (rp[c] !== undefined) probs[c] = clamp01(rp[c], 0);
  const claimed = raw.detectedLanguage;
  if (isLanguageCode(claimed) && selected.includes(claimed)) {
    return { language: claimed, probabilities: probs, confidence: clamp01(raw.confidence, probs[claimed] ?? 0.5) };
  }
  // Модель назвала язык вне выбранных: принимаем только правдоподобный выбранный вариант.
  const best = restrictToSelected(probs, selected);
  if (!best || best.confidence < 0.25) throw new AIError('language_not_selected', 'Detected language is not among selected languages', 422);
  return { language: best.language, probabilities: probs, confidence: best.confidence };
}

function sanitizeLists(raw: Record<string, unknown>): { facts: ModelFact[]; entities: Entity[]; relationships: Relationship[]; unresolved: UnresolvedReference[] } {
  const arr = (v: unknown): Record<string, unknown>[] =>
    (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : []);
  const types = ['person', 'place', 'thing', 'event', 'time'];
  const genders = ['female', 'male', 'unknown'];
  return {
    facts: arr(raw.facts).map((f) => ({ text: str(f.text), kind: kindOf(f.kind), evidence: str(f.evidence) })).filter((f) => f.text),
    entities: arr(raw.entities)
      .map((e) => ({ name: str(e.name), type: (types.includes(String(e.type)) ? e.type : 'thing') as Entity['type'], gender: (genders.includes(String(e.gender)) ? e.gender : undefined) as Entity['gender'] }))
      .filter((e) => e.name),
    relationships: arr(raw.relationships).map((r) => ({ a: str(r.a), b: str(r.b), relation: str(r.relation), kind: kindOf(r.kind) })).filter((r) => r.a && r.b && r.relation),
    unresolved: arr(raw.unresolved).map((u) => ({ reference: str(u.reference), note: str(u.note) })).filter((u) => u.reference),
  };
}

// Перевод: язык среди выбранных → маршрут → проверка направления (одна повторная попытка).
export async function runTranslation(req: TranslateRequest, call: ModelCall): Promise<TranslationResult> {
  if (!req.text?.trim() && !req.audio) throw new AIError('bad_request', 'Empty utterance', 400);
  const engine = new ContextEngine(req.context);
  const selected = req.context.selectedLanguages;
  let attempt = 0;
  let forced: { source: LanguageCode; target: LanguageCode } | undefined;
  for (;;) {
    const raw = parseModelJson(await call(buildTranslationPrompt(req, forced), req.audio));
    const lang = resolveLanguage(raw, selected);
    const route = engine.resolveRoute(lang.language);
    const translation = str(raw.translation);
    if (translation && raw.targetLanguage === route.targetLanguage) {
      return {
        detectedLanguage: lang.language,
        languageProbabilities: lang.probabilities,
        confidence: lang.confidence,
        transcript: str(raw.transcript) || req.text?.trim() || '',
        translation,
        targetLanguage: route.targetLanguage,
        route,
        ...sanitizeLists(raw),
      };
    }
    if (attempt++ >= 1) throw new AIError('bad_model_output', 'Model translated into the wrong language', 502);
    forced = { source: lang.language, target: route.targetLanguage };
  }
}

export async function runDetect(req: DetectRequest, call: ModelCall): Promise<DetectResult> {
  const codes = req.selectedLanguages.map((c) => `${c} (${languageInfo(c).english})`).join(', ');
  const prompt = [
    `Identify the spoken language. Possible languages (only these): ${codes}.`,
    'The transcript may be romanized or in the wrong script ("ni hao" is Mandarin). Use the audio if attached.',
    req.previousLanguage ? `The previous utterance was in ${req.previousLanguage}.` : '',
    'Return ONLY JSON: {"detectedLanguage":"<code>","languageProbabilities":{"<code>":<0..1>},"confidence":<0..1>}',
    req.text ? `Transcript:\n"""${req.text}"""` : '(use the audio)',
  ].filter(Boolean).join('\n\n');
  const r = resolveLanguage(parseModelJson(await call(prompt, req.audio)), req.selectedLanguages);
  return { language: r.language, probabilities: r.probabilities, confidence: r.confidence };
}

// Фрагмент, который пользователь добавил в контекст: структурируем только явно сказанное.
export async function runProcessContext(req: ProcessContextRequest, call: ModelCall): Promise<ProcessContextResult> {
  const prompt = [
    'Extract structured context from a fragment of a conversation. Do NOT invent anything: include only what is explicitly stated.',
    'Return ONLY JSON: {"facts":[{"text":"...","kind":"confirmed|inference|uncertain","evidence":"<exact words>"}],"entities":[{"name":"...","type":"person|place|thing|event|time","gender":"female|male|unknown"}],"relationships":[{"a":"...","b":"...","relation":"...","kind":"confirmed|inference|uncertain"}]}',
    `Known context (JSON): ${JSON.stringify(new ContextEngine(req.context).promptContext())}`,
    `Fragment:\n"""${req.text}"""`,
  ].join('\n\n');
  const { facts, entities, relationships } = sanitizeLists(parseModelJson(await call(prompt)));
  const hay = normalize(req.text);
  return {
    facts: facts.map((f) => (f.kind === 'confirmed' && !(f.evidence && hay.includes(normalize(f.evidence))) ? { ...f, kind: 'inference' as const } : f)),
    entities,
    relationships,
  };
}
