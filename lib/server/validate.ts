import { AIError } from '../errors.ts';
import { isLanguageCode } from '../languages.ts';
import type { ConversationContext, LanguageCode, SpeakerRole, TranslationMode } from '../types.ts';

const bad = (m: string): never => { throw new AIError('bad_request', m, 400); };
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function parseLanguages(v: unknown): LanguageCode[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > 10) return bad('selectedLanguages');
  const out = v.filter(isLanguageCode);
  if (out.length !== v.length) bad('selectedLanguages contains unknown language');
  return out;
}

// Клиент присылает своё состояние беседы; сервер stateless, поэтому проверяет форму и ограничивает размер.
export function parseContext(v: unknown): ConversationContext {
  if (!isObj(v) || typeof v.conversationId !== 'string' || !isObj(v.speakers)) return bad('context');
  const sp = v.speakers as Record<string, unknown>;
  for (const r of ['user', 'partner'] as SpeakerRole[]) {
    const s = sp[r];
    if (!isObj(s) || !isLanguageCode(s.language)) bad(`speakers.${r}`);
  }
  const selectedLanguages = parseLanguages(v.selectedLanguages);
  const cap = <T>(x: unknown, n: number): T[] => (Array.isArray(x) ? (x.slice(-n) as T[]) : []);
  return {
    conversationId: v.conversationId.slice(0, 64),
    speakers: sp as unknown as ConversationContext['speakers'],
    selectedLanguages,
    currentSpeaker: v.currentSpeaker === 'user' || v.currentSpeaker === 'partner' ? v.currentSpeaker : null,
    facts: cap(v.facts, 60),
    entities: cap(v.entities, 40),
    relationships: cap(v.relationships, 40),
    recentMessages: cap(v.recentMessages, 12),
    unresolvedReferences: cap(v.unresolvedReferences, 20),
    languageHistory: cap(v.languageHistory, 20),
  };
}

export const parseMode = (v: unknown): TranslationMode => (v === 'natural' || v === 'literal' ? v : 'contextual');

export function parseText(v: unknown, max = 2000): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string') return bad('text');
  return v.slice(0, max);
}

export function parseAudio(v: unknown): { mime: string; data: string } | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isObj(v) || typeof v.data !== 'string' || typeof v.mime !== 'string') return bad('audio');
  if (!/^audio\/(wav|x-wav|wave)$/.test(v.mime)) return bad('audio mime');
  if (v.data.length > 4_500_000) throw new AIError('too_large', 'Audio too long', 413);
  return { mime: 'audio/wav', data: v.data };
}
