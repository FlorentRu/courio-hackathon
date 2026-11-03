// The headset's microphone, for answering a letter by voice.
//
// Records while the person speaks and hands back a small WAV file (mono, 16-bit, 16 kHz), the format
// Meta's speech model accepts. Nothing is recorded until the person presses "Answer by voice", the
// microphone is let go as soon as they finish or cancel, and the recording is never saved.
//
// Recording uses the browser's own recorder, which works inside the headset view. Live loudness (for the
// glowing microphone and for stopping by itself after a pause) needs sound processing that browsers only
// allow after a tap or click on the page, so it is switched on at the first tap (for example "Enter XR");
// without it the recording still works and the person presses Done.

const RATE = 16000;
const MAX_SECONDS = 60;
const BANDS = 24;

let live: AudioContext | null = null;
/** Sound processing for live loudness, switched on by the first tap or key press on the page. */
function unlock(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!live) live = new Ctx();
    if (live.state === 'suspended') live.resume().catch(() => {});
  } catch { /* loudness is a nicety */ }
}
if (typeof document !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown', 'touchend', 'click']) document.addEventListener(ev, unlock, { capture: true, passive: true });
}

const MIC_KEY = 'courio.mic.v1';
/** The microphone chosen on the sign-in card (empty: the browser's default). Kept on this device only. */
export function chosenMic(): string { try { return localStorage.getItem(MIC_KEY) || ''; } catch { return ''; } }
export function chooseMic(id: string): void { try { if (id) localStorage.setItem(MIC_KEY, id); else localStorage.removeItem(MIC_KEY); } catch { /* fine */ } }

/** The microphones this device has (names only appear once the microphone has been allowed). */
export async function listMics(): Promise<{ id: string; name: string }[]> {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    // "default" and "communications" are copies of a real microphone, already covered by "Default".
    // Names lose the USB code at the end ("Microphone (HyperX SoloCast) (0951:170f)").
    return all.filter((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'communications' && d.deviceId !== 'default')
      .map((d, i) => ({ id: d.deviceId, name: (d.label || `Microphone ${i + 1}`).replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/iu, '').replace(/^Microphone \((?:\d+- )?(.+)\)$/u, '$1') }));
  } catch { return []; }
}

function micConstraints(): MediaTrackConstraints {
  const id = chosenMic();
  return { ...(id ? { deviceId: { exact: id } } : {}), channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true };
}

/**
 * Listens to the chosen microphone for a few seconds so the person can see it hears them, calling
 * `onLevel` with the loudness (0 to 1) many times a second. Returns a function that stops it.
 */
export async function testMic(onLevel: (v: number) => void): Promise<() => void> {
  unlock();
  let stream: MediaStream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: micConstraints() }); }
  catch { chooseMic(''); stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  const ctx = live;
  let stop = false;
  let raf = 0;
  if (ctx) {
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    const tick = () => {
      if (stop) return;
      an.getFloatTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
      onLevel(Math.min(1, peak * 3));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { stop = true; cancelAnimationFrame(raf); try { src.disconnect(); } catch { /* gone */ } stream.getTracks().forEach((t) => t.stop()); };
  }
  return () => { stream.getTracks().forEach((t) => t.stop()); };
}

/** Asks for the microphone once, ahead of time, so the question does not pop up in the middle of a reply. */
export async function allowMicrophone(): Promise<boolean> {
  unlock();
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return true;
  } catch { return false; }
}

export class Recorder {
  private stream: MediaStream | null = null;
  private media: MediaRecorder | null = null;
  private parts: Blob[] = [];
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freq = new Uint8Array(128);
  private started = 0;
  private spoken = 0;
  private quiet = 0;
  /** How loud the person is right now, 0 to 1. */
  level = 0;
  /** True while live loudness is available (otherwise the person presses Done). */
  get hearing(): boolean { return !!this.analyser && live?.state === 'running'; }
  /** Called once when the person has spoken and then paused, or after a minute. */
  onFinished: (() => void) | null = null;

  get recording(): boolean { return !!this.media; }

  async start(): Promise<void> {
    this.cancel();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot use the microphone.');
    if (typeof MediaRecorder === 'undefined') throw new Error('This browser cannot record sound.');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: micConstraints() });
    } catch {
      // The chosen microphone may have been unplugged: fall back to the default one.
      try { chooseMic(''); stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch { throw new Error('Allow the microphone, then try again'); }
    }
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    const type = types.find((t) => MediaRecorder.isTypeSupported?.(t));
    const media = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
    this.parts = [];
    media.ondataavailable = (e) => { if (e.data && e.data.size) this.parts.push(e.data); };
    media.start(250);
    this.stream = stream; this.media = media;
    this.started = performance.now(); this.spoken = 0; this.quiet = 0; this.level = 0;
    try {
      if (live && live.state === 'running') {
        this.source = live.createMediaStreamSource(stream);
        this.analyser = live.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.55;
        this.source.connect(this.analyser);
      }
    } catch { this.analyser = null; }
  }

  /**
   * Fills `out` with how loud each pitch band is (0 to 1), low to high, and keeps track of pauses.
   * Returns false when live loudness is not available.
   */
  bands(out: Float32Array, dt: number): boolean {
    if (!this.media) return false;
    if ((performance.now() - this.started) / 1000 > MAX_SECONDS) { this.finish(); return false; }
    if (!this.hearing || !this.analyser) return false;
    this.analyser.getByteFrequencyData(this.freq);
    const n = out.length;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      // Voices live below about 4.5 kHz; spread those bands across the bars.
      const at = Math.min(this.freq.length - 1, 1 + Math.floor((i / n) * 24));
      const v = Math.min(1, Math.max(0, (this.freq[at] - 70) / 150));
      out[i] = v;
      sum += v;
    }
    this.level = this.level * 0.5 + (sum / n) * 0.5;
    if (this.level > 0.14) { this.spoken += dt; this.quiet = 0; } else this.quiet += dt;
    // Once they have said something, a pause of a little over two seconds means they have finished.
    if (this.spoken > 0.6 && this.quiet > 2.2) this.finish();
    return true;
  }

  private finish(): void {
    const f = this.onFinished;
    this.onFinished = null;
    f?.();
  }

  /** How loud the last recording was at its loudest, 0 to 1 (close to 0 means the microphone sent silence). */
  peak = 0;

  /** Stops and returns the recording as a WAV file, or null if almost nothing was said. */
  async stop(): Promise<Blob | null> {
    const media = this.media;
    if (!media) { this.release(); return null; }
    const done = new Promise<void>((ok) => { media.onstop = () => ok(); });
    try { media.requestData(); } catch { /* nothing buffered */ }
    try { media.stop(); } catch { /* already stopped */ }
    await Promise.race([done, new Promise((ok) => setTimeout(ok, 1500))]);
    const parts = this.parts;
    this.release();
    if (!parts.length) return null;
    const blob = new Blob(parts, { type: parts[0].type || 'audio/webm' });
    try {
      const out = await toWav(blob);
      this.peak = out ? out.peak : 0;
      return out ? out.wav : null;
    } catch {
      throw new Error("I couldn't read that recording. Try again?");
    }
  }

  cancel(): void { this.release(); }

  private release(): void {
    this.onFinished = null;
    try { this.source?.disconnect(); } catch { /* already gone */ }
    if (this.media) { this.media.ondataavailable = null; try { if (this.media.state !== 'inactive') this.media.stop(); } catch { /* fine */ } }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null; this.media = null; this.source = null; this.analyser = null;
    this.parts = []; this.level = 0;
  }
}

/** Decodes a recording and turns it into a 16 kHz mono WAV file. Offline processing needs no tap. */
async function toWav(blob: Blob): Promise<{ wav: Blob; peak: number } | null> {
  const bytes = await blob.arrayBuffer();
  const Off = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const decoded = await new Off(1, 1, 48000).decodeAudioData(bytes);
  if (decoded.duration < 0.4) return null;
  const frames = Math.ceil(decoded.duration * RATE);
  const off = new Off(1, frames, RATE);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  const samples = rendered.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < samples.length; i += 4) { const a = Math.abs(samples[i]); if (a > peak) peak = a; }
  return { wav: wav(samples, RATE), peak };
}

/** A mono 16-bit PCM WAV file. */
export function wav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

export { BANDS };
