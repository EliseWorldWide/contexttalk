import { parseWav, base64ToBytes } from '../audio.ts';
import type { AIProvider } from '../ai/provider.ts';
import { AIError } from '../errors.ts';
import type { ConsentStatus, LanguageCode, Speaker, SpeakerRole, VoiceProfile } from '../types.ts';

// Голоса по умолчанию, пока клонированный профиль не создан: у сторон разные голоса, а не один общий.
export const PREBUILT_DEFAULTS: Record<SpeakerRole, string> = { user: 'Kore', partner: 'Puck' };
export const REFERENCE_SECONDS = { min: 10, max: 30 };
export const CONSENT_MAX_SECONDS = 20;

// Перевод озвучивается голосом того, кому принадлежит целевой язык (targetRole).
export function selectVoice(
  targetRole: SpeakerRole,
  speakers: Record<SpeakerRole, Pick<Speaker, 'voiceId'>>,
  defaults: Record<SpeakerRole, string> = PREBUILT_DEFAULTS,
): { voice: string; replicated: boolean } {
  const id = speakers[targetRole]?.voiceId;
  return id ? { voice: id, replicated: true } : { voice: defaults[targetRole], replicated: false };
}

export interface CreateProfileInput {
  role: SpeakerRole;
  language: LanguageCode;
  displayName: string;
  referenceWavBase64: string;
  consentWavBase64: string;
  consentConfirmed: boolean;
  store?: boolean; // true — Google хранит профиль (1 год); false — ключ хранится только у клиента (7 дней)
}

// VoiceService не знает про UI. Исходные записи существуют только на время вызова и нигде не сохраняются.
export class VoiceService {
  private provider: AIProvider;
  constructor(provider: AIProvider) { this.provider = provider; }

  async createVoiceProfile(input: CreateProfileInput, signal?: AbortSignal): Promise<VoiceProfile> {
    if (input.consentConfirmed !== true) throw new AIError('consent_required', 'Consent must be confirmed', 400);
    const ref = parseWav(base64ToBytes(input.referenceWavBase64));
    const consent = parseWav(base64ToBytes(input.consentWavBase64));
    if (!ref || !consent) throw new AIError('bad_request', 'Audio must be WAV', 400);
    if (ref.seconds < REFERENCE_SECONDS.min - 0.5 || ref.seconds > REFERENCE_SECONDS.max + 1) {
      throw new AIError('bad_request', `Reference audio must be ${REFERENCE_SECONDS.min}-${REFERENCE_SECONDS.max} s`, 400);
    }
    if (consent.seconds < 2 || consent.seconds > CONSENT_MAX_SECONDS) throw new AIError('bad_request', 'Consent audio has unexpected length', 400);
    const store = input.store !== false;
    const v = await this.provider.createVoice({
      displayName: input.displayName.slice(0, 60) || input.role,
      referenceWavBase64: input.referenceWavBase64,
      consentWavBase64: input.consentWavBase64,
      store,
    }, signal);
    const consentStatus: ConsentStatus = 'confirmed';
    return { role: input.role, voiceId: v.id, displayName: input.displayName, language: input.language, createdAt: Date.now(), consentStatus, storage: store ? 'stateful' : 'stateless' };
  }

  async deleteVoiceProfile(profile: Pick<VoiceProfile, 'voiceId' | 'storage'>, signal?: AbortSignal): Promise<void> {
    // Stateless-ключ на сервере Google не хранится: достаточно забыть его на клиенте.
    if (profile.storage === 'stateful') await this.provider.deleteVoice(profile.voiceId, signal);
  }

  getVoiceProfile(voiceId: string, signal?: AbortSignal) { return this.provider.getVoice(voiceId, signal); }

  async synthesize(input: { text: string; language: LanguageCode; targetRole: SpeakerRole; speakers: Record<SpeakerRole, Pick<Speaker, 'voiceId'>>; style?: string }, signal?: AbortSignal) {
    const { voice } = selectVoice(input.targetRole, input.speakers);
    return this.provider.synthesizeSpeech({ text: input.text, voice, language: input.language, style: input.style }, signal);
  }
}
