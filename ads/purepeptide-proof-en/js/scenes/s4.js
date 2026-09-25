// s4 — REAL SITE TEST (clip 30.90 → 47.60, ENGLISH), BELOW the stage-level #sitetest video (31.40 → 45.60).
// Black stage + teal floor glow + a dark macOS-like browser window whose content area frames the real site
// recording exactly. One camera function of time (PP.s4cam) drives the window chrome, the video and (from s4o) the
// edge light, corner masks, click ripples and highlights, so every layer shares the exact same transform on every
// frame. Transparent until 31.40 (s3's « CHECK IT YOURSELF. » slam shows through), then the window flies in from
// black (whoosh 31.40); it recedes behind the offer cards 45.30 → 45.58 (video ends 45.60); the black stage stays
// under the full-frame offer panel (s4o) and leaves with the exit whoosh 47.30. All times absolute (s).
PP.scene("s4", function (tl, root, cam) {
  const ST = PP.cfg.siteTest; // 1920 x 1200 video px
  const VW = ST.w,
    VH = ST.h;
  const K0 = 0.71; // base scale: content 1363.2 x 852 stage px
  const TB = 56; // top bar height (stage px at base scale)
  const TBU = TB / K0; // top bar height in window-local units
  const RAD = 18 / K0; // window radius in local units
  const WIN_TOP = 146; // base window top (stage px)
  const BASE = { f: [VW / 2, VH / 2], s: [960, WIN_TOP + TB + (VH * K0) / 2], z: 1 };
  const T_IN = 31.4, // whoosh: window flies in from black
    T_REC = 45.3, // window recedes behind the offer cards
    T_GONE = 45.58, // fully gone (video clip ends 45.60)
    T_EXIT = 47.3; // exit whoosh (stage leaves)

  // ---------------------------------------------------------------- camera keyframes (video point f → stage point s, zoom z)
  // English recording layout (video px): gate modal 614–1306 × 280–920 · home CTA (381, 847) · shop grid card
  // BPC-157 / TB-500 70–494 × 144–936 after the 35.83–36.63 scroll · purity line 1010–1655 × 480–540 · page scrolls
  // 347 px 40.57–41.27 → bundles 1020–1645 × 468–562, Add to cart (1390, 701), « Ships within 24 h … Free shipping
  // over $200 » 1022–1643 × 1107–1190, Cart button (1797, 1140) · cart drawer 1360–1920 × 0–730 from 43.4.
  const K = [
    { t: 31.4, ...BASE },
    // 01 · gate — slow push into the researcher verification
    { t: 33.9, f: [960, 640], s: [960, 612], z: 1.12, e: "sine.inOut" },
    // home — breathe out, CTA « Explore the catalog » stays in frame
    { t: 34.6, f: [900, 620], s: [940, 622], z: 1.05, e: "power2.inOut" },
    { t: 35.55, f: [900, 620], s: [940, 622], z: 1.07, e: "none" },
    // 02 · shop grid → first card (BPC-157 / TB-500)
    { t: 37.3, f: [282, 540], s: [600, 566], z: 1.32, e: "power3.inOut" },
    { t: 38.1, f: [282, 540], s: [604, 562], z: 1.35, e: "sine.inOut" },
    // product page (38.067) — breathe out, then push to the purity line (outlined 39.167 → 40.57)
    { t: 38.85, f: [1150, 600], s: [1010, 580], z: 1.14, e: "power2.inOut" },
    { t: 40.05, f: [1332, 510], s: [1170, 424], z: 1.36, e: "power3.inOut" },
    { t: 40.6, f: [1332, 510], s: [1164, 430], z: 1.37, e: "sine.inOut" },
    // 04 · page scrolled: bundles + Add to cart + shipping line (right half of the frame; lower third / cards left)
    { t: 41.85, f: [1330, 820], s: [1190, 640], z: 1.2, e: "power3.inOut" },
    { t: 43.15, f: [1330, 820], s: [1184, 640], z: 1.22, e: "none" },
    // cart drawer (43.2 → 45.6), framed on the right; offer cards over the dimmed page on the left
    { t: 44.15, f: [1640, 380], s: [1488, 492], z: 1.34, e: "power2.inOut" },
    { t: 45.6, f: [1640, 380], s: [1484, 494], z: 1.365, e: "none" },
  ];
  const eases = {};
  const ez = (name) => eases[name] || (eases[name] = gsap.parseEase(name));
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  function state(t) {
    let a = K[0],
      b = K[0],
      k = 0;
    if (t >= K[K.length - 1].t) a = b = K[K.length - 1];
    else if (t > K[0].t) {
      for (let i = 1; i < K.length; i++)
        if (t <= K[i].t) {
          a = K[i - 1];
          b = K[i];
          k = ez(b.e)(clamp01((t - a.t) / (b.t - a.t)));
          break;
        }
    }
    const z = Math.exp(lerp(Math.log(a.z), Math.log(b.z), k));
    let fx = lerp(a.f[0], b.f[0], k),
      fy = lerp(a.f[1], b.f[1], k),
      sx = lerp(a.s[0], b.s[0], k),
      sy = lerp(a.s[1], b.s[1], k);
    let zm = 1,
      dy = 0,
      rx = 0,
      op = 1,
      br = 1;
    // entry (whoosh 31.40): from below, tilted, small, dark → expo.out 0.62 s
    if (t < T_IN) op = 0;
    else if (t < T_IN + 0.62) {
      const e = ez("expo.out")((t - T_IN) / 0.62);
      dy = lerp(700, 0, e);
      rx = lerp(18, 0, e);
      zm = lerp(0.85, 1, e);
      br = lerp(0.35, 1, e);
      op = clamp01((t - T_IN) / 0.1 + 0.001);
    }
    // recede (45.30 → 45.58): dolly back + sink + darken behind the offer cards, gone before the video ends
    if (t > T_REC) {
      const u = clamp01((t - T_REC) / (T_GONE - T_REC));
      const e = ez("power2.in")(u);
      zm = 1 - 0.16 * ez("power2.out")(u);
      dy = 90 * e;
      rx = 8 * e;
      br = 1 - 0.65 * e;
      op = 1 - e;
      if (t >= T_GONE) op = 0;
    }
    const kk = K0 * z * zm;
    // zoom about the frame focus: keep stage point s fixed while zm scales
    const X = sx - fx * kk; // content (video) top-left, stage px
    const Y = sy + dy - fy * kk;
    return { k: kk, X, Y, rx, op, br, winTop: Y - TBU * kk };
  }
  // CSS transform for an element at stage (0,0) with transform-origin 0 0, in window-local units (content top = TBU).
  function tf(st, extraY) {
    const px = st.X + (VW * st.k) / 2,
      py = st.Y + (VH * st.k) / 2; // pivot = content centre
    let s = "";
    if (Math.abs(st.rx) > 1e-4) s += `translate(${px}px,${py}px) perspective(1800px) rotateX(${st.rx}deg) translate(${-px}px,${-py}px) `;
    s += `translate(${st.X}px,${st.winTop}px) scale(${st.k})`;
    if (extraY) s += ` translate(0px,${extraY}px)`;
    return s;
  }
  // shared with s4o (same camera for the overlays)
  PP.s4cam = { state, tf, TBU, RAD, VW, VH, K0 };
  // video px → stage px (valid when rx = 0)
  PP.s4cam.pt = (t, vx, vy) => {
    const st = state(t);
    return { x: st.X + vx * st.k, y: st.Y + vy * st.k, k: st.k };
  };

  // ---------------------------------------------------------------- stage (transparent until 31.40)
  const stage = PP.el("div", "s4-stage", cam);
  const amb = PP.el("div", "s4-amb", stage);
  const floor = PP.el("div", "s4-floor", stage);
  const halo = PP.el("div", "s4-halo", stage);

  // ---------------------------------------------------------------- window (local units: 1920 wide, TBU + 1200 tall)
  const win = PP.el("div", "s4-win", stage);
  win.style.width = VW + "px";
  win.style.height = VH + TBU + "px";
  win.style.borderRadius = RAD + "px";
  const glowEl = PP.el("div", "s4-win-glow", win);
  glowEl.style.borderRadius = RAD + "px";
  const bar = PP.el("div", "s4-bar", win);
  bar.style.height = TBU + "px";
  bar.style.borderRadius = `${RAD}px ${RAD}px 0 0`;
  // top-bar content designed in stage px (base scale), scaled up to local units
  const barIn = PP.el("div", "s4-bar-in", bar);
  barIn.style.width = VW * K0 + "px";
  barIn.style.height = TB + "px";
  barIn.style.transform = `scale(${1 / K0})`;
  const dots = PP.el("div", "s4-dots", barIn);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c) => (PP.el("i", "", dots).style.background = c));
  const nav = PP.el("div", "s4-nav", barIn);
  nav.innerHTML = `<svg width="44" height="18" viewBox="0 0 44 18"><path d="M11 3 L5 9 L11 15" fill="none" stroke="#8b95a7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 3 L37 9 L31 15" fill="none" stroke="#4a5363" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const url = PP.el("div", "s4-url", barIn);
  url.innerHTML = `<svg width="17" height="20" viewBox="0 0 13 15"><rect x="1" y="6.5" width="11" height="8" rx="2" fill="#2EE6C9"/><path d="M3.6 6.5 V4.6 a2.9 2.9 0 0 1 5.8 0 V6.5" fill="none" stroke="#2EE6C9" stroke-width="1.7"/></svg><span>${PP.cfg.url}</span>`;
  PP.el("div", "s4-content", win).style.cssText = `top:${TBU}px;height:${VH}px;`;

  const video = document.getElementById("sitetest");

  // ---------------------------------------------------------------- one driver: t → window + video transform
  const t0 = 30.9,
    t1 = 47.6;
  PP.drive(
    tl,
    (t) => {
      const st = state(t);
      win.style.transform = tf(st);
      win.style.opacity = st.op;
      win.style.filter = st.br !== 1 ? `brightness(${st.br.toFixed(3)})` : "none";
      if (video) {
        video.style.transform = tf(st, TBU);
        video.style.opacity = st.op;
        video.style.filter = st.br !== 1 ? `brightness(${st.br.toFixed(3)})` : "none";
      }
      // halo under the window follows it softly
      halo.style.opacity = (st.op * 0.9).toFixed(3);
    },
    t0,
    t1,
    t0,
    t1 - t0,
    "none"
  );

  // stage: invisible while s3 finishes (the section is above s3), black from the whoosh, leaves with the exit whoosh
  gsap.set(stage, { opacity: 0 });
  tl.fromTo(stage, { opacity: 0 }, { opacity: 1, duration: 0.001, ease: "none", immediateRender: false }, T_IN - 0.002);
  tl.fromTo([amb, floor], { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power2.out", immediateRender: false }, T_IN);
  tl.fromTo(stage, { opacity: 1 }, { opacity: 0, duration: 0.22, ease: "power2.in", immediateRender: false }, T_EXIT);
});
