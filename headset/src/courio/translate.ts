// Translating letters with Meta's model (Muse Spark, through the companion-ai helper on the server).
// The language you read in is picked on the sign-in card (at first, the device's own language) and
// kept on this headset. Only languages written with spaces between words for now, so the letter card
// can wrap them.

export type Target = { id: string; name: string; label: string };

export const TARGETS: Target[] = [
  { id: 'en', name: 'English', label: 'English' },
  { id: 'fr', name: 'French', label: 'Français' },
  { id: 'es', name: 'Spanish', label: 'Español' },
  { id: 'de', name: 'German', label: 'Deutsch' },
  { id: 'it', name: 'Italian', label: 'Italiano' },
  { id: 'pt', name: 'Portuguese', label: 'Português' },
  { id: 'nl', name: 'Dutch', label: 'Nederlands' },
];

const KEY = 'courio.translate.v1';

/** The language letters are translated into on this headset. */
export function myLanguage(): Target {
  let id = '';
  try { id = localStorage.getItem(KEY) || ''; } catch { /* fine */ }
  if (!id) id = ((typeof navigator !== 'undefined' && navigator.language) || 'en').slice(0, 2).toLowerCase();
  return TARGETS.find((t) => t.id === id) ?? TARGETS[0];
}

export function chooseLanguage(id: string): void {
  try { localStorage.setItem(KEY, id); } catch { /* fine without */ }
}
