import type {
  ConversationContext, Entity, LanguageCode, ModelFact, Relationship, TranslationMode, TranslationResult,
} from '../types.ts';

export interface AudioInput { mime: string; data: string } // data = base64

export interface TranslateRequest {
  text?: string;
  audio?: AudioInput; // аудио только текущей реплики (не вся беседа)
  context: ConversationContext;
  mode: TranslationMode;
  source: 'voice' | 'text';
}

export interface DetectRequest { text?: string; audio?: AudioInput; selectedLanguages: LanguageCode[]; previousLanguage?: LanguageCode }
export interface DetectResult { language: LanguageCode; probabilities: Partial<Record<LanguageCode, number>>; confidence: number }

export interface ProcessContextRequest { text: string; context: ConversationContext }
export interface ProcessContextResult { facts: ModelFact[]; entities: Entity[]; relationships: Relationship[] }

export interface RealtimeSessionInfo {
  token: string; // временный токен (не API-ключ)
  model: string;
  wsUrl: string;
  setup: Record<string, unknown>;
  expiresAt: string;
}

export interface SynthesizeRequest { text: string; voice: string; language: LanguageCode; style?: string }
export interface SynthesizedAudio { mimeType: string; data: string } // base64, WAV

export interface CreateVoiceRequest { displayName: string; referenceWavBase64: string; consentWavBase64: string; store: boolean }
export interface VoiceInfo { id: string; displayName?: string; type?: string; key?: string; createdAt?: string }

// Единая граница между приложением и AI. UI, Context Engine, история и голосовые профили
// от провайдера не зависят: чтобы добавить OpenAI, нужно написать только OpenAIProvider.
export interface AIProvider {
  readonly name: string;
  translate(req: TranslateRequest, signal?: AbortSignal): Promise<TranslationResult>;
  detectLanguage(req: DetectRequest, signal?: AbortSignal): Promise<DetectResult>;
  processContext(req: ProcessContextRequest, signal?: AbortSignal): Promise<ProcessContextResult>;
  realtimeSession(): Promise<RealtimeSessionInfo>;
  synthesizeSpeech(req: SynthesizeRequest, signal?: AbortSignal): Promise<SynthesizedAudio>;
  createVoice(req: CreateVoiceRequest, signal?: AbortSignal): Promise<VoiceInfo>;
  getVoice(id: string, signal?: AbortSignal): Promise<VoiceInfo>;
  deleteVoice(id: string, signal?: AbortSignal): Promise<void>;
}
