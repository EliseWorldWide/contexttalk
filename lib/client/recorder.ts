import { bytesToBase64, pcm16ToWav, floatTo16, resample } from '../audio.ts';
import { MicCapture } from './capture.ts';

// Запись образца голоса и фразы согласия. Один и тот же микрофонный поток на оба шага:
// Google сверяет голос образца и согласия, поэтому запись должна идти подряд в одних условиях.
export class VoiceRecorder {
  private cap = new MicCapture();
  private chunks: Float32Array[] | null = null;
  private rate = 48000;
  onLevel: (rms: number, seconds: number) => void = () => {};
  private seconds = 0;

  async open(): Promise<void> {
    this.cap.onFrame = (f) => {
      this.rate = f.sampleRate;
      if (this.chunks) { this.chunks.push(f.float); this.seconds += f.dtMs / 1000; }
      this.onLevel(f.rms, this.seconds);
    };
    await this.cap.start();
  }

  startSegment(): void { this.chunks = []; this.seconds = 0; }

  stopSegment(): { wavBase64: string; seconds: number } {
    const chunks = this.chunks ?? []; this.chunks = null;
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const all = new Float32Array(total);
    let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
    const pcm = floatTo16(resample(all, this.rate, 24000)); // 24 кГц mono 16-bit WAV — формат, рекомендованный Gemini
    return { wavBase64: bytesToBase64(pcm16ToWav(pcm, 24000)), seconds: pcm.length / 24000 };
  }

  close(): void { this.chunks = null; this.cap.stop(); }
}
