import { bytesToBase64 } from '../audio.ts';
import type { Api } from './api.ts';
import { ApiError } from './api.ts';

// Стриминг микрофона в Gemini Live (gemini-3.8-live) через одноразовый токен: API-ключа в браузере нет.
// Live используется как «уши»: транскрипт входящей речи. Аудио-ответы модели игнорируются.
export class LiveTranscriber {
  private ws: WebSocket | null = null;
  private pending = '';
  private ready = false;
  onClose: () => void = () => {};
  onText: (t: string) => void = () => {};

  private api: Api;
  constructor(api: Api) { this.api = api; }

  get isOpen(): boolean { return this.ready && this.ws?.readyState === WebSocket.OPEN; }

  async connect(): Promise<void> {
    const info = await this.api.liveToken();
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = (err?: Error) => { if (settled) return; settled = true; clearTimeout(timer); err ? reject(err) : resolve(); };
      const timer = setTimeout(() => { this.close(); done(new ApiError('network', 'Live API connect timeout')); }, 12000);
      const ws = (this.ws = new WebSocket(`${info.wsUrl}?access_token=${encodeURIComponent(info.token)}`));
      ws.onopen = () => ws.send(JSON.stringify(info.setup));
      ws.onerror = () => done(new ApiError('network', 'Live API connection failed'));
      ws.onclose = () => { const was = this.ready; this.ready = false; if (!settled) done(new ApiError('network', 'Live API closed')); else if (was) this.onClose(); };
      ws.onmessage = async (ev) => {
        let raw: string;
        try { raw = typeof ev.data === 'string' ? ev.data : await (ev.data as Blob).text(); } catch { return; }
        let msg: { setupComplete?: unknown; serverContent?: { inputTranscription?: { text?: string } } };
        try { msg = JSON.parse(raw); } catch { return; }
        if (msg.setupComplete !== undefined && !this.ready) { this.ready = true; done(); return; }
        const t = msg.serverContent?.inputTranscription?.text;
        if (t) { this.pending += t; this.onText(this.pending); }
      };
    });
  }

  sendAudio(pcm16: Int16Array): void {
    if (!this.isOpen) return;
    this.ws!.send(JSON.stringify({ realtimeInput: { audio: { data: bytesToBase64(new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength)), mimeType: 'audio/pcm;rate=16000' } } }));
  }

  flush(): void { if (this.isOpen) this.ws!.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } })); }
  clear(): void { this.pending = ''; }
  take(): string { const t = this.pending.trim(); this.pending = ''; return t; }
  close(): void { this.ready = false; try { this.ws?.close(); } catch { /* */ } this.ws = null; }
}
