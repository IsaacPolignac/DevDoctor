// Procedural wrap-around label (2D canvas -> THREE.CanvasTexture).
// Layout is in "label units" (same units as the 3D scene: 1 u = 10 mm); u = 0.5 is the label's front centre.
// Deterministic: seeded RNG only, all images awaited before drawing.

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

const GRAD = ["#123A78", "#2A9AC2", "#16A48F"];

// arcLen, height: label size in scene units. pxPerUnit: texture density.
export async function drawLabelCanvas({ arcLen, height, pxPerUnit = 720, base = "assets/brand/" }) {
  const W = Math.round(arcLen * pxPerUnit);
  const H = Math.round(height * pxPerUnit);
  const [symbol, wordmark] = await Promise.all([loadImage(base + "brand-symbol.svg"), loadImage(base + "brand-wordmark.svg")]);
  await Promise.all(['600 40px "Inter"', '700 40px "Inter"', '500 40px "Inter"'].map((f) => document.fonts.load(f, "RESEARCH USE ONLY. SCIENCE PURITY POTENTIAL")));

  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d");
  const u = pxPerUnit; // px per scene unit
  const cx = W / 2;

  // paper: warm-neutral white with a very faint vertical falloff (printed stock, not pure #fff)
  const paper = g.createLinearGradient(0, 0, 0, H);
  paper.addColorStop(0, "#f3f4f5");
  paper.addColorStop(0.5, "#fbfbfb");
  paper.addColorStop(1, "#f1f2f3");
  g.fillStyle = paper;
  g.fillRect(0, 0, W, H);

  // faint molecular-lattice decoration on the flanks (like the real label), seeded
  const R = rng(7);
  g.save();
  g.strokeStyle = "rgba(120,130,145,0.16)";
  g.fillStyle = "rgba(120,130,145,0.20)";
  g.lineWidth = 0.012 * u;
  const hex = (x, y, r, rot) => {
    const pts = [];
    for (let i = 0; i < 6; i++) pts.push([x + r * Math.cos(rot + (i * Math.PI) / 3), y + r * Math.sin(rot + (i * Math.PI) / 3)]);
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath();
    g.stroke();
    pts.forEach((p) => {
      if (R() < 0.7) {
        g.beginPath();
        g.arc(p[0], p[1], 0.022 * u, 0, Math.PI * 2);
        g.fill();
      }
    });
    return pts;
  };
  const cluster = (x0, y0) => {
    const r = 0.13 * u;
    let x = x0, y = y0;
    for (let k = 0; k < 5; k++) {
      const pts = hex(x, y, r, Math.PI / 6);
      const p = pts[Math.floor(R() * 6)];
      x = x + (p[0] - x) * 1.73;
      y = y + (p[1] - y) * 1.73;
      if (R() < 0.5) {
        const q = pts[Math.floor(R() * 6)];
        g.beginPath();
        g.moveTo(q[0], q[1]);
        const a = R() * Math.PI * 2;
        g.lineTo(q[0] + Math.cos(a) * r * 1.1, q[1] + Math.sin(a) * r * 1.1);
        g.stroke();
      }
    }
  };
  for (const [ox, oy] of [[-1.35, 0.55], [-1.2, 1.55], [1.3, 0.75], [1.45, 1.6], [-2.6, 1.0], [2.55, 1.2]]) cluster(cx + ox * u, oy * u);
  g.restore();

  // thin brand-gradient bands (top and bottom), full wrap, with a fine lighter core line (foil-like)
  const band = (y, h) => {
    const lg = g.createLinearGradient(0, 0, W, 0);
    // repeat the gradient so every side of the vial shows navy -> blue -> teal
    const reps = 3;
    for (let i = 0; i < reps; i++) {
      lg.addColorStop(i / reps, GRAD[0]);
      lg.addColorStop((i + 0.5) / reps, GRAD[1]);
      lg.addColorStop(Math.min(1, (i + 0.999) / reps), GRAD[2]);
    }
    g.fillStyle = lg;
    g.fillRect(0, y, W, h);
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.fillRect(0, y + h * 0.42, W, Math.max(1, h * 0.12));
  };
  band(0.1 * u, 0.045 * u);
  band(H - 0.145 * u, 0.045 * u);

  // symbol
  const symH = 0.62 * u;
  const symW = (symH * 405) / 456;
  const symY = 0.36 * u;
  g.drawImage(symbol, cx - symW / 2, symY, symW, symH);

  // wordmark
  const wmW = 1.62 * u;
  const wmH = (wmW * 62) / 611;
  const wmY = symY + symH + 0.16 * u;
  g.drawImage(wordmark, cx - wmW / 2, wmY, wmW, wmH);

  // rule under the wordmark (gradient)
  const ry = wmY + wmH + 0.075 * u;
  const rl = g.createLinearGradient(cx - wmW / 2, 0, cx + wmW / 2, 0);
  rl.addColorStop(0, GRAD[0]);
  rl.addColorStop(0.55, GRAD[1]);
  rl.addColorStop(1, GRAD[2]);
  g.fillStyle = rl;
  g.fillRect(cx - wmW / 2, ry, wmW, 0.014 * u);

  // tagline (small caps, tracked)
  const track = (txt, y, size, weight, color, spacing) => {
    g.font = `${weight} ${size}px "Inter"`;
    g.fillStyle = color;
    g.textBaseline = "alphabetic";
    const chars = [...txt];
    const widths = chars.map((c) => g.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    let x = cx - total / 2;
    chars.forEach((c, i) => {
      g.fillText(c, x, y);
      x += widths[i] + spacing;
    });
  };
  const tagG = g.createLinearGradient(cx - 0.8 * u, 0, cx + 0.8 * u, 0);
  tagG.addColorStop(0, "#1D4E9E");
  tagG.addColorStop(1, "#1F7FB5");
  track("SCIENCE. PURITY. POTENTIAL.", ry + 0.19 * u, 0.086 * u, 600, tagG, 0.02 * u);

  track("RESEARCH USE ONLY", H - 0.3 * u, 0.078 * u, 700, "#1E3F7A", 0.024 * u);

  // overlap seam at the back (u = 0 / 1): the outer end of the label casts a hairline shadow on the inner end
  const sg = g.createLinearGradient(0, 0, 0.05 * u, 0);
  sg.addColorStop(0, "rgba(40,45,55,0.45)");
  sg.addColorStop(1, "rgba(40,45,55,0)");
  g.fillStyle = sg;
  g.fillRect(0, 0, 0.05 * u, H);

  // very subtle paper tooth (seeded speckle), keeps the label from looking like flat CG white
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const R2 = rng(99);
  for (let i = 0; i < d.length; i += 4) {
    const n = (R2() - 0.5) * 5;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  return cv;
}
