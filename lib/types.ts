// Общие типы ContextTalk. Только «стираемый» синтаксис TS (без enum и parameter properties),
// чтобы модули можно было тестировать через `node --test` без сборки.

export type LanguageCode = 'ru' | 'zh' | 'en' | 'es' | 'fr' | 'de' | 'ja' | 'ko' | 'ar' | 'pl';
export type SpeakerRole = 'user' | 'partner';
export type TranslationMode = 'natural' | 'literal' | 'contextual';
export type FactKind = 'confirmed' | 'inference' | 'uncertain';
export type ConsentStatus = 'none' | 'confirmed';

export type AppState =
  | 'idle' | 'listening' | 'processing' | 'understanding'
  | 'translating' | 'speaking' | 'interrupted' | 'error';

export interface Speaker {
  id: SpeakerRole;
  role: SpeakerRole;
  name?: string;
  language: LanguageCode;
  gender?: 'female' | 'male' | 'unknown';
  voiceId?: string; // voice_... (stateful) или voicekey_... (stateless)
}

export interface Fact {
  id: string;
  text: string;
  kind: FactKind;
  source: 'user_selection' | 'utterance' | 'model';
  messageId?: string;
  createdAt: number;
}

export interface Entity { name: string; type: 'person' | 'place' | 'thing' | 'event' | 'time'; gender?: 'female' | 'male' | 'unknown'; }
export interface Relationship { a: string; b: string; relation: string; kind: FactKind; }
export interface UnresolvedReference { reference: string; note: string; messageId?: string; }

export type MessageStatus = 'pending' | 'translated' | 'error';

export interface Message {
  id: string;
  speakerId: SpeakerRole;
  language: LanguageCode;
  targetLanguage: LanguageCode;
  originalText: string;
  translatedText: string;
  timestamp: number;
  confidence: number;
  status: MessageStatus;
  source: 'voice' | 'text';
}

export interface ConversationContext {
  conversationId: string;
  speakers: Record<SpeakerRole, Speaker>;
  selectedLanguages: LanguageCode[];
  currentSpeaker: SpeakerRole | null;
  facts: Fact[];
  entities: Entity[];
  relationships: Relationship[];
  recentMessages: Message[];
  unresolvedReferences: UnresolvedReference[];
  languageHistory: { speakerId: SpeakerRole; language: LanguageCode; at: number }[];
}

export interface Route {
  speakerId: SpeakerRole;
  targetSpeakerId: SpeakerRole;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  uncertain: boolean; // говорящий определён не однозначно
}

export interface ModelFact { text: string; kind: FactKind; evidence?: string; }

export interface TranslationResult {
  detectedLanguage: LanguageCode;
  languageProbabilities: Partial<Record<LanguageCode, number>>;
  confidence: number;
  transcript: string;        // проверенный транскрипт (в родной письменности)
  translation: string;
  targetLanguage: LanguageCode;
  route: Route;
  facts: ModelFact[];
  entities: Entity[];
  relationships: Relationship[];
  unresolved: UnresolvedReference[];
}

export interface PromptContext {
  speakers: { id: SpeakerRole; language: LanguageCode; name?: string; gender?: string }[];
  selectedLanguages: LanguageCode[];
  currentSpeaker: SpeakerRole | null;
  confirmedFacts: string[];
  inferences: string[];
  uncertain: string[];
  entities: Entity[];
  relationships: Relationship[];
  recent: { speaker: SpeakerRole; language: LanguageCode; original: string; translation: string }[];
  unresolved: UnresolvedReference[];
  languageHistory: { speaker: SpeakerRole; language: LanguageCode }[];
}

export interface VoiceProfile {
  role: SpeakerRole;
  voiceId: string;
  displayName: string;
  language: LanguageCode;
  createdAt: number;
  consentStatus: ConsentStatus;
  storage: 'stateful' | 'stateless';
}

export type ErrorCode =
  | 'not_configured' | 'auth' | 'rate_limited' | 'network' | 'upstream'
  | 'bad_request' | 'language_not_selected' | 'bad_model_output'
  | 'consent_required' | 'voice_rejected' | 'forbidden' | 'too_large' | 'unsupported';
