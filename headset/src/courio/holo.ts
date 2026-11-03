// The glowing microphone that appears while you answer a letter by voice: a hologram of a microphone
// over a soft disc of light, with a row of light bars behind it that dance to your voice, and specks of
// light drifting up. While Courio writes your letter, the bars ripple gently instead. Pointing at the
// microphone and pressing it means "I've finished".
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RingGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from '@iwsdk/core';

const CYAN = new Color('#55E6FF');
const BLUE = new Color('#3A7BFF');
const PINK = new Color('#FF5FB4');

function glow(color: Color, opacity: number, wire = false): MeshBasicMaterial {
  return new MeshBasicMaterial({ color, transparent: true, opacity, blending: NormalBlending, depthWrite: false, side: DoubleSide, wireframe: wire });
}

/** A dark glass panel with a soft blue glow, so the light shows up in any room. */
function backplate(w: number, h: number): Mesh {
  const W = 512, H = Math.round((512 * h) / w);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const r = 40;
  g.beginPath();
  g.moveTo(r, 0); g.arcTo(W, 0, W, H, r); g.arcTo(W, H, 0, H, r); g.arcTo(0, H, 0, 0, r); g.arcTo(0, 0, W, 0, r); g.closePath();
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(10,16,40,0.88)'); bg.addColorStop(1, 'rgba(6,10,28,0.94)');
  g.fillStyle = bg; g.fill();
  const spot = g.createRadialGradient(W / 2, H * 0.85, 10, W / 2, H * 0.85, W * 0.55);
  spot.addColorStop(0, 'rgba(70,140,255,0.45)'); spot.addColorStop(1, 'rgba(70,140,255,0)');
  g.fillStyle = spot; g.fill();
  g.lineWidth = 4; g.strokeStyle = 'rgba(85,230,255,0.55)'; g.stroke();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
}

export class MicHologram {
  readonly group = new Group();
  /** An invisible box round the microphone, to point at and press. */
  readonly hit: Mesh;
  private mic = new Group();
  private bars: Mesh[] = [];
  private barMats: MeshBasicMaterial[] = [];
  private heights: Float32Array;
  private levels: Float32Array;
  private disc: Mesh;
  private halo: Mesh;
  private dust: Points;
  private dustY: Float32Array;
  private grille: MeshBasicMaterial;
  private t = 0;
  private appear = 0;
  state: 'off' | 'listening' | 'thinking' = 'off';

  constructor(count = 24) {
    this.heights = new Float32Array(count);
    this.levels = new Float32Array(count);

    // The microphone: a glowing head with a wire grille, a cradle, a stem and a foot.
    const head = new Mesh(new CapsuleGeometry(0.022, 0.034, 6, 16), glow(CYAN, 0.35));
    this.grille = glow(CYAN, 0.9, true);
    const grille = new Mesh(new CapsuleGeometry(0.0235, 0.034, 5, 12), this.grille);
    head.position.y = grille.position.y = 0.105;
    const band = new Mesh(new TorusGeometry(0.024, 0.0022, 6, 28), glow(CYAN, 0.9));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.088;
    const cradle = new Mesh(new TorusGeometry(0.034, 0.0022, 6, 28, Math.PI), glow(CYAN, 0.85));
    cradle.rotation.z = Math.PI;
    cradle.position.y = 0.1;
    const stem = new Mesh(new CylinderGeometry(0.0022, 0.0022, 0.05, 8), glow(CYAN, 0.85));
    stem.position.y = 0.043;
    const foot = new Mesh(new TorusGeometry(0.016, 0.0022, 6, 24), glow(CYAN, 0.85));
    foot.rotation.x = Math.PI / 2;
    foot.position.y = 0.018;
    this.mic.add(head, grille, band, cradle, stem, foot);
    this.mic.position.z = 0.02;
    this.group.add(this.mic);

    // The bars: a gentle arc behind the microphone, blue at the edges and cyan in the middle.
    for (let i = 0; i < count; i++) {
      const k = i / (count - 1);
      const x = (k - 0.5) * 0.34;
      const mid = 1 - Math.abs(k - 0.5) * 2;
      const mat = glow(BLUE.clone().lerp(CYAN, mid), 0.85);
      const bar = new Mesh(new BoxGeometry(0.007, 1, 0.003), mat);
      bar.position.set(x, 0.012, -0.03 - (1 - mid) * 0.04);
      bar.scale.y = 0.004;
      this.bars.push(bar); this.barMats.push(mat);
      this.group.add(bar);
    }

    // A disc of light underneath, like a phone screen glowing on a table.
    this.disc = new Mesh(new RingGeometry(0.03, 0.2, 48, 1), glow(BLUE, 0.22));
    this.disc.rotation.x = -Math.PI / 2;
    this.halo = new Mesh(new RingGeometry(0.188, 0.196, 64, 1), glow(CYAN, 0.7));
    this.halo.rotation.x = -Math.PI / 2;
    this.group.add(this.disc, this.halo);
    const plate = backplate(0.44, 0.26);
    plate.position.set(0, 0.11, -0.09);
    plate.renderOrder = -2;
    this.group.add(plate);

    // Specks of light drifting up.
    const n = 70;
    const pos = new Float32Array(n * 3);
    this.dustY = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.36;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.12 - 0.02;
      this.dustY[i] = Math.random() * 0.2;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    this.dust = new Points(g, new PointsMaterial({ color: CYAN, size: 0.004, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }));
    this.group.add(this.dust);

    this.hit = new Mesh(new BoxGeometry(0.11, 0.17, 0.08), new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.hit.position.y = 0.08;
    this.group.add(this.hit);
    this.group.visible = false;
  }

  private flashT = 0;
  /** A bright pulse: the microphone is open, start talking. */
  flash(): void { this.flashT = 1; }

  show(state: 'off' | 'listening' | 'thinking'): void {
    if (state !== 'off' && this.state === 'off') this.appear = 0;
    this.state = state;
    this.group.visible = state !== 'off';
  }

  /**
   * Moves everything on by dt seconds. `voice` holds the loudness of each band while listening, or null
   * when live loudness is not available (the bars then breathe on their own).
   */
  update(dt: number, voice: Float32Array | null): void {
    if (this.state === 'off') return;
    this.t += dt;
    this.appear = Math.min(1, this.appear + dt / 0.35);
    const s = 0.4 + 0.6 * (1 - Math.pow(1 - this.appear, 3));
    this.group.scale.setScalar(s);
    const n = this.bars.length;
    let loud = 0;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      let want: number;
      if (this.state === 'thinking') {
        // A wave running across while your letter is written.
        want = 0.15 + 0.35 * Math.max(0, Math.sin(this.t * 5 - k * 9));
      } else if (voice) {
        // Your voice, mirrored so the middle bars carry the loudest bands.
        const j = Math.floor(Math.abs(k - 0.5) * 2 * (voice.length - 1));
        const idle = 0.05 + 0.07 * (0.5 + 0.5 * Math.sin(this.t * 3.1 + k * 7));
        want = Math.max(idle, 0.05 + voice[j] * 0.95);
      } else {
        want = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(this.t * 3.1 + k * 7)) * (0.5 + 0.5 * Math.sin(this.t * 1.7 - k * 4));
      }
      this.levels[i] = want;
      // Up fast, down slowly, like a real level meter.
      const h = this.heights[i];
      this.heights[i] = want > h ? h + (want - h) * Math.min(1, dt * 20) : h + (want - h) * Math.min(1, dt * 5);
      const height = 0.004 + this.heights[i] * 0.16;
      this.bars[i].scale.y = height;
      this.bars[i].position.y = 0.006 + height / 2;
      this.barMats[i].color.copy(BLUE).lerp(CYAN, 1 - Math.abs(k - 0.5) * 2).lerp(PINK, Math.max(0, this.heights[i] - 0.75) * 2.5);
      loud += this.heights[i];
    }
    loud /= n;
    // The microphone glows and swells a little with your voice, and turns slowly while thinking.
    this.flashT = Math.max(0, this.flashT - dt * 1.6);
    this.grille.opacity = 0.6 + loud * 0.8 + this.flashT * 0.4;
    this.mic.scale.setScalar(1 + loud * 0.18 + this.flashT * 0.25);
    this.mic.rotation.y = this.state === 'thinking' ? this.t * 2.2 : Math.sin(this.t * 0.8) * 0.25;
    (this.halo.material as MeshBasicMaterial).opacity = 0.45 + 0.35 * Math.sin(this.t * 2.4) * (this.state === 'thinking' ? 1 : 0.4) + loud * 0.4;
    this.halo.scale.setScalar(1 + loud * 0.15);
    // Specks rise, faster when you speak.
    const pos = this.dust.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < this.dustY.length; i++) {
      this.dustY[i] += dt * (0.03 + loud * 0.15 + (i % 5) * 0.004);
      if (this.dustY[i] > 0.22) this.dustY[i] = 0;
      pos.setY(i, this.dustY[i]);
    }
    pos.needsUpdate = true;
  }
}
