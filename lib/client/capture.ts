import { floatTo16, resample } from '../audio.ts';

export type MicErrorCode = 'denied' | 'nodev' | 'busy' | 'insecure' | 'error';

// Стандартный getUserMedia. Никакой привязки к iframe/превью: только реальные ошибки браузера.
export function classifyMicError(e: unknown): MicErrorCode {
  const n = (e as { name?: string })?.name;
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return 'nodev';
  if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') return 'busy';
  if (n === 'NotAllowedError' || n === 'PermissionDeniedError' || n === 'SecurityError') return 'denied';
  return 'error';
}

export interface Frame { float: Float32Array; pcm16k: Int16Array; rms: number; dtMs: number; sampleRate: number }

export class MicCapture {
  ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  onFrame: (f: Frame) => void = () => {};

  async start(): Promise<void> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      const e = new Error('Insecure context or no mediaDevices'); e.name = 'InsecureContext'; throw e;
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    try {
      this.ctx = new AudioContext();
      await this.ctx.audioWorklet.addModule('/pcm-worklet.js');
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.node = new AudioWorkletNode(this.ctx, 'pcm-capture');
      this.node.port.onmessage = (ev: MessageEvent<Float32Array>) => {
        const float = ev.data;
        let sum = 0;
        for (let i = 0; i < float.length; i++) sum += float[i] * float[i];
        const rate = this.ctx!.sampleRate;
        this.onFrame({ float, pcm16k: floatTo16(resample(float, rate, 16000)), rms: Math.sqrt(sum / float.length), dtMs: (float.length / rate) * 1000, sampleRate: rate });
      };
      src.connect(this.node); // к destination не подключаем: собственный голос не воспроизводится
    } catch (e) { this.stop(); throw e; }
  }

  stop(): void {
    try { this.node?.disconnect(); } catch { /* */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    try { void this.ctx?.close(); } catch { /* */ }
    this.node = null; this.stream = null; this.ctx = null;
  }
}
