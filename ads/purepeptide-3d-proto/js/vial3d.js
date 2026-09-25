// PurePeptide — photoreal 3D glass vial shot for HyperFrames.
// Everything visible is a pure function of the timeline time t:
//   renderAt(t)  ->  vialTl.totalTime(t, true)   (GSAP writes the proxy S)
//                ->  applyState(S)               (proxy -> camera / vial / lights)
//                ->  renderer.render(scene, cam)
// No clocks, no requestAnimationFrame, no Math.random. Seeking out of order gives identical frames.
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
  p.push(...line(R, 0.17, R, D.bodyTop, 40));
  p.push(...bez([R, D.bodyTop], [R, 3.78], [D.neckR + 0.02, 3.66], [D.neckR, 4.0], 72)); // shoulder
  p.push(...line(D.neckR, 4.0, D.neckR, 4.14, 3));
  p.push(...bez([D.neckR, 4.14], [0.86, 4.14], [D.lipR, 4.16], [D.lipR, 4.3], 16)); // lip underside
  p.push(...line(D.lipR, 4.3, D.lipR, 4.52, 4));
  p.push(...arc(D.lipR - 0.1, 4.52, 0.1, 0, Math.PI / 2, 6)); // lip top round
  p.push(...line(D.lipR - 0.1, D.lipTop, 0.56, D.lipTop, 4));
  // inner (walk back down)
  const iR = R - w, iN = D.neckR - 0.18;
  p.push(...line(0.56, D.lipTop, iN, 4.52, 2));
  p.push(...line(iN, 4.52, iN, 3.98, 6));
  p.push(...bez([iN, 3.98], [iN + 0.02, 3.62], [iR, 3.72], [iR, D.bodyTop], 72));
  p.push(...line(iR, D.bodyTop, iR, 0.3, 24));
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
function stripTex() {
  // soft-edged vertical light strip (horizontal falloff + top/bottom fade)
  return canvasTex(128, 512, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = Math.abs(x / (w - 1) - 0.5) * 2;
        const hx = Math.pow(Math.max(0, 1 - dx), 1.6);
        const vy = y / (h - 1);
        const fv = Math.min(1, vy / 0.12) * Math.min(1, (1 - vy) / 0.2);
        const v = Math.round(255 * hx * fv);
        const i = (y * w + x) * 4;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
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

// ------------------------------------------------------------------ studio environment (PMREM of a dark room with bright panels)
function buildEnv(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x000000);
  const room = new THREE.Mesh(new THREE.BoxGeometry(40, 30, 40), new THREE.MeshBasicMaterial({ color: 0x050607, side: THREE.BackSide }));
  env.add(room);
  const sb = softboxTex();
  const panel = (w, h, pos, intensity, tint = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: sb, color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 2.6, 0);
    env.add(m);
    return m;
  };
  panel(8, 18, [-9, 4, -9], 10.0); // large soft key, behind-left -> rim on glass edges
  panel(1.4, 18, [-8.5, 4, 4.5], 14.0); // strip left
  panel(1.2, 18, [8.5, 4, 3], 11.0, 0xeef4ff); // strip right (slightly cool)
  panel(2.2, 18, [8, 4, -8], 9.0); // kicker behind-right -> right rim
  panel(8, 8, [0, 14, 0], 0.35); // soft top
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(env, 0.0, 0.1, 100, { size: 1024 });
  pm.dispose();
  return rt.texture;
}

// ------------------------------------------------------------------ the shot
export function createVialShot({ canvas, width = 1920, height = 1080, pixelRatio = 1.5, duration = 12, antialias = true, transmissionScale = 1 }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
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

  // ---------------- proxy state: the ONLY thing the GSAP timeline animates
  const S = {
    az: 0, el: 0.06, dist: 15, tx: 0, ty: 2.7, tz: 0, fov: 28, // camera (spherical around target)
    vialRot: 0, // turntable
    rig: 0, // light rig + environment rotation (makes reflections slide)
    sweep: -9, // x of the moving strip light (label light sweep)
    sweepI: 0,
    rim: 1, // rim / key intensity multiplier
    glow: 0.5, // background glow behind vial
    envI: 1,
    exposure: 1.0,
  };
  const tl = gsap.timeline({ paused: true, defaults: { immediateRender: false } });
  const seg = (at, dur, from, to, ease = "power2.inOut") => tl.fromTo(S, { ...from }, { ...to, duration: dur, ease, immediateRender: false }, at);

  // Shot A 0–3 s: macro push along the glass edge (shoulder + label top edge), light sweep over the label
  seg(0, 3, { az: -0.5, el: 0.2, dist: 4.5, tx: 0.62, ty: 2.7, tz: 0, fov: 24, vialRot: -0.95 }, { az: -0.3, el: 0.02, dist: 3.6, tx: 0.55, ty: 4.0, tz: 0, fov: 24, vialRot: -0.5 }, "sine.inOut");
  seg(0, 3, { sweep: -7, sweepI: 1 }, { sweep: 7, sweepI: 1 }, "power1.inOut");
  seg(0, 3, { rig: 0.25, rim: 1, glow: 0.35, envI: 1, exposure: 1 }, { rig: 0.1, rim: 1, glow: 0.35, envI: 1, exposure: 1 }, "none");

  // Shot B 3–7 s: hero width, full 360° turntable (ease in/out), light rig counter-rotates so strips slide over the glass
  seg(3, 4, { az: 0.3, el: 0.05, dist: 15.2, tx: 0, ty: 2.62, tz: 0, fov: 28, vialRot: -0.95 }, { az: -0.18, el: 0.07, dist: 14.6, tx: 0, ty: 2.62, tz: 0, fov: 28, vialRot: Math.PI * 2 - 0.18 }, "power2.inOut");
  seg(3, 4, { rig: 0.45, sweep: 9, sweepI: 0, rim: 1, glow: 0.5, envI: 1, exposure: 1 }, { rig: -0.55, sweep: 9, sweepI: 0, rim: 1, glow: 0.5, envI: 1, exposure: 1 }, "sine.inOut");

  // Shot C 7–10 s: camera rises and orbits to a 3/4 top view (blue cap + crimp)
  seg(7, 3, { az: -0.18, el: 0.07, dist: 14.6, tx: 0, ty: 2.62, fov: 28, vialRot: Math.PI * 2 - 0.18 }, { az: 0.6, el: 0.66, dist: 8.2, tx: 0, ty: 4.25, fov: 30, vialRot: Math.PI * 2 + 0.3 }, "power2.inOut");
  seg(7, 3, { rig: -0.55 }, { rig: -0.2 }, "sine.inOut");

  // Shot D 10–12 s: hero pose, centred; rim light pulse
  seg(10, 1.35, { az: 0.6, el: 0.66, dist: 8.2, tx: 0, ty: 4.25, fov: 30, vialRot: Math.PI * 2 + 0.3 }, { az: 0, el: 0.05, dist: 14.4, tx: 0, ty: 2.7, fov: 28, vialRot: Math.PI * 2 }, "power3.inOut");
  seg(11.35, 0.65, { dist: 14.4 }, { dist: 14.0 }, "sine.out");
  seg(10, 2, { rig: -0.2 }, { rig: 0 }, "sine.inOut");
  seg(10, 1.1, { rim: 1, glow: 0.5 }, { rim: 2.6, glow: 1.0 }, "power2.inOut");
  seg(11.1, 0.9, { rim: 2.6, glow: 1.0 }, { rim: 1.5, glow: 0.75 }, "sine.out");
  tl.to({}, { duration: 0 }, duration); // pin length

  // ---------------- scene graph (materials/meshes created sync; label texture async)
  const noise = makeNoise(4242);
  const world = new THREE.Group();
  scene.add(world);
  const vial = new THREE.Group(); // rotates (turntable)
  world.add(vial);

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.02,
    transmission: 1,
    thickness: 0.2,
    ior: 1.5,
    specularIntensity: 1,
    specularColor: 0xffffff,
    attenuationColor: new THREE.Color(0xdcecf2),
    attenuationDistance: 3.0,
    envMapIntensity: 1.25,
    side: THREE.DoubleSide,
    transparent: false,
  });
  const glass = new THREE.Mesh(new THREE.LatheGeometry(glassProfile(), 256), glassMat);
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

  const brush = brushedBump(11);
  brush.wrapS = brush.wrapT = THREE.RepeatWrapping;
  const crimpMat = new THREE.MeshPhysicalMaterial({ color: 0xd8dce1, metalness: 1, roughness: 0.36, anisotropy: 0.7, anisotropyRotation: Math.PI / 2, bumpMap: brush, bumpScale: 0.12, envMapIntensity: 1.1 });
  const crimp = new THREE.Mesh(new THREE.LatheGeometry(crimpProfile(), 256), crimpMat);
  vial.add(crimp);

  const capMat = new THREE.MeshPhysicalMaterial({ color: 0x1f4fd1, roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4, specularIntensity: 0.35, envMapIntensity: 0.9 });
  const cap = new THREE.Mesh(new THREE.LatheGeometry(capProfile(), 192), capMat);
  vial.add(cap);

  // label (front = +z when vialRot = 0). Leave a small seam gap at the back.
  const labelH = D.labelTop - D.labelBot;
  const thetaLen = Math.PI * 2; // full wrap, overlap seam drawn into the texture at the back
  const labelGeo = new THREE.CylinderGeometry(D.labelR, D.labelR, labelH, 256, 1, true, -thetaLen / 2, thetaLen);
  labelGeo.translate(0, D.labelBot + labelH / 2, 0);
  const labelMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.18, side: THREE.FrontSide });
  const label = new THREE.Mesh(labelGeo, labelMat);
  vial.add(label);
  const labelBack = new THREE.Mesh(labelGeo, new THREE.MeshStandardMaterial({ color: 0xd9dadc, roughness: 0.8, side: THREE.BackSide }));
  vial.add(labelBack);

  // mirrored clone for the floor reflection (shares geometry + materials)
  const mirror = new THREE.Group();
  mirror.scale.y = -1;
  const vialMirror = vial.clone(true);
  mirror.add(vialMirror);
  world.add(mirror);

  // glossy black floor, semi-transparent over the mirrored clone, stronger reflection near the vial
  const floorAlpha = radialTex([[0, "#9a9a9a"], [0.05, "#b4b4b4"], [0.16, "#e4e4e4"], [0.35, "#ffffff"], [1, "#ffffff"]]);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaMap: floorAlpha, opacity: 1, depthWrite: true }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = 3;
  world.add(floor);

  // ---------------- light rig (area lights mirror the env panels; the rig + env rotate together)
  const rig = new THREE.Group();
  scene.add(rig);
  const area = (w, h, pos, intensity, color = 0xffffff) => {
    const l = new THREE.RectAreaLight(color, intensity, w, h);
    l.position.set(...pos);
    l.lookAt(0, 2.6, 0);
    rig.add(l);
    return l;
  };
  const key = area(8, 12, [-9, 6.5, -9], 3.5);
  area(1.4, 12, [-8.5, 6.5, 4.5], 5);
  area(1.2, 12, [8.5, 6.5, 3], 4, 0xeef4ff);
  const kicker = area(2.2, 12, [8, 6.5, -8], 3);
  scene.add(new THREE.AmbientLight(0xffffff, 0.2)); // no frontal area light: it would print a rectangle on the glass
  const sweep = new THREE.RectAreaLight(0xffffff, 0, 0.5, 16);
  sweep.position.set(0, 2.2, 4.2);
  sweep.lookAt(0, 2.2, 0);
  scene.add(sweep); // camera-independent, moves along x

  // visible light strips *behind* the vial (placed each frame on the camera->vial axis): they are what the glass refracts
  const back = new THREE.Group();
  // soft dark-blue glow behind the vial (studio "halo")
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex(), fog: false, color: new THREE.Color(0.5, 0.5, 0.5) });
  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), glowMat);
  glowPlane.position.set(0, 2.8, -0.5);
  back.add(glowPlane);
  scene.add(back);

  // ---------------- apply proxy -> scene
  const tgt = new THREE.Vector3();
  const tmp = new THREE.Vector3();
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
    rig.rotation.y = S.rig;
    scene.environmentRotation.set(0, S.rig, 0);
    scene.environmentIntensity = S.envI;
    key.intensity = 3.5 * S.rim;
    kicker.intensity = 3 * S.rim;
    sweep.position.x = S.sweep;
    sweep.intensity = 28 * S.sweepI;
    // strips + glow sit 6 u behind the vial axis, facing the camera
    tmp.set(cam.position.x, 0, cam.position.z).normalize();
    back.position.set(-tmp.x * 6, 0, -tmp.z * 6);
    back.rotation.set(0, Math.atan2(tmp.x, tmp.z), 0);
    glowMat.color.setScalar(S.glow);
    renderer.toneMappingExposure = S.exposure;
  }

  let isReady = false;
  let lastT = NaN;
  function renderAt(t, force) {
    const tt = Math.min(Math.max(0, t), duration);
    if (tt === lastT && !force) return; // HyperFrames may dispatch the same time twice per frame
    lastT = tt;
    tl.totalTime(tt, true); // GSAP writes S deterministically for time tt
    applyState();
    renderer.render(scene, cam);
  }

  const ready = (async () => {
    const arcLen = thetaLen * D.labelR;
    const cv = await drawLabelCanvas({ arcLen, height: labelH, pxPerUnit: 760 });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.generateMipmaps = true;
    labelMat.map = tex;
    labelMat.emissiveMap = tex; // printed paper reads bright without a frontal light that would mirror in the glass
    labelMat.emissive = new THREE.Color(0.2, 0.2, 0.2);
    labelMat.needsUpdate = true;
    scene.environment = buildEnv(renderer);
    renderer.compile(scene, cam);
    isReady = true;
    return true;
  })();

  return { parts: { glass, cake, stopper, crimp, cap, label, labelBack, floor, mirror }, renderer, scene, camera: cam, timeline: tl, state: S, renderAt, ready, get isReady() { return isReady; } };
}
