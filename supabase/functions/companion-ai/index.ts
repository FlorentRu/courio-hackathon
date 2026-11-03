// Courio's AI helper: the only place that talks to Meta's models (Meta Model API).
//
// It runs on Supabase as an Edge Function, so the Meta key stays on the server and never reaches a
// phone or a headset. Each call:
//   1. checks the person is signed in to Courio,
//   2. counts one use against today's limit (use_ai() in ai.sql; 30 a day),
//   3. does one job and returns the result. Nothing is stored here: not the recording, not the text.
//
// Jobs (sent as form fields, "action" says which):
//   reply      audio (a WAV recording) + to (friend's name)  ->  { heard, letter }
//              Muse Voice Transcribe turns the recording into words, then Muse Spark turns those words
//              into a short letter in the speaker's own voice, adding nothing they did not say.
//   translate  text + lang (e.g. "French")  ->  { text }
//   languages  text  ->  { parts: [{ lang, text }] }
//              Splits a letter into pieces by spoken language ("fr", "en"...), so the headset can read
//              each piece aloud with a native voice. The words are not changed.
//
// The person always sees the result first: nothing is sent to a friend from here.
//
// Secret needed (Supabase dashboard > Edge Functions > Secrets): META_MODEL_API_KEY.
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase automatically.

import { createClient } from 'npm:@supabase/supabase-js@2';

const META = 'https://api.meta.ai/v1';
const CHAT_MODEL = 'muse-spark-1.3';
const VOICE_MODEL = 'muse-voice-transcribe-1.0';
const MAX_AUDIO = 8 * 1024 * 1024; // about 4 minutes of 16 kHz speech; replies are much shorter

const ALLOWED = ['https://courio-xr.netlify.app', 'https://courio-app.netlify.app'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const ok = ALLOWED.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/u.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function reply(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });
}

/** Words from a short WAV recording. */
async function transcribe(key: string, audio: Blob): Promise<string> {
  const form = new FormData();
  form.append('request', new Blob([JSON.stringify({
    mode: 'PUSH_TO_TALK',
    model: VOICE_MODEL,
    audioEncoding: 'WAV',
    languageBias: ['English', 'French', 'Spanish'],
  })], { type: 'application/json' }));
  form.append('audio', audio, 'reply.wav');
  const res = await fetch(`${META}/asr/transcribe`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, body: form });
  const text = await res.text();
  if (!res.ok) throw new Error(`transcribe ${res.status}: ${text.slice(0, 300)}`);
  return String(JSON.parse(text).transcript || '').trim();
}

/** One short answer from Muse Spark. */
async function chat(key: string, system: string, user: string, maxTokens = 500): Promise<string> {
  const res = await fetch(`${META}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: maxTokens,
      reasoning_effort: 'minimal',
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`chat ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  return String(data?.choices?.[0]?.message?.content ?? '').trim();
}

const LETTER_RULES = `You help someone answer a friend's letter by voice in Courio, a letter-writing app.
You receive what they said out loud, transcribed by a machine. Turn it into the body of a short letter.
Rules:
- Keep their meaning, their words where possible, their tone and their language. Write in the same language they spoke.
- Remove filler words, false starts and repetitions, and fix grammar and punctuation.
- Never add facts, feelings, plans, promises, questions or details they did not say. Shorter is better than invented.
- No greeting line and no signature: the app adds "Dear ..." and their name.
- At most 700 characters.
- If the words are empty, only noise, or not meant as a message, answer exactly: EMPTY
Answer with the letter body only.`;

const LANGUAGE_RULES = `You prepare a personal letter to be read aloud by text-to-speech voices, one voice per language.
Split the text into consecutive pieces so that each piece is in a single spoken language. A letter may switch
language in the middle of a sentence: split there too. Names, brands and titles belong with the words around them
(an English movie title inside an English clause is English).
Rules:
- Copy the text exactly: every word once, in order. Do not translate, correct, add or remove anything.
- Give each piece the ISO 639-1 code of its language (en, fr, es, de, it, pt...).
- Merge neighbouring pieces in the same language.
Answer with JSON only, like {"parts":[{"lang":"fr","text":"..."},{"lang":"en","text":"..."}]}`;

/** The pieces of a text by language, checked to be the same words as the text (or null). */
function languageParts(text: string, answer: string): { lang: string; text: string }[] | null {
  try {
    const json = JSON.parse(answer.slice(answer.indexOf('{'), answer.lastIndexOf('}') + 1));
    const parts = (Array.isArray(json?.parts) ? json.parts : [])
      .map((p: { lang?: unknown; text?: unknown }) => ({ lang: String(p?.lang || '').toLowerCase().slice(0, 2), text: String(p?.text || '') }))
      .filter((p: { lang: string; text: string }) => /^[a-z]{2}$/u.test(p.lang) && p.text.trim());
    const squash = (s: string) => s.replace(/\s+/gu, '');
    if (!parts.length || squash(parts.map((p: { text: string }) => p.text).join('')) !== squash(text)) return null;
    return parts;
  } catch { return null; }
}

const TRANSLATE_RULES = `You translate a personal letter between friends. Translate faithfully into the language you are given,
keeping the tone, warmth and line breaks. Do not add, remove or explain anything. Answer with the translation only.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return reply(req, 405, { error: 'POST only' });

  const key = Deno.env.get('META_MODEL_API_KEY');
  if (!key) return reply(req, 503, { error: 'The AI helper is not set up yet' });

  // Who is asking: the person's own Courio sign-in, checked by Supabase.
  const auth = req.headers.get('Authorization') || '';
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: who } = await db.auth.getUser();
  if (!who?.user) return reply(req, 401, { error: 'Please sign in again.' });

  let form: FormData;
  try { form = await req.formData(); } catch { return reply(req, 400, { error: 'Bad request' }); }
  const action = String(form.get('action') || '');
  if (action !== 'reply' && action !== 'translate' && action !== 'languages') return reply(req, 400, { error: 'Unknown action' });

  const { data: allowed, error: limitError } = await db.rpc('use_ai');
  if (limitError) { console.error('use_ai', limitError.message); return reply(req, 500, { error: 'Something went wrong. Try again?' }); }
  if (!allowed) return reply(req, 429, { error: "That's all the AI help for today" });

  try {
    if (action === 'reply') {
      const audio = form.get('audio');
      if (!(audio instanceof Blob) || audio.size < 1000) return reply(req, 400, { error: "I couldn't hear anything. Try again?" });
      if (audio.size > MAX_AUDIO) return reply(req, 413, { error: 'Too long: please keep it under a minute' });
      const to = String(form.get('to') || 'my friend').slice(0, 60);
      const heard = await transcribe(key, audio);
      if (!heard) return reply(req, 200, { heard: '', letter: '' });
      const letter = await chat(key, LETTER_RULES, `Friend's name: ${to}\nWhat they said: ${heard.slice(0, 4000)}`);
      const clean = letter === 'EMPTY' ? '' : letter.replace(/^["“]|["”]$/gu, '').slice(0, 900);
      return reply(req, 200, { heard, letter: clean });
    }
    if (action === 'languages') {
      const text = String(form.get('text') || '').slice(0, 2000);
      if (!text.trim()) return reply(req, 400, { error: 'Nothing to read.' });
      const parts = languageParts(text, await chat(key, LANGUAGE_RULES, text, 1500));
      if (!parts) return reply(req, 502, { error: 'The helper is busy. Try again in a moment' });
      return reply(req, 200, { parts });
    }
    const text = String(form.get('text') || '').slice(0, 1000);
    const lang = String(form.get('lang') || 'English').slice(0, 30);
    if (!text.trim()) return reply(req, 400, { error: 'Nothing to translate.' });
    const out = await chat(key, TRANSLATE_RULES, `Translate into ${lang}:\n\n${text}`, 900);
    return reply(req, 200, { text: out.slice(0, 1000) });
  } catch (e) {
    // The details go to the server log only (never the recording or the letter).
    console.error(action, String((e as Error)?.message || e));
    return reply(req, 502, { error: 'The helper is busy. Try again in a moment' });
  }
});
