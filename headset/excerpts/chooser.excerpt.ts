// EXCERPT of headset/src/courio/chooser.ts (Courio headset app).
// This file existed before the hackathon. Only the parts written during the hackathon
// (26 October - 4 November 2026) are shown here; everything else is left out on purpose.
// What these parts do: the new Opening and Voice buttons on the in-room settings panel.
// Line numbers refer to the full file. This excerpt is for reading, not for building.

// ---- lines 150-151 ------------------------------------------------------------
        opening: [...OPENINGS.map((o) => o.id), 'surprise'],
        voice: ['auto', ...VOICE_KINDS.map((v) => v.id)],

// ---- lines 169-170 ------------------------------------------------------------
      if (kind === 'voice') return this.choice.voice === 'auto' ? 'Auto: from the look' : VOICE_KINDS.find((v) => v.id === this.choice.voice)?.label ?? 'Auto';
      if (kind === 'opening') return OPENINGS.find((o) => o.id === this.choice.opening)?.label ?? 'Surprise me';

// ---- end of excerpt (the full file has 196 lines) ----
