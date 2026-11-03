// Opening a letter. When you take one, the envelope comes to you and opens in one of several ways
// (inspired by animated invitation videos the owner collected), then the letter flies up to be read:
//   Classic       the flap lifts, the wax seal pops, the letter slides out
//   Golden light  the seal glows, warm light and rays pour out, a ribbon of sparkles spirals up
//   Ribbon bow    a bow comes undone and its ribbons slide away, then the flap opens
//   Blooming      the four flaps of the envelope open outwards like petals, light inside
//   Pink cloud    soft pink clouds puff out of the envelope and the letter rises through them
//   Scroll        a scroll tied with a bow, in a ring of light, unrolls into the letter
// Everything is drawn with a few flat shapes, canvases and points, so it costs almost nothing.
import {
  BufferGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh,
  MeshBasicMaterial, PlaneGeometry, Points, PointsMaterial, SRGBColorSpace, Vector3,
} from '@iwsdk/core';

export type OpeningId = 'classic' | 'light' | 'ribbon' | 'bloom' | 'cloud' | 'scroll';
export const OPENINGS: { id: OpeningId; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'light', label: 'Golden light' },
  { id: 'ribbon', label: 'Ribbon bow' },
  { id: 'bloom', label: 'Blooming' },
  { id: 'cloud', label: 'Pink cloud' },
  { id: 'scroll', label: 'Scroll' },
];

export const ENV_W = 0.16;
export const ENV_H = 0.112;
/** The letter inside has the same shape as the opened letter card, so one turns smoothly into the other. */
export const SHEET_W = 0.134;
export const SHEET_H = SHEET_W * (720 / 1024);

/** How long each opening takes, from the tap until the letter flies to you (seconds). */
const LENGTH: Record<OpeningId, number> = { classic: 1.1, light: 1.45, ribbon: 1.5, bloom: 1.3, cloud: 1.25, scroll: 1.25 };
/** When something gives way (the seal breaks, the bow comes undone): a pop and a few sparkles. */
const POPS: Record<OpeningId, number[]> = { classic: [0.36], light: [0.5], ribbon: [0.32, 0.8], bloom: [0.37], cloud: [0.48], scroll: [0.38] };

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const smooth = (v: number) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
const span = (t: number, a: number, b: number) => smooth((t - a) / (b - a));
const easeOut = (v: number) => 1 - (1 - clamp01(v)) ** 3;
const rand = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

/** Mixes two #rrggbb colours (k = 0 gives a, 1 gives b). */
function mix(a: string, b: string, k: number): string {
  const p = (s: string) => (/^#[0-9a-f]{6}$/iu.test(s) ? [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) : null);
  const x = p(a), y = p(b);
  if (!x || !y) return a;
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}

function canvasTexture(W: number, H: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  draw(g, W, H);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Paper, wax and ribbon: drawn with depth so the thin layers always stack the right way round. */
function solid(color = '#ffffff'): MeshBasicMaterial {
  return new MeshBasicMaterial({ color, transparent: true, side: DoubleSide });
}
/** Light, glow and clouds: soft, see-through, never hiding what is behind them. */
function soft(map: CanvasTexture, color = '#ffffff'): MeshBasicMaterial {
  return new MeshBasicMaterial({ map, color, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false });
}

/** A triangle hinged along a-b with its point at apex; the texture's top edge runs along the hinge. */
function triangle(a: [number, number], b: [number, number], apex: [number, number]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([a[0], a[1], 0, b[0], b[1], 0, apex[0], apex[1], 0], 3));
  g.setAttribute('uv', new Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
  return g;
}

function mesh(geo: BufferGeometry, mat: MeshBasicMaterial, order: number): Mesh {
  const m = new Mesh(geo, mat);
  m.renderOrder = order;
  return m;
}

type Puff = { mesh: Mesh; mat: MeshBasicMaterial; from: Vector3; to: Vector3; size: number; delay: number };

export class OpenEnvelope {
  readonly group = new Group();
  /** The letter inside, which comes out and then flies to you. */
  readonly sheet: Mesh;
  style: OpeningId = 'classic';
  /** Seconds from the tap until the letter is out, ready to fly to you. */
  length = LENGTH.classic;
  pops: number[] = POPS.classic;

  // The envelope: inside, front pocket, top flap and seal; or four petal flaps for Blooming.
  private back: Mesh;
  private pocket: Mesh;
  private flap = new Group();
  private flapMesh: Mesh;
  private seal: Mesh;
  private petals: Group[] = [];
  // Light and air.
  private glow: Mesh;
  private sealGlow: Mesh;
  private rays: Mesh;
  private spiral: Points;
  private spiralPos: Float32Array;
  private puffs: Puff[] = [];
  // Ribbons.
  private bandL: Mesh;
  private bandR: Mesh;
  private bow: Mesh;
  // The scroll.
  private rollL: Mesh;
  private rollR: Mesh;
  private wrap: Mesh;
  private ring: Mesh;

  private m = {
    back: solid(), sheet: solid(), pocket: solid(), flap: solid(), seal: solid(), petal: solid(),
    band: solid(), bow: solid(), roll: solid(), wrap: solid(),
    glow: null as unknown as MeshBasicMaterial, sealGlow: null as unknown as MeshBasicMaterial,
    rays: null as unknown as MeshBasicMaterial, ring: null as unknown as MeshBasicMaterial,
    spiral: null as unknown as PointsMaterial,
  };
  private look = '';

  constructor() {
    const W = ENV_W, H = ENV_H;
    this.m.seal.alphaTest = 0.5; // the round seal's see-through corners
    this.m.bow.alphaTest = 0.4;

    this.back = mesh(new PlaneGeometry(W, H), this.m.back, 0);
    this.back.position.z = -0.003;
    this.sheet = mesh(new PlaneGeometry(SHEET_W, SHEET_H), this.m.sheet, 2);
    this.pocket = mesh(new PlaneGeometry(W, H), this.m.pocket, 3);
    // The flap: a triangle hinged along the top edge, folded down over the front.
    this.flapMesh = mesh(triangle([-W / 2, 0], [W / 2, 0], [0, -H * 0.62]), this.m.flap, 4);
    this.flapMesh.position.z = 0.0015;
    this.flap.add(this.flapMesh);
    this.flap.position.y = H / 2;
    this.seal = mesh(new PlaneGeometry(0.03, 0.03), this.m.seal, 5);

    // Four petals (Blooming): top, bottom, left, right, each hinged on its own edge.
    const petalShapes: [[number, number], [number, number], [number, number], number, number, number][] = [
      [[-W / 2, 0], [W / 2, 0], [0, -H / 2], 0, H / 2, 0.0024],
      [[-W / 2, 0], [W / 2, 0], [0, H / 2], 0, -H / 2, 0.0018],
      [[0, H / 2], [0, -H / 2], [W / 2, 0], -W / 2, 0, 0.0012],
      [[0, -H / 2], [0, H / 2], [-W / 2, 0], W / 2, 0, 0.0012],
    ];
    for (const [a, b, apex, x, y, z] of petalShapes) {
      const hinge = new Group();
      hinge.position.set(x, y, 0);
      const p = mesh(triangle(a, b, apex), this.m.petal, 4);
      p.position.z = z;
      hinge.add(p);
      this.petals.push(hinge);
    }

    // Light: a warm glow, rays fanning out of the opening, a glow behind the seal.
    const glowTex = canvasTexture(256, 256, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(255,248,222,1)'); r.addColorStop(0.25, 'rgba(255,224,150,0.78)');
      r.addColorStop(0.6, 'rgba(255,196,96,0.22)'); r.addColorStop(1, 'rgba(255,186,80,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    });
    this.m.glow = soft(glowTex);
    this.glow = mesh(new PlaneGeometry(1, 1), this.m.glow, 6);
    this.m.sealGlow = soft(glowTex);
    this.sealGlow = mesh(new PlaneGeometry(0.075, 0.075), this.m.sealGlow, 6);
    this.sealGlow.position.z = -0.0005;
    this.seal.add(this.sealGlow);
    const raysTex = canvasTexture(512, 512, (g, w, h) => {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 11; i++) {
        const a = -1.2 + i * 0.24 + (rand(i, 1) - 0.5) * 0.1;
        const len = h * (0.55 + 0.4 * rand(i, 2));
        const half = 0.035 + 0.03 * rand(i, 3);
        const ox = w / 2, oy = h;
        const ex = ox + Math.sin(a) * len, ey = oy - Math.cos(a) * len;
        const grad = g.createLinearGradient(ox, oy, ex, ey);
        grad.addColorStop(0, 'rgba(255,244,200,0.95)'); grad.addColorStop(1, 'rgba(255,200,96,0)');
        g.fillStyle = grad;
        g.beginPath(); g.moveTo(ox, oy);
        g.lineTo(ox + Math.sin(a - half) * len, oy - Math.cos(a - half) * len);
        g.lineTo(ox + Math.sin(a + half) * len, oy - Math.cos(a + half) * len);
        g.closePath(); g.fill();
      }
    });
    this.m.rays = soft(raysTex);
    this.rays = mesh(new PlaneGeometry(0.34, 0.34).translate(0, 0.17, 0), this.m.rays, 6);
    this.rays.position.set(0, H * 0.3, -0.0025);

    // A ribbon of sparkles that spirals up around the letter (Golden light).
    const dotTex = canvasTexture(64, 64, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,240,190,0.85)'); r.addColorStop(1, 'rgba(255,220,140,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    });
    const sg = new BufferGeometry();
    sg.setAttribute('position', new Float32BufferAttribute(new Float32Array(130 * 3), 3));
    this.spiralPos = sg.attributes.position.array as Float32Array; // (the attribute keeps its own copy)
    this.m.spiral = new PointsMaterial({ map: dotTex, color: '#FFE6A0', size: 0.017, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0 });
    this.spiral = new Points(sg, this.m.spiral);
    this.spiral.renderOrder = 7;
    this.spiral.frustumCulled = false;

    // Pink clouds (Pink cloud).
    const puffTex = canvasTexture(256, 256, (g, w) => {
      const blobs = [[0.5, 0.55, 0.36], [0.32, 0.6, 0.24], [0.68, 0.6, 0.25], [0.42, 0.4, 0.24], [0.6, 0.38, 0.22]];
      for (const [x, y, r] of blobs) {
        const grad = g.createRadialGradient(x * w, y * w, 0, x * w, y * w, r * w);
        grad.addColorStop(0, 'rgba(255,255,255,0.95)'); grad.addColorStop(0.6, 'rgba(255,250,252,0.7)'); grad.addColorStop(1, 'rgba(255,245,250,0)');
        g.fillStyle = grad; g.beginPath(); g.arc(x * w, y * w, r * w, 0, Math.PI * 2); g.fill();
      }
    });
    const puffGeo = new PlaneGeometry(1, 1);
    for (let i = 0; i < 16; i++) {
      const mat = soft(puffTex, i % 3 === 0 ? '#FFD3E6' : '#FFE8F2');
      const pm = mesh(puffGeo, mat, 8);
      pm.rotation.z = rand(i, 4) * Math.PI * 2;
      const side = (i / 15 - 0.5) * 2;
      this.puffs.push({
        mesh: pm, mat,
        from: new Vector3(side * 0.03, H * 0.3, 0.004),
        to: new Vector3(side * 0.14 + (rand(i, 5) - 0.5) * 0.04, -0.01 + 0.14 * rand(i, 6), 0.012 + 0.035 * rand(i, 7)),
        size: 0.09 + 0.08 * rand(i, 8),
        delay: 0.52 + i * 0.028,
      });
    }

    // Ribbons: a band across the envelope in two halves, and a bow.
    this.bandL = mesh(new PlaneGeometry(W / 2 + 0.006, 0.016), this.m.band, 5);
    this.bandR = mesh(new PlaneGeometry(W / 2 + 0.006, 0.016), this.m.band, 5);
    this.bow = mesh(new PlaneGeometry(0.095, 0.095 * (200 / 256)), this.m.bow, 5);

    // The scroll: two rolls of paper, a ribbon wrapped round them, a ring of light behind.
    const rollGeo = new CylinderGeometry(1, 1, SHEET_H * 1.06, 28, 1, false);
    this.rollL = mesh(rollGeo, this.m.roll, 3);
    this.rollR = mesh(rollGeo, this.m.roll, 3);
    this.wrap = mesh(new CylinderGeometry(1, 1, 0.016, 28, 1, true), this.m.wrap, 4);
    this.wrap.scale.set(0.027, 1, 0.016);
    const ringTex = canvasTexture(256, 256, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(255,220,130,0)'); r.addColorStop(0.62, 'rgba(255,220,130,0)');
      r.addColorStop(0.74, 'rgba(255,214,120,0.8)'); r.addColorStop(0.8, 'rgba(255,250,228,1)');
      r.addColorStop(0.86, 'rgba(255,214,120,0.75)'); r.addColorStop(1, 'rgba(255,214,120,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
      // A few brighter specks along the ring.
      for (let i = 0; i < 14; i++) {
        const a = rand(i, 9) * Math.PI * 2, d = w * 0.4;
        g.fillStyle = 'rgba(255,255,240,0.9)';
        g.beginPath(); g.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 2 + 3 * rand(i, 10), 0, Math.PI * 2); g.fill();
      }
    });
    this.m.ring = soft(ringTex);
    this.ring = mesh(new PlaneGeometry(1, 1), this.m.ring, 1);
    this.ring.position.z = -0.02;

    this.group.add(this.back, this.sheet, this.pocket, this.flap, ...this.petals, this.glow, this.rays, this.spiral,
      ...this.puffs.map((p) => p.mesh), this.bandL, this.bandR, this.bow, this.rollL, this.rollR, this.wrap, this.ring);
    this.setLook('#FBF4E4', '#C0392B');
    this.start('classic');
    this.group.visible = false;
  }

  /** The paper colour of the letter and the colour of the wax seal (the ribbons take after the wax). */
  setLook(paper: string, wax: string): void {
    const key = `${paper}|${wax}`;
    if (key === this.look) return;
    this.look = key;
    const ribbon = mix(wax, '#FFFFFF', 0.42);
    const set = (m: MeshBasicMaterial, t: CanvasTexture) => { m.map?.dispose(); m.map = t; m.needsUpdate = true; };
    const edge = 'rgba(201,151,46,0.85)';

    set(this.m.back, canvasTexture(256, 180, (g, w, h) => {
      g.fillStyle = '#EADBBE'; g.fillRect(0, 0, w, h);
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
      r.addColorStop(0, 'rgba(255,236,190,0.9)'); r.addColorStop(1, 'rgba(255,236,190,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    }));
    set(this.m.pocket, canvasTexture(512, 360, (g, w, h) => {
      g.fillStyle = '#FFF9EC'; g.fillRect(0, 0, w, h);
      // The folds of the back of an envelope.
      g.strokeStyle = 'rgba(150,120,80,0.35)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.5, h * 0.45); g.lineTo(w, h); g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.42, h * 0.5); g.moveTo(w, 0); g.lineTo(w * 0.58, h * 0.5); g.stroke();
      g.strokeStyle = edge; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    }));
    set(this.m.flap, canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#F6ECD6'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w / 2, h); g.closePath(); g.fill();
      g.strokeStyle = edge; g.lineWidth = 6; g.beginPath(); g.moveTo(2, 2); g.lineTo(w / 2, h - 3); g.lineTo(w - 2, 2); g.stroke();
    }));
    set(this.m.petal, canvasTexture(256, 256, (g, w, h) => {
      // A petal-like flap with a scalloped, lace-like edge.
      g.fillStyle = '#FFF7EA'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w / 2, h); g.closePath(); g.fill();
      g.fillStyle = '#F3E3C6';
      for (const [x0, x1] of [[0, w / 2], [w, w / 2]]) {
        for (let k = 0.04; k < 0.97; k += 0.075) {
          const x = x0 + (x1 - x0) * k, y = h * k;
          g.beginPath(); g.arc(x + (x0 === 0 ? 7 : -7), y - 3, 7, 0, Math.PI * 2); g.fill();
        }
      }
      g.strokeStyle = edge; g.lineWidth = 4; g.beginPath(); g.moveTo(16, 6); g.lineTo(w / 2, h - 22); g.lineTo(w - 16, 6); g.stroke();
      g.fillStyle = 'rgba(201,151,46,0.35)';
      for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(w * (0.35 + 0.3 * rand(i, 11)), h * (0.12 + 0.4 * rand(i, 12)), 3, 0, Math.PI * 2); g.fill(); }
    }));
    set(this.m.sheet, canvasTexture(512, 360, (g, w, h) => {
      g.fillStyle = paper; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#C9972E'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
      g.fillStyle = 'rgba(59,49,40,0.45)';
      for (let i = 0; i < 6; i++) g.fillRect(w * 0.1, h * (0.18 + i * 0.12), w * (i === 5 ? 0.4 : 0.78), h * 0.025);
    }));
    set(this.m.seal, canvasTexture(128, 128, (g, w, h) => {
      g.beginPath(); g.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2); g.fillStyle = wax; g.fill();
      g.beginPath(); g.arc(w / 2, h / 2, w * 0.32, 0, Math.PI * 2); g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.92)'; g.font = `700 ${Math.round(w * 0.42)}px Georgia, serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('C', w / 2, h / 2 + 2);
    }));
    set(this.m.band, canvasTexture(64, 16, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, mix(ribbon, '#000000', 0.18)); grad.addColorStop(0.5, mix(ribbon, '#FFFFFF', 0.3)); grad.addColorStop(1, mix(ribbon, '#000000', 0.18));
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
    }));
    this.m.wrap.color.set(ribbon);
    set(this.m.bow, canvasTexture(256, 200, (g, w) => {
      const dark = mix(ribbon, '#000000', 0.25), light = mix(ribbon, '#FFFFFF', 0.25);
      const cx = w / 2, cy = 82;
      g.lineJoin = 'round';
      // Two tails with notched ends.
      for (const s of [-1, 1]) {
        g.fillStyle = ribbon; g.strokeStyle = dark; g.lineWidth = 3;
        g.beginPath(); g.moveTo(cx - 8 * s, cy + 6); g.lineTo(cx + 8 * s, cy + 8);
        g.lineTo(cx + 58 * s, 190); g.lineTo(cx + 40 * s, 176); g.lineTo(cx + 30 * s, 196); g.closePath(); g.fill(); g.stroke();
      }
      // Two loops.
      for (const s of [-1, 1]) {
        g.save(); g.translate(cx + 48 * s, cy - 6); g.rotate(-0.32 * s);
        g.fillStyle = ribbon; g.strokeStyle = dark; g.lineWidth = 3;
        g.beginPath(); g.ellipse(0, 0, 52, 32, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = dark; g.globalAlpha = 0.55;
        g.beginPath(); g.ellipse(4 * s, 3, 28, 13, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1; g.strokeStyle = light; g.lineWidth = 4;
        g.beginPath(); g.ellipse(0, -6, 40, 20, 0, Math.PI * 1.1, Math.PI * 1.75); g.stroke();
        g.restore();
      }
      // The knot.
      g.fillStyle = mix(ribbon, '#000000', 0.08); g.strokeStyle = dark; g.lineWidth = 3;
      g.beginPath(); g.ellipse(cx, cy, 17, 21, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    }));
    set(this.m.roll, canvasTexture(256, 256, (g, w, h) => {
      // Around the roll: brightest facing you (the texture's left and right edges), darker behind.
      for (let x = 0; x < w; x++) {
        const shade = 0.5 + 0.5 * Math.cos((x / w) * Math.PI * 2);
        g.fillStyle = mix(mix(paper, '#B08A55', 0.35), mix(paper, '#FFFFFF', 0.4), shade);
        g.fillRect(x, 0, 1, h);
      }
      g.fillStyle = 'rgba(201,151,46,0.95)'; g.fillRect(0, 4, w, 12); g.fillRect(0, h - 16, w, 12);
    }));
  }

  /** Back to a closed envelope (or tied scroll), ready to open in this style. */
  start(style: OpeningId): void {
    this.style = style;
    this.length = LENGTH[style];
    this.pops = POPS[style];
    const flapped = style !== 'bloom' && style !== 'scroll';
    this.back.visible = style !== 'scroll';
    this.pocket.visible = flapped;
    this.flap.visible = flapped;
    this.flap.rotation.set(0, 0, 0);
    for (const p of this.petals) { p.visible = style === 'bloom'; p.rotation.set(0, 0, 0); }
    // The seal sits at the tip of the flap, or where the four petals of a blooming envelope meet.
    if (style === 'bloom') { this.petals[0].add(this.seal); this.seal.position.set(0, -ENV_H / 2, 0.0034); }
    else { this.flap.add(this.seal); this.seal.position.set(0, -ENV_H * 0.5, style === 'ribbon' ? 0.0055 : 0.0025); }
    this.seal.visible = style !== 'scroll';
    this.seal.scale.setScalar(1);
    this.glow.visible = style === 'light' || style === 'bloom';
    if (style === 'light') this.glow.position.set(0, ENV_H * 0.42, -0.002);
    else this.glow.position.set(0, 0, -0.0025);
    this.sealGlow.visible = style === 'light' || style === 'cloud';
    this.m.sealGlow.color.set(style === 'cloud' ? '#FF9ACB' : '#FFFFFF');
    this.rays.visible = style === 'light';
    this.spiral.visible = style === 'light';
    this.spiral.geometry.setDrawRange(0, 0);
    for (const p of this.puffs) p.mesh.visible = false;
    this.bandL.visible = this.bandR.visible = style === 'ribbon';
    this.bandL.rotation.set(0, 0, 0); this.bandR.rotation.set(0, 0, 0);
    this.bow.visible = style === 'ribbon' || style === 'scroll';
    this.bow.rotation.set(0, 0, 0);
    if (style === 'scroll') this.bow.position.set(0, -0.004, 0.018); else this.bow.position.set(0, 0, 0.0045);
    this.rollL.visible = this.rollR.visible = this.wrap.visible = this.ring.visible = style === 'scroll';
    this.wrap.position.set(0, 0, 0);
    if (this.sheet.parent !== this.group) this.group.add(this.sheet);
    this.sheet.rotation.set(0, 0, 0);
    this.sheet.scale.setScalar(1);
    this.sheet.position.set(0, 0, style === 'scroll' ? 0 : -0.0008);
    this.sheet.visible = style !== 'scroll';
    this.crop(1);
    this.pose(0, 1);
  }

  /** Puts everything away, the letter too (even mid-flight). */
  hide(): void {
    this.group.visible = false;
    if (this.sheet.parent !== this.group) this.group.add(this.sheet);
  }

  /** Where the pop happens (the seal, or the bow of the scroll), in the room. */
  popWorld(out: Vector3): Vector3 {
    return (this.style === 'scroll' ? this.bow : this.seal).getWorldPosition(out);
  }

  /**
   * Shows the opening t seconds after the tap. It keeps going a little after `length` (light fading,
   * clouds clearing) while the letter flies; fade takes the envelope away (1 = there, 0 = gone).
   */
  pose(t: number, fade = 1): void {
    for (const m of [this.m.back, this.m.pocket, this.m.flap, this.m.seal, this.m.petal, this.m.bow, this.m.roll]) m.opacity = fade;
    const inside = this.sheet.parent === this.group; // false once the letter has flown out
    const st = this.style;

    if (st === 'bloom') {
      const open = [span(t, 0.35, 0.75), span(t, 0.45, 0.85), span(t, 0.5, 0.9), span(t, 0.5, 0.9)];
      this.petals[0].rotation.x = -open[0] * Math.PI * 0.94;
      this.petals[1].rotation.x = open[1] * Math.PI * 0.94;
      this.petals[2].rotation.y = -open[2] * Math.PI * 0.94;
      this.petals[3].rotation.y = open[3] * Math.PI * 0.94;
      this.popSeal(open[0], 0);
      const g = span(t, 0.42, 0.85);
      this.m.glow.opacity = g * fade;
      this.glow.scale.setScalar(0.1 + 0.16 * g + 0.008 * Math.sin(t * 7));
      if (inside) { const k = span(t, 0.85, 1.25); this.sheet.position.set(0, 0.012 * k, -0.0008 + 0.03 * k); }
      return;
    }

    if (st === 'scroll') {
      const ring = span(t, 0.25, 0.65) * (1 - span(t, 1.05, 1.4));
      this.m.ring.opacity = ring * fade;
      this.ring.scale.setScalar(0.19 * (0.6 + 0.4 * span(t, 0.25, 0.65)));
      this.ring.rotation.z = t * 0.9;
      const b = span(t, 0.35, 0.6);
      this.bow.scale.setScalar(0.75 * Math.max(0.001, 1 - b));
      this.bow.rotation.z = b * 0.8;
      const w = span(t, 0.45, 0.75);
      this.wrap.position.y = -w * 0.06;
      this.m.wrap.opacity = (1 - w) * fade;
      this.wrap.visible = w < 0.99;
      const k = span(t, 0.7, 1.2);
      const x = 0.012 + k * (SHEET_W / 2 - 0.012);
      const r = 0.012 * (1 - 0.3 * k);
      this.rollL.position.set(-x, 0, 0); this.rollR.position.set(x, 0, 0);
      this.rollL.scale.set(r, 1, r); this.rollR.scale.set(r, 1, r);
      if (inside) {
        const sx = clamp01((2 * x - 0.024) / (SHEET_W - 0.024));
        this.sheet.visible = sx > 0.004;
        this.sheet.scale.set(Math.max(0.004, sx), 1, 1);
        this.crop(sx);
      }
      return;
    }

    // The envelopes with a flap: Classic, Golden light, Ribbon bow, Pink cloud.
    const flapAt = st === 'ribbon' ? 0.75 : st === 'classic' ? 0.3 : 0.47;
    const flap = span(t, flapAt, flapAt + 0.35);
    this.flap.rotation.x = -flap * Math.PI * 1.06;
    const slideAt = st === 'ribbon' ? 1.0 : st === 'classic' ? 0.6 : st === 'light' ? 0.85 : 0.75;
    if (inside) this.sheet.position.set(0, span(t, slideAt, slideAt + 0.45) * ENV_H * (st === 'light' ? 1.0 : 0.85), -0.0008);

    if (st === 'light') {
      // The seal glows first, then light pours out as the flap lifts.
      const sg = span(t, 0.28, 0.48);
      this.popSeal(flap, 0.15 * sg);
      this.m.sealGlow.opacity = sg * (1 - span(t, 0.55, 0.85)) * fade;
      const g = span(t, 0.55, 0.9);
      this.m.glow.opacity = g * 0.95 * fade;
      this.glow.scale.setScalar(0.1 + 0.13 * g + 0.006 * Math.sin(t * 6));
      const r = span(t, 0.6, 1.1);
      this.m.rays.opacity = r * 0.85 * fade;
      this.rays.scale.setScalar(0.25 + 0.75 * r);
      this.rays.rotation.z = 0.07 * Math.sin(t * 1.7);
      this.spin(t, fade);
    } else if (st === 'ribbon') {
      // The bow comes undone, the ribbon's two halves slide away to the sides, then the flap opens.
      const b = span(t, 0.3, 0.55);
      this.bow.scale.setScalar(Math.max(0.001, 1 - b));
      this.bow.rotation.z = b * 0.8;
      const k = span(t, 0.4, 0.85);
      const x = ENV_W / 4 + 0.003 + k * 0.14;
      this.bandL.position.set(-x, -0.04 * k * k, 0.0035); this.bandL.rotation.z = k * 0.35;
      this.bandR.position.set(x, -0.04 * k * k, 0.0035); this.bandR.rotation.z = -k * 0.35;
      this.m.band.opacity = (1 - k) * fade;
      this.bandL.visible = this.bandR.visible = k < 0.99;
      this.popSeal(span(t, 0.75, 1.1), 0);
    } else if (st === 'cloud') {
      // The seal glows pink, then clouds billow out of the opening and clear as the letter flies.
      const sg = span(t, 0.3, 0.46);
      this.popSeal(flap, 0.12 * sg);
      this.m.sealGlow.opacity = sg * (1 - span(t, 0.5, 0.75)) * fade;
      const clear = 1 - span(t, 1.15, 1.75);
      for (const p of this.puffs) {
        const k = (t - p.delay) / 0.6;
        p.mesh.visible = k > 0 && clear > 0.01;
        if (!p.mesh.visible) continue;
        const grow = easeOut(k);
        p.mesh.position.lerpVectors(p.from, p.to, grow);
        p.mesh.position.y += 0.02 * Math.max(0, t - 1.1); // drifting up as they clear
        p.mesh.scale.setScalar(p.size * (0.25 + 0.75 * grow) * (1 + 0.15 * (1 - clear)));
        p.mat.opacity = Math.min(1, k * 3) * clear * 0.92 * fade;
      }
    } else {
      this.popSeal(flap, 0);
    }
  }

  /** The seal swells a little as it breaks (k: how far the flap has opened), plus any glow. */
  private popSeal(k: number, boost: number): void {
    this.seal.scale.setScalar((1 + boost) * (1 + 0.35 * Math.sin(Math.min(1, k * 2.2) * Math.PI)));
  }

  /** Golden light: a ribbon of sparkles climbing around the letter and vanishing above it. */
  private spin(t: number, fade: number): void {
    const head = (t - 0.8) / 0.7;
    const N = this.spiralPos.length / 3;
    const p = this.spiralPos;
    let n = 0;
    for (let i = 0; i < N; i++) {
      const s = head - 0.55 * (i / N);
      if (s < 0 || s > 1) continue;
      const a = s * Math.PI * 2 * 2.2 + 0.6;
      const r = 0.11 - 0.035 * s;
      const j = 0.005 * Math.sin(i * 7.3 + t * 9);
      p[n * 3] = Math.cos(a) * r + j;
      p[n * 3 + 1] = 0.0 + s * 0.24 + j;
      p[n * 3 + 2] = Math.sin(a) * r * 0.8;
      n++;
    }
    const geo = this.spiral.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.setDrawRange(0, n);
    this.m.spiral.opacity = n ? fade * (1 - span(t, 1.75, 2.0)) : 0;
  }

  /** Shows only the middle part of the letter (the scroll unrolling), 0 to 1. */
  private crop(w: number): void {
    const map = this.m.sheet.map;
    if (!map) return;
    const k = Math.max(0.004, w);
    map.repeat.set(k, 1);
    map.offset.set((1 - k) / 2, 0);
  }
}
