// s4 — TEST (clip 29.80 → 44.60), BELOW the stage-level #sitetest video. Black stage + teal floor glow + a dark
// macOS-like browser window whose content area frames the real site recording exactly. One camera function of time
// (PP.s4cam) drives the window chrome, the video and (from s4o) the edge light, corner masks and click ripples,
// so every layer shares the exact same transform on every frame. All times absolute (s).
PP.scene("s4", function (tl, root, cam) {
  const ST = PP.cfg.siteTest; // 1920 x 1200 video px
  const VW = ST.w,
    VH = ST.h;
  const K0 = 0.72; // base scale: content 1382.4 x 864 stage px
  const TB = 44; // top bar height (stage px at base scale)
  const TBU = TB / K0; // top bar height in window-local units
  const RAD = 18 / K0; // window radius in local units
  const WIN_TOP = 146; // base window top (stage px)
  const BASE = { f: [VW / 2, VH / 2], s: [960, WIN_TOP + TB + (VH * K0) / 2], z: 1 };
  const T_IN = 30.4,
    T_OUT = 44.3;

  // ---------------------------------------------------------------- camera keyframes (video point f → stage point s, zoom z)
  const K = [
    { t: 30.4, ...BASE },
    { t: 34.4, f: BASE.f, s: BASE.s, z: 1.045, e: "sine.inOut" },
    { t: 34.9, f: BASE.f, s: BASE.s, z: 1.05, e: "none" },
    // 02 · shop grid → first card (BPC-157 / TB-500), page scrolls at ~35.1–35.4 (card centre video ≈ 282, 560)
    { t: 36.3, f: [282, 560], s: [600, 562], z: 1.32, e: "power3.inOut" },
    { t: 37.1, f: [282, 560], s: [604, 560], z: 1.35, e: "sine.inOut" },
    // product page (37.07) — breathe out, then push to the purity line (video ≈ 1332, 506)
    { t: 37.9, f: [1150, 560], s: [960, 575], z: 1.14, e: "power2.inOut" },
    { t: 39.2, f: [1332, 506], s: [1060, 420], z: 1.35, e: "power3.inOut" },
    { t: 40.9, f: [1332, 506], s: [1050, 430], z: 1.35, e: "sine.inOut" },
    // 04 · perks list after « Ajouter au panier » (video ≈ 1350, 920)
    { t: 41.8, f: [1350, 920], s: [980, 700], z: 1.28, e: "power3.inOut" },
    { t: 42.15, f: [1350, 920], s: [976, 700], z: 1.29, e: "none" },
    // cart drawer (right edge, video x 1416 → 1920)
    { t: 44.0, f: [1668, 380], s: [1480, 470], z: 1.32, e: "power2.inOut" },
    { t: 44.3, f: [1668, 380], s: [1480, 470], z: 1.335, e: "none" },
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
    // entry (whoosh 30.40): from below, tilted, small, dark → expo.out 0.62 s
    if (t < T_IN) op = 0;
    else if (t < T_IN + 0.62) {
      const e = ez("expo.out")((t - T_IN) / 0.62);
      dy = lerp(700, 0, e);
      rx = lerp(18, 0, e);
      zm = lerp(0.85, 1, e);
      br = lerp(0.35, 1, e);
      op = clamp01((t - T_IN) / 0.1 + 0.001);
    }
    // exit (whoosh 44.30): whip up + zoom, gone by 44.55
    if (t > T_OUT) {
      const u = clamp01((t - T_OUT) / 0.24);
      const e = ez("expo.in")(u);
      dy = -1300 * e;
      zm = 1 + 0.35 * e;
      rx = -14 * e;
      br = 1 + 0.8 * e;
      op = 1 - ez("power2.in")(u);
      if (t >= T_OUT + 0.24) op = 0;
    }
    const kk = K0 * z * zm;
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

  // ---------------------------------------------------------------- stage
  const stage = PP.el("div", "s4-stage", cam);
  PP.el("div", "s4-floor", stage);
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
  url.innerHTML = `<svg width="13" height="15" viewBox="0 0 13 15"><rect x="1" y="6.5" width="11" height="8" rx="2" fill="#2EE6C9"/><path d="M3.6 6.5 V4.6 a2.9 2.9 0 0 1 5.8 0 V6.5" fill="none" stroke="#2EE6C9" stroke-width="1.7"/></svg><span>purepeptide.care</span>`;
  PP.el("div", "s4-content", win).style.cssText = `top:${TBU}px;height:${VH}px;`;

  const video = document.getElementById("sitetest");

  // ---------------------------------------------------------------- one driver: t → window + video transform
  const t0 = 29.8,
    t1 = 44.6;
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

  // stage fades with the exit whip
  tl.fromTo(stage, { opacity: 1 }, { opacity: 0, duration: 0.2, ease: "power2.in", immediateRender: false }, T_OUT + 0.05);
});
