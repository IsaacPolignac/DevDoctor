// PurePeptide film — three.js plate stage (adapted from ../purepeptide-3d-proto/js/vial3d.js).
// Renders the short 3D shots of the film as plates (rendered once to mp4, then graded like the Blender plates).
// State is a pure function of time: renderAt(t) -> find segment -> interpolate its keys -> render.
// No clocks, no requestAnimationFrame, no Math.random. Seeking in any order gives identical frames.
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { drawLabelCanvas } from "./label.js";

// ------------------------------------------------------------------ helpers
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// seeded 2D value noise + fbm (deterministic)
function makeNoise(seed) {
  const R = rng(seed);
  const P = new Float32Array(256 * 256);
  for (let i = 0; i < P.length; i++) P[i] = R();
  const at = (x, y) => P[((y & 255) << 8) | (x & 255)];
  const sm = (t) => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = sm(x - xi), yf = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y, oct = 4) => {
    let s = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++) {
      s += amp * n(x * f + i * 17.3, y * f - i * 9.1);
      f *= 2.03;
      amp *= 0.5;
    }
    return s; // ~0..1
  };
}
const bez = (p0, p1, p2, p3, n) => {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push(new THREE.Vector2(
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ));
  }
  return out;
};
const arc = (cx, cy, r, a0, a1, n) => {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return out;
};
const line = (x0, y0, x1, y1, n) => {
  const out = [];
  for (let i = 1; i <= n; i++) out.push(new THREE.Vector2(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n));
  return out;
};

// ------------------------------------------------------------------ dimensions (1 u = 10 mm)
const D = {
  R: 1.2, // body outer radius (24 mm Ø)
  wall: 0.1,
  bodyTop: 3.35,
  neckR: 0.74,
  lipR: 1.0,
  lipTop: 4.62,
  crimpR: 1.08,
  crimpBot: 4.06,
  crimpTop: 4.97,
  capR: 1.12,
  capTop: 5.38,
  labelBot: 0.62,
  labelTop: 3.06,
  labelR: 1.212,
};

// ------------------------------------------------------------------ geometry
function glassProfile() {
  const { R, wall: w } = D;
  const p = [new THREE.Vector2(0.0001, 0.17)];
  // outer: push-up dome -> heel -> body -> shoulder -> neck -> lip
  p.push(...bez([0, 0.17], [0.45, 0.17], [0.8, 0.03], [1.02, 0.0], 10));
  p.push(...arc(R - 0.17, 0.17, 0.17, -Math.PI / 2, 0, 10)); // heel
  p.push(...line(R, 0.17, R, D.bodyTop, 2)); // straight wall: no need to subdivide
  p.push(...bez([R, D.bodyTop], [R, 3.78], [D.neckR + 0.02, 3.66], [D.neckR, 4.0], 40)); // shoulder
  p.push(...line(D.neckR, 4.0, D.neckR, 4.14, 3));
  p.push(...bez([D.neckR, 4.14], [0.86, 4.14], [D.lipR, 4.16], [D.lipR, 4.3], 16)); // lip underside
  p.push(...line(D.lipR, 4.3, D.lipR, 4.52, 4));
  p.push(...arc(D.lipR - 0.1, 4.52, 0.1, 0, Math.PI / 2, 6)); // lip top round
  p.push(...line(D.lipR - 0.1, D.lipTop, 0.56, D.lipTop, 4));
  // inner (walk back down)
  const iR = R - w, iN = D.neckR - 0.18;
  p.push(...line(0.56, D.lipTop, iN, 4.52, 2));
  p.push(...line(iN, 4.52, iN, 3.98, 2));
  p.push(...bez([iN, 3.98], [iN + 0.02, 3.62], [iR, 3.72], [iR, D.bodyTop], 40));
  p.push(...line(iR, D.bodyTop, iR, 0.3, 2));
  p.push(...arc(iR - 0.12, 0.3, 0.12, 0, -Math.PI / 2, 8));
  p.push(...bez([iR - 0.12, 0.18], [0.75, 0.18], [0.45, 0.3], [0.0001, 0.3], 10));
  return p;
}

function crimpProfile() {
  const r = D.crimpR, b = D.crimpBot, t = D.crimpTop;
  const p = [new THREE.Vector2(0.8, b + 0.03)];
  p.push(...bez([0.8, b + 0.03], [0.84, b - 0.03], [r - 0.08, b - 0.03], [r - 0.02, b + 0.02], 12)); // rolled under the lip (clears the glass)
  p.push(...bez([r - 0.02, b + 0.02], [r, b + 0.05], [r, b + 0.08], [r, b + 0.12], 4));
  p.push(...line(r, b + 0.12, r, t - 0.05, 20));
  p.push(...arc(r - 0.05, t - 0.05, 0.05, 0, Math.PI / 2, 6));
  p.push(...line(r - 0.05, t, 0.62, t, 6));
  p.push(...line(0.62, t, 0.62, t - 0.05, 1));
  return p;
}

function capProfile() {
  const r = D.capR, b = D.crimpTop - 0.005, t = D.capTop;
  const p = [new THREE.Vector2(0.62, b + 0.02)];
  p.push(...line(0.62, b + 0.02, r - 0.03, b, 4));
  p.push(...arc(r - 0.03, b + 0.03, 0.03, -Math.PI / 2, 0, 4));
  p.push(...line(r, b + 0.03, r, t - 0.09, 10));
  p.push(...arc(r - 0.09, t - 0.09, 0.09, 0, Math.PI / 2, 10)); // rounded top rim
  p.push(...line(r - 0.09, t, r - 0.2, t, 2));
  p.push(...bez([r - 0.2, t], [r - 0.26, t], [r - 0.28, t - 0.035], [r - 0.34, t - 0.035], 6)); // recessed top field
  p.push(...line(r - 0.34, t - 0.035, 0.0001, t - 0.03, 10));
  return p;
}

// lyophilised cake: slightly shrunk from the wall, irregular crusty top, a couple of cracks
function cakeGeometry(noise) {
  const segs = 160, rings = 48;
  const rMax = D.R - D.wall - 0.03;
  const y0 = 0.19, hBase = 0.5;
  const pos = [], uv = [], idx = [];
  const topY = (r, a) => {
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    let h = hBase + (noise(x * 1.6 + 3, z * 1.6 + 7, 5) - 0.5) * 0.16; // lumpy
    h += (noise(x * 7 + 11, z * 7 - 5, 3) - 0.5) * 0.035; // grainy crust
    const edge = r / rMax;
    h += Math.pow(edge, 8) * 0.05; // cake lifts at the wall (meniscus memory)
    h -= Math.pow(Math.max(0, edge - 0.93) / 0.07, 2) * 0.05; // crumbly rounded rim
    const crack = Math.abs(Math.sin(a * 3 + noise(x * 2, z * 2, 2) * 4));
    if (edge > 0.3 && crack < 0.04) h -= 0.06 * (1 - crack / 0.04);
    h -= (1 - edge) * 0.04; // slight central dip
    return y0 + h;
  };
  // top surface
  for (let i = 0; i <= rings; i++) {
    const r = (i / rings) * rMax;
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      pos.push(Math.cos(a) * r, topY(r, a), Math.sin(a) * r);
      uv.push(0.5 + (Math.cos(a) * r) / (2 * rMax), 0.5 + (Math.sin(a) * r) / (2 * rMax));
    }
  }
  const row = segs + 1;
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segs; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  // side wall (slightly wavy radius where it shrank off the glass)
  const base = pos.length / 3;
  const vs = 6;
  for (let k = 0; k <= vs; k++) {
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const rr = rMax - 0.012 - noise(Math.cos(a) * 3 + k * 0.7, Math.sin(a) * 3 + k * 0.9, 4) * 0.06;
      const yt = topY(rMax, a);
      const y = y0 - 0.02 + (yt - y0 + 0.02) * (k / vs);
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      uv.push(j / segs, k / vs);
    }
  }
  for (let k = 0; k < vs; k++)
    for (let j = 0; j < segs; j++) {
      const a = base + k * row + j, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ procedural textures
function canvasTex(w, h, draw, colorSpace) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (colorSpace) t.colorSpace = colorSpace;
  return t;
}
// brushed / crimp micro-lines running around the circumference (lathe uv: u = around, v = along profile)
function brushedBump(seed) {
  const R = rng(seed);
  return canvasTex(64, 1024, (g, w, h) => {
    g.fillStyle = "#808080";
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const v = 128 + (R() - 0.5) * 70;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(0, y, w, 1);
    }
  });
}
function cakeBump(noise) {
  return canvasTex(512, 512, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = noise(x / 18, y / 18, 4) * 255;
        const i = (y * w + x) * 4;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
        im.data[i + 3] = 255;
      }
    g.putImageData(im, 0, 0);
  });
}
function radialTex(stops, size = 512) {
  return canvasTex(size, size, (g, w, h) => {
    const rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    stops.forEach(([o, c]) => rg.addColorStop(o, c));
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
  });
}
function glowTex() {
  // radial halo that falls off toward the floor line (v = 0.325 on a 16 u plane centred at y = 2.8)
  return canvasTex(512, 512, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1) - 0.5, v = 1 - y / (h - 1);
        const r = Math.hypot(u * 1.15, (v - 0.52) * 1.0) * 2;
        let k = Math.exp(-r * r * 3.2);
        const f = Math.min(1, Math.max(0, (v - 0.33) / 0.3));
        k *= f * f * (3 - 2 * f);
        const i = (y * w + x) * 4;
        im.data[i] = Math.round(34 * k);
        im.data[i + 1] = Math.round(60 * k);
        im.data[i + 2] = Math.round(110 * k);
        im.data[i + 3] = 255;
      }
    g.putImageData(im, 0, 0);
  }, THREE.SRGBColorSpace);
}
function softboxTex() {
  // bright core with soft rolled-off edges (diffusion fabric), linear values
  return canvasTex(128, 256, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = Math.abs(x / (w - 1) - 0.5) * 2, dy = Math.abs(y / (h - 1) - 0.5) * 2;
        const ex = Math.min(1, (1 - dx) / 0.35), ey = Math.min(1, (1 - dy) / 0.15);
        const v = Math.round(255 * Math.pow(Math.max(0, ex), 1.5) * Math.pow(Math.max(0, ey), 1.2) * (0.85 + 0.15 * (1 - dx)));
        const i = (y * w + x) * 4;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
        im.data[i + 3] = 255;
      }
    g.putImageData(im, 0, 0);
  });
}

// crimp: vertical knurl ribs around the circumference + fine machining lines
function ribBump(seed) {
  const R = rng(seed);
  return canvasTex(2048, 256, (g, w, h) => {
    const im = g.createImageData(w, h);
    const ribs = 96;
    const rowN = new Float32Array(h);
    for (let y = 0; y < h; y++) rowN[y] = (R() - 0.5) * 30;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = (x / w) * ribs;
        const f = p - Math.floor(p);
        const rib = Math.pow(Math.sin(f * Math.PI), 0.6); // rounded crests, sharp valleys
        const v = Math.max(0, Math.min(255, 70 + rib * 150 + rowN[y]));
        const i = (y * w + x) * 4;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
        im.data[i + 3] = 255;
      }
    g.putImageData(im, 0, 0);
  });
}
function glowTexW() {
  // neutral radial glow (tinted by material colour); plane is 16 u, centred at y = 2.8; falls off toward the floor
  return canvasTex(512, 512, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1) - 0.5, v = 1 - y / (h - 1);
        const r = Math.hypot(u * 1.5, (v - 0.55) * 0.95) * 2;
        let k = Math.exp(-r * r * 3.4);
        const f = Math.min(1, Math.max(0, (v - 0.33) / 0.12));
        k *= f * f * (3 - 2 * f);
        const i = (y * w + x) * 4;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = Math.round(255 * k);
        im.data[i + 3] = 255;
      }
    g.putImageData(im, 0, 0);
  }, THREE.SRGBColorSpace);
}

// ------------------------------------------------------------------ environments (PMREM of a black room with panels)
function buildEnv(renderer, panels) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x000000);
  const room = new THREE.Mesh(new THREE.BoxGeometry(40, 30, 40), new THREE.MeshBasicMaterial({ color: 0x030304, side: THREE.BackSide }));
  env.add(room);
  const sb = softboxTex();
  for (const [w, h, pos, intensity, tint] of panels) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: sb, color: new THREE.Color(tint || 0xffffff).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 2.6, 0);
    env.add(m);
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(env, 0.0, 0.1, 100, { size: 1024 });
  pm.dispose();
  return rt.texture;
}
const ENV = {
  // Blender-matched studio: soft key behind-left, two strips, a kicker, faint top
  studio: [[8, 18, [-9, 4, -9], 9.0], [1.4, 18, [-8.5, 4, 4.5], 13.0], [1.2, 18, [8.5, 4, 3], 10.0, 0xf2f6ff], [2.2, 18, [8, 4, -8], 9.0], [8, 8, [0, 14, 0], 0.3]],
  // fragment of light: only two tall strips behind the vial -> rims on the glass edges, everything else black
  rim: [[1.0, 20, [-6.5, 4, -7], 16.0], [1.0, 20, [6.5, 4, -7], 16.0]],
  // cold: rims tinted blue-white, a faint cool top
  cold: [[1.2, 20, [-6, 4, -7.5], 13.0, 0xd9e6ff], [1.2, 20, [6, 4, -7.5], 13.0, 0xd9e6ff], [6, 6, [0, 14, -2], 0.25, 0xcfe0ff]],
  // backlight for the smoke shot: one broad soft panel straight behind + thin rims
  back: [[6, 14, [0, 4, -10], 7.0, 0xfff8f0], [0.8, 20, [-7, 4, -6], 10.0], [0.8, 20, [7, 4, -6], 10.0]],
};
const LOOK = {
  studio: { env: "studio", envI: 1.0, labelE: 0.2, glow: [0, 0, 0], hemi: 0 },
  rim: { env: "rim", envI: 1.0, labelE: 0.0, glow: [0, 0, 0], hemi: 0 },
  cold: { env: "cold", envI: 1.0, labelE: 0.035, glow: [0.34, 0.44, 0.62], hemi: 0 },
  back: { env: "back", envI: 1.0, labelE: 0.02, glow: [0.62, 0.6, 0.58], hemi: 0 },
};

// ------------------------------------------------------------------ easing
const EASE = {
  lin: (t) => t,
  io: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  o: (t) => 1 - (1 - t) * (1 - t),
  i: (t) => t * t,
  ramp: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), // speed ramp (power3.inOut)
};
const DEF = { az: 0, el: 0.05, dist: 14, tx: 0, ty: 2.7, tz: 0, fov: 28, vialRot: 0, rig: 0, sweep: -9, sweepI: 0, exposure: 1.0, glowK: 1 };

// ------------------------------------------------------------------ the stage
// segments: [{ name, t0, dur, look, from: {...}, to: {...}, ease }]
export function createStage({ canvas, segments, width = 1920, height = 1080, pixelRatio = 1.25, transmissionScale = 0.75, glassSegs = 160 }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 1);
  renderer.transmissionResolutionScale = transmissionScale;
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 26, 60);
  const cam = new THREE.PerspectiveCamera(28, width / height, 0.05, 200);
  scene.add(cam);

  const noise = makeNoise(4242);
  const world = new THREE.Group();
  scene.add(world);
  const vial = new THREE.Group();
  world.add(vial);

  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 1, thickness: 0.2, ior: 1.5, specularIntensity: 1, specularColor: 0xffffff, attenuationColor: new THREE.Color(0xdcecf2), attenuationDistance: 3.0, envMapIntensity: 1.25, side: THREE.DoubleSide, transparent: false });
  const glass = new THREE.Mesh(new THREE.LatheGeometry(glassProfile(), glassSegs), glassMat);
  glass.renderOrder = 2;
  vial.add(glass);

  const cakeMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f1e8, roughness: 0.92, metalness: 0, bumpMap: cakeBump(noise), bumpScale: 1.2, sheen: 0.4, sheenRoughness: 0.9, sheenColor: 0xffffff });
  const cake = new THREE.Mesh(cakeGeometry(noise), cakeMat);
  vial.add(cake);

  const stopper = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(0.0001, 3.92), new THREE.Vector2(0.5, 3.92), new THREE.Vector2(0.54, 3.97), new THREE.Vector2(0.55, 4.62), new THREE.Vector2(0.9, 4.63), new THREE.Vector2(0.9, 4.68), new THREE.Vector2(0.0001, 4.68)], 96),
    new THREE.MeshPhysicalMaterial({ color: 0x5d6168, roughness: 0.55, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.5 }),
  );
  vial.add(stopper);

  const ribs = ribBump(11);
  ribs.wrapS = ribs.wrapT = THREE.RepeatWrapping;
  const crimpMat = new THREE.MeshPhysicalMaterial({ color: 0xd8dce1, metalness: 1, roughness: 0.3, anisotropy: 0.6, anisotropyRotation: 0, bumpMap: ribs, bumpScale: 0.9, envMapIntensity: 1.05 });
  const crimp = new THREE.Mesh(new THREE.LatheGeometry(crimpProfile(), 384), crimpMat);
  vial.add(crimp);

  const capMat = new THREE.MeshPhysicalMaterial({ color: 0x1f4fd1, roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.35, specularIntensity: 0.35, envMapIntensity: 0.9 });
  const cap = new THREE.Mesh(new THREE.LatheGeometry(capProfile(), 192), capMat);
  vial.add(cap);

  const labelH = D.labelTop - D.labelBot;
  const thetaLen = Math.PI * 2;
  const labelGeo = new THREE.CylinderGeometry(D.labelR, D.labelR, labelH, 256, 1, true, -thetaLen / 2, thetaLen);
  labelGeo.translate(0, D.labelBot + labelH / 2, 0);
  const labelMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.18, side: THREE.FrontSide });
  const label = new THREE.Mesh(labelGeo, labelMat);
  vial.add(label);
  vial.add(new THREE.Mesh(labelGeo, new THREE.MeshStandardMaterial({ color: 0xd9dadc, roughness: 0.8, side: THREE.BackSide })));

  const mirror = new THREE.Group();
  mirror.scale.y = -1;
  const vialMirror = vial.clone(true);
  mirror.add(vialMirror);
  world.add(mirror);
  const floorAlpha = radialTex([[0, "#9a9a9a"], [0.05, "#b4b4b4"], [0.16, "#e4e4e4"], [0.35, "#ffffff"], [1, "#ffffff"]]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaMap: floorAlpha, opacity: 1, depthWrite: true }));
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = 3;
  world.add(floor);

  const sweep = new THREE.RectAreaLight(0xffffff, 0, 0.5, 16);
  sweep.position.set(0, 2.2, 4.2);
  sweep.lookAt(0, 2.2, 0);
  scene.add(sweep);

  const back = new THREE.Group();
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTexW(), fog: false, color: new THREE.Color(0, 0, 0) });
  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), glowMat);
  glowPlane.position.set(0, 2.8, -0.5);
  back.add(glowPlane);
  scene.add(back);

  const envs = {};
  const S = { ...DEF };
  let look = LOOK.studio;
  const tgt = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  function stateAt(t) {
    let seg = segments[0];
    for (const s of segments) if (t >= s.t0 - 1e-6) seg = s;
    const u = Math.min(1, Math.max(0, (t - seg.t0) / seg.dur));
    const e = (EASE[seg.ease] || EASE.io)(u);
    Object.assign(S, DEF);
    const from = seg.from || {}, to = seg.to || {};
    for (const k of Object.keys(DEF)) {
      const a = from[k] != null ? from[k] : DEF[k];
      const b = to[k] != null ? to[k] : a;
      const ek = seg.easeKeys && seg.easeKeys[k] ? EASE[seg.easeKeys[k]](u) : e;
      S[k] = a + (b - a) * ek;
    }
    look = LOOK[seg.look || "studio"];
    return seg;
  }
  function applyState() {
    tgt.set(S.tx, S.ty, S.tz);
    const ce = Math.cos(S.el);
    cam.position.set(tgt.x + S.dist * ce * Math.sin(S.az), tgt.y + S.dist * Math.sin(S.el), tgt.z + S.dist * ce * Math.cos(S.az));
    cam.lookAt(tgt);
    if (cam.fov !== S.fov) {
      cam.fov = S.fov;
      cam.updateProjectionMatrix();
    }
    vial.rotation.y = S.vialRot;
    vialMirror.rotation.y = S.vialRot;
    scene.environment = envs[look.env];
    scene.environmentRotation.set(0, S.rig, 0);
    scene.environmentIntensity = look.envI;
    labelMat.emissive.setScalar(look.labelE);
    sweep.position.x = S.sweep;
    sweep.intensity = 28 * S.sweepI;
    tmp.set(cam.position.x, 0, cam.position.z).normalize();
    back.position.set(-tmp.x * 6, 0, -tmp.z * 6);
    back.rotation.set(0, Math.atan2(tmp.x, tmp.z), 0);
    glowMat.color.setRGB(look.glow[0] * S.glowK, look.glow[1] * S.glowK, look.glow[2] * S.glowK);
    renderer.toneMappingExposure = S.exposure;
  }

  let isReady = false;
  let lastT = NaN;
  function renderAt(t, force) {
    const tt = Math.max(0, Math.round(t * 240) / 240);
    if (tt === lastT && !force) return;
    lastT = tt;
    stateAt(tt);
    applyState();
    renderer.render(scene, cam);
  }

  const ready = (async () => {
    const arcLen = thetaLen * D.labelR;
    const cv = await drawLabelCanvas({ arcLen, height: labelH, pxPerUnit: 900 });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.generateMipmaps = true;
    labelMat.map = tex;
    labelMat.emissiveMap = tex;
    labelMat.emissive = new THREE.Color(0.2, 0.2, 0.2);
    labelMat.needsUpdate = true;
    for (const k in ENV) envs[k] = buildEnv(renderer, ENV[k]);
    scene.environment = envs.studio;
    renderer.compile(scene, cam);
    isReady = true;
    renderAt(0, true);
    return true;
  })();

  return { renderer, scene, camera: cam, state: S, renderAt, ready, get isReady() { return isReady; } };
}
