import type { LanguageCode } from './types.ts';

export interface LanguageInfo { code: LanguageCode; bcp: string; english: string; consent: string; }

// Обязательные фразы согласия для Voice replication (дословно из документации Gemini API).
export const LANGUAGES: LanguageInfo[] = [
  { code: 'ru', bcp: 'ru-RU', english: 'Russian', consent: 'Я являюсь владельцем этого голоса и даю согласие Google на использование этого голоса для создания модели синтетического голоса.' },
  { code: 'zh', bcp: 'zh-CN', english: 'Chinese (Simplified)', consent: '我是此声音的拥有者并授权谷歌使用此声音创建语音合成模型' },
  { code: 'en', bcp: 'en-US', english: 'English', consent: 'I am the owner of this voice and I consent to Google using this voice to create a synthetic voice model.' },
  { code: 'es', bcp: 'es-ES', english: 'Spanish', consent: 'Soy el propietario de esta voz y doy mi consentimiento para que Google la utilice para crear un modelo de voz sintética.' },
  { code: 'fr', bcp: 'fr-FR', english: 'French', consent: "Je suis le propriétaire de cette voix et j'autorise Google à utiliser cette voix pour créer un modèle de voix synthétique." },
  { code: 'de', bcp: 'de-DE', english: 'German', consent: 'Ich bin der Eigentümer dieser Stimme und bin damit einverstanden, dass Google diese Stimme zur Erstellung eines synthetischen Stimmmodells verwendet.' },
  { code: 'ja', bcp: 'ja-JP', english: 'Japanese', consent: '私はこの音声の所有者であり、Googleがこの音声を使用して音声合成モデルを作成することを承認します。' },
  { code: 'ko', bcp: 'ko-KR', english: 'Korean', consent: '나는 이 음성의 소유자이며 구글이 이 음성을 사용하여 음성 합성 모델을 생성할 것을 허용합니다.' },
  { code: 'ar', bcp: 'ar-XA', english: 'Arabic', consent: 'أنا مالك هذا الصوت وأوافق على أن تستخدم Google هذا الصوت لإنشاء نموذج صوتي اصطناعي.' },
  { code: 'pl', bcp: 'pl-PL', english: 'Polish', consent: 'Jestem właścicielem tego głosu i wyrażam zgodę na wykorzystanie go przez Google w celu utworzenia syntetycznego modelu głosu.' },
];

export const LANGUAGE_CODES: LanguageCode[] = LANGUAGES.map((l) => l.code);
export const isLanguageCode = (v: unknown): v is LanguageCode =>
  typeof v === 'string' && (LANGUAGE_CODES as string[]).includes(v);
export const languageInfo = (c: LanguageCode): LanguageInfo => LANGUAGES.find((l) => l.code === c)!;

// Выбор языка среди выбранных пользователем: язык вне списка никогда не принимается.
export function restrictToSelected(
  probs: Partial<Record<string, number>>,
  selected: LanguageCode[],
): { language: LanguageCode; confidence: number } | null {
  let best: { language: LanguageCode; confidence: number } | null = null;
  for (const code of selected) {
    const p = Number(probs[code] ?? 0);
    if (!best || p > best.confidence) best = { language: code, confidence: p };
  }
  return best && best.confidence > 0 ? best : null;
}
