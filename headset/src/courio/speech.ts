// The companion reads letters aloud, with the device's own speech voices (the browser's speechSynthesis;
// Meta's models have no text-to-speech). Nothing leaves the headset.
//
// - The most natural voice the device has is used: "Natural" / "Online" / "Neural" voices first (as in
//   Microsoft Edge), then Google's, then the older built-in ones. A voice chosen on the sign-in card wins.
// - Each sentence is read in its own language (English, French or Spanish) by a native voice, so a
//   French line in an English letter sounds French.
// - Each companion sounds a little like itself: a gentle pitch and speed for its kind (strong changes
//   make voices sound robotic), and the sender's name picks among the best voices, so the same friend
//   always sounds the same.
import { Companion } from './model.js';

/** What a companion sounds like. "auto" works it out from the companion's look. */
export type VoiceKind = 'little' | 'bright' | 'warm' | 'deep';
export const VOICE_KINDS: { id: VoiceKind; label: string }[] = [
  { id: 'little', label: 'Little one' },
  { id: 'bright', label: 'Bright' },
  { id: 'warm', label: 'Warm' },
  { id: 'deep', label: 'Deep' },
];

export type Voice = { pitch: number; rate: number; seed: number; kind: VoiceKind };

/**
 * The voice that fits a companion's look: dragons and stout, bearded folk sound deep or warm, small
 * ones like a child, slender, bright-eyed ones bright. Birds are a little higher and quicker.
 */
export function voiceKindOf(c: Companion): VoiceKind {
  if (c.kind === 3) return 'deep';
  if (c.kind === 0) {
    if (c.beard || c.build === 'stout') return 'deep';
    if (c.build === 'broad' || c.build === 'hero' || c.headType === 2) return 'warm';
    if (c.build === 'small') return 'little';
    return 'bright';
  }
  if (c.kind === 1) return 'bright';
  return c.crest || c.horn ? 'warm' : 'bright';
}

const VOICE_TONE: Record<VoiceKind, { pitch: number; rate: number }> = {
  little: { pitch: 1.04, rate: 1.0 },
  bright: { pitch: 1.04, rate: 1.0 },
  warm: { pitch: 0.98, rate: 0.98 },
  deep: { pitch: 0.82, rate: 0.93 },
};

/** The voice of a companion: what its look (or your choice) calls for, plus a little of its own from the sender's name. */
export function voiceFor(c: Companion, name: string, choice: 'auto' | VoiceKind = 'auto'): Voice {
  let h = 7;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const kind = choice === 'auto' ? voiceKindOf(c) : choice;
  const vary = ((h % 100) / 100 - 0.5) * 0.06;
  const bird = c.kind === 1 ? 0.06 : 0;
  const tone = VOICE_TONE[kind];
  return { pitch: tone.pitch + bird + vary, rate: tone.rate + bird * 0.5, seed: h, kind };
}

export const canSpeak =
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

// Which voices sound like what, from their names (Edge's natural voices, Windows, Google, Apple).
const SOUNDS: Record<VoiceKind, RegExp> = {
  little: /\b(ana|eloise|maisie|ivy|justin)\b/iu,
  bright: /\b(ava|emma|jenny|aria|michelle|sonia|libby|natasha|clara|ashley|cora|elizabeth|amber|nancy|sara|denise|vivienne|brigitte|celeste|coralie|josephine|yvette|elvira|abril|irene|laura|helena|ximena|zira|hazel|susan|samantha|karen|moira|tessa|amelie|marie|audrey|hortense|julie|paulina|monica|female)\b/iu,
  warm: /\b(andrew|brian|guy|christopher|eric|roger|steffan|ryan|thomas|william|liam|davis|tony|jason|henri|remy|alain|claude|jerome|maurice|yves|alvaro|dario|elias|jorge|pablo|raul|david|mark|george|daniel|alex|fred|paul|male)\b/iu,
  deep: /\b(christopher|guy|roger|davis|eric|brian|andrew|steffan|ryan|thomas|henri|alain|claude|alvaro|elias|jorge|david|mark|george|daniel|fred|male)\b/iu,
};

export const LANGS: { id: string; name: string; locale: string; sample: string }[] = [
  { id: 'en', name: 'English', locale: 'en-US', sample: "Hello! I'm your companion, and I'll read your letters to you." },
  { id: 'fr', name: 'French', locale: 'fr-FR', sample: 'Bonjour ! Je suis ton compagnon, et je te lirai tes lettres.' },
  { id: 'es', name: 'Spanish', locale: 'es-ES', sample: '¡Hola! Soy tu compañero y te leeré tus cartas.' },
];

const WORDS: Record<string, Set<string>> = {
  en: new Set(['the', 'and', 'i', 'you', 'is', 'not', 'a', 'an', 'to', 'for', 'with', 'my', 'very', 'thanks', 'thank', 'hello', 'hi', 'hey', 'of', 'in', 'it', 'we', 'this', 'that', 'are', 'be', 'see', 'can', 'your', 'so', 'dear', 'love', 'soon', "i'm", 'what', 'how', 'just', 'was', 'were', 'have', 'has', 'had', 'will', 'would', 'about', 'from', 'they', 'he', 'she', 'his', 'her', 'our', 'their', 'at', 'on', 'by', 'or', 'but', 'if', 'when', 'all', 'some', 'today', 'tomorrow', 'week', 'weekend', 'day', 'good', 'great', 'miss', 'hope', 'want', 'know', 'think', 'really', 'off', 'up', 'out', 'after', 'before', 'first', 'second', 'new', 'old', 'big', 'little', "it's", "don't", "can't", 'yes', 'okay', 'friend']),
  fr: new Set(['le', 'la', 'les', 'et', 'je', 'tu', 'vous', 'est', 'pas', 'une', 'des', 'que', 'pour', 'avec', 'mon', 'ma', 'très', 'merci', 'bonjour', 'salut', 'du', 'nous', 'ce', 'qui', 'dans', "c'est", "j'ai", 'au', 'mais', 'ton', 'ta', 'bisous', 'à', 'oui', 'bientôt', 'ça', 'suis', 'vais', 'aussi', 'beaucoup', 'toi', 'moi', 'cher', 'chère', 'bonne', 'journée', 'ici', 'comment', 'quoi', 'se', 'voit', 'samedi', 'dimanche', 'juste', 'dire', 'allez', 'voir', 'bien', 'tout', 'toujours', "aujourd'hui", 'demain', 'rien', 'chez', 'comme', 'quand', 'encore', 'peut', 'faire', 'fait', 'ami', 'amie', 'mec', 'poto', 'coucou', 'revoir', 'bises', 'te', 'me', 'lui', 'leur', 'sur', 'sans', 'cette', 'ces', 'sont', 'était', 'avoir', 'être']),
  es: new Set(['el', 'los', 'las', 'y', 'yo', 'tú', 'usted', 'es', 'no', 'una', 'para', 'con', 'mi', 'muy', 'gracias', 'hola', 'por', 'qué', 'está', 'estoy', 'pero', 'te', 'besos', 'querido', 'querida', 'pronto', 'cómo', 'sí']),
};

/** English, French or Spanish from the commonest little words (and accents), or '' if it cannot tell. */
function guess(text: string): string {
  const words = text.toLowerCase().match(/[a-zà-ÿñæœ']+/gu) || [];
  let best = '', score = 0;
  for (const [lang, set] of Object.entries(WORDS)) {
    const n = words.filter((w) => set.has(w)).length;
    if (n > score) { best = lang; score = n; }
  }
  if (best) return best;
  if (/[¿¡ñ]/u.test(text)) return 'es';
  if (/[àâçéèêëîïôûùœ]/iu.test(text)) return 'fr';
  return '';
}

/** The main language of a letter (English if it cannot tell and the device is not set to French or Spanish). */
export function langOf(text: string): string {
  const g = guess(text);
  if (g) return g;
  const own = ((typeof navigator !== 'undefined' && navigator.language) || 'en').slice(0, 2);
  return LANGS.some((l) => l.id === own) ? own : 'en';
}

// ---- Choosing a voice -----------------------------------------------------------------------------

const VOICE_KEY = 'courio.voice.v1';
export function chosenVoice(): string {
  try { return localStorage.getItem(VOICE_KEY) || ''; } catch { return ''; }
}
export function chooseVoice(uri: string): void {
  try { if (uri) localStorage.setItem(VOICE_KEY, uri); else localStorage.removeItem(VOICE_KEY); } catch { /* fine */ }
}

const langOfVoice = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-').slice(0, 2);

/** How natural a voice usually sounds (higher is better). */
export function rank(v: SpeechSynthesisVoice): number {
  const n = v.name;
  // Joke voices some computers have (Bubbles, Zarvox...) and very old engines.
  if (/\b(espeak|eloquence|novelty|bad news|bells|bubbles|boing|cellos|whisper|zarvox|trinoids|pipe organ|hysterical|jester|superstar|albert|bahh|wobble|good news|deranged|grandma|grandpa|rocko|shelley|flo|reed|sandy|eddy)\b/iu.test(n)) return -10;
  let r = 0;
  if (/natural/iu.test(n)) r += 6;
  else if (/neural|online/iu.test(n)) r += 5;
  else if (/premium|enhanced/iu.test(n)) r += 4;
  else if (/google/iu.test(n)) r += 3;
  if (!v.localService) r += 1;
  return r;
}

/** The device's voices for English, French and Spanish, most natural first. */
export function listVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak) return [];
  return window.speechSynthesis.getVoices()
    .filter((v) => LANGS.some((l) => l.id === langOfVoice(v)) && rank(v) > -10)
    .sort((a, b) => rank(b) - rank(a) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
}

/** Languages this device has no voice for (they would be read with a foreign accent). */
export function missingLanguages(): string[] {
  const have = new Set(listVoices().map(langOfVoice));
  return LANGS.filter((l) => !have.has(l.id)).map((l) => l.name);
}

/** Every voice on the device except joke voices, for any language. */
function allVoices(): SpeechSynthesisVoice[] {
  return canSpeak ? window.speechSynthesis.getVoices().filter((v) => rank(v) > -10) : [];
}

/**
 * The voice for one language: the one chosen on the sign-in card if it speaks it, else the most
 * natural one that sounds like the companion (a child's voice for a little one, and so on).
 */
function pickVoice(lang: string, seed: number, kind?: VoiceKind): SpeechSynthesisVoice | null {
  const all = allVoices();
  const mine = all.find((v) => v.voiceURI === chosenVoice());
  if (mine && langOfVoice(mine) === lang) return mine;
  let fits = all.filter((v) => langOfVoice(v) === lang);
  if (!fits.length) return null;
  if (kind) {
    // The best natural voices that sound right; a little one with no child's voice gets a bright one.
    const like = (k: VoiceKind) => fits.filter((v) => SOUNDS[k].test(v.name.replace(/^Microsoft |^Google /u, '')));
    const sounding = like(kind).length ? like(kind) : kind === 'little' ? like('bright') : [];
    if (sounding.length && Math.max(...sounding.map(rank)) >= Math.max(...fits.map(rank)) - 1) fits = sounding;
  }
  const locale = LANGS.find((l) => l.id === lang)?.locale.toLowerCase() || '';
  const score = (v: SpeechSynthesisVoice) => rank(v) + (v.lang.toLowerCase().replace('_', '-') === locale ? 0.5 : 0);
  const best = Math.max(...fits.map(score));
  const top = fits.filter((v) => score(v) === best);
  return top[seed % top.length];
}

/** Short pieces, a sentence or so each: long ones can stall in some browsers, and each gets its own language. */
function pieces(text: string): string[] {
  const out: string[] = [];
  // Line by line first (a greeting on its own line is its own piece), then sentence by sentence.
  for (const s of text.split(/\n+/u).flatMap((line) => line.replace(/\s+/gu, ' ').match(/[^.!?…]+[.!?…]*["')\]»]*\s*/gu) || [])) {
    let rest = s.trim();
    while (rest.length > 180) {
      const cut = Math.max(rest.lastIndexOf(',', 180), rest.lastIndexOf(' ', 180), 60);
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

export type Segment = { lang: string; text: string };

/** Does the letter end with its own sign-off ("- Joseph", "Love," "Bisous")? Then "From ..." is not added. */
export function signsOff(body: string): boolean {
  const lines = body.trim().split(/\n+/u).map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] || '';
  if (/^[-–—~]\s*\S/u.test(last) && last.length < 40) return true;
  // Signed at the end of the same line: "... On se voit samedi ? - Joseph".
  if (/\s[-–—~]\s*\p{Lu}[\p{L}'.-]*(\s\p{Lu}[\p{L}'.-]*){0,2}\s*[!.]?$/u.test(body.trim())) return true;
  return lines.length > 1 && last.length < 40 &&
    /^(love|lots of love|all my love|cheers|best|best wishes|regards|kind regards|take care|hugs|xoxo|xx|yours|bisous|gros bisous|bises|amitiés|à bientôt|a\+|besos|abrazos|un abrazo|saludos|cordialement)\b/iu.test(last);
}

/** Does the letter start with its own greeting ("Hey Mec," "Salut !")? Then "Dear ..." is not read too. */
export function greets(body: string): boolean {
  return /^\s*(hey|hi|hello|hiya|dear|dearest|good (morning|evening|afternoon)|bonjour|bonsoir|salut|coucou|cher|chère|hola|querid[oa]|buenos|buenas|yo)\b/iu.test(body);
}

/**
 * The letter in pieces by language, worked out on the headset: sentence by sentence, and within a
 * sentence at a colon, semicolon or dash ("Juste pour te dire que : the movie..."). Pieces it cannot
 * tell keep the language of the piece before. `mixed` is true when more than one language shows up.
 */
/**
 * Might this letter mix languages? True when words of two languages appear anywhere in it, or letters
 * with accents: then Meta's model is asked to mark each language, even inside one sentence.
 */
export function mightMix(text: string): boolean {
  const words = text.toLowerCase().match(/[a-zà-ÿñæœ']+/gu) || [];
  const langs = Object.values(WORDS).filter((set) => words.some((w) => set.has(w))).length;
  return langs >= 2 || /[àâçéèêëîïôûùœñ¿¡]/iu.test(text);
}

/**
 * Splits one clause where the language changes inside it ("Juste pour te dire que the cherry tree..."):
 * each word takes the language its little words show, unknown words (names, nouns) follow the word
 * before, and runs shorter than three words join their neighbour so a lone word is never cut out.
 */
function runs(clause: string, start: string): Segment[] {
  const words = clause.split(/\s+/u).filter(Boolean);
  if (words.length < 5) return [{ lang: start, text: clause }];
  const langOfWord = (w: string): string => {
    const k = w.toLowerCase().replace(/^[^a-zà-ÿñæœ']+|[^a-zà-ÿñæœ']+$/giu, '');
    const hits = Object.entries(WORDS).filter(([, set]) => set.has(k)).map(([l]) => l);
    return hits.length === 1 ? hits[0] : '';
  };
  let cur = start;
  const tagged = words.map((w) => { const l = langOfWord(w); if (l) cur = l; return { w, l: cur }; });
  const out: { lang: string; words: string[] }[] = [];
  for (const t of tagged) {
    const prev = out[out.length - 1];
    if (prev && prev.lang === t.l) prev.words.push(t.w); else out.push({ lang: t.l, words: [t.w] });
  }
  // The shortest run under three words joins its longer neighbour, again and again.
  for (;;) {
    let i = -1;
    out.forEach((r, k) => { if (r.words.length < 3 && (i < 0 || r.words.length < out[i].words.length)) i = k; });
    if (i < 0 || out.length < 2) break;
    const before = out[i - 1], after = out[i + 1];
    const into = !before ? after : !after ? before : before.words.length >= after.words.length ? before : after;
    if (into === before) before.words.push(...out[i].words); else after.words.unshift(...out[i].words);
    out.splice(i, 1);
    // Neighbours now in the same language become one run.
    for (let k = out.length - 1; k > 0; k--) if (out[k].lang === out[k - 1].lang) { out[k - 1].words.push(...out[k].words); out.splice(k, 1); }
  }
  return out.map((r) => ({ lang: r.lang, text: r.words.join(' ') }));
}

export function localSegments(text: string, main: string): { parts: Segment[]; mixed: boolean } {
  const parts: Segment[] = [];
  let last = main;
  for (const sentence of pieces(text)) {
    for (const clause of sentence.split(/(?<=[:;]|\s[–—-])\s+/u)) {
      if (!clause.trim()) continue;
      for (const run of runs(clause, guess(clause) || last)) {
        last = run.lang;
        const prev = parts[parts.length - 1];
        if (prev && prev.lang === run.lang && prev.text.length + run.text.length < 180) prev.text += ` ${run.text}`;
        else parts.push(run);
      }
    }
  }
  return { parts, mixed: new Set(parts.map((p) => p.lang)).size > 1 };
}

export class Reader {
  private run = 0;
  private live = false;

  get speaking(): boolean { return this.live; }

  /**
   * Reads the parts (greeting, letter, signature) in this voice; lang is the letter's main language,
   * used for sentences too short to tell. onPiece is called as each sentence starts; onDone once at
   * the end, or when it could not be read. Returns false if this device cannot speak.
   */
  read(parts: string[], voice: Voice, lang: string, onPiece: () => void, onDone: () => void): boolean {
    if (!canSpeak) return false;
    const list = parts.flatMap(pieces).map((text) => ({ text, lang: guess(text) || lang }));
    return this.say(list, voice, onPiece, onDone);
  }

  /** Reads pieces whose language is already known (long pieces are cut into sentences). */
  readSegments(parts: Segment[], voice: Voice, onPiece: () => void, onDone: () => void): boolean {
    if (!canSpeak) return false;
    const list = parts.flatMap((p) => pieces(p.text).map((text) => ({ text, lang: p.lang })));
    return this.say(list, voice, onPiece, onDone);
  }

  /** A short sample in one voice (from the sign-in card); '' means the automatic choice. */
  sample(uri: string, onDone: () => void): boolean {
    if (!canSpeak) return false;
    const v = listVoices().find((x) => x.voiceURI === uri);
    const langs = v ? LANGS.filter((l) => l.id === langOfVoice(v)) : LANGS.filter((l) => l.id !== 'es');
    return this.say(langs.map((l) => ({ text: l.sample, lang: l.id })), { pitch: 1, rate: 1, seed: 0, kind: 'bright' }, () => {}, onDone);
  }

  private say(list: { text: string; lang: string }[], voice: Voice, onPiece: () => void, onDone: () => void): boolean {
    if (!list.length) return false;
    const synth = window.speechSynthesis;
    this.stop();
    const run = ++this.run;
    this.live = true;
    const finish = () => { if (run === this.run && this.live) { this.live = false; onDone(); } };
    list.forEach(({ text, lang }, i) => {
      const u = new SpeechSynthesisUtterance(text);
      const pick = pickVoice(lang, voice.seed, voice.kind);
      u.lang = pick?.lang || LANGS.find((l) => l.id === lang)?.locale || lang;
      if (pick) u.voice = pick;
      u.pitch = voice.pitch;
      u.rate = voice.rate;
      u.onstart = () => { if (run === this.run) onPiece(); };
      u.onerror = (e) => {
        const why = (e as SpeechSynthesisErrorEvent).error;
        if (why !== 'interrupted' && why !== 'canceled') console.warn('[Courio] Could not read aloud', why);
        finish();
      };
      if (i === list.length - 1) u.onend = finish;
      synth.speak(u);
    });
    return true;
  }

  stop(): void {
    this.run++;
    this.live = false;
    if (canSpeak) window.speechSynthesis.cancel();
  }
}

/** Called when the device's voices arrive or change (some browsers load them a moment after the page). */
export function onVoices(fn: () => void): void {
  if (!canSpeak) return;
  try {
    window.speechSynthesis.addEventListener('voiceschanged', fn);
    window.speechSynthesis.getVoices();
  } catch { /* fine */ }
}
