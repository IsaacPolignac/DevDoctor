// PurePeptide motion library: design tokens, deterministic helpers, reusable art.
// Every visual state is a pure function of timeline time: no callbacks, clocks or Math.random.
(function () {
  const PP = (window.PP = window.PP || {});
  const SVGNS = "http://www.w3.org/2000/svg";

  PP.W = 1080;
  PP.H = 1920;
  PP.C = {
    bg: "#05070A",
    panel: "rgba(255,255,255,0.035)",
    line: "rgba(234,242,255,0.10)",
    text: "#EEF3F8",
    muted: "#7D8896",
    accent: "#7FE7FF",
    paper: "#F4F6F8",
    ink: "#0B1016",
  };

  // ---------------------------------------------------------------- registry
  PP._scenes = [];
  PP.scene = (id, build) => PP._scenes.push({ id, build });
  PP.layers = {};

  // ---------------------------------------------------------------- determinism
  PP.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Tween a value and push it into any setter during render (seek-safe, no callbacks).
  PP.drive = function (tl, setter, from, to, at, dur, ease) {
    let cur = from;
    const o = {
      v(x) {
        if (x === undefined) return cur;
        cur = x;
        setter(x);
      },
    };
    tl.fromTo(o, { v: from }, { v: to, duration: dur, ease: ease || "none", immediateRender: false }, at);
    setter(from);
    return o;
  };

  // ---------------------------------------------------------------- DOM helpers
  PP.el = function (tag, cls, parent, attrs) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (const k in attrs) k === "text" ? (e.textContent = attrs[k]) : k === "style" ? (e.style.cssText = attrs[k]) : e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  PP.svg = function (tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) k === "text" ? (e.textContent = attrs[k]) : e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  let uid = 0;
  PP.uid = (p) => (p || "pp") + "-" + ++uid;

  // ---------------------------------------------------------------- text
  // lines: array of strings; wrap a word in *asterisks* to colour it --accent.
  // Returns { el, lines, words }. Lines are overflow-hidden masks; words are the moving parts.
  PP.headline = function (parent, lines, cls) {
    const el = PP.el("div", "pp-h " + (cls || "h2"), parent);
    const lineEls = [];
    const words = [];
    lines.forEach((line) => {
      const ln = PP.el("div", "pp-ln", el);
      lineEls.push(ln);
      line.split(" ").forEach((w, i) => {
        if (i) ln.appendChild(document.createTextNode(" "));
        const acc = /^\*.*\*$/.test(w);
        const word = PP.el("span", "pp-w" + (acc ? " acc" : ""), ln, { text: acc ? w.slice(1, -1) : w });
        words.push(word);
      });
    });
    return { el, lines: lineEls, words };
  };

  // Brief: per-word mask reveal, translateY 100%->0, 0.55 s expo.out, stagger 0.06 s, blur 10->0.
  PP.wordsIn = function (tl, words, at, o) {
    o = o || {};
    return tl.fromTo(
      words,
      { yPercent: 100, filter: "blur(10px)" },
      { yPercent: 0, filter: "blur(0px)", duration: o.dur || 0.55, ease: o.ease || "expo.out", stagger: o.stagger == null ? 0.06 : o.stagger },
      at,
    );
  };

  // Brief: text out, translateY 0->-40% + opacity->0, 0.25 s power2.in.
  PP.textOut = function (tl, targets, at, o) {
    o = o || {};
    return tl.fromTo(
      targets,
      { yPercent: 0, opacity: 1 },
      { yPercent: -40, opacity: 0, duration: o.dur || 0.25, ease: "power2.in", stagger: o.stagger || 0, immediateRender: false },
      at,
    );
  };

  // Split text into per-character spans (for type-on). Spaces are kept as non-breaking.
  PP.chars = function (el, text) {
    el.textContent = "";
    return Array.from(text).map((ch) => PP.el("span", "pp-c", el, { text: ch === " " ? " " : ch }));
  };
  // Brief: labels type on at 0.025 s/char.
  PP.typeOn = function (tl, chars, at, perChar) {
    return tl.fromTo(chars, { opacity: 0 }, { opacity: 1, duration: 0.001, ease: "none", stagger: perChar || 0.025 }, at);
  };

  // Brief: counters power3.out, one decimal, tabular numbers.
  PP.counter = function (tl, el, o) {
    const d = o.decimals == null ? 1 : o.decimals;
    const fmt = o.format || ((x) => x.toFixed(d));
    return PP.drive(tl, (x) => (el.textContent = fmt(x)), o.from || 0, o.to, o.at, o.dur, o.ease || "power3.out");
  };

  // Brief: pop-ins scale 0.9->1, back.out(1.6), 0.3 s.
  PP.popIn = function (tl, targets, at, o) {
    o = o || {};
    return tl.fromTo(
      targets,
      { scale: o.from || 0.9, opacity: 0 },
      { scale: 1, opacity: 1, duration: o.dur || 0.3, ease: "back.out(1.6)", stagger: o.stagger || 0 },
      at,
    );
  };

  // Brief: strokes draw via dashoffset, power2.inOut. Uses DrawSVGPlugin (seek-safe).
  PP.draw = function (tl, paths, at, dur, o) {
    o = o || {};
    return tl.fromTo(paths, { drawSVG: "0%" }, { drawSVG: "100%", duration: dur, ease: o.ease || "power2.inOut", stagger: o.stagger || 0 }, at);
  };

  // Brief: every scene container pushes in 1.00->1.04 over its duration (linear).
  PP.camera = function (tl, cam, start, end) {
    return tl.fromTo(cam, { scale: 1 }, { scale: 1.04, duration: end - start, ease: "none", immediateRender: false }, start);
  };

  // ---------------------------------------------------------------- recurring art
  // Verification motif: 2 px --accent line + 24 px glow. dir 'h' (horizontal line) or 'v'.
  PP.scanLine = function (parent, dir, len) {
    const e = PP.el("div", "pp-scan pp-scan-" + (dir || "h"), parent);
    if (dir === "v") e.style.height = (len || PP.H) + "px";
    else e.style.width = (len || PP.W) + "px";
    return e;
  };

  // Check icon: circle + tick; returns { svg, circle, tick } (draw both with PP.draw).
  PP.checkIcon = function (parent, size, color) {
    const s = PP.svg("svg", { width: size, height: size, viewBox: "0 0 44 44", class: "pp-check" }, parent);
    const col = color || PP.C.accent;
    const circle = PP.svg("circle", { cx: 22, cy: 22, r: 20, fill: "none", stroke: col, "stroke-width": 2 }, s);
    const tick = PP.svg("path", { d: "M13.5 22.5 L19.5 28.5 L31 16", fill: "none", stroke: col, "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round" }, s);
    return { svg: s, circle, tick };
  };

  // Logo: {{LOGO_URL}} image if provided, otherwise the brief's wordmark fallback:
  // "Pure" Inter Tight 600 + "Peptide" Inter Tight 300, no space, dot of the i = 0.18em --accent circle.
  // Size with { width } (px, exact) or { height } (px, cap-top to descender). Returns { el, dot, fontSize, width, height, isImage }.
  PP.WORDMARK_EM = 5.09; // measured width of the wordmark in em
  PP.WORDMARK_H_EM = 0.95; // visual height (cap top -> p descender) in em
  PP.logo = function (parent, size) {
    if (typeof size === "number") size = { height: size };
    if (PP.cfg.logoUrl) {
      const img = PP.el("img", "pp-logo-img", parent, { src: PP.cfg.logoUrl, alt: "PurePeptide" });
      if (size.width) img.style.width = size.width + "px";
      else img.style.height = size.height + "px";
      return { el: img, dot: null, isImage: true, width: size.width || null, height: size.height || null };
    }
    const fontSize = size.width ? size.width / PP.WORDMARK_EM : size.height / PP.WORDMARK_H_EM;
    const wm = PP.el("div", "pp-wordmark", parent);
    wm.style.fontSize = fontSize + "px";
    PP.el("span", "wm-a", wm, { text: "Pure" });
    const b = PP.el("span", "wm-b", wm);
    b.appendChild(document.createTextNode("Pept"));
    const i = PP.el("span", "wm-i", b, { text: "\u0131" });
    const dot = PP.el("span", "wm-dot", i);
    b.appendChild(document.createTextNode("de"));
    return { el: wm, dot, fontSize, isImage: false, width: fontSize * PP.WORDMARK_EM, height: fontSize * PP.WORDMARK_H_EM };
  };

  // Scannable QR code (qrcode-generator, EC level M) as SVG. Dark modules --ink on --paper.
  PP.qr = function (parent, text, size) {
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    const quiet = 2;
    const s = PP.svg("svg", { width: size, height: size, viewBox: `0 0 ${n + quiet * 2} ${n + quiet * 2}`, "shape-rendering": "crispEdges", class: "pp-qr" }, parent);
    PP.svg("rect", { x: 0, y: 0, width: n + quiet * 2, height: n + quiet * 2, fill: PP.C.paper }, s);
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    PP.svg("path", { d, fill: PP.C.ink }, s);
    return s;
  };

  // ---------------------------------------------------------------- vial
  // Clear 2R-style vial (brief §4). ViewBox 300 x 712 (body 260 x 560 incl. shoulders, neck 150,
  // crimp cap 170 x 90, flip-off 176 x 28). Height in px sets the scale.
  // Returns { el, svg, sweep, sweepRect, label, cake, scale, height, width }.
  //   sweep      <g> clipped to the vial silhouette: animate sweepRect `x` (viewBox units, -200 -> 360)
  //              and the group's opacity for specular / rim-light sweeps.
  PP.VIAL_VB = { w: 300, h: 712 };
  PP.vial = function (parent, o) {
    o = o || {};
    const height = o.height || 780;
    const scale = height / PP.VIAL_VB.h;
    const product = o.product || PP.cfg.coaProduct;
    const amount = o.amount || PP.cfg.amount;
    const batch = o.batch !== undefined ? o.batch : PP.cfg.batch; // "" = no batch line (no known code)
    const id = PP.uid("vial");
    const wrap = PP.el("div", "pp-vial", parent);
    wrap.style.width = PP.VIAL_VB.w * scale + "px";
    wrap.style.height = height + "px";

    const imgUrl = o.imageUrl !== undefined ? o.imageUrl : PP.vialImage(product, o.hero);
    if (imgUrl) {
      PP.el("img", "pp-vial-img", wrap, { src: imgUrl, alt: product });
      return { el: wrap, svg: null, sweep: null, sweepRect: null, scale, height, width: PP.VIAL_VB.w * scale };
    }

    const s = PP.svg("svg", { viewBox: `0 0 ${PP.VIAL_VB.w} ${PP.VIAL_VB.h}`, width: "100%", height: "100%", overflow: "visible" }, wrap);
    const defs = PP.svg("defs", null, s);
    const sil = "M75 116 L225 116 L225 150 C225 172 280 174 280 202 L280 688 Q280 710 258 710 L42 710 Q20 710 20 688 L20 202 C20 174 75 172 75 150 Z";

    const grad = (gid, x2, y2, stops) => {
      const g = PP.svg("linearGradient", { id: gid, x1: 0, y1: 0, x2, y2 }, defs);
      stops.forEach(([off, col, op]) => PP.svg("stop", { offset: off, "stop-color": col, "stop-opacity": op == null ? 1 : op }, g));
      return `url(#${gid})`;
    };
    const cp = PP.svg("clipPath", { id: id + "-sil" }, defs);
    PP.svg("path", { d: sil }, cp);
    const soft = PP.svg("filter", { id: id + "-soft", x: "-50%", y: "-5%", width: "200%", height: "110%" }, defs);
    PP.svg("feGaussianBlur", { stdDeviation: 1.6 }, soft);

    const glassFill = grad(id + "-glass", 1, 0, [
      [0, "#0E1822", 0.85],
      [0.1, "#1A2733", 0.35],
      [0.3, "#FFFFFF", 0.035],
      [0.7, "#FFFFFF", 0.02],
      [0.9, "#1A2733", 0.35],
      [1, "#0E1822", 0.85],
    ]);
    const capV = grad(id + "-capv", 0, 1, [
      [0, "#D9DEE3"],
      [1, "#8E969F"],
    ]);
    const capH = grad(id + "-caph", 1, 0, [
      [0, "#000000", 0.38],
      [0.16, "#FFFFFF", 0.3],
      [0.32, "#000000", 0.0],
      [0.72, "#000000", 0.06],
      [0.86, "#FFFFFF", 0.14],
      [1, "#000000", 0.42],
    ]);
    const flip = grad(id + "-flip", 0, 1, [
      [0, "#B5F2FF"],
      [0.5, PP.C.accent],
      [1, "#4FB9D4"],
    ]);
    const cakeG = grad(id + "-cake", 0, 1, [
      [0, "#F7F6F1"],
      [1, "#DCD8CD"],
    ]);
    const labelShade = grad(id + "-lsh", 1, 0, [
      [0, "#0B1016", 0.34],
      [0.12, "#0B1016", 0.08],
      [0.3, "#FFFFFF", 0.0],
      [0.7, "#0B1016", 0.0],
      [0.9, "#0B1016", 0.14],
      [1, "#0B1016", 0.4],
    ]);
    const sweepG = grad(id + "-sw", 1, 0, [
      [0, "#FFFFFF", 0],
      [0.5, "#FFFFFF", 0.55],
      [1, "#FFFFFF", 0],
    ]);

    // back wall + glass body
    PP.svg("path", { d: sil, fill: glassFill }, s);

    // lyophilized cake: bottom 18 % of the body (≈101 units), slightly irregular top
    const r = PP.rng(157);
    let top = "M24 686 L24 612";
    const steps = 12;
    for (let k = 1; k <= steps; k++) {
      const x = 24 + (252 * k) / steps;
      const y = 609 + (r() - 0.5) * 7 + Math.sin(k * 0.9) * 2.2;
      top += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    const cakeD = top + " L276 686 Q276 706 256 706 L44 706 Q24 706 24 686 Z";
    const cake = PP.svg("path", { d: cakeD, fill: cakeG }, s);
    PP.svg("path", { d: top.replace("M24 686 L24 612", "M24 612"), fill: "none", stroke: "#FFFFFF", "stroke-opacity": 0.55, "stroke-width": 1.5 }, s);

    // wrap-around label: 58 % of body height (325 units), y 252 -> 577
    const label = PP.svg("g", { class: "pp-vial-label" }, s);
    const LY = 252,
      LH = 325;
    PP.svg("rect", { x: 20, y: LY, width: 260, height: LH, fill: PP.C.paper }, label);
    PP.svg("rect", { x: 20, y: LY + 6, width: 260, height: 2.2, fill: PP.C.accent }, label);
    const T = (txt, x, y, size, weight, family, extra) =>
      PP.svg(
        "text",
        Object.assign({ x, y, "font-size": size, "font-weight": weight, "font-family": family, fill: PP.C.ink, "text-anchor": "middle", text: txt }, extra || {}),
        label,
      );
    // mini wordmark
    const wm = T("", 150, LY + 44, 22, 600, "Inter Tight", { "letter-spacing": "-0.5" });
    PP.svg("tspan", { text: "Pure" }, wm);
    PP.svg("tspan", { "font-weight": 300, text: "Peptide" }, wm);
    PP.svg("rect", { x: 70, y: LY + 60, width: 160, height: 1, fill: PP.C.ink, "fill-opacity": 0.2 }, label);
    // product name (auto-fit; split long names on " / ")
    const parts = product.includes(" / ") ? [product.split(" / ")[0] + " /", product.split(" / ")[1]] : [product];
    const longest = Math.max(...parts.map((p) => p.length));
    const fs = Math.min(42, 222 / (longest * 0.58));
    const nameY = parts.length > 1 ? LY + 112 : LY + 140;
    parts.forEach((p, k) => T(p, 150, nameY + k * fs * 1.02, fs, 600, "Inter Tight", { "letter-spacing": -fs * 0.03, "word-spacing": fs * 0.12 }));
    T(amount.toUpperCase(), 150, LY + 190, 22, 500, "IBM Plex Mono", { "letter-spacing": 2.5 });
    PP.svg("rect", { x: 44, y: LY + 214, width: 212, height: 1, fill: PP.C.ink, "fill-opacity": 0.2 }, label);
    T("LYOPHILIZED · HPLC-TESTED", 150, LY + (batch ? 240 : 252), 11.5, 400, "IBM Plex Mono", { "letter-spacing": 1.4, "fill-opacity": 0.75 });
    if (batch) T("BATCH " + batch, 150, LY + 262, 13, 500, "IBM Plex Mono", { "letter-spacing": 1.6 });
    PP.svg("rect", { x: 20, y: LY + LH - 38, width: 260, height: 38, fill: PP.C.ink }, label);
    T("RESEARCH USE ONLY", 150, LY + LH - 14, 12.5, 500, "IBM Plex Mono", { "letter-spacing": 2.4, fill: PP.C.paper });
    PP.svg("rect", { x: 20, y: LY, width: 260, height: LH, fill: labelShade }, label);

    // glass edges + highlight strips (white 35 % and 12 %)
    PP.svg("path", { d: sil, fill: "none", stroke: "#EAF2FF", "stroke-opacity": 0.3, "stroke-width": 1.6 }, s);
    PP.svg("rect", { x: 44, y: 212, width: 12, height: 470, rx: 6, fill: "#FFFFFF", "fill-opacity": 0.35, filter: `url(#${id}-soft)` }, s);
    PP.svg("rect", { x: 236, y: 220, width: 18, height: 456, rx: 9, fill: "#FFFFFF", "fill-opacity": 0.12, filter: `url(#${id}-soft)` }, s);
    PP.svg("path", { d: "M92 132 L92 150 C92 166 60 170 50 190", fill: "none", stroke: "#FFFFFF", "stroke-opacity": 0.28, "stroke-width": 5, "stroke-linecap": "round", filter: `url(#${id}-soft)` }, s);

    // aluminium crimp cap 170 x 90 + flip-off top 176 x 28 (--accent)
    PP.svg("path", { d: "M65 34 L235 34 L235 106 Q235 118 223 118 L77 118 Q65 118 65 106 Z", fill: capV }, s);
    PP.svg("path", { d: "M65 34 L235 34 L235 106 Q235 118 223 118 L77 118 Q65 118 65 106 Z", fill: capH }, s);
    for (let k = 0; k < 3; k++) PP.svg("rect", { x: 65, y: 98 + k * 5, width: 170, height: 1.2, fill: "#5E666F", "fill-opacity": 0.45 }, s);
    PP.svg("rect", { x: 62, y: 6, width: 176, height: 28, rx: 6, fill: flip }, s);
    PP.svg("rect", { x: 62, y: 6, width: 176, height: 28, rx: 6, fill: capH, "fill-opacity": 0.6 }, s);
    PP.svg("rect", { x: 70, y: 9, width: 160, height: 3, rx: 1.5, fill: "#FFFFFF", "fill-opacity": 0.45 }, s);

    // sweep band, clipped to the silhouette (cap included via union rect)
    const cp2 = PP.svg("clipPath", { id: id + "-all" }, defs);
    PP.svg("path", { d: sil }, cp2);
    PP.svg("rect", { x: 62, y: 6, width: 176, height: 112, rx: 6 }, cp2);
    const sweep = PP.svg("g", { "clip-path": `url(#${id}-all)`, class: "pp-vial-sweep" }, s);
    const sweepRect = PP.svg("rect", { x: -200, y: -60, width: 140 / scale, height: 840, fill: sweepG, transform: "skewX(-12)" }, sweep);

    return { el: wrap, svg: s, sweep, sweepRect, label, cake, scale, height, width: PP.VIAL_VB.w * scale };
  };

  // Brief §4: VIAL_URLS in catalog order; a single render is used for the S1–S2 hero only.
  PP.vialImage = function (product, hero) {
    const u = PP.cfg.vialUrls;
    if (!u.length) return null;
    if (u.length === 1) return hero ? u[0] : null;
    const i = PP.cfg.catalog.indexOf(product);
    return i >= 0 && u[i] ? u[i] : null;
  };

  // Mirrored reflection of a vial, fading out over `fade` px at `opacity`. Returns { el, vial }.
  PP.vialReflection = function (parent, o) {
    o = o || {};
    const wrap = PP.el("div", "pp-reflect", parent);
    const v = PP.vial(wrap, o);
    const fade = o.fade || 220;
    wrap.style.height = v.height + "px";
    wrap.style.width = v.width + "px";
    wrap.style.opacity = o.opacity == null ? 0.15 : o.opacity;
    const m = `linear-gradient(to bottom, #000 0px, transparent ${fade}px)`;
    wrap.style.webkitMaskImage = m;
    wrap.style.maskImage = m;
    v.el.style.transform = "scaleY(-1)";
    return { el: wrap, vial: v };
  };
})();
