import type {
  ConversationContext, Entity, Fact, FactKind, LanguageCode, Message, ModelFact,
  PromptContext, Relationship, Route, Speaker, SpeakerRole, UnresolvedReference,
} from '../types.ts';

const MAX_RECENT = 12;
const MAX_LANG_HISTORY = 20;

export const normalize = (s: string): string =>
  s.toLowerCase().replace(/ё/g, 'е').replace(/[\s.,!?;:，。！？、"'«»()\[\]-]+/g, ' ').trim();

const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export interface EngineInit {
  userLanguage: LanguageCode;
  partnerLanguage: LanguageCode;
  selectedLanguages?: LanguageCode[];
  userName?: string;
  partnerName?: string;
  userVoiceId?: string;
  partnerVoiceId?: string;
}

// Чистая логика без сети и DOM. Работает и в браузере (держит состояние беседы),
// и на сервере (строит контекст для запроса к модели).
export class ContextEngine {
  state: ConversationContext;

  constructor(state: ConversationContext) {
    this.state = state;
  }

  static create(init: EngineInit): ContextEngine {
    const selected = Array.from(new Set([init.userLanguage, init.partnerLanguage, ...(init.selectedLanguages ?? [])]));
    const mk = (role: SpeakerRole, language: LanguageCode, name?: string, voiceId?: string): Speaker =>
      ({ id: role, role, language, name, gender: 'unknown', voiceId });
    return new ContextEngine({
      conversationId: uid(),
      speakers: {
        user: mk('user', init.userLanguage, init.userName, init.userVoiceId),
        partner: mk('partner', init.partnerLanguage, init.partnerName, init.partnerVoiceId),
      },
      selectedLanguages: selected,
      currentSpeaker: null,
      facts: [], entities: [], relationships: [], recentMessages: [],
      unresolvedReferences: [], languageHistory: [],
    });
  }

  // Новая беседа = новый контекст. Участники, языки и голоса остаются, всё «сказанное» стирается.
  reset(): void {
    const { speakers, selectedLanguages } = this.state;
    this.state = {
      conversationId: uid(), speakers, selectedLanguages, currentSpeaker: null,
      facts: [], entities: [], relationships: [], recentMessages: [],
      unresolvedReferences: [], languageHistory: [],
    };
  }

  setLanguages(user: LanguageCode, partner: LanguageCode, selected?: LanguageCode[]): void {
    this.state.speakers.user.language = user;
    this.state.speakers.partner.language = partner;
    this.state.selectedLanguages = Array.from(new Set([user, partner, ...(selected ?? this.state.selectedLanguages)]));
  }

  setVoice(role: SpeakerRole, voiceId?: string): void {
    this.state.speakers[role].voiceId = voiceId;
  }

  // Определение говорящего и направления перевода по определённому языку.
  resolveRoute(detected: LanguageCode): Route {
    const { user, partner } = this.state.speakers;
    let speaker: SpeakerRole;
    let uncertain = false;
    if (user.language === partner.language) {
      // Один язык у обоих: по языку различить нельзя, чередуем говорящих и помечаем как неточное.
      speaker = this.state.currentSpeaker === 'user' ? 'partner' : 'user';
      uncertain = true;
    } else if (detected === user.language) {
      speaker = 'user';
    } else if (detected === partner.language) {
      speaker = 'partner';
    } else {
      // Третий выбранный язык: считаем, что говорит собеседник, перевод на язык пользователя.
      speaker = 'partner';
      uncertain = true;
    }
    const target: SpeakerRole = speaker === 'user' ? 'partner' : 'user';
    return {
      speakerId: speaker,
      targetSpeakerId: target,
      sourceLanguage: detected,
      targetLanguage: this.state.speakers[target].language,
      uncertain,
    };
  }

  // Факт, который пользователь явно подтвердил («Add to context»), — единственный путь к CONFIRMED «вручную».
  addConfirmedByUser(text: string): Fact | null {
    return this.addFact(text, 'confirmed', 'user_selection');
  }

  addFact(text: string, kind: FactKind, source: Fact['source'], messageId?: string): Fact | null {
    const clean = text.trim();
    if (!clean) return null;
    const key = normalize(clean);
    const existing = this.state.facts.find((f) => normalize(f.text) === key);
    if (existing) {
      // Повтор никогда не понижает подтверждённый факт и не повышает предположение до подтверждённого.
      return existing;
    }
    const fact: Fact = { id: uid(), text: clean, kind, source, messageId, createdAt: Date.now() };
    this.state.facts.push(fact);
    return fact;
  }

  // Факты от модели. CONFIRMED допускается только если цитата-основание реально присутствует
  // в сказанной реплике; иначе это INFERENCE. Это защита от выдуманных фактов.
  acceptModelFacts(facts: ModelFact[], utterance: string, messageId?: string): Fact[] {
    const accepted: Fact[] = [];
    const haystack = normalize(utterance);
    for (const f of facts) {
      let kind: FactKind = f.kind;
      if (kind === 'confirmed') {
        const ev = f.evidence ? normalize(f.evidence) : '';
        if (!ev || !haystack.includes(ev)) kind = 'inference';
      }
      const added = this.addFact(f.text, kind, 'model', messageId);
      if (added) accepted.push(added);
    }
    return accepted;
  }

  removeFact(id: string): void {
    this.state.facts = this.state.facts.filter((f) => f.id !== id);
  }

  addEntities(entities: Entity[]): void {
    for (const e of entities) {
      const found = this.state.entities.find((x) => normalize(x.name) === normalize(e.name));
      if (!found) this.state.entities.push(e);
      else if ((!found.gender || found.gender === 'unknown') && e.gender) found.gender = e.gender;
    }
  }

  addRelationships(rels: Relationship[]): void {
    for (const r of rels) {
      const dup = this.state.relationships.some((x) => normalize(x.a) === normalize(r.a) && normalize(x.b) === normalize(r.b) && normalize(x.relation) === normalize(r.relation));
      if (!dup) this.state.relationships.push(r);
    }
  }

  addUnresolved(refs: UnresolvedReference[]): void {
    for (const r of refs) this.state.unresolvedReferences.push(r);
    if (this.state.unresolvedReferences.length > 20) this.state.unresolvedReferences.splice(0, this.state.unresolvedReferences.length - 20);
  }

  recordMessage(m: Message): void {
    const list = this.state.recentMessages;
    const i = list.findIndex((x) => x.id === m.id);
    if (i >= 0) list[i] = m; else list.push(m);
    if (list.length > MAX_RECENT) list.splice(0, list.length - MAX_RECENT);
    if (m.status === 'translated') {
      this.state.currentSpeaker = m.speakerId;
      this.state.languageHistory.push({ speakerId: m.speakerId, language: m.language, at: m.timestamp });
      if (this.state.languageHistory.length > MAX_LANG_HISTORY) this.state.languageHistory.shift();
    }
  }

  promptContext(): PromptContext {
    const s = this.state;
    const byKind = (k: FactKind) => s.facts.filter((f) => f.kind === k).map((f) => f.text);
    return {
      speakers: [s.speakers.user, s.speakers.partner].map((p) => ({ id: p.id, language: p.language, name: p.name, gender: p.gender })),
      selectedLanguages: s.selectedLanguages,
      currentSpeaker: s.currentSpeaker,
      confirmedFacts: byKind('confirmed'),
      inferences: byKind('inference'),
      uncertain: byKind('uncertain'),
      entities: s.entities,
      relationships: s.relationships,
      recent: s.recentMessages.filter((m) => m.status === 'translated').slice(-8)
        .map((m) => ({ speaker: m.speakerId, language: m.language, original: m.originalText, translation: m.translatedText })),
      unresolved: s.unresolvedReferences.slice(-5),
      languageHistory: s.languageHistory.slice(-5).map((h) => ({ speaker: h.speakerId, language: h.language })),
    };
  }

  serialize(): string { return JSON.stringify(this.state); }
  static restore(json: string): ContextEngine | null {
    try { const s = JSON.parse(json) as ConversationContext; return s?.conversationId && s.speakers ? new ContextEngine(s) : null; } catch { return null; }
  }
}
