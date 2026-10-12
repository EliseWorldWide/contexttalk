import { ContextEngine } from '../context/engine.ts';
import { pcm16ToWav, bytesToBase64 } from '../audio.ts';
import { splitSentences } from '../text.ts';
import type { AppState, Message, SpeakerRole, TranslationMode, LanguageCode } from '../types.ts';
import { api as defaultApi, ApiError } from './api.ts';
import type { Api } from './api.ts';
import { classifyMicError, MicCapture } from './capture.ts';
import { LiveTranscriber } from './live.ts';
import { AudioPlayer } from './player.ts';
import { Vad } from './vad.ts';

export interface ControllerEvents {
  state(s: AppState, detail?: string): void;
  message(m: Message): void;
  level(l: number): void;
  partial(text: string): void;
  error(e: { code: string; message: string; retry?: () => void }): void; // блокирующая ошибка (баннер)
  notice(code: string, message: string): void; // неблокирующее уведомление (например, озвучка не сработала)
  context(): void; // контекст изменился (нужно сохранить)
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const GRACE_MS = 600;       // ждём последние куски транскрипта после конца реплики
const MAX_UTTERANCE_S = 30;
const PREROLL_FRAMES = 8;   // ~400 мс до начала речи

// Оркестратор разговора. Ничего не знает про DOM: UI подписывается на события.
// Текст и голос идут через один и тот же processUtterance → Context Engine → перевод (Gemini) → озвучка.
export class ConversationController {
  engine: ContextEngine;
  state: AppState = 'idle';
  mode: TranslationMode = 'contextual';
  private ev: ControllerEvents;
  private api: Api;
  private capture = new MicCapture();
  private live: LiveTranscriber;
  private vad = new Vad();
  private player = new AudioPlayer();
  private listening = false;
  private busy = false;
  private queue: { text?: string; wav?: string; source: 'voice' | 'text' }[] = [];
  private preroll: Int16Array[] = [];
  private utter: Int16Array[] | null = null;
  private utterSamples = 0;
  private run = 0;
  private reconnecting = false;

  constructor(engine: ContextEngine, events: ControllerEvents, api: Api = defaultApi) {
    this.engine = engine; this.ev = events; this.api = api;
    this.live = new LiveTranscriber(api);
    this.live.onText = (t) => this.ev.partial(t);
    this.live.onClose = () => { if (this.listening) void this.reconnectLive(); };
  }

  private set(s: AppState, detail?: string) { this.state = s; this.ev.state(s, detail); }

  // Вызывать из жеста пользователя: запрашивает микрофон и открывает Live-сессию.
  async start(): Promise<void> {
    if (this.listening) return;
    await this.player.unlock();
    this.capture.onFrame = (f) => this.onFrame(f);
    try { await this.capture.start(); }
    catch (e) { return this.fail(e instanceof Error && e.name === 'InsecureContext' ? 'insecure' : classifyMicError(e), () => void this.start()); }
    this.listening = true; this.vad.reset();
    this.set('listening');
    try { await this.live.connect(); }
    catch (e) {
      // Live недоступен: продолжаем «на слух» — аудио реплики уйдёт в Gemini напрямую (без транскрипта от Live).
      this.ev.notice(e instanceof ApiError ? e.code : 'network', e instanceof ApiError ? e.message : 'Live API недоступен');
    }
  }

  stop(): void {
    this.listening = false; this.run++; this.queue = [];
    this.player.stop(); this.live.close(); this.capture.stop();
    this.utter = null; this.preroll = []; this.vad.reset();
    this.ev.level(0); this.set('idle');
  }

  get isListening(): boolean { return this.listening; }

  private async reconnectLive(): Promise<void> {
    if (this.reconnecting) return;
    this.reconnecting = true;
    try { await this.live.connect(); } catch { /* останемся на аудио-режиме */ } finally { this.reconnecting = false; }
  }

  private onFrame(f: { pcm16k: Int16Array; rms: number; dtMs: number }): void {
    this.ev.level(this.state === 'listening' ? Math.min(1, f.rms * 12) : 0);
    this.live.sendAudio(f.pcm16k);
    const speaking = this.state === 'speaking';
    const e = this.vad.process(f.rms, f.dtMs, speaking);
    if (this.utter) {
      this.utter.push(f.pcm16k); this.utterSamples += f.pcm16k.length;
      if (this.utterSamples > 16000 * MAX_UTTERANCE_S) this.utter.shift();
    } else {
      this.preroll.push(f.pcm16k);
      if (this.preroll.length > PREROLL_FRAMES) this.preroll.shift();
    }
    if (e === 'barge_in') { this.interrupt(); this.beginUtterance(); }
    else if (e === 'speech_start') this.beginUtterance();
    else if (e === 'speech_end') void this.endUtterance();
  }

  private beginUtterance(): void {
    this.utter = [...this.preroll]; this.utterSamples = this.utter.reduce((n, c) => n + c.length, 0);
    this.preroll = []; this.live.clear();
  }

  private async endUtterance(): Promise<void> {
    const chunks = this.utter; this.utter = null;
    this.live.flush();
    await new Promise((r) => setTimeout(r, GRACE_MS));
    const text = this.live.take();
    if (!chunks || !chunks.length) return;
    const pcm = new Int16Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0; for (const c of chunks) { pcm.set(c, o); o += c.length; }
    // Слишком короткие звуки (кашель, щелчок) без текста игнорируем.
    if (!text && pcm.length < 16000 * 0.6) return;
    const wav = bytesToBase64(pcm16ToWav(pcm, 16000));
    this.submit({ text: text || undefined, wav, source: 'voice' });
  }

  // Перебивание: озвучка обрывается сразу, идём слушать новую реплику.
  interrupt(): void {
    this.run++;
    this.player.stop();
    this.set('interrupted');
    setTimeout(() => { if (this.state === 'interrupted') this.set(this.listening ? 'listening' : 'idle'); }, 250);
  }

  async submitText(text: string): Promise<void> {
    const t = text.trim();
    if (!t) return;
    await this.player.unlock();
    if (this.state === 'speaking') this.interrupt();
    this.submit({ text: t, source: 'text' });
  }

  private submit(u: { text?: string; wav?: string; source: 'voice' | 'text' }): void {
    this.queue.push(u);
    if (!this.busy) void this.drain();
  }

  private async drain(): Promise<void> {
    this.busy = true;
    try { for (let u = this.queue.shift(); u; u = this.queue.shift()) await this.processUtterance(u); }
    finally { this.busy = false; }
  }

  private idleState(): AppState { return this.listening ? 'listening' : 'idle'; }

  private async processUtterance(u: { text?: string; wav?: string; source: 'voice' | 'text' }, again?: Message): Promise<void> {
    const run = ++this.run;
    const user = this.engine.state.speakers.user;
    const msg: Message = again ?? {
      id: uid(), speakerId: 'user', language: user.language, targetLanguage: this.engine.state.speakers.partner.language,
      originalText: u.text ?? '', translatedText: '', timestamp: Date.now(), confidence: 0, status: 'pending', source: u.source,
    };
    msg.status = 'pending'; this.ev.message({ ...msg });
    this.set('processing'); await new Promise((r) => setTimeout(r, 0));
    if (run !== this.run) return;
    this.set('understanding'); this.engine.promptContext();
    if (run !== this.run) return;
    this.set('translating');
    let r;
    try {
      r = await this.api.translate({ text: u.text, audio: u.wav ? { mime: 'audio/wav', data: u.wav } : undefined, context: this.engine.state, mode: this.mode, source: u.source });
    } catch (e) {
      if (run !== this.run) return;
      msg.status = 'error'; this.ev.message({ ...msg });
      const ae = e instanceof ApiError ? e : new ApiError('network', 'Не удалось подключиться к AI. Проверь интернет-соединение.');
      return this.fail(ae.code, () => { this.queue.unshift(u); void this.drainAgain(msg); }, ae.message);
    }
    if (run !== this.run) return;
    Object.assign(msg, {
      speakerId: r.route.speakerId, language: r.detectedLanguage, targetLanguage: r.targetLanguage,
      originalText: r.transcript || u.text || '', translatedText: r.translation, confidence: r.confidence, status: 'translated',
    });
    this.engine.recordMessage({ ...msg });
    this.engine.acceptModelFacts(r.facts, msg.originalText, msg.id);
    this.engine.addEntities(r.entities); this.engine.addRelationships(r.relationships); this.engine.addUnresolved(r.unresolved);
    this.ev.message({ ...msg }); this.ev.context();

    // Озвучка голосом того, кому принадлежит целевой язык.
    const speakers = { user: { voiceId: this.engine.state.speakers.user.voiceId }, partner: { voiceId: this.engine.state.speakers.partner.voiceId } };
    const targetRole: SpeakerRole = r.route.targetSpeakerId;
    const segs = splitSentences(r.translation).map((text) => () => this.api.tts({ text, language: r.targetLanguage, targetRole, speakers }));
    this.set('speaking');
    try { await this.player.speak(segs); }
    catch (e) {
      // Ошибка озвучки не блокирует: перевод уже показан текстом.
      this.ev.notice('tts', (e instanceof ApiError ? `${e.code}${e.detail ? ': ' + e.detail : ''}` : String((e as Error)?.message ?? e)));
    }
    if (run !== this.run) return; // перебили
    this.set(this.idleState());
  }

  private async drainAgain(msg: Message): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try { const u = this.queue.shift(); if (u) await this.processUtterance(u, msg); for (let n = this.queue.shift(); n; n = this.queue.shift()) await this.processUtterance(n); }
    finally { this.busy = false; }
  }

  private fail(code: string, retry?: () => void, message?: string): void {
    this.listening = code === 'network' || code === 'upstream' || code === 'rate_limited' ? this.listening : false;
    if (!this.listening) { this.live.close(); this.capture.stop(); }
    this.set('error');
    this.ev.error({ code, message: message ?? code, retry });
  }

  // Повторное прослушивание перевода (озвучка тем же голосом, что и в разговоре).
  async replay(m: Message): Promise<void> {
    if (m.status !== 'translated') return;
    await this.player.unlock();
    if (this.state === 'speaking') this.interrupt();
    const speakers = { user: { voiceId: this.engine.state.speakers.user.voiceId }, partner: { voiceId: this.engine.state.speakers.partner.voiceId } };
    const targetRole: SpeakerRole = m.speakerId === 'user' ? 'partner' : 'user';
    const run = ++this.run;
    this.set('speaking');
    try { await this.player.speak(splitSentences(m.translatedText).map((text) => () => this.api.tts({ text, language: m.targetLanguage, targetRole, speakers }))); }
    catch (e) { this.ev.notice('tts', (e instanceof ApiError ? `${e.code}${e.detail ? ': ' + e.detail : ''}` : String((e as Error)?.message ?? e))); }
    if (run === this.run) this.set(this.idleState());
  }

  // «Add to context»: фрагмент, который пользователь сам отметил важным, — CONFIRMED.
  // Структуру (сущности, отношения) достраивает Gemini, но только из явно сказанного.
  async addToContext(text: string): Promise<'ok' | 'partial'> {
    this.engine.addConfirmedByUser(text);
    this.ev.context();
    try {
      const r = await this.api.extractContext(text, this.engine.state);
      this.engine.acceptModelFacts(r.facts, text);
      this.engine.addEntities(r.entities); this.engine.addRelationships(r.relationships);
      this.ev.context();
      return 'ok';
    } catch { return 'partial'; }
  }

  setMode(m: TranslationMode): void { this.mode = m; }
  setLanguages(user: LanguageCode, partner: LanguageCode, selected?: LanguageCode[]): void { this.engine.setLanguages(user, partner, selected); this.ev.context(); }
  setVoice(role: SpeakerRole, voiceId?: string): void { this.engine.setVoice(role, voiceId); this.ev.context(); }
  newConversation(): void { this.engine.reset(); this.ev.context(); }
}
