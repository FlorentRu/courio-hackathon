// A keyboard drawn in the room, for typing a reply in the headset: press the keys with a pointer or a
// fingertip. Three pages: letters, numbers and signs, and accented letters (é è à ç…) for French or
// Spanish. Shift capitalises the next letter (and switches on by itself at the start of a sentence).
import { CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';

export type Page = 'abc' | '123' | 'acc';
type Key = { mesh: Mesh; key: string; page: Page; mat: MeshBasicMaterial };

const U = 0.042; // one key, in metres
const GAP = 0.005;

// Special keys: ⇧ shift, ⌫ delete, ␣ space, and the page switches.
const PAGES: Record<Page, string[][]> = {
  abc: [[...'qwertyuiop'], [...'asdfghjkl'], ['⇧', ...'zxcvbnm', '⌫'], ['123', 'àé', '␣', ',', '.', '?']],
  '123': [[...'1234567890'], ['@', '#', '&', '-', '+', '(', ')', '/', ':', "'"], ['!', '"', ';', '*', '_', '%', '=', '€', '$', '⌫'], ['abc', 'àé', '␣', ',', '.', '!']],
  acc: [[...'éèêëàâùûüç'], [...'îïôœñáíóú'], ['⇧', '«', '»', '¿', '¡', '’', '…', '⌫'], ['abc', '123', '␣', ',', '.', '?']],
};
const WIDTH: Record<string, number> = { '␣': 4.6, '⇧': 1.5, '⌫': 1.5, '123': 1.5, abc: 1.5, 'àé': 1.5 };
const LABEL: Record<string, string> = { '␣': 'space', '⇧': '⇧', '⌫': '⌫', '123': '123', abc: 'abc', 'àé': 'àé' };

function keyTexture(label: string, w: number, special: boolean): CanvasTexture {
  const H = 112, W = Math.round(H * w);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const r = 22;
  g.beginPath();
  g.moveTo(6 + r, 6); g.arcTo(W - 6, 6, W - 6, H - 6, r); g.arcTo(W - 6, H - 6, 6, H - 6, r);
  g.arcTo(6, H - 6, 6, 6, r); g.arcTo(6, 6, W - 6, 6, r); g.closePath();
  g.fillStyle = special ? '#EFE3C8' : '#FBF4E4'; g.fill();
  g.lineWidth = 4; g.strokeStyle = special ? '#B48A2E' : '#C9972E'; g.stroke();
  g.fillStyle = '#3B2457'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${special && label.length > 1 ? 600 : 500} ${label.length > 2 ? 34 : 54}px system-ui, sans-serif`;
  g.fillText(label, W / 2, H / 2 + 3);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class Keyboard {
  readonly group = new Group();
  readonly keys: Key[] = [];
  page: Page = 'abc';
  shift = false;
  private pressed = new Map<Mesh, number>();

  constructor() {
    for (const page of Object.keys(PAGES) as Page[]) {
      PAGES[page].forEach((row, r) => {
        const widths = row.map((k) => WIDTH[k] ?? 1);
        const total = widths.reduce((a, b) => a + b, 0) * U + (row.length - 1) * GAP;
        let x = -total / 2;
        row.forEach((k, i) => {
          const w = widths[i] * U;
          const special = k.length > 1 || '⇧⌫␣'.includes(k);
          const mat = new MeshBasicMaterial({ map: keyTexture(LABEL[k] ?? k, widths[i], special), transparent: true, side: DoubleSide, depthWrite: false });
          const mesh = new Mesh(new PlaneGeometry(w, U), mat);
          mesh.position.set(x + w / 2, -r * (U + GAP), 0);
          x += w + GAP;
          this.group.add(mesh);
          this.keys.push({ mesh, key: k, page, mat });
        });
      });
    }
    this.setPage('abc');
  }

  setPage(p: Page): void {
    this.page = p;
    for (const k of this.keys) k.mesh.visible = k.page === p;
    this.paintShift();
  }

  setShift(on: boolean): void {
    this.shift = on;
    this.paintShift();
  }

  private paintShift(): void {
    for (const k of this.keys) if (k.key === '⇧') k.mat.color.set(this.shift ? '#D8C0F2' : '#FFFFFF');
  }

  /** The key behind a mesh, if it is one of ours. */
  keyOf(mesh: unknown): string | null {
    const k = this.keys.find((x) => x.mesh === mesh);
    return k ? k.key : null;
  }

  /** A little press: the key dips for a moment. */
  flash(mesh: unknown): void {
    const k = this.keys.find((x) => x.mesh === mesh);
    if (k) this.pressed.set(k.mesh, 0.15);
  }

  /**
   * A key typed on a real keyboard: the matching key in the room dips too (turning to its page if it
   * is on another one), so you can see what was typed.
   */
  showTyped(key: string): void {
    const want = key === ' ' ? '␣' : key === 'Backspace' ? '⌫' : key.toLowerCase();
    const k = this.keys.find((x) => x.key === want && x.page === this.page) ?? this.keys.find((x) => x.key === want);
    if (!k) return;
    if (k.page !== this.page) this.setPage(k.page);
    this.pressed.set(k.mesh, 0.15);
  }

  update(dt: number): void {
    for (const [m, left] of this.pressed) {
      const l = left - dt;
      if (l <= 0) { this.pressed.delete(m); m.scale.setScalar(1); m.position.z = 0; continue; }
      this.pressed.set(m, l);
      m.scale.setScalar(0.9);
      m.position.z = -0.004;
    }
  }

  /**
   * What a key does to the text: returns the new text (the page keys and shift just change the
   * keyboard). Capitals come on by themselves at the start and after . ! ?
   */
  apply(key: string, text: string, max = 700): string {
    if (key === 'abc') { this.setPage('abc'); return text; }
    if (key === '123') { this.setPage('123'); return text; }
    if (key === 'àé') { this.setPage('acc'); return text; }
    if (key === '⇧') { this.setShift(!this.shift); return text; }
    let out = text;
    if (key === '⌫') out = text.slice(0, -1);
    else if (text.length < max) {
      const ch = key === '␣' ? ' ' : this.shift ? key.toUpperCase() : key;
      out = text + ch;
      if (this.shift && /\p{L}/u.test(ch)) this.setShift(false);
    }
    this.autoShift(out);
    return out;
  }

  /** Capital letter next: at the very start, or after the end of a sentence. */
  autoShift(text: string): void {
    const want = text.trim() === '' || /[.!?¡¿]\s+$/u.test(text);
    if (want !== this.shift && (want || text.length === 0 || /\s$/u.test(text))) this.setShift(want);
  }
}
