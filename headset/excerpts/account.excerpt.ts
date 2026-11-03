// EXCERPT of headset/src/courio/account.ts (Courio headset app).
// This file existed before the hackathon. Only the parts written during the hackathon
// (26 October - 4 November 2026) are shown here; everything else is left out on purpose.
// What these parts do: askAI(), the one call from the headset to the companion-ai server function (the Meta key stays on the server).
// Line numbers refer to the full file. This excerpt is for reading, not for building.

// ---- lines 147-165 ------------------------------------------------------------
/**
 * Asks Courio's AI helper (the companion-ai server function, which holds the Meta key) to do one job.
 * Answers with the helper's JSON, or throws an Error whose message can be shown to the person.
 */
export async function askAI<T>(form: FormData): Promise<T> {
  const res = await fetch(`${URL}/functions/v1/companion-ai`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${await token()}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String((data as { error?: string }).error || 'The AI helper could not be reached. Try again?'));
  return data as T;
}

/** Wax seal colours, as in the phone app's album. */
export const SEAL_WAX: Record<string, string> = { rose: '#E8476A', sky: '#3E9BE0', gold: '#F2B731' };
/** Letter paper colours, as in the phone app. */
export const PAPERS = ['#FBF4E4', '#E4E9FB', '#E5F3EA', '#FBE8E1'];

// ---- end of excerpt (the full file has 166 lines) ----
