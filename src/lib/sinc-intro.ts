/*!
 * SINC intro animation — zero dependencies, drawn live on <canvas>.
 *
 *   import { playSincIntro } from "./sinc-intro";
 *   playSincIntro();                       // auto: welcome film on the very first visit,
 *                                          //       then the 2s animation on every new visit / login
 *   playSincIntro({ mode: "welcome" });    // always the 16.9s welcome film
 *   playSincIntro({ mode: "intro" });      // always the 5.2s intro
 *   playSincIntro({ mode: "quick" });      // always the 2s animation
 *   resetSincIntroSession();               // call on logout so the next login plays it again
 *
 * Needs the six logo pieces (sinc-piece-1..6.webp) at `assetsBase`.
 * Resolves with "played" | "skipped" | "not-needed". Never throws, never blocks the app.
 */

// --------------------------------------------------------------------------- config
export interface SincIntroOptions {
  mode?: 'auto' | 'welcome' | 'intro' | 'quick';
  returningMode?: 'quick' | 'intro';
  assetsBase?: string;
  ext?: string;
  zIndex?: number;
  background?: string;
  fontFamily?: string;
  loadGoogleFont?: boolean;
  welcomeKey?: string;
  sessionKey?: string;
  respectReducedMotion?: boolean;
  onDone?: (result: PlayIntroResult) => void;
  makeCanvas?: (w: number, h: number) => HTMLCanvasElement;
}

export type PlayIntroResult = 'played' | 'skipped' | 'not-needed';

const DEFAULTS: Required<Omit<SincIntroOptions, 'onDone' | 'makeCanvas'>> = {
  mode: "auto",                       // "auto" | "welcome" | "intro" | "quick"
  returningMode: "quick",             // what "auto" plays on every visit after the first: "quick" (2s) or "intro" (5.2s)
  assetsBase: "/sinc-intro/",         // folder holding sinc-piece-1..6.webp
  ext: "webp",
  zIndex: 9999,
  background: "#ffffff",
  fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif',
  loadGoogleFont: true,               // set false if you self-host Inter or block Google Fonts (CSP)
  welcomeKey: "sincWelcomeSeen",      // localStorage: has this browser seen the welcome film?
  sessionKey: "sincIntroSeen",        // sessionStorage: shown already in this session?
  respectReducedMotion: true,
};

const NAVY = "rgb(14,26,70)";
const SLATE = "rgb(58,72,104)";
const BLUE_A = "rgb(10,38,168)";
const BLUE_B = "rgb(24,104,255)";

// --------------------------------------------------------------------------- easing
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const prog = (t: number, s: number, d: number): number => clamp01((t - s) / d);
const outCubic = (p: number): number => 1 - Math.pow(1 - p, 3);
const outQuart = (p: number): number => 1 - Math.pow(1 - p, 4);
const inCubic = (p: number): number => Math.pow(p, 3);
const inOutCubic = (p: number): number => (p < 0.5 ? 4 * Math.pow(p, 3) : 1 - Math.pow(-2 * p + 2, 3) / 2);
const inOutSine = (p: number): number => -(Math.cos(Math.PI * p) - 1) / 2;
const outBack = (p: number, s: number = 1.70158): number => { p -= 1; return 1 + (s + 1) * Math.pow(p, 3) + s * Math.pow(p, 2); };
const active = (p: number): boolean => p > 0 && p < 1;

// --------------------------------------------------------------------------- 2D affine [a,b,c,d,e,f]
type AffineMatrix = [number, number, number, number, number, number];
const T = (x: number, y: number): AffineMatrix => [1, 0, 0, 1, x, y];
const S = (s: number): AffineMatrix => [s, 0, 0, s, 0, 0];
const Rot = (deg: number): AffineMatrix => { const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, 0, 0]; };
const mul = (m: AffineMatrix, n: AffineMatrix): AffineMatrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const chain = (...ms: AffineMatrix[]): AffineMatrix => ms.reduce(mul);
const about = (m: AffineMatrix, x: number, y: number): AffineMatrix => chain(T(x, y), m, T(-x, -y));
const apply = (m: AffineMatrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// --------------------------------------------------------------------------- logo geometry
// [kind, x0, y0, cx, cy] — offset of each piece inside the 1254x1254 source logo
type PieceDef = [kind: "arm" | "head", x0: number, y0: number, cx: number, cy: number];
const PIECES: PieceDef[] = [
  ["arm", 192, 508, 394.34, 785.27],
  ["arm", 327, 340, 692.24, 511.46],
  ["arm", 469, 553, 805.82, 884.99],
  ["head", 506, 168, 626.52, 281.44],
  ["head", 916, 818, 1032.32, 930.37],
  ["head", 104, 818, 218.34, 930.37],
];
const ROT_C: [number, number] = [625.73, 714.06];   // swirl centre
const BBOX_C: [number, number] = [626, 622];        // logo bounding-box centre
const LOGO_H = 894;
const LOGO_BOX: [number, number, number, number] = [100, 160, 1150, 1075];

function pieceMatrix(ta: number, i: number): { m: AffineMatrix; a: number } | null {
  const [kind, , , cx, cy] = PIECES[i];
  if (kind === "arm") {
    const p = prog(ta, 0.05 + 0.08 * i, 1.05);
    if (p <= 0) return null;
    const ang = -150 * (1 - outCubic(p));
    const sc = 0.35 + 0.65 * outBack(Math.min(p * 1.1, 1), 1.1);
    return { m: about(mul(Rot(ang), S(sc)), ROT_C[0], ROT_C[1]), a: clamp01(p / 0.3) };
  }
  const j = i - 3;
  const p = prog(ta, 0.72 + 0.1 * j, 0.62);
  if (p <= 0) return null;
  let ux = cx - ROT_C[0], uy = cy - ROT_C[1];
  const n = Math.hypot(ux, uy); ux /= n; uy /= n;
  const d = 260 * (1 - outCubic(p));
  const sc = Math.max(outBack(p, 2.2), 0);
  return { m: mul(T(ux * d, uy * d), about(S(sc), cx, cy)), a: clamp01(p / 0.2) };
}

// --------------------------------------------------------------------------- content
const ROLES: [string, number, number][] = [
  ["Students", 190, 170], ["Developers", 500, 128], ["Designers", 830, 182],
  ["Founders", 318, 312], ["AI Engineers", 655, 292], ["Creators", 915, 335],
  ["Freelancers", 175, 760], ["Product Builders", 490, 725], ["Researchers", 840, 758],
  ["Marketers", 300, 905], ["Entrepreneurs", 640, 885], ["Professionals", 900, 935],
];
const ROLE_ORDER = [8, 7, 10, 2, 5, 11, 9, 0, 4, 6, 3, 1];
const ROLE_PHASE = [5.713, 1.348, 0.54, 2.626, 1.511, 3.461, 0.371, 3.551, 5.95, 3.96, 3.661, 0.388];
const CYCLE = ["Ideas", "Collaborations", "Projects", "Products", "Companies", "Opportunities"];
const FIND = ["teammate", "mentor", "co-founder", "collaborator", "client", "people."];
const FULL_NAME = "Society for Innovation, Network & Collaboration";
const TAGLINE = "Where Ambition Finds Its People.";

// final lockup layout (design units, 1080 square)
const LOCK = (() => {
  const s = 0.43, logoH = LOGO_H * s;
  const total = logoH + 52 + 109 + 38 + 24 + 46 + 24;
  const top = 540 - total / 2 - 4;
  const sinc = top + logoH + 52 + 109;
  return { s, logo: [540, top + logoH / 2] as [number, number], sinc, name: sinc + 62, tag: sinc + 132 };
})();

// 2-second "quick" layout: logo + SINC only
const QUICK = (() => {
  const s = 0.46, logoH = LOGO_H * s;
  const top = 540 - (logoH + 50 + 109) / 2;
  return { s, logo: [540, top + logoH / 2] as [number, number], sinc: top + logoH + 50 + 109 };
})();
const QUICK_SPEED = 1.6;   // the quick version runs the logo assembly 1.6x faster

// --------------------------------------------------------------------------- renderer
export interface SincIntroRenderer {
  draw: (ctx: CanvasRenderingContext2D, W: number, H: number, t: number) => void;
  duration: number;
  mode: 'welcome' | 'quick' | 'intro';
}

/**
 * Low-level renderer: draw(ctx, W, H, t) paints frame `t` (seconds) for the given mode.
 * images: array of 6 loaded images (pieces 1..6). makeCanvas(w, h) returns a scratch canvas.
 */
export function createSincIntroRenderer(
  images: HTMLImageElement[],
  {
    mode = "welcome",
    fontFamily = DEFAULTS.fontFamily,
    background = DEFAULTS.background,
    makeCanvas,
  }: {
    mode?: string;
    fontFamily?: string;
    background?: string;
    makeCanvas?: (w: number, h: number) => HTMLCanvasElement;
  } = {}
): SincIntroRenderer {
  const film = mode === "welcome", quick = mode === "quick";
  const duration = film ? 16.9 : quick ? 1.6 : 5.2;
  const A = film ? 3.5 : 0;                       // logo assembly start
  const scratch: Record<string, HTMLCanvasElement> = {};
  const mk = makeCanvas || ((w: number, h: number) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  });

  const surface = (key: string, w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
    w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
    let c = scratch[key];
    if (!c) c = scratch[key] = mk(w, h);
    if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
    const x = c.getContext("2d")!;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = "source-over";
    x.globalAlpha = 1;
    x.clearRect(0, 0, w, h);
    return [c, x];
  };

  // text widths are measured once at 100px and scaled (kerning scales linearly)
  const widthCache = new Map<string, number>();
  let measureCtx: CanvasRenderingContext2D | null = null;
  const width100 = (weight: number, text: string): number => {
    const key = weight + "|" + text;
    if (!widthCache.has(key)) {
      if (!measureCtx) measureCtx = mk(4, 4).getContext("2d")!;
      measureCtx.font = `${weight} 100px ${fontFamily}`;
      widthCache.set(key, measureCtx.measureText(text).width);
    }
    return widthCache.get(key)!;
  };
  const font = (ctx: CanvasRenderingContext2D, weight: number, px: number) => {
    ctx.font = `${weight} ${px}px ${fontFamily}`;
  };

  const filmSegs: [number, number, [number, number, number]][] = [
    [5.8, 6.45, [540, 480 - (ROT_C[1] - 622) * 0.27, 0.27]],
    [9.7, 10.35, [540, 370, 0.3]],
    [13.35, 14.05, [LOCK.logo[0], LOCK.logo[1], LOCK.s]],
  ];
  const introSegs: [number, number, [number, number, number]][] = [
    [1.95, 2.8, [LOCK.logo[0], LOCK.logo[1], LOCK.s]]
  ];
  const START: [number, number, number] = quick ? [QUICK.logo[0], QUICK.logo[1], QUICK.s] : [540, 540, 0.56];
  const nodeT = [6.2, ...[1, 2, 3, 4, 5].map((i) => 6.45 + 2.4 * Math.acos(1 - (2 * i) / 6) / Math.PI - 0.1)];

  function logoState(t: number): [number, number, number] {
    let cur = START.slice() as [number, number, number];
    for (const [ts, te, tgt] of film ? filmSegs : quick ? [] : introSegs) {
      if (t <= ts) break;
      const p = inOutCubic(prog(t, ts, te - ts));
      cur = cur.map((v, i) => v + (tgt[i] - v) * p) as [number, number, number];
      if (p < 1) break;
    }
    return cur;
  }

  function draw(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
    // ---- stage: a 1080x1080 design square, scaled to fit any viewport shape
    const k = Math.min(W / 960, H / 1080);
    const ox = W / 2 - 540 * k, oy = H / 2 - 540 * k;
    const X = (x: number) => ox + x * k, Y = (y: number) => oy + y * k;
    const spreadX = Math.max(1, (W / k - 160) / 920), spreadY = Math.max(1, (H / k - 160) / 920);
    const Xs = (x: number) => W / 2 + (x - 540) * k * spreadX;   // scattered labels use the full screen
    const Ys = (y: number) => H / 2 + (y - 540) * k * spreadY;
    const logoG = (cx: number, cy: number, s: number) => chain(T(X(cx), Y(cy)), S(s * k), T(-BBOX_C[0], -BBOX_C[1]));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, W, H);

    const grad = (c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => {
      const g = c.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, BLUE_A); g.addColorStop(1, BLUE_B);
      return g;
    };

    // ---- helpers -----------------------------------------------------------
    function line(
      text: string,
      weight: number,
      sizeD: number,
      cx: number,
      base: number,
      colors: string | ((x0: number, total: number) => CanvasGradient | string) | (string | CanvasGradient)[],
      tin: number,
      tout: number | null = null,
      stagger: number = 0.06,
      riseD: number = 22
    ) {
      const px = sizeD * k, words = text.split(" ");
      const total = (width100(weight, text) * px) / 100;
      const x0 = cx - total / 2;
      font(ctx, weight, px);
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      words.forEach((w, i) => {
        const p = prog(t, tin + i * stagger, 0.6);
        if (p <= 0) return;
        let op = outCubic(prog(t, tin + i * stagger, 0.42));
        let dy = (1 - outQuart(p)) * riseD * k;
        if (tout !== null) {
          const q = prog(t, tout + i * stagger * 0.5, 0.32);
          op *= 1 - q; dy -= inCubic(q) * riseD * 0.7 * k;
        }
        if (op <= 0.002) return;
        const prefix = words.slice(0, i).join(" ") + (i ? " " : "");
        const x = x0 + (width100(weight, prefix) * px) / 100;
        const col = Array.isArray(colors) ? colors[i] : colors;
        ctx.globalAlpha = op;
        ctx.fillStyle = typeof col === "function" ? col(x0, total) : col;
        ctx.fillText(w, x, base + dy);
      });
      ctx.globalAlpha = 1;
    }

    const spanGrad = (sizeD: number, base: number) => (x0: number, total: number) =>
      grad(ctx, x0, base - sizeD * k * 0.7, x0 + total, base);

    const wordsGrad = (text: string, weight: number, sizeD: number, cx: number, base: number, from: number, to: number) => {
      const px = sizeD * k, words = text.split(" ");
      const left = cx - (width100(weight, text) * px) / 200;
      const pre = (n: number) => (width100(weight, words.slice(0, n).join(" ") + (n ? " " : "")) * px) / 100;
      const xa = left + pre(from);
      const xb = left + pre(to) + (width100(weight, words[to]) * px) / 100;
      return grad(ctx, xa, base - px * 0.7, xb, base);
    };

    function pill(text: string, cx: number, cy: number, scale: number, alpha: number, node: boolean) {
      if (alpha <= 0.002 || scale <= 0.01) return;
      const fpx = (node ? 27 : 24) * k, h = (node ? 54 : 46) * k, pad = (node ? 22 : 18) * k;
      const w = (width100(600, text) * fpx) / 100 + 2 * pad, r = h / 2;
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + r, -h / 2);
      ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r);
      ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
      ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r);
      ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r);
      ctx.closePath();
      if (node) {
        ctx.shadowColor = "rgba(14,26,70,0.16)";
        ctx.shadowBlur = 14 * k * scale;
        ctx.shadowOffsetY = 4 * k * scale;
      }
      ctx.fillStyle = node ? "#ffffff" : "rgb(237,242,255)";
      ctx.fill();
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.lineWidth = 2 * k;
      ctx.strokeStyle = node ? "rgb(190,210,255)" : "rgb(214,226,255)";
      ctx.stroke();
      font(ctx, 600, fpx);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = node ? "rgb(14,44,150)" : "rgb(28,64,190)";
      ctx.fillText(text, 0, 1 * k);
      ctx.restore();
    }

    function ring(cx: number, cy: number, r: number, lw: number, color: string, alpha: number, start: number | null = null, span: number = 360) {
      if (alpha <= 0.002 || span <= 0) return;
      ctx.beginPath();
      if (start === null || span >= 360) ctx.arc(cx, cy, r, 0, Math.PI * 2);
      else ctx.arc(cx, cy, r, (start * Math.PI) / 180, ((start + span) * Math.PI) / 180);
      ctx.globalAlpha = alpha; ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function dot(x: number, y: number, r: number, alpha: number) {
      if (alpha <= 0.002) return;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      ([[0, 0.45], [0.25, 0.33], [0.45, 0.165], [0.7, 0.03], [1, 0]] as [number, number][]).forEach(([o, a]) =>
        g.addColorStop(o, `rgba(24,104,255,${a * alpha})`));
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.globalAlpha = alpha; ctx.fillStyle = BLUE_B; ctx.fill(); ctx.globalAlpha = 1;
    }

    function glintBand(c: CanvasRenderingContext2D, cx: number, cy: number, nx: number, ny: number, w: number, rgb: string, peak: number) {
      const g = c.createLinearGradient(cx - nx * 2.5 * w, cy - ny * 2.5 * w, cx + nx * 2.5 * w, cy + ny * 2.5 * w);
      for (let i = 0; i <= 12; i++) {
        const u = -2.5 + (5 * i) / 12;
        g.addColorStop(i / 12, `rgba(${rgb},${(Math.exp(-u * u) * peak).toFixed(4)})`);
      }
      c.globalCompositeOperation = "source-atop";
      c.fillStyle = g;
      c.fillRect(0, 0, c.canvas.width, c.canvas.height);
      c.globalCompositeOperation = "source-over";
    }

    function logo(G: AffineMatrix, ta: number, s: number, glint: number) {
      const drawPieces = (c: CanvasRenderingContext2D, pre: AffineMatrix) => {
        PIECES.forEach((pc, i) => {
          const r = pieceMatrix(ta, i);
          if (!r || r.a <= 0) return;
          const m = chain(pre, G, r.m, T(pc[1], pc[2]));
          c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
          c.globalAlpha = r.a;
          c.drawImage(images[i], 0, 0);
        });
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalAlpha = 1;
      };
      if (!active(glint)) { drawPieces(ctx, T(0, 0)); return; }
      const pts = [[LOGO_BOX[0], LOGO_BOX[1]], [LOGO_BOX[2], LOGO_BOX[1]], [LOGO_BOX[0], LOGO_BOX[3]], [LOGO_BOX[2], LOGO_BOX[3]]]
        .map(([x, y]) => apply(G, x, y));
      const bx = Math.floor(Math.min(...pts.map((p) => p[0]))) - 2, by = Math.floor(Math.min(...pts.map((p) => p[1]))) - 2;
      const bw = Math.max(...pts.map((p) => p[0])) - bx + 4, bh = Math.max(...pts.map((p) => p[1])) - by + 4;
      const [cv, c] = surface("logo", bw, bh);
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
      drawPieces(c, T(-bx, -by));
      const [gx, gy] = apply(G, BBOX_C[0], BBOX_C[1]);
      const span = 1100 * s * k, pos = -span + 2 * span * inOutCubic(glint);
      const nl = Math.hypot(0.9, 0.44), nx = 0.9 / nl, ny = 0.44 / nl;
      glintBand(c, gx - bx + nx * pos, gy - by + ny * pos, nx, ny, 71 * s * k, "150,195,255", 0.72);
      ctx.drawImage(cv, 0, 0, Math.ceil(bw), Math.ceil(bh), bx, by, Math.ceil(bw), Math.ceil(bh));
    }

    function rippleRings(cx: number, cy: number, ta: number) {
      ([[1.33, 0.42], [1.51, 0.26]] as [number, number][]).forEach(([st, peak]) => {
        const p = prog(ta, st, 1);
        if (!active(p)) return;
        const e = outCubic(p);
        ring(cx, cy, (150 + 430 * e) * k, (7 - 5 * e) * k, "rgb(40,110,255)", peak * Math.pow(1 - p, 1.5));
      });
    }

    function lockup(t0: number, glintAt: number, { sincY = LOCK.sinc, full = true, stagger = 0.075, dur = 0.7 } = {}) {
      if (t >= t0) {
        const px = 150 * k, track = 0.14 * px, word = "SINC";
        const wTot = (width100(800, word) * px) / 100 + track * 3;
        const x0 = X(540) - wTot / 2, base = Y(sincY);
        const rx = Math.floor(x0 - 6 * k), ry = Math.floor(base - 0.8 * px);
        const rw = Math.ceil(wTot + 12 * k), rh = Math.ceil(0.86 * px);
        const [cv, c] = surface("sinc", rw, rh);
        font(c, 800, px);
        c.textAlign = "left"; c.textBaseline = "alphabetic";
        c.fillStyle = grad(c, 0, 0, rw, rh * 0.6);
        for (let i = 0; i < 4; i++) {
          const p = prog(t, t0 + stagger * i, dur);
          if (p <= 0) continue;
          const lx = x0 - rx + (width100(800, word.slice(0, i)) * px) / 100 + track * i;
          c.fillText(word[i], lx, base - ry + (1 - outQuart(p)) * rh * 1.05);
        }
        const g = prog(t, glintAt, 0.65);
        if (active(g)) {
          const nl = Math.hypot(1, 0.45);
          const pos = -0.3 * rw + 1.6 * rw * inOutCubic(g);
          glintBand(c, pos, 0, 1 / nl, 0.45 / nl, (30 * k) / nl, "160,200,255", 0.75);
        }
        ctx.drawImage(cv, 0, 0, rw, rh, rx, ry, rw, rh);
      }
      if (!full) return;
      const tn = t0 + 0.48, p = prog(t, tn, 0.9);
      if (p > 0) {
        const e = outQuart(p), op = outCubic(prog(t, tn, 0.65)), px = 30 * k;
        const track = (0.3 * (1 - e) + 0.01 * e) * px;
        const wTot = (width100(500, FULL_NAME) * px) / 100 + track * (FULL_NAME.length - 1);
        const x0 = X(540) - wTot / 2, base = Y(LOCK.name) + (1 - e) * 10 * k;
        font(ctx, 500, px);
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = SLATE; ctx.globalAlpha = op;
        for (let i = 0; i < FULL_NAME.length; i++) {
          if (FULL_NAME[i] === " ") continue;
          ctx.fillText(FULL_NAME[i], x0 + (width100(500, FULL_NAME.slice(0, i)) * px) / 100 + track * i, base);
        }
        ctx.globalAlpha = 1;
      }
      const tt = t0 + 1.0, tb = Y(LOCK.tag);
      line(TAGLINE, 600, 30, X(540), tb, spanGrad(30, tb), tt, null, 0.07, 16);
      const lp = outCubic(prog(t, tt + 0.25, 0.6));
      if (lp > 0) {
        const half = (width100(600, TAGLINE) * 30 * k) / 200, gap = 22 * k, len = 46 * k * lp;
        ctx.fillStyle = "rgba(24,104,255,0.55)";
        const th = Math.max(1.5 * k, 1), y = tb - 9 * k - th / 2;
        ctx.fillRect(X(540) - half - gap - len, y, len, th);
        ctx.fillRect(X(540) + half + gap, y, len, th);
      }
    }

    const [lcx, lcy, ls] = logoState(t);
    const ta = quick ? t * QUICK_SPEED : t - A;
    const [vx, vy] = apply(logoG(...START), ROT_C[0], ROT_C[1]);

    rippleRings(vx, vy, ta);

    if (quick) {
      logo(logoG(lcx, lcy, ls), ta, ls, prog(t, 0.92, 0.55));
      lockup(0.6, 1.05, { sincY: QUICK.sinc, full: false, stagger: 0.05, dur: 0.45 });
      return;
    }

    if (!film) {
      logo(logoG(lcx, lcy, ls), ta, ls, prog(t, 1.5, 0.75));
      lockup(2.32, 4.05);
      return;
    }

    const rcx = X(540), rcy = Y(480), R = 300 * k;
    if (t > 6.1 && t < 10) {
      const fade = 1 - prog(t, 9.55, 0.35);
      ring(rcx, rcy, R, 2.2 * k, "rgb(224,232,252)", outCubic(prog(t, 6.15, 0.45)) * fade);
      const pa = prog(t, 6.45, 2.4), span = 360 * inOutSine(pa);
      ring(rcx, rcy, R, 3.6 * k, "rgb(64,120,255)", 0.95 * fade, -90, span);
      if (active(pa)) {
        const a = ((-90 + span) * Math.PI) / 180;
        dot(rcx + R * Math.cos(a), rcy + R * Math.sin(a), 6 * k, 1);
      }
      if (t > 8.85) {
        const dt = t - 8.85, th = 140 * (dt - 0.3 * (1 - Math.exp(-dt / 0.3)));
        for (let j = 0; j < 3; j++) {
          const a = ((-90 + 120 * j + th) * Math.PI) / 180;
          dot(rcx + R * Math.cos(a), rcy + R * Math.sin(a), 5 * k, clamp01(dt / 0.25) * fade);
        }
      }
    }

    if (t < 4.4) {
      const roles = ROLES.map(([name, x, y], i) => ({ name, i, x: Xs(x), y: Ys(y), d: 0, tv: 0 }));
      roles.forEach((r) => { r.d = Math.hypot(r.x - vx, r.y - vy); });
      [...roles].sort((a, b) => b.d - a.d).forEach((r, rank) => { r.tv = 3.12 + 0.028 * rank; });
      roles.forEach((r) => {
        const p = prog(t, 0.35 + ROLE_ORDER[r.i] * 0.085, 0.5);
        if (p <= 0) return;
        let sc = outBack(p, 1.8), op = clamp01(p / 0.3);
        let x = r.x + 6 * k * Math.sin(1.3 * t + ROLE_PHASE[r.i]);
        let y = r.y + 5 * k * Math.cos(1.1 * t + ROLE_PHASE[r.i]);
        const q = prog(t, r.tv, 0.85);
        if (q > 0) {
          const e = inCubic(q), ang = (150 * e * Math.PI) / 180;
          const dx = (x - vx) * (1 - e), dy = (y - vy) * (1 - e);
          x = vx + dx * Math.cos(ang) - dy * Math.sin(ang);
          y = vy + dx * Math.sin(ang) + dy * Math.cos(ang);
          sc *= 1 - 0.75 * e;
          op *= 1 - clamp01((e - 0.5) / 0.5);
        }
        pill(r.name, x, y, sc, op, false);
      });
    }

    if (ta > 0) {
      const g1 = prog(t, A + 1.5, 0.75), g2 = prog(t, 15.35, 0.75);
      logo(logoG(lcx, lcy, ls), ta, ls, active(g1) ? g1 : g2);
    }

    if (t > 6.1 && t < 10) {
      CYCLE.forEach((name, i) => {
        const p = prog(t, nodeT[i], 0.5);
        if (p <= 0) return;
        const q = prog(t, 9.48 + 0.035 * i, 0.35);
        const a = ((-90 + 60 * i) * Math.PI) / 180;
        pill(name, rcx + R * Math.cos(a), rcy + R * Math.sin(a),
          outBack(p, 2.0) * (1 - 0.25 * inCubic(q)), clamp01(p / 0.25) * (1 - q), true);
      });
      line("A self-sustaining ecosystem", 700, 40, X(540), Y(890), NAVY, 7.25, 9.45);
      line("where every success creates new opportunities for someone else.", 500, 26, X(540), Y(934),
        SLATE, 7.5, 9.5, 0.025, 12);
    }

    if (t < 3.8) {
      const t1 = "Talent is everywhere.", b2 = "the right people find each other.";
      const gT = wordsGrad(t1, 700, 76, X(540), Y(567), 2, 2);
      line(t1, 700, 76, X(540), Y(567), [NAVY, NAVY, gT], 0.15, 1.75);
      line("Opportunities begin when", 700, 58, X(540), Y(532), NAVY, 2.0, 3.2);
      const gB = wordsGrad(b2, 700, 58, X(540), Y(608), 0, 2);
      line(b2, 700, 58, X(540), Y(608), [gB, gB, gB, NAVY, NAVY, NAVY], 2.18, 3.25);
    }

    if (t > 10 && t < 13.7) {
      line("Find your", 700, 66, X(540), Y(630), NAVY, 10.05, 13.25);
      const px = 104 * k, base = Y(765);
      const top = base - 0.84 * px, h = 1.1 * px;
      ctx.save();
      ctx.beginPath(); ctx.rect(X(540) - 440 * k, top, 880 * k, h); ctx.clip();
      font(ctx, 800, px);
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillStyle = grad(ctx, X(540) - 300 * k, top, X(540) + 300 * k, top + h);
      ctx.globalAlpha = 1 - prog(t, 13.28, 0.3);
      FIND.forEach((w, i) => {
        const ti = 10.3 + 0.45 * i, p = prog(t, ti, 0.38);
        if (p <= 0) return;
        let dy = (1 - outQuart(p)) * h;
        if (i + 1 < FIND.length) {
          const q = prog(t, ti + 0.45 - 0.06, 0.24);
          if (q >= 1) return;
          dy -= inCubic(q) * h;
        }
        ctx.fillText(w, X(540), base + dy);
      });
      ctx.restore();
    }

    if (t > 13.8) lockup(13.85, 15.75);
  }

  return { draw, duration, mode: film ? "welcome" : quick ? "quick" : "intro" };
}

// --------------------------------------------------------------------------- player
function store(kind: "local" | "session", key: string, value?: string): string | null {
  try {
    const s = kind === "local" ? window.localStorage : window.sessionStorage;
    if (value === undefined) return s.getItem(key);
    s.setItem(key, value);
  } catch (_) { /* storage blocked (private mode etc.) — treat as not seen */ }
  return null;
}

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([promise, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadFonts(o: Required<Omit<SincIntroOptions, 'onDone' | 'makeCanvas'>>, timeoutMs: number): Promise<void> {
  if (!document.fonts) return;
  if (o.loadGoogleFont && !document.querySelector("link[data-sinc-intro-font]")) {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap";
    l.dataset.sincIntroFont = "";
    document.head.appendChild(l);
  }
  const fam = o.fontFamily.split(",")[0].trim();
  try {
    await withTimeout(
      Promise.all([500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px ${fam}`).catch(() => null))),
      timeoutMs
    );
  } catch (_) {}
}

let running: Promise<PlayIntroResult> | null = null;

export function resetSincIntroSession(options: SincIntroOptions = {}): void {
  const o = { ...DEFAULTS, ...options };
  try {
    window.sessionStorage.removeItem(o.sessionKey);
    window.localStorage.removeItem(o.welcomeKey);
  } catch (_) {}
}

export function resetSincIntroWelcome(options: SincIntroOptions = {}): void {
  const o = { ...DEFAULTS, ...options };
  try {
    window.localStorage.removeItem(o.welcomeKey);
  } catch (_) {}
}

export function hasSeenSincWelcome(options: SincIntroOptions = {}): boolean {
  const o = { ...DEFAULTS, ...options };
  return typeof window !== 'undefined' && store("local", o.welcomeKey) === "1";
}

export function hasSeenSincSession(options: SincIntroOptions = {}): boolean {
  const o = { ...DEFAULTS, ...options };
  return typeof window !== 'undefined' && store("session", o.sessionKey) === "1";
}

export function markSincWelcomeSeen(options: SincIntroOptions = {}): void {
  const o = { ...DEFAULTS, ...options };
  store("local", o.welcomeKey, "1");
}

export function markSincSessionSeen(options: SincIntroOptions = {}): void {
  const o = { ...DEFAULTS, ...options };
  store("session", o.sessionKey, "1");
}

/**
 * Show the SINC intro as a full-screen overlay. Safe to call from any client-side code;
 * returns immediately on the server or when nothing needs to play.
 */
export function playSincIntro(options: SincIntroOptions = {}): Promise<PlayIntroResult> {
  if (typeof window === "undefined" || typeof document === "undefined") return Promise.resolve("not-needed");
  if (running) return running;
  running = run(options).finally(() => { running = null; });
  return running;
}

async function run(options: SincIntroOptions): Promise<PlayIntroResult> {
  const o = { ...DEFAULTS, ...options };

  if (o.respectReducedMotion && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return "not-needed";
  }
  let mode = o.mode;
  if (mode === "auto") {
    if (!store("local", o.welcomeKey)) mode = "welcome";
    else if (!store("session", o.sessionKey)) mode = o.returningMode;
    else return "not-needed";
  }
  const quick = mode === "quick";
  store("session", o.sessionKey, "1");

  if (typeof document !== 'undefined') {
    document.querySelectorAll('.sinc-intro-overlay').forEach((el) => el.remove());
  }

  const root = document.createElement("div");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "SINC — Society for Innovation, Network & Collaboration");
  root.className = quick
    ? "sinc-intro-overlay sinc-intro-quick sinc-logo-splash"
    : "sinc-intro-overlay sinc-intro-welcome";
  root.dataset.introMode = mode;
  const fadeMs = quick ? 350 : 450;
  Object.assign(root.style, {
    position: "fixed", inset: "0", zIndex: String(o.zIndex), background: o.background,
    opacity: "1", transition: `opacity ${fadeMs}ms ease`, cursor: "pointer", touchAction: "none",
  });
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block" });
  root.appendChild(canvas);
  const prevOverflow = typeof document !== 'undefined' ? document.documentElement.style.overflow : '';

  const close = (result: PlayIntroResult) => new Promise<PlayIntroResult>((resolve) => {
    root.style.opacity = "0";
    root.style.pointerEvents = "none";
    setTimeout(() => {
      root.remove();
      if (typeof document !== 'undefined') {
        document.documentElement.style.overflow = prevOverflow;
      }
      resolve(result);
      o.onDone?.(result);
    }, fadeMs + 10);
  });

  let images: HTMLImageElement[] | null = null;
  try {
    const loaded = await Promise.all([
      withTimeout(Promise.all([1, 2, 3, 4, 5, 6].map((i) => loadImage(`${o.assetsBase}sinc-piece-${i}.${o.ext}`))),
        quick ? 1800 : 5000),
      loadFonts(o, quick ? 500 : 2000),
    ]);
    images = loaded[0];
  } catch (_) { images = null; }
  if (!images || images.length !== 6) {
    return Promise.resolve("skipped");
  }

  // Only append overlay to document once assets are fully loaded and verified
  if (typeof document !== 'undefined') {
    document.documentElement.style.overflow = "hidden";
    (document.body || document.documentElement).appendChild(root);
  }
  if (mode === "welcome") store("local", o.welcomeKey, "1");

  const renderer = createSincIntroRenderer(images, { mode, fontFamily: o.fontFamily, background: o.background, makeCanvas: o.makeCanvas });

  let skipBtn: HTMLButtonElement | null = null;
  if (mode === "welcome") {
    skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.textContent = "Skip";
    Object.assign(skipBtn.style, {
      position: "absolute",
      right: "max(20px, env(safe-area-inset-right))",
      bottom: "max(20px, env(safe-area-inset-bottom))",
      padding: "9px 20px", borderRadius: "999px", border: "1px solid #c9d7ff",
      background: "rgba(255,255,255,.92)", color: "#1c40b8", cursor: "pointer",
      font: `600 14px/1.2 ${o.fontFamily}`, letterSpacing: ".02em",
    });
    root.appendChild(skipBtn);
  }
  const ctx = canvas.getContext("2d")!;

  let W = 0, H = 0;
  const fit = () => {
    const cw = Math.max(1, root.clientWidth), ch = Math.max(1, root.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4.2e6 / (cw * ch)));
    W = Math.max(1, Math.round(cw * dpr)); H = Math.max(1, Math.round(ch * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  };
  fit();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
  ro?.observe(root);
  window.addEventListener("resize", fit);

  return new Promise<PlayIntroResult>((resolve) => {
    let done = false, raf = 0, startAt: number | null = null, result: PlayIntroResult = "played";
    const maxSafetyTimer = setTimeout(() => finish(), (renderer.duration + 1.5) * 1000);
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(maxSafetyTimer);
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", fit);
      document.removeEventListener("keydown", onKey);
      close(result).then(resolve);
    };
    const skip = () => { result = "skipped"; finish(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") skip(); };
    root.addEventListener("click", skip);
    document.addEventListener("keydown", onKey);

    const tick = (now: number) => {
      if (startAt === null) startAt = now;
      const t = Math.min((now - startAt) / 1000, renderer.duration);
      try {
        renderer.draw(ctx, W, H, t);
      } catch (err) {
        console.warn("[sinc-intro] render error, closing intro", err);
        return skip();
      }
      if (t >= renderer.duration) { setTimeout(finish, quick ? 80 : 300); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    setTimeout(finish, (renderer.duration + 4) * 1000);
  });
}

if (typeof window !== "undefined") {
  (window as any).playSincIntro = playSincIntro;
}
