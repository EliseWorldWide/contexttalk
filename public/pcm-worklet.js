// AudioWorklet: собирает кадры микрофона (~50 мс) и отдаёт их основному потоку.
class PCMCapture extends AudioWorkletProcessor {
  constructor() { super(); this.parts = []; this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    this.parts.push(new Float32Array(ch));
    this.n += ch.length;
    if (this.n >= sampleRate * 0.05) {
      const out = new Float32Array(this.n);
      let o = 0;
      for (const p of this.parts) { out.set(p, o); o += p.length; }
      this.port.postMessage(out, [out.buffer]);
      this.parts = []; this.n = 0;
    }
    return true;
  }
}
registerProcessor('pcm-capture', PCMCapture);
