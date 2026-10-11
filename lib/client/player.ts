// Воспроизведение озвучки по сегментам: следующий сегмент готовится, пока играет текущий.
// stop() обрывает звук немедленно (перебивание).
export class AudioPlayer {
  private ctx: AudioContext | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private run = 0;

  // Вызывать из пользовательского жеста (клик/нажатие), иначе браузер не даст играть звук.
  async unlock(): Promise<void> {
    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  get playing(): boolean { return this.sources.size > 0; }

  async speak(segments: (() => Promise<ArrayBuffer>)[], onFirstAudio?: () => void): Promise<'done' | 'stopped'> {
    await this.unlock();
    const run = ++this.run;
    const ctx = this.ctx!;
    let next: Promise<AudioBuffer> | null = null;
    const load = (i: number) => segments[i]().then((b) => ctx.decodeAudioData(b));
    if (segments.length) next = load(0);
    for (let i = 0; i < segments.length; i++) {
      const buf = await next!;
      if (run !== this.run) return 'stopped';
      next = i + 1 < segments.length ? load(i + 1) : null;
      next?.catch(() => {}); // ошибка следующего сегмента всплывёт на его await
      if (i === 0) onFirstAudio?.();
      await new Promise<void>((resolve) => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        this.sources.add(src);
        src.onended = () => { this.sources.delete(src); resolve(); };
        src.start();
      });
      if (run !== this.run) return 'stopped';
    }
    return 'done';
  }

  stop(): void {
    this.run++;
    for (const s of this.sources) { try { s.stop(); } catch { /* */ } }
    this.sources.clear();
  }
}
