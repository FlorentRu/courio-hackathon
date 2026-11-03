// EXCERPT of headset/src/courio/delivery.ts (Courio headset app).
// This file existed before the hackathon. Only the parts written during the hackathon
// (26 October - 4 November 2026) are shown here; everything else is left out on purpose.
// What these parts do: the envelope that opens in six styles, Read it to me / Translate buttons, Answer by voice and the hologram microphone, Type a reply with the room keyboard, translation, reading aloud with a voice per companion and per language.
// Line numbers refer to the full file. This excerpt is for reading, not for building.

// ---- lines 351-368 ------------------------------------------------------------
    // The envelope that opens in front of you when you take a letter (only seen for a moment).
    world.createTransformEntity(this.envelope.group, { parent: world.sceneEntity, persistent: true });
    this.envelope.group.traverse((o) => { (o as Object3D & { pointerEvents?: string }).pointerEvents = 'none'; });

    // Under the opened letter: have the companion read it to you, or stop.
    this.readPill = pill('Read it to me', 0.2);
    this.stopPill = pill('Stop reading', 0.2);
    this.translatePill = pill('Translate', 0.2);
    this.originalPill = pill('Show original', 0.2);
    this.busyPill = pill('Translating…', 0.2, true);
    this.failPill = pill('Could not translate. Again?', 0.2, true);
    for (const m of [this.readPill, this.stopPill, this.translatePill, this.originalPill, this.busyPill, this.failPill]) {
      m.visible = false;
      const e = world.createTransformEntity(m, { parent: world.sceneEntity, persistent: true });
      e.addComponent(RayInteractable);
      e.addComponent(CourioButton);
      this.pointables.push(m);
    }

// ---- lines 396-456 ------------------------------------------------------------
    // Or say it in your own words.
    this.voicePill = pill('Answer by voice', 0.36);
    this.voicePill.position.set(0, 0.11 - 3 * 0.085, 0);
    this.typePill = pill('Type a reply', 0.36);
    this.typePill.position.set(0, 0.11 - 4 * 0.085, 0);
    {
      const e = world.createTransformEntity(this.typePill, { parent: replyEntity, persistent: true });
      e.addComponent(RayInteractable);
      e.addComponent(CourioButton);
      this.pointables.push(this.typePill);
    }
    // The keyboard, with Send and Cancel under it; the letter you type appears above it.
    const typeEntity = world.createTransformEntity(this.typeGroup, { parent: world.sceneEntity, persistent: true });
    this.keyboard.group.position.set(0, 0.02, 0.01);
    const keyboardEntity = world.createTransformEntity(this.keyboard.group, { parent: typeEntity, persistent: true });
    for (const k of this.keyboard.keys) {
      const e = world.createTransformEntity(k.mesh, { parent: keyboardEntity, persistent: true });
      e.addComponent(RayInteractable);
      e.addComponent(CourioButton);
      this.pointables.push(k.mesh);
    }
    this.typeSend = pill('Send', 0.2);
    this.typeCancel = pill('Cancel', 0.2, true);
    this.typeSend.position.set(0.11, -0.2, 0.01);
    this.typeCancel.position.set(-0.11, -0.2, 0.01);
    for (const m of [this.typeSend, this.typeCancel]) {
      const e = world.createTransformEntity(m, { parent: typeEntity, persistent: true });
      e.addComponent(RayInteractable);
      e.addComponent(CourioButton);
      this.pointables.push(m);
    }
    this.typeGroup.visible = false;
    this.typeGroup.position.set(0, -50, 0);
    // A real keyboard works too (on a computer, or one paired with the headset).
    window.addEventListener('keydown', (ev) => this.physicalKey(ev), true);
    const vp = world.createTransformEntity(this.voicePill, { parent: replyEntity, persistent: true });
    vp.addComponent(RayInteractable);
    vp.addComponent(CourioButton);
    this.pointables.push(this.voicePill);
    this.showReplies(false);

    // The voice answer: a sign saying what is happening, your letter once written, and its buttons.
    const voiceEntity = world.createTransformEntity(this.voiceGroup, { parent: world.sceneEntity, persistent: true });
    this.voiceHint = hint(' ', 0.24);
    this.voiceGroup.add(this.voiceHint);
    const LABELS: Record<keyof typeof this.voiceButtons, string> = { done: 'Done', send: 'Send', again: 'Say it again', cancel: 'Cancel' };
    for (const k of Object.keys(LABELS) as (keyof typeof this.voiceButtons)[]) {
      const m = pill(LABELS[k], k === 'cancel' ? 0.24 : 0.32, k === 'cancel');
      const e = world.createTransformEntity(m, { parent: voiceEntity, persistent: true });
      e.addComponent(RayInteractable);
      e.addComponent(CourioButton);
      this.voiceButtons[k] = m;
      this.pointables.push(m);
    }
    // The glowing microphone (pointing at it and pressing also means Done).
    this.voiceGroup.add(this.holo.group);
    const hitEntity2 = world.createTransformEntity(this.holo.hit, { parent: voiceEntity, persistent: true });
    hitEntity2.addComponent(RayInteractable);
    hitEntity2.addComponent(CourioButton);
    this.pointables.push(this.holo.hit);
    this.showVoice(false);

// ---- lines 489-692 ------------------------------------------------------------
  /** Shows the voice answer in the same place as the replies, laid out for what is happening now. */
  private showVoice(on: boolean): void {
    this.voiceGroup.visible = on;
    if (!on) { this.voiceGroup.position.set(0, -50, 0); return; }
    if (this.replyGroup.visible) {
      this.voiceGroup.position.copy(this.replyGroup.position);
      this.voiceGroup.quaternion.copy(this.replyGroup.quaternion);
    } else if (this.voiceGroup.position.y < -10) {
      this.readViewer();
      this.tmp.copy(this.viewer).addScaledVector(this.fwd, 0.6);
      this.tmp.y = this.viewer.y - 0.28;
      this.voiceGroup.position.copy(this.tmp);
      this.voiceGroup.lookAt(this.viewer);
    }
    const b = this.voiceButtons;
    for (const m of Object.values(b)) m.visible = false;
    const draft = this.voice === 'draft' && this.draftCard;
    if (this.draftCard) this.draftCard.visible = !!draft;
    // The glowing microphone while listening and writing; the buttons stacked underneath, like the replies.
    this.holo.show(this.voice === 'listening' || this.voice === 'thinking' ? this.voice : 'off');
    this.holo.group.position.set(0, 0.02, 0);
    this.holo.hit.visible = this.voice === 'listening';
    this.holo.hit.position.set(0, 0.1, 0);
    const stack = (names: (keyof typeof b)[], y: number) => {
      names.forEach((n, i) => { b[n].visible = true; b[n].position.set(0, y - i * 0.085, 0.01); });
    };
    if (this.voice === 'listening') { this.voiceHint.position.set(0, 0.26, 0); stack(['done', 'cancel'], -0.04); }
    else if (this.voice === 'thinking') { this.voiceHint.position.set(0, 0.26, 0); stack(['cancel'], -0.04); }
    else if (this.voice === 'draft') { this.voiceHint.position.set(0, 0.4, 0); this.draftCard!.position.set(0, 0.2, 0); stack(['send', 'again', 'cancel'], 0.0); }
    else if (this.voice === 'error') { this.voiceHint.position.set(0, 0.16, 0); stack(['again', 'cancel'], 0.06); }
  }

  private setVoiceHint(text: string): void {
    if (text === this.voiceHintText) return;
    this.voiceHintText = text;
    const h = hint(text, 0.24);
    const oldMat = this.voiceHint.material as MeshBasicMaterial;
    this.voiceHint.material = h.material;
    oldMat.map?.dispose(); oldMat.dispose();
    this.voiceHint.geometry.dispose();
    this.voiceHint.geometry = h.geometry;
  }

  /** "Answer by voice", or "Say it again": the microphone opens and the companion listens. */
  private startVoice(): void {
    if (this.phase !== 'reply' || !this.current) return;
    const attempt = ++this.voiceTry;
    if (this.replyGroup.visible) this.showVoice(true); // take over the replies' place first
    this.showReplies(false);
    this.voice = 'listening';
    // Not "listening" yet: the microphone takes a moment to open, and words said before it is ready are lost.
    this.setVoiceHint('One moment…');
    this.showVoice(true);
    this.rig.play('joy');
    this.recorder.start().then(() => {
      if (attempt !== this.voiceTry) { this.recorder.cancel(); return; }
      this.recorder.onFinished = () => this.finishVoice();
      // With live loudness it stops by itself after a pause; otherwise press Done.
      this.setVoiceHint(this.recorder.hearing ? "Go ahead, I'm listening… pause when you're done" : "Go ahead, I'm listening… press Done when finished");
      this.holo.flash();
    }).catch((e: Error) => { if (attempt === this.voiceTry) this.voiceError(e.message); });
  }

  /** "Done": the recording goes to Courio's AI helper, which writes it up as a letter. */
  private finishVoice(): void {
    if (this.voice !== 'listening' || !this.current) return;
    const mail = this.current;
    const attempt = ++this.voiceTry;
    this.voice = 'thinking';
    this.setVoiceHint('Writing your letter…');
    this.showVoice(true);
    this.recorder.stop()
      .then((audio) => {
        if (attempt !== this.voiceTry || this.voice !== 'thinking' || this.current !== mail) return null;
        if (!audio) { this.voiceError("I didn't catch that. Try again?"); return null; }
        // Nothing but silence: the browser is listening to a microphone that is muted or not the one in use.
        if (this.recorder.peak < 0.01) { this.voiceError('Your microphone sent only silence'); return null; }
        const form = new FormData();
        form.append('action', 'reply');
        form.append('to', mail.from.name);
        form.append('audio', audio, 'reply.wav');
        return askAI<{ heard: string; letter: string }>(form);
      })
      .then((r) => {
        if (!r || attempt !== this.voiceTry || this.voice !== 'thinking' || this.current !== mail) return;
        if (!r.heard) { this.voiceError("I couldn't hear any words. Try again?"); return; }
        // Very short answers ("Got it, thanks!") can come back unpolished: then show exactly what was heard.
        if (!r.letter) { this.showDraft(r.heard.charAt(0).toUpperCase() + r.heard.slice(1)); return; }
        this.showDraft(r.letter);
      })
      .catch((e: Error) => { if (attempt === this.voiceTry && this.voice === 'thinking') this.voiceError(e.message); });
  }

  /** Your letter, written up, on paper: send it, say it again, or cancel. Nothing goes until you press Send. */
  private showDraft(text: string): void {
    const mail = this.current;
    if (!mail) return;
    this.draftText = text;
    if (this.draftCard) {
      this.voiceGroup.remove(this.draftCard);
      const m = this.draftCard.material as MeshBasicMaterial;
      m.map?.dispose(); m.dispose(); this.draftCard.geometry.dispose();
    }
    const seal = SEAL_WAX[mail.flair.seal || ''] || '#8B4FB8';
    this.draftCard = letterCard(this.me?.name || 'Me', mail.from.name, text, seal, 0.42, PAPERS[0], 'Read it through, then press Send');
    this.voiceGroup.add(this.draftCard);
    this.voice = 'draft';
    this.setVoiceHint('Here is your letter');
    this.showVoice(true);
  }

  private voiceError(message: string): void {
    this.recorder.cancel();
    this.voice = 'error';
    this.setVoiceHint(message.length > 48 ? message.slice(0, 45) + '…' : message);
    this.showVoice(true);
  }

  private voicePressed(k: 'done' | 'send' | 'again' | 'cancel'): void {
    if (this.phase !== 'reply' || this.voice === 'off') return;
    if (k === 'done') this.finishVoice();
    else if (k === 'again') this.startVoice();
    else if (k === 'send' && this.voice === 'draft') { const text = this.draftText; this.stopVoice(); this.chooseReply(text); }
    else if (k === 'cancel') { this.stopVoice(); this.showReplies(true); this.t = 0.5; }
  }

  // ---- Typing a reply --------------------------------------------------------------------------------

  /** The keyboard takes the replies' place, with your letter written above it as you type. */
  private startTyping(): void {
    if (this.phase !== 'reply' || !this.current) return;
    this.typeGroup.position.copy(this.replyGroup.position);
    this.typeGroup.quaternion.copy(this.replyGroup.quaternion);
    this.showReplies(false);
    this.typing = true;
    this.typeText = '';
    this.keyboard.setPage('abc');
    this.keyboard.autoShift('');
    this.typeGroup.visible = true;
    this.drawTypeCard();
  }

  private stopTyping(): void {
    this.typing = false;
    this.typeGroup.visible = false;
    this.typeGroup.position.set(0, -50, 0);
  }

  private typeKey(key: string): void {
    if (!this.typing) return;
    const before = this.typeText;
    this.typeText = this.keyboard.apply(key, this.typeText);
    if (this.typeText !== before) this.typeDirty = true;
  }

  /** Keys typed on a real keyboard while the drawn one is open (and kept from moving you about). */
  private physicalKey(ev: KeyboardEvent): void {
    if (!this.typing || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement || ev.target instanceof HTMLSelectElement) return;
    let next = this.typeText;
    if (ev.key === 'Backspace') next = next.slice(0, -1);
    else if (ev.key === 'Enter') { if (ev.shiftKey) next += '\n'; else { ev.preventDefault(); ev.stopImmediatePropagation(); this.sendTyped(); return; } }
    else if (ev.key.length === 1) next = (next + ev.key).slice(0, 700);
    else return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    this.keyboard.showTyped(ev.key);
    this.typeText = next;
    this.keyboard.autoShift(next);
    this.typeDirty = true;
  }

  private drawTypeCard(): void {
    const mail = this.current;
    if (!mail) return;
    if (this.typeCard) {
      this.typeGroup.remove(this.typeCard);
      const m = this.typeCard.material as MeshBasicMaterial;
      m.map?.dispose(); m.dispose(); this.typeCard.geometry.dispose();
    }
    const seal = SEAL_WAX[mail.flair.seal || ''] || '#8B4FB8';
    // A blinking-style bar where the next letter goes.
    this.typeCard = letterCard(this.me?.name || 'Me', mail.from.name, `${this.typeText}|`, seal, 0.42, PAPERS[0],
      this.typeText.trim() ? 'Press Send when it is ready' : 'Type with the keys below');
    this.typeCard.scale.setScalar(0.72);
    this.typeCard.position.set(0, 0.19, 0);
    this.typeGroup.add(this.typeCard);
    this.typeSend.visible = this.typeText.trim().length > 0;
  }

  private sendTyped(): void {
    const text = this.typeText.trim();
    if (!this.typing || !text) return;
    this.stopTyping();
    this.chooseReply(text);
  }

  /** Closes the voice answer and lets go of the microphone. */
  private stopVoice(): void {
    this.voiceTry++;
    this.recorder.cancel();
    this.voice = 'off';
    this.showVoice(false);
  }

// ---- lines 731-753 ------------------------------------------------------------
  /** Writes who the envelope is for, and from whom, on its front, so it can be read as it is held out. */
  private labelEnvelope(to: string, from: string): void {
    if (this.envLabel) {
      this.letter.remove(this.envLabel);
      const m = this.envLabel.material as MeshBasicMaterial;
      m.map?.dispose(); m.dispose(); this.envLabel.geometry.dispose();
      this.envLabel = null;
    }
    const lm = this.letterMesh;
    const parent = lm.parent;
    parent?.remove(lm);
    lm.updateMatrixWorld(true);
    const box = new Box3().setFromObject(lm);
    parent?.add(lm);
    if (box.isEmpty()) return;
    const sx = box.max.x - box.min.x, sy = box.max.y - box.min.y;
    const label = envelopeLabel(to === 'friend' ? 'you' : to, from, sx * 0.9, sy * 0.8);
    label.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.max.z + 0.004);
    label.renderOrder = 2;
    this.envLabel = label;
    this.letter.add(label);
  }


// ---- lines 894-956 ------------------------------------------------------------
  /** Draws the open letter with this text (the original, or its translation, which says so). */
  private drawCard(body: string, translated: boolean): void {
    const { from, to, seal, paper } = this.cardArgs;
    // A long letter comes on a bigger page, so its smaller writing stays easy to read.
    const card = letterCard(from, to, body, seal, body.length > 420 ? 0.56 : 0.42, paper,
      translated ? `Translated by Meta AI into ${myLanguage().label}` : undefined);
    const old = this.card.material as MeshBasicMaterial;
    this.card.material = card.material;
    old.map?.dispose(); old.dispose();
    const oldGeo = this.card.geometry;
    this.card.geometry = card.geometry;
    oldGeo.dispose();
  }

  /** Translation is offered for friends' letters (signed in) not already in your language. */
  private canTranslate(): boolean {
    if (!this.account || !this.current) return false;
    const body = this.cardArgs.body;
    return this.translated || langOf(body) !== myLanguage().id || localSegments(body, langOf(body)).mixed;
  }

  /** Meta's model translates the open letter into your language; "Show original" switches back. */
  private async translateLetter(): Promise<void> {
    if (this.phase !== 'reading' || this.translating) return;
    const target = myLanguage();
    const body = this.cardArgs.body;
    const key = `${target.id}|${body}`;
    let text = this.translations.get(key);
    if (!text) {
      const token = ++this.translateToken;
      this.translating = true;
      this.failUntil = 0;
      try {
        const form = new FormData();
        form.append('action', 'translate');
        form.append('text', body);
        form.append('lang', target.name);
        const r = await askAI<{ text?: string }>(form);
        text = String(r.text || '').trim();
        if (text) this.translations.set(key, text);
      } catch (e) {
        console.warn('[Courio] Could not translate the letter', e);
      }
      if (token !== this.translateToken) return; // another letter, or put away meanwhile
      this.translating = false;
      if (!text) { this.failUntil = this.clock + 3; return; }
    }
    if (this.phase !== 'reading') return;
    this.stopReading(false);
    this.translated = true;
    this.drawCard(text, true);
    this.readBody = text;
    this.readLang = target.id;
  }

  private showOriginal(): void {
    if (!this.translated) return;
    this.stopReading(false);
    this.translated = false;
    this.drawCard(this.cardArgs.body, false);
    this.readBody = this.cardArgs.body;
    this.readLang = langOf(this.cardArgs.body);
  }

// ---- lines 1181-1282 ------------------------------------------------------------
  /** The companion reads the open letter to you. asked: you pressed the button (so it keeps reading the next ones). */
  private async readAloud(asked: boolean): Promise<void> {
    if (this.phase !== 'reading') return;
    if (asked) this.setAutoRead(true);
    const body = this.readBody, main = this.readLang;
    const local = localSegments(body, main);
    let parts = local.parts;
    // A letter that mixes languages: Meta's model (Muse Spark) marks which words are in which language,
    // so each is read by a native voice. Asked once per letter; the headset's own guess is the fallback.
    if ((local.mixed || mightMix(body)) && this.account) {
      const cached = this.langCache.get(body);
      if (cached) parts = cached;
      else {
        const token = ++this.readToken;
        this.readPreparing = true;
        this.placeReadPills();
        try {
          const form = new FormData();
          form.append('action', 'languages');
          form.append('text', body);
          const r = await askAI<{ parts?: Segment[] }>(form);
          if (Array.isArray(r.parts) && r.parts.length) { parts = r.parts; this.langCache.set(body, parts); }
        } catch (e) {
          console.warn("[Courio] Reading with the headset's own language guess", e);
        }
        if (token !== this.readToken || this.phase !== 'reading') return; // stopped or put away meanwhile
        this.readPreparing = false;
      }
    }
    // "Dear ..." and "From ..." in the letter's own language; no "Dear" if the letter has its own greeting.
    const to = this.readTo === 'friend' ? '' : ` ${this.readTo}`;
    const hello: Record<string, string> = { en: `Dear${to},`, fr: `Bonjour${to},`, es: `Hola${to},` };
    const bye: Record<string, string> = { en: `From ${this.readFrom}.`, fr: `De la part de ${this.readFrom}.`, es: `De parte de ${this.readFrom}.` };
    const lang = hello[main] ? main : 'en';
    const all: Segment[] = [
      ...(greets(body) ? [] : [{ lang, text: hello[lang] }]),
      ...parts,
      ...(signsOff(body) ? [] : [{ lang, text: bye[lang] }]),
    ];
    let first = true;
    const ok = this.reader.readSegments(all, this.readVoice, () => {
      // Each new sentence: a little bounce, as if it were talking.
      if (!first) this.rig.boop();
      first = false;
    }, () => this.placeReadPills());
    if (!ok && asked) console.warn('[Courio] This browser cannot read aloud');
    this.placeReadPills();
  }

  /** Stops reading. asked: you pressed Stop (so the next letters are not read either). */
  private stopReading(asked: boolean): void {
    if (asked) this.setAutoRead(false);
    this.readToken++;
    this.readPreparing = false;
    if (this.reader.speaking) this.reader.stop();
    if (this.readPill) for (const m of [this.readPill, this.stopPill, this.translatePill, this.originalPill, this.busyPill, this.failPill]) m.visible = false;
  }

  private setAutoRead(on: boolean): void {
    this.autoRead = on;
    try { localStorage.setItem('courio.readaloud.v1', on ? '1' : '0'); } catch { /* fine without */ }
  }

  /** "Read it to me" (or "Stop reading") just under the open letter, facing you. */
  private placeReadPills(): void {
    const all = [this.readPill, this.stopPill, this.translatePill, this.originalPill, this.busyPill, this.failPill];
    if (this.phase !== 'reading') { for (const m of all) m.visible = false; return; }
    // Which buttons show: read or stop on the left, translate (or its state) on the right.
    const speaking = this.reader.speaking || this.readPreparing;
    const left = canSpeak ? (speaking ? this.stopPill : this.readPill) : null;
    const right = !this.canTranslate() ? null
      : this.translating ? this.busyPill
      : this.clock < this.failUntil ? this.failPill
      : this.translated ? this.originalPill : this.translatePill;
    const shown = [left, right].filter((m): m is Mesh => !!m);
    this.envBox.setFromBufferAttribute(this.card.geometry.attributes.position as never);
    const s = this.card.scale.x;
    const k = Math.min(1, s * 1.2);
    for (const m of all) m.visible = shown.includes(m);
    shown.forEach((m, i) => {
      const x = shown.length === 2 ? (i === 0 ? -0.112 : 0.112) * k : 0;
      m.position.set(x, (this.envBox.min.y * s) - 0.04, 0.003).applyQuaternion(this.card.quaternion).add(this.card.position);
      m.quaternion.copy(this.card.quaternion);
      m.scale.setScalar(k);
    });
  }

  /** The voice picked on the chooser, else Juno's own (a child's voice, the owner's choice), else from the look. */
  private voiceChoice(from: string): 'auto' | VoiceKind {
    const pick = this.chooser.choice.voice;
    if (pick !== 'auto') return pick;
    return from === JUNO.name ? 'little' : 'auto';
  }

  /** How this letter opens: the one picked on the chooser, or a different one each time ("Surprise me"). */
  private openingStyle(): OpeningId {
    const pick = this.chooser.choice.opening;
    if (pick !== 'surprise') return OPENINGS.some((o) => o.id === pick) ? pick : 'classic';
    const others = OPENINGS.filter((o) => o.id !== this.lastOpening);
    this.lastOpening = others[Math.floor(Math.random() * others.length)].id;
    return this.lastOpening;
  }

// ---- lines 1598-1654 ------------------------------------------------------------
      case 'unseal': {
        // It comes to you and grows (0 to 0.3 s), then opens in the chosen way (see envelope3d.ts).
        const e = this.envelope;
        const come = smooth(t / 0.3);
        this.tmp.lerpVectors(this.from, this.envAt, come);
        this.tmp.y += 0.04 * Math.sin(Math.PI * come);
        setWorldPosition(e.group, this.tmp);
        e.group.lookAt(this.viewer);
        e.group.scale.setScalar(this.envScale + (1 - this.envScale) * come);
        e.pose(t, 1);
        // The seal breaks or the bow comes undone: a little pop and a few sparkles.
        for (const p of e.pops) {
          if (t - dt < p && t >= p) {
            this.playSound(this.sounds.pop);
            this.sparkles.burst(e.popWorld(this.tmp2), 8, 0.02, 0.22, 0.1);
          }
        }
        if (t >= e.length) {
          // The letter leaves the envelope and flies up to open in front of you.
          e.group.parent?.attach(e.sheet);
          e.sheet.getWorldPosition(this.from);
          this.sheetScale = e.sheet.scale.y;
          this.phase = 'flight';
          this.t = 0;
        }
        break;
      }

      case 'flight': {
        const e = this.envelope;
        const k = smooth(t / 0.5);
        this.tmp.lerpVectors(this.from, this.cardAt, k);
        setWorldPosition(e.sheet, this.tmp);
        e.sheet.lookAt(this.viewer);
        // It ends exactly the size of the opened letter as it first appears, so one becomes the other.
        this.envBox.setFromBufferAttribute(this.card.geometry.attributes.position as never);
        const want = (0.3 * (this.envBox.max.x - this.envBox.min.x)) / SHEET_W;
        e.sheet.scale.setScalar(this.sheetScale + (want - this.sheetScale) * k);
        // What is left (envelope, light, clouds) finishes its moment, drifts down and fades away.
        e.pose(e.length + t, 1 - smooth(t / 0.4));
        e.group.position.y -= dt * 0.08;
        if (t >= 0.5) {
          e.hide();
          this.card.visible = true;
          this.phase = 'reading';
          this.t = 0;
        }
        break;
      }

      case 'reading': {
        this.card.scale.setScalar(0.3 + 0.7 * smooth(t / 0.35));
        this.placeReadPills();
        if (!this.autoTried && t > 0.5) { this.autoTried = true; if (this.autoRead) void this.readAloud(false); }
        if (this.reader.speaking) this.rig.glad(0.3); // a happy face while it reads to you
        break;
      }

// ---- end of excerpt (the full file has 1802 lines) ----
