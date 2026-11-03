# Courio: companions that read, translate and help you answer letters on Meta Quest

**Meta Global AI Developer Hackathon 2026 · Indie Developer track · Build for Your World**

Live headset app: **https://courio-xr.netlify.app** (open it in the Meta Quest browser, or in a desktop browser with the WebXR emulator)

Courio is a friends-only letter app. Each person designs a 3D companion, and that companion carries their letters. On Meta Quest, a friend's companion walks through a door into your room and hands you their letter, sent from a phone.

For this hackathon I gave the companions a voice with Meta's models. In the headset you can now:

- **open the letter**, in one of six animated styles;
- **have it read aloud**, in a voice that fits the companion, even when the letter mixes languages;
- **translate it**;
- **answer by voice** or **type your answer on a keyboard drawn in the room**.

---

## What existed before, and what was built during the hackathon

The hackathon rules ask entries that build on an existing project to show only the new work. **This repository contains only code written during the hackathon (26 October to 4 November 2026).** The rest of Courio is not included: the phone app, the companion designer, the 3D companions, the door, delivery and the account system.

| Existed before 26 October | Built during the hackathon |
|---|---|
| Phone app (Android / iPhone, closed testing): design a companion, write letters to friends | **Answer by voice:** Muse Voice Transcribe turns your words into text, then Muse Spark turns them into a short letter in your own tone |
| Headset app: a friend's companion walks through a door into your room and hands you their letter | **Reading aloud** with a voice that fits the companion; letters that mix languages are split by **Muse Spark** so each part gets a native voice |
| Quick replies ("Thank you! I loved your letter", …) | **Translate** with Muse Spark, with "Show original" |
| Sign-in on the headset page, letters delivered in about 10 seconds | **Typed reply** on a keyboard drawn in the room (letters, numbers, accents), or a paired keyboard |
|  | **Six ways to open a letter** (Classic, Golden light, Ribbon bow, Blooming, Pink cloud, Scroll) |
|  | **The `companion-ai` server function** and the **daily limit**: the only place that talks to Meta's models |

---

## How it uses Meta's AI

All calls go through one Supabase Edge Function, [`supabase/functions/companion-ai/index.ts`](supabase/functions/companion-ai/index.ts), using the **Meta Model API** (`https://api.meta.ai/v1`).

| Job | Meta model | What it does |
|---|---|---|
| `reply` | **Muse Voice Transcribe 1.0** (`/asr/transcribe`), then **Muse Spark 1.3** (`/chat/completions`) | A short WAV recording becomes text. Muse Spark then turns it into a short letter: it keeps the speaker's words, tone and language, removes filler words, and adds nothing they did not say. |
| `languages` | **Muse Spark 1.3** | Splits a letter into pieces by spoken language ("Juste pour te dire que" / "the cherry tree bloomed…"), so the headset reads each piece with a native voice. The answer is checked to contain exactly the letter's words before it is used. |
| `translate` | **Muse Spark 1.3** | Translates a letter faithfully into the reader's language (English, French, Spanish, German, Italian, Portuguese or Dutch), keeping tone and line breaks. |

The Meta Model API has no text-to-speech, so letters are read aloud with the headset browser's own speech voices ([`speech.ts`](headset/src/courio/speech.ts)). The headset picks the most natural voice for each language, and a voice type from the companion's look:

- small companions get a child's voice;
- dragons and stout or bearded companions get a deep voice;
- broad builds and horned or crested animals get a warm voice;
- the rest get a bright voice.

### Safety and privacy

- **The Meta key never reaches the headset or a phone.** It is a server secret (`META_MODEL_API_KEY`), read only inside the Edge Function.
- **Signed-in friends only.** Each call checks the person's own Courio sign-in.
- **A daily limit:** each person gets 30 AI actions a day. [`supabase/ai.sql`](supabase/ai.sql) counts them in `use_ai()`; nobody can read or write that table directly.
- **Nothing is stored** by the function: not the recording, not the letter text.
- **Nothing is sent without you.** A voice or typed reply is shown on the companion's paper first. Only Send sends it; Say it again and Cancel do not.
- **The AI only runs when you press a button**, and only on the letter or recording you chose.
- Courio is for people 16 and over, friends-only, with no ads.

---

## What is in this repository

```
supabase/
  functions/companion-ai/index.ts   the server function: sign-in check, daily limit, Muse Voice Transcribe + Muse Spark
  ai.sql                            the daily limit (30 AI actions per person per day)
headset/src/courio/                 new headset modules, written during the hackathon (complete files)
  voice.ts                          microphone recording, turned into a 16 kHz WAV; microphone chooser and test
  holo.ts                           the glowing hologram microphone that follows your voice while you answer
  speech.ts                         reading aloud: voice per companion, per language, mixed-language splitting
  translate.ts                      the reader's language for translation
  keyboard.ts                       the keyboard drawn in the room (letters, numbers, accents, shift)
  envelope3d.ts                     the six animated ways to open a letter
headset/excerpts/                   the hackathon parts of files that existed before (for reading, not building)
  delivery.excerpt.ts               the buttons and steps for reading, translating, answering by voice and typing
  account-ui.excerpt.ts             microphone, reading-voice and translation choosers on the sign-in card
  account.excerpt.ts                askAI(): the one call from the headset to the server function
  chooser.excerpt.ts                the Opening and Voice buttons on the in-room panel
```

Each excerpt keeps the line numbers of the full file. The rest of those files, and the rest of Courio, existed before the hackathon and are left out, so this repository is not meant to be built on its own. **To try Courio, use the live app above.**

## Built with

- **Meta Model API:** Muse Spark 1.3, Muse Voice Transcribe 1.0
- **Meta Immersive Web SDK (IWSDK)** and WebXR, for the headset app (Meta Quest 3 / 3S)
- **Supabase:** Edge Functions (Deno), Postgres
- TypeScript, three.js, Web Speech API, MediaRecorder

Tested on a real Meta Quest 3 at Meta Lab (697 Fifth Avenue, New York) on 30 October 2026 (with its controllers), and in the IWSDK emulator (with hand tracking).

---

© 2026 Florent Rudel Ndeffo. All rights reserved. This code is shared publicly so the hackathon judges can read it. No licence is granted to copy, modify or redistribute it. See [NOTICE](NOTICE).
