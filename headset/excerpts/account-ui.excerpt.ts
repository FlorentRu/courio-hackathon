// EXCERPT of headset/src/courio/account-ui.ts (Courio headset app).
// This file existed before the hackathon. Only the parts written during the hackathon
// (26 October - 4 November 2026) are shown here; everything else is left out on purpose.
// What these parts do: the microphone chooser and test, the reading-voice chooser with Listen, and the "Translate letters into" chooser on the sign-in card.
// Line numbers refer to the full file. This excerpt is for reading, not for building.

// ---- lines 62-76 ------------------------------------------------------------
  // Which voice reads letters aloud: the most natural one this device has, or one you pick.
  const voiceSection = (): string => {
    if (!canSpeak) return '';
    const voices = listVoices();
    if (!voices.length) return `<div style="font-size:13px;color:#5A4A3A;margin:2px 0 8px">Reading aloud: this device has no voices yet.</div>`;
    const lang = (l: string) => LANGS.find((x) => x.id === l.slice(0, 2).toLowerCase())?.name ?? l;
    const missing = missingLanguages();
    return `<label style="font-size:13px;color:#5A4A3A">Reading voice<br><select id="courio-voice" style="width:100%;margin:3px 0 6px;padding:6px;border-radius:8px;border:1.5px solid #C9B48A;font:13px system-ui">` +
      `<option value="">Automatic (most natural for each language)</option>` +
      voices.map((v) => `<option value="${esc(v.voiceURI)}"${v.voiceURI === chosenVoice() ? ' selected' : ''}>${rank(v) >= 5 ? '★ ' : ''}${esc(v.name.replace(/^Microsoft /u, '').replace(/ - .*$/u, ''))} · ${esc(lang(v.lang))}</option>`).join('') +
      `</select></label>` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">${button(sampling ? 'Stop' : 'Listen', false)}` +
      `<span style="font-size:12px;color:#7A6A5A">${voices.some((v) => rank(v) >= 5) ? '★ sounds most natural.' : 'Only basic voices on this device (Microsoft Edge has natural ones).'}${missing.length ? ` No ${missing.join(' or ')} voice here, so ${missing.length > 1 ? 'those' : 'that'} would sound accented.` : ''}</span></div>`;
  };
  onVoices(() => render?.());

// ---- lines 84-94 ------------------------------------------------------------
        (mic === 'ok' ? `<div style="font-size:13px;color:#2E7D4F;margin-bottom:6px">Microphone ready: you can answer letters by voice.</div>` +
          (mics.length > 1 ? `<label style="font-size:13px;color:#5A4A3A">Microphone<br><select id="courio-mic" style="width:100%;margin:3px 0 6px;padding:6px;border-radius:8px;border:1.5px solid #C9B48A;font:13px system-ui">` +
            `<option value="">Default</option>` + mics.map((m) => `<option value="${esc(m.id)}"${m.id === chosenMic() ? ' selected' : ''}>${esc(m.name)}</option>`).join('') + `</select></label>` : '') +
          `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">${button(stopTest ? 'Stop test' : 'Test microphone', false)}` +
          `<div style="flex:1;height:10px;border-radius:5px;background:#E9DFC9;overflow:hidden"><div id="courio-mic-level" style="height:100%;width:0%;background:#2E9BD6;transition:width 60ms"></div></div></div>` +
          (stopTest ? `<div style="font-size:12px;color:#5A4A3A;margin:-4px 0 8px">${heardTest ? 'It hears you.' : 'Say something: the bar should move.'}</div>` : '')
          : `<div style="font-size:13px;color:#5A4A3A;margin-bottom:8px">${mic === 'no' ? 'The microphone was not allowed. ' : ''}To answer letters by voice, allow the microphone first (only used while you answer).</div>`) +
        voiceSection() +
        `<label style="font-size:13px;color:#5A4A3A">Translate letters into<br><select id="courio-lang" style="width:100%;margin:3px 0 8px;padding:6px;border-radius:8px;border:1.5px solid #C9B48A;font:13px system-ui">` +
          TARGETS.map((t) => `<option value="${t.id}"${t.id === myLanguage().id ? ' selected' : ''}>${esc(t.label)}</option>`).join('') + `</select></label>` +
        `<div style="display:flex;gap:8px;flex-wrap:wrap">${mic === 'ok' ? '' : button('Allow microphone', true)}${button('Sign out', false)}</div>`);

// ---- lines 127-148 ------------------------------------------------------------
    if (act === 'Allow microphone') void allowMicrophone().then((ok) => { mic = ok ? 'ok' : 'no'; if (ok) void loadMics(); render?.(); });
    if (act === 'Listen') { sampling = sampler.sample(chosenVoice(), () => { sampling = false; render?.(); }); render?.(); }
    if (act === 'Stop') { sampler.stop(); sampling = false; render?.(); }
    if (act === 'Stop test') { stopTest?.(); stopTest = null; render?.(); }
    if (act === 'Test microphone') {
      heardTest = false;
      void testMic((v) => {
        const bar = document.getElementById('courio-mic-level');
        if (bar) bar.style.width = `${Math.round(v * 100)}%`;
        if (v > 0.15 && !heardTest) { heardTest = true; render?.(); }
      }).then((stop) => {
        stopTest = stop; render?.();
        setTimeout(() => { if (stopTest === stop) { stop(); stopTest = null; render?.(); } }, 8000);
      }).catch(() => { mic = 'no'; render?.(); });
    }
  });
  card.addEventListener('change', (ev) => {
    const t = ev.target as HTMLSelectElement;
    if (t && t.id === 'courio-mic') { chooseMic(t.value); stopTest?.(); stopTest = null; render?.(); }
    if (t && t.id === 'courio-lang') { chooseLanguage(t.value); render?.(); }
    if (t && t.id === 'courio-voice') { chooseVoice(t.value); sampling = sampler.sample(t.value, () => { sampling = false; render?.(); }); render?.(); }
  });

// ---- end of excerpt (the full file has 162 lines) ----
