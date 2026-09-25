// s1 (0.00 → 4.25) — hook. L1 « Vous achetez des peptides en ligne ? » over a neon search bar (typed 0.40→1.20,
// cursor click 1.32), then L2 « Mais savez-vous vraiment ce qu’il y a dans la fiole ? » with the hero vial rising
// (2.00) in the dark, push-in (3.80) and a 4-frame zoom-through the counter of the « o » of « fiole » (4.10→4.233)
// that opens onto s2. Layers: cam (slow drift) > push (origin = the « o ») > [vial layer, zoom (origin = the « o »)].
(function () {
  const PP = window.PP;
  // ---- helpers shared with s2 (s2.js loads after this file) ----
  const S12 = (PP.s12 = PP.s12 || {});
  // Hero vial with a masked neon rim light (blue left edge, neon right edge) and a specular sheen.
  S12.vial = function (parent, h) {
    const v = PP.heroVial(parent, h);
    v.el.classList.add("s12-vial");
    const mask = `url("${PP.cfg.heroVial}")`;
    const mk = (cls) => {
      const d = PP.el("div", cls, v.el);
      d.style.webkitMaskImage = d.style.maskImage = mask;
      d.style.webkitMaskSize = d.style.maskSize = "100% 100%";
      return d;
    };
    v.rim = mk("s12-rim");
    v.sheen = mk("s12-sheen");
    return v;
  };
  // Light sweep + rim drift ("slow Y rotation" illusion), all seek-safe.
  S12.vialLife = function (tl, v, at, dur) {
    PP.drive(tl, (p) => v.sheen.style.setProperty("--p", p.toFixed(1) + "%"), -30, 130, at, dur, "power1.inOut");
    PP.drive(tl, (p) => v.rim.style.setProperty("--r", p.toFixed(2) + "%"), -3, 3, at, dur, "sine.inOut");
  };
  // Floating depth particles (bokeh) — positions from PP.rng.
  S12.bokeh = function (tl, parent, seed, n, t0, t1) {
    const r = PP.rng(seed);
    for (let i = 0; i < n; i++) {
      const z = r();
      const d = PP.el("div", "s12-bokeh", parent);
      const s = 4 + z * 12;
      d.style.width = d.style.height = s + "px";
      d.style.left = 60 + r() * 960 + "px";
      d.style.top = 700 + r() * 1150 + "px";
      d.style.opacity = (0.15 + 0.45 * (1 - z)).toFixed(2);
      d.style.filter = `blur(${(z * 5).toFixed(1)}px)`;
      tl.fromTo(d, { y: 0, x: 0 }, { y: -(60 + z * 160), x: (r() - 0.5) * 60, duration: t1 - t0, ease: "none" }, t0);
    }
  };

  PP.scene("s1", function (tl, root, cam) {
    const F = PP.F;
    const push = PP.el("div", "s1-layer s1-push", cam);
    const vialL = PP.el("div", "s1-layer", push);
    const zoom = PP.el("div", "s1-layer s1-zoom", push);
    const grpA = PP.el("div", "s1-layer", zoom); // L1 + search bar + cursor
    const grpB = PP.el("div", "s1-layer", zoom); // L2

    // ------------------------------------------------ L1 headline
    const h1 = PP.voHeadline(tl, grpA, "L1", ["Vous achetez", "des *peptides*", "en ligne ?"], "h1 s1-h1");
    h1.el.style.cssText = "position:absolute;left:0;right:0;top:330px";

    // ------------------------------------------------ search bar (3D tilted neon card)
    const persp = PP.el("div", "s1-layer s1-persp", grpA);
    const bar = PP.neonCard(persp, { x: 540, y: 1050, w: 840, h: 150, radius: 75 });
    bar.el.classList.add("s1-bar");
    const mag = PP.svg("svg", { width: 60, height: 60, viewBox: "0 0 60 60", class: "s1-mag" }, bar.body);
    PP.svg("circle", { cx: 26, cy: 26, r: 16, fill: "none", stroke: PP.C.neon, "stroke-width": 5 }, mag);
    PP.svg("path", { d: "M38 38 L52 52", stroke: PP.C.neon, "stroke-width": 6, "stroke-linecap": "round" }, mag);
    const field = PP.el("div", "s1-field", bar.body);
    const typed = PP.el("span", "s1-typed", field);
    const caret = PP.el("span", "s1-caret", field);
    const btn = PP.el("div", "s1-btn", bar.body);
    const btnLit = PP.el("div", "s1-btn-lit", btn);
    const btnTxt = PP.el("span", "s1-btn-txt", btn, { text: "Rechercher" });

    // entry: tilted, blurred, rising (already half visible on frame 0)
    tl.fromTo(bar.el, { y: 90, rotationX: 38, scale: 0.9, opacity: 0.35, filter: "blur(10px)" }, { y: 0, rotationX: 9, scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.55, ease: "expo.out" }, 0);
    tl.fromTo(bar.el, { rotationX: 9, rotationY: -5 }, { rotationX: 4, rotationY: 4, duration: 1.3, ease: "sine.inOut", immediateRender: false }, 0.55);

    // typing « peptides » 0.40 → 1.20 (one key per 0.8/7 s) + deterministic caret blink
    const WORD = "peptides";
    const keyT = Array.from(WORD).map((_, i) => 0.4 + (i * 0.8) / (WORD.length - 1));
    PP.drive(
      tl,
      (t) => {
        let n = 0;
        while (n < keyT.length && keyT[n] <= t + 1e-4) n++;
        const s = WORD.slice(0, n);
        if (typed.textContent !== s) typed.textContent = s;
        const typing = t >= 0.36 && t < 1.28;
        caret.style.opacity = typing || Math.floor(t / 0.265) % 2 === 0 ? "1" : "0";
      },
      0,
      2,
      0,
      2,
      "none"
    );

    // cursor glides in, button lights 1 frame before the click at 1.32
    const cur = PP.cursor(grpA, 1140, 1560, 1.25);
    const bx = 540 + 840 / 2 - 22 - 250 / 2,
      by = 1050 + 8;
    cur.move(tl, bx - 30, by + 6, 0.82, 0.44, "power3.inOut");
    cur.click(tl, 1.32);
    tl.fromTo(btnLit, { opacity: 0 }, { opacity: 1, duration: 0.001, ease: "none", immediateRender: false }, 1.32 - F);
    tl.fromTo(btnTxt, { color: PP.C.ink }, { color: PP.C.bg, duration: 0.001, ease: "none", immediateRender: false }, 1.32 - F);
    tl.fromTo(btn, { scale: 1 }, { scale: 0.94, duration: 0.07, ease: "power2.out", immediateRender: false }, 1.32);
    tl.fromTo(btn, { scale: 0.94 }, { scale: 1, duration: 0.3, ease: "back.out(3)", immediateRender: false }, 1.39);

    // results drop down as loading skeletons with a « ? » — nobody knows what's inside
    const res = PP.neonCard(persp, { x: 540, y: 1270, w: 840, h: 250, radius: 36 });
    res.el.classList.add("s1-res");
    for (let i = 0; i < 3; i++) {
      const row = PP.el("div", "s1-row", res.body);
      row.style.top = 30 + i * 68 + "px";
      PP.el("div", "s1-q", row, { text: "?" });
      const b1 = PP.el("div", "s1-sk", row);
      b1.style.width = [330, 260, 300][i] + "px";
      const b2 = PP.el("div", "s1-sk s1-sk2", row);
      b2.style.width = [170, 210, 140][i] + "px";
      tl.fromTo(row, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.3, ease: "expo.out" }, 1.42 + i * 0.05);
    }
    const shimmer = PP.el("div", "s1-shimmer", res.body);
    PP.drive(tl, (p) => shimmer.style.setProperty("--p", p.toFixed(1) + "%"), -30, 130, 1.45, 0.5, "power1.inOut");
    tl.fromTo(res.el, { clipPath: "inset(0px 0px 250px 0px round 36px)", opacity: 0 }, { clipPath: "inset(0px 0px 0px 0px round 36px)", opacity: 1, duration: 0.3, ease: "expo.out" }, 1.37);

    // L1 group exits fast (up + blur) 1.83 → 1.98
    tl.fromTo(grpA, { y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }, { y: -150, scale: 0.94, opacity: 0, filter: "blur(18px)", duration: 0.15, ease: "power2.in", immediateRender: false }, 1.8);
    tl.set(grpA, { transformOrigin: "540px 800px" }, 0);

    // ------------------------------------------------ L2 headline + measured « o » of « fiole »
    const h2 = PP.voHeadline(tl, grpB, "L2", ["Mais savez-vous", "vraiment ce qu’il", "y a dans la fiole ?"], "h1 s1-h2");
    h2.el.style.cssText = "position:absolute;left:0;right:0;top:340px";
    const fw = h2.words[h2.words.length - 1];
    const tail = fw.textContent.slice(5); // narrow nbsp + « ? »
    fw.textContent = "";
    const g = PP.el("span", "grad", fw);
    g.appendChild(document.createTextNode("fi"));
    const bl = PP.el("span", "s1-bl", g);
    const oSpan = PP.el("span", "s1-o", g, { text: "o" });
    g.appendChild(document.createTextNode("le"));
    fw.appendChild(document.createTextNode(tail));

    // glyph metrics of « o » (ink centre + counter radius) from a canvas at the headline's font
    const fs = parseFloat(getComputedStyle(h2.el).fontSize) || 100;
    const cv = document.createElement("canvas");
    cv.width = cv.height = Math.ceil(fs * 2);
    const cx = cv.getContext("2d");
    cx.font = `800 ${fs}px "DM Sans"`;
    cx.fillStyle = "#fff";
    const ox0 = fs * 0.5,
      base = fs * 1.4;
    cx.fillText("o", ox0, base);
    const px = cx.getImageData(0, 0, cv.width, cv.height).data;
    let L = 1e9,
      R = -1,
      T = 1e9,
      B = -1;
    for (let y = 0; y < cv.height; y++)
      for (let x = 0; x < cv.width; x++)
        if (px[(y * cv.width + x) * 4 + 3] > 127) {
          if (x < L) L = x;
          if (x > R) R = x;
          if (y < T) T = y;
          if (y > B) B = y;
        }
    const icx = Math.round((L + R) / 2),
      icy = Math.round((T + B) / 2);
    const ink = (x, y) => px[(y * cv.width + x) * 4 + 3] > 127;
    let hx = 0,
      hy = 0;
    while (icx + hx < R && !ink(icx + hx, icy) && !ink(icx - hx, icy)) hx++;
    while (icy + hy < B && !ink(icx, icy + hy) && !ink(icx, icy - hy)) hy++;
    const r0 = Math.max(4, Math.min(hx, hy) - 1.5); // counter radius (px, unscaled)
    // DOM position (without the word's entrance transform)
    const saveT = fw.style.transform;
    fw.style.transform = "none";
    const rr = root.getBoundingClientRect();
    const oR = oSpan.getBoundingClientRect();
    const bR = bl.getBoundingClientRect();
    fw.style.transform = saveT;
    const ox = oR.left - rr.left + ((L + R) / 2 - ox0),
      oy = bR.bottom - rr.top - (base - (T + B) / 2);

    // ------------------------------------------------ camera: drift (cam) · push (3.80) · zoom-through (4.10)
    const DS = 1.035,
      DY = -14; // drift reached at 3.80, then held
    tl.fromTo(cam, { scale: 1, y: 0 }, { scale: DS, y: DY, duration: 3.8, ease: "sine.inOut" }, 0);
    const PS = 1.15;
    tl.set(push, { transformOrigin: `${ox}px ${oy}px` }, 0);
    tl.fromTo(push, { scale: 1 }, { scale: PS, duration: 0.3, ease: "sine.in", immediateRender: false }, 3.8);
    const oxS = 540 + DS * (ox - 540),
      oyS = 960 + DS * (oy - 960) + DY; // on-screen centre of the « o » from 3.80 on
    const far = Math.max(Math.hypot(oxS, oyS), Math.hypot(1080 - oxS, oyS), Math.hypot(oxS, 1920 - oyS), Math.hypot(1080 - oxS, 1920 - oyS));
    const A = Math.ceil((far * 1.08) / (r0 * DS * PS));
    PP.zoomThrough(tl, zoom, ox, oy, 4.1, { amount: A });
    S12.o = { x: oxS, y: oyS, r: r0 * DS * PS, A, at: 4.1 };
    tl.fromTo(cam, { opacity: 1 }, { opacity: 0, duration: 0.001, ease: "none", immediateRender: false }, 4.1 + 4 * F - 0.002);

    // L2 slow settle (ends before the push so the « o » is still at its measured spot)
    tl.fromTo(h2.el, { y: 18 }, { y: 0, duration: 1.85, ease: "power2.out" }, 1.93);

    // ------------------------------------------------ hero vial rises behind the question (2.00, soft whoosh)
    const qm = PP.el("div", "s1-qmark", vialL, { text: "?" });
    tl.fromTo(qm, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 1.2, ease: "expo.out" }, 2.05);
    tl.fromTo(qm, { rotation: -12, y: 30 }, { rotation: 6, y: -40, duration: 2.05, ease: "power1.out" }, 2.05);
    const glow = PP.el("div", "s1-vglow", vialL);
    tl.fromTo(glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 1, ease: "power2.out" }, 2.0);
    const vw = PP.el("div", "s1-vwrap", vialL);
    const v = S12.vial(vw, 900);
    v.el.style.left = 540 - v.width / 2 + "px";
    v.el.style.top = "860px";
    v.el.classList.add("s1-vial");
    tl.fromTo(vw, { y: 760, opacity: 0, filter: "blur(16px)" }, { y: 0, opacity: 1, filter: "blur(1.2px)", duration: 1.1, ease: "expo.out" }, 2.0 - F);
    tl.fromTo(v.el, { rotation: -5, scale: 0.96, scaleX: 0.95 }, { rotation: 2, scale: 1.04, scaleX: 1.0, duration: 2.1, ease: "sine.inOut" }, 2.0);
    S12.vialLife(tl, v, 2.2, 1.9);
    S12.bokeh(tl, vialL, 11, 16, 0, 4.25);
    // vial + bokeh fly outwards during the zoom-through
    tl.fromTo(vialL, { y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }, { y: 420, scale: 1.5, opacity: 0, filter: "blur(22px)", duration: 4 * F, ease: "power2.in", immediateRender: false }, 4.1);
    tl.set(vialL, { transformOrigin: `${ox}px ${oy}px` }, 0);
  });
})();
