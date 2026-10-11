// Voice Activity Detection по энергии сигнала. Чистая логика без DOM: легко тестируется.
export interface VadConfig {
  threshold: number;      // порог «голос» (RMS 0..1)
  bargeInThreshold: number; // порог, пока говорит AI (выше, чтобы не ловить собственное эхо)
  minSpeechMs: number;    // сколько нужно голоса подряд, чтобы считать началом речи
  hangoverMs: number;     // пауза, после которой реплика считается законченной (1–2 с, не режет человека рано)
  bargeInMinMs: number;   // сколько голоса подряд нужно, чтобы перебить AI
}
export type VadEvent = 'speech_start' | 'speech_end' | 'barge_in' | null;

export const DEFAULT_VAD: VadConfig = { threshold: 0.02, bargeInThreshold: 0.06, minSpeechMs: 160, hangoverMs: 1400, bargeInMinMs: 240 };

export class Vad {
  cfg: VadConfig;
  inSpeech = false;
  private loudMs = 0;
  private silenceMs = 0;
  private noise = 0.005; // оценка фонового шума

  constructor(cfg: Partial<VadConfig> = {}) { this.cfg = { ...DEFAULT_VAD, ...cfg }; }

  reset(): void { this.inSpeech = false; this.loudMs = 0; this.silenceMs = 0; }

  process(rms: number, dtMs: number, speaking = false): VadEvent {
    if (speaking && !this.inSpeech) {
      // Пока AI говорит, реагируем только на заметно более громкий и достаточно долгий голос.
      if (rms >= Math.max(this.cfg.bargeInThreshold, this.noise * 4)) {
        this.loudMs += dtMs;
        if (this.loudMs >= this.cfg.bargeInMinMs) { this.inSpeech = true; this.silenceMs = 0; return 'barge_in'; }
      } else this.loudMs = 0;
      return null;
    }
    const thr = Math.max(this.cfg.threshold, this.noise * 2.5);
    const loud = rms >= thr;
    if (!this.inSpeech) {
      if (loud) {
        this.loudMs += dtMs;
        if (this.loudMs >= this.cfg.minSpeechMs) { this.inSpeech = true; this.silenceMs = 0; return 'speech_start'; }
      } else {
        this.loudMs = 0;
        this.noise = this.noise * 0.95 + rms * 0.05;
      }
      return null;
    }
    if (loud) { this.silenceMs = 0; return null; }
    this.silenceMs += dtMs;
    if (this.silenceMs >= this.cfg.hangoverMs) { this.inSpeech = false; this.loudMs = 0; this.silenceMs = 0; return 'speech_end'; }
    return null;
  }
}
