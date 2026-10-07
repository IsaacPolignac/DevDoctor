// PurePeptide "SPELLED OUT" (45 s, 1920x1080) — motion library. Adapted from purepeptide-neon-fr/js/lib.js
// (+ grain / sweep / feather / vmove / vpush / maskCss ported from purepeptide-film-en/js/film.js). SCENES §0.2.
// Every visual state is a pure function of timeline time: no callbacks, clocks, rAF or Math.random.
// The iPhone lives in js/phone.js (window.PH); PP.phone / PP.touch / PP.cursor were dropped on purpose.
(function () {
  const PP = (window.PP = window.PP || {});
  const SVGNS = "http://www.w3.org/2000/svg";

  PP.W = 1920;
  PP.H = 1080;
  PP.FPS = 30;
  PP.DUR = 45;
  PP.F = 1 / 30; // one frame (s)
  PP.f = (n) => n / 30; // frames -> seconds
  PP.toF = (t) => Math.round(t * 30); // seconds -> frame

  // Palette (BRIEF §2). Same values as css/tokens.css.
  PP.C = {
    // INK
    black: "#000000",
    ink: "#F3F6FA",
    inkSoft: "#93A1B8",
    accent: "#2EE6C9",
    capBlue: "#3F7FE8",
    crimp: "#C3CBD6",
    // PAPER
    paper: "#F5F8FB",
    paperKey: "radial-gradient(1400px 900px at 20% 10%, #FFFFFF, #F5F8FB 70%)",
    pInk: "#16233F",
    pInkSoft: "#5C697F",
    pLine: "#E6EBF2",
    h1Teal: "#0E7D6C",
    h1Ink: "#1B1E24",
    callout: "#0B6B5D",
    siteTeal: "#16A48F", // fill only
    barGreen: "#2BB58A", // fill only
    // NAVY
    navy: "radial-gradient(circle at 50% 45%, #123A78 0%, #0C2558 55%, #081536 100%)",
    navyBtn: "#123A78",
    nText: "#F3F6FA",
    nAccent: "#2EE6C9",
    legal: "#C3CBD6",
    pillFill: "rgba(255,255,255,.08)",
    pillStroke: "rgba(255,255,255,.32)",
  };

  // Scene windows in frames [in, out) — SCENES §0.9. main.js shows/hides each <section> with tl.set(opacity) on these.
  PP.WIN = {
    S01: [0, 105], S02: [105, 278], S03: [270, 426], S04: [426, 532], S05: [532, 674], S06: [674, 750],
    S07: [750, 849], S08: [849, 1030], S09: [1030, 1086], S10: [1086, 1230], S11: [1230, 1350],
  };
  PP.IN = (id) => PP.WIN[id][0] / 30;
  PP.OUT = (id) => PP.WIN[id][1] / 30;

  PP._scenes = [];
  PP.scene = (id, build) => PP._scenes.push({ id, build });

  // ---------------------------------------------------------------- VO word times (SCENES §0.3)
  // VO.w(id, i): onset of word i (number) or of the first word starting with a prefix (string, case-insensitive).
  // The transcript writes numbers as digits and "Janosik": spoken-form prefixes are aliased below.
  const VO = window.VO;
  const ALIAS = { ninety: "99", "ninety-nine": "99", percent: "%", five: "5", eight: "8", ten: "10", twenty: "24", "twenty-four": "24", janoshik: "janosik", two: "two", "200": "$200", dot: ".care", care: ".care" };
  const norm = (s) => String(s).toLowerCase().replace(/^[^a-z0-9$%.]+|[^a-z0-9$%]+$/g, "");
  if (VO) {
    VO.w = function (id, i) {
      const L = VO[id];
      if (!L) throw new Error("VO.w: unknown line " + id);
      if (typeof i === "number") {
        if (!L.words[i]) throw new Error(`VO.w: ${id} has no word ${i}`);
        return L.words[i][0];
      }
      const q = norm(i);
      const find = (p) => L.words.find((w) => norm(w[1]).startsWith(p));
      const hit = find(q) || (ALIAS[q] && find(norm(ALIAS[q])));
      if (hit) return hit[0];
      console.warn(`[VO] ${id}: no word starting with "${i}" (${L.words.map((w) => w[1]).join(" ")}); using line start`);
      return L.at;
    };
    VO.at = (id) => VO[id].at;
    VO.end = (id) => VO[id].end;
  }
  // Clamp rule: word-locked events are clamped into the scene window; warn when it fires.
  PP.clamp = function (t, lo, hi, label) {
    const c = Math.min(hi, Math.max(lo, t));
    if (Math.abs(c - t) > 1e-6) console.warn(`[clamp] ${label || ""} ${t.toFixed(3)} s -> ${c.toFixed(3)} s`);
    return c;
  };

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
  // Tween a value and push it into any setter during render (seek-safe, no callbacks). Returns the proxy.
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
  // Drive by absolute time: setter(t) receives the timeline time over [t0, t1] (handy with PH.stage(X, Y, t)).
  PP.driveT = (tl, setter, t0, t1) => PP.drive(tl, setter, t0, t1, t0, t1 - t0, "none");

  // ---------------------------------------------------------------- DOM
  PP.el = function (tag, cls, parent, attrs) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (const k in attrs) k === "text" ? (e.textContent = attrs[k]) : k === "html" ? (e.innerHTML = attrs[k]) : k === "style" ? (e.style.cssText = attrs[k]) : e.setAttribute(k, attrs[k]);
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
  PP.maskCss = function (el, v) {
    el.style.webkitMaskImage = v;
    el.style.maskImage = v;
  };

  // ---------------------------------------------------------------- text
  // lines: array of strings; a word wrapped in *asterisks* gets class "acc". Returns { el, lines, words }.
  PP.headline = function (parent, lines, cls) {
    const el = PP.el("div", "pp-h " + (cls || ""), parent);
    const lineEls = [];
    const words = [];
    lines.forEach((line) => {
      const ln = PP.el("div", "pp-ln", el);
      lineEls.push(ln);
      line.split(" ").forEach((w, i) => {
        if (i) ln.appendChild(document.createTextNode(" "));
        const acc = /^\*.*\*$/.test(w);
        words.push(PP.el("span", "pp-w" + (acc ? " acc" : ""), ln, { text: acc ? w.slice(1, -1) : w }));
      });
    });
    return { el, lines: lineEls, words };
  };
  // A masked line: <div.pp-mask><div.pp-ln>text</div></div>. Returns the inner line (animate it with PP.maskLine).
  PP.masked = function (parent, text, cls) {
    const m = PP.el("div", "pp-mask " + (cls || ""), parent);
    return PP.el("div", "pp-ln", m, { text: text || "" });
  };
  // Masked line reveal (SCENES §0.2). in: yPercent 110→0, 12 f power4.out. out: 0→−110, 8 f power3.in.
  // o.set (default true for 'in'): also hold the line hidden from t=0 until `at`.
  PP.maskLine = function (tl, el, at, o) {
    o = o || {};
    if ((o.dir || "in") === "in") {
      if (o.set !== false) tl.set(el, { yPercent: 110 }, 0);
      return tl.fromTo(el, { yPercent: 110 }, { yPercent: 0, duration: o.dur || 12 / 30, ease: o.ease || "power4.out", stagger: o.stagger || 0, immediateRender: false }, at);
    }
    return tl.fromTo(el, { yPercent: 0 }, { yPercent: -110, duration: o.dur || 8 / 30, ease: o.ease || "power3.in", stagger: o.stagger || 0, immediateRender: false }, at);
  };
  // Per-character (or per-word) blur-in: yPercent 35→0, blur 10→0, opacity 0→1, 12 f expo.out, stagger 2 f.
  PP.blurIn = function (tl, chars, at, o) {
    o = o || {};
    if (o.set !== false) tl.set(chars, { opacity: 0 }, 0);
    return tl.fromTo(
      chars,
      { yPercent: 35, filter: "blur(10px)", opacity: 0 },
      { yPercent: 0, filter: "blur(0px)", opacity: 1, duration: o.dur || 12 / 30, ease: o.ease || "expo.out", stagger: o.stagger == null ? 2 / 30 : o.stagger, immediateRender: false },
      at
    );
  };
  // Per-word reveal (opacity in 3 f, small rise, blur, expo settle).
  PP.wordIn = function (tl, word, at, o) {
    o = o || {};
    const d = o.dur || 0.4;
    if (o.set !== false) tl.set(word, { opacity: 0 }, 0);
    tl.fromTo(word, { y: o.rise == null ? 14 : o.rise, filter: `blur(${o.blur == null ? 6 : o.blur}px)` }, { y: 0, filter: "blur(0px)", duration: d, ease: o.ease || "expo.out", immediateRender: false }, at);
    tl.fromTo(word, { opacity: 0 }, { opacity: 1, duration: 0.09, ease: "none", immediateRender: false }, at);
  };
  PP.wordsIn = function (tl, words, at, o) {
    o = o || {};
    words.forEach((w, i) => PP.wordIn(tl, w, at + i * (o.stagger == null ? 0.06 : o.stagger), o));
  };
  // Headline whose words appear when the VO says them. lines: display strings with the same word count as the VO
  // line (else spread evenly over the line). o.lead: seconds before the word. o.clamp: [lo, hi] scene window.
  PP.voHeadline = function (tl, parent, lineId, lines, cls, o) {
    o = o || {};
    const h = PP.headline(parent, lines, cls);
    const L = window.VO[lineId];
    const lead = o.lead == null ? 0 : o.lead;
    const n = h.words.length;
    h.times = h.words.map((w, i) => {
      let t = L.words.length === n ? L.words[i][0] : L.at + ((L.end - L.at) * i) / n;
      t -= lead;
      if (o.clamp) t = PP.clamp(t, o.clamp[0], o.clamp[1], lineId + " word " + i);
      return t;
    });
    h.words.forEach((w, i) => PP.wordIn(tl, w, h.times[i], o));
    return h;
  };
  PP.textOut = function (tl, targets, at, o) {
    o = o || {};
    return tl.fromTo(targets, { y: 0, opacity: 1, filter: "blur(0px)" }, { y: -24, opacity: 0, filter: "blur(6px)", duration: o.dur || 0.2, ease: "power2.in", stagger: o.stagger || 0, immediateRender: false }, at);
  };
  // Split text into per-character spans (class pp-c). Returns the spans.
  PP.chars = function (el, text) {
    el.textContent = "";
    return Array.from(text).map((ch) => PP.el("span", "pp-c", el, { text: ch === " " ? " " : ch }));
  };
  PP.typeOn = function (tl, chars, at, perChar) {
    tl.set(chars, { opacity: 0 }, 0);
    return tl.fromTo(chars, { opacity: 0 }, { opacity: 1, duration: 0.001, ease: "none", stagger: perChar || 0.025, immediateRender: false }, at);
  };
  PP.counter = function (tl, el, o) {
    const d = o.decimals == null ? 0 : o.decimals;
    const fmt = o.format || ((x) => x.toFixed(d));
    return PP.drive(tl, (x) => (el.textContent = fmt(x)), o.from || 0, o.to, o.at, o.dur, o.ease || "power3.out");
  };
  PP.popIn = function (tl, targets, at, o) {
    o = o || {};
    if (o.set !== false) tl.set(targets, { opacity: 0 }, 0);
    return tl.fromTo(targets, { scale: o.from || 0.9, opacity: 0, y: o.y || 0 }, { scale: 1, opacity: 1, y: 0, duration: o.dur || 14 / 30, ease: o.ease || "back.out(0.8)", stagger: o.stagger || 0, immediateRender: false }, at);
  };
  PP.draw = function (tl, paths, at, dur, o) {
    o = o || {};
    return tl.fromTo(paths, { drawSVG: o.from || "0%" }, { drawSVG: o.to || "100%", duration: dur, ease: o.ease || "power2.inOut", stagger: o.stagger || 0, immediateRender: o.immediate !== false }, at);
  };
  // Slow push on a wrapper: scale 1 → 1+amount, linear.
  PP.camera = function (tl, cam, start, end, amount) {
    return tl.fromTo(cam, { scale: 1 }, { scale: 1 + (amount || 0.03), duration: end - start, ease: "none", immediateRender: false }, start);
  };

  // ---------------------------------------------------------------- brand art
  PP.WORDMARK_RATIO = 62 / 611; // brand-wordmark*.svg 611 x 62
  PP.SYMBOL_RATIO = 456 / 405; // brand-symbol*.svg 405 x 456
  PP.logo = function (parent, o) {
    o = o || {};
    const w = o.width || 600;
    const img = PP.el("img", "pp-logo", parent, { src: o.dark ? "assets/brand/brand-wordmark.svg" : "assets/brand/brand-wordmark-light.svg", alt: "PurePeptide" });
    img.style.width = w + "px";
    img.style.height = w * PP.WORDMARK_RATIO + "px";
    return { el: img, width: w, height: w * PP.WORDMARK_RATIO };
  };
  PP.symbol = function (parent, height, o) {
    o = o || {};
    const img = PP.el("img", "pp-symbol", parent, { src: o.plain ? "assets/brand/brand-symbol.svg" : "assets/brand/brand-symbol-neon.svg", alt: "" });
    img.style.height = height + "px";
    img.style.width = height / PP.SYMBOL_RATIO + "px";
    return { el: img, width: height / PP.SYMBOL_RATIO, height };
  };
  // Catalog vial (assets/vials/<name>.png, 606 x 1240, alpha). Returns { el, img, width, height }.
  PP.VIAL_RATIO = 606 / 1240;
  PP.VIALS = ["bpc157-tb500-10", "cjc-1295-ipa-10", "ghk-cu-50", "igf-1-lr3-1", "selank-10", "semax-10"];
  PP.vial = function (parent, name, height) {
    const el = PP.el("div", "pp-vial", parent);
    el.style.width = height * PP.VIAL_RATIO + "px";
    el.style.height = height + "px";
    const img = PP.el("img", "", el, { src: `assets/vials/${name}.png`, alt: "" });
    return { el, img, width: height * PP.VIAL_RATIO, height };
  };
  // ✓ as SVG (no font in the project has U+2713). Draw it with PP.draw(tl, [ic.tick], at, 8/30).
  PP.checkIcon = function (parent, size, color, o) {
    o = o || {};
    const s = PP.svg("svg", { width: size, height: size, viewBox: "0 0 44 44", class: "pp-check" }, parent);
    const col = color || PP.C.accent;
    const circle = o.circle === false ? null : PP.svg("circle", { cx: 22, cy: 22, r: 20, fill: "none", stroke: col, "stroke-width": 2.4 }, s);
    const tick = PP.svg("path", { d: "M13.5 22.5 L19.5 28.5 L31 16", fill: "none", stroke: col, "stroke-width": o.width || 3.2, "stroke-linecap": "round", "stroke-linejoin": "round" }, s);
    return { svg: s, circle, tick };
  };

  // ---------------------------------------------------------------- recipes (from neon)
  // Flash + ring born at (x, y) on `at`. parent = full-frame layer. Returns { ring, ring2, bloom, fill }.
  PP.flashRing = function (tl, parent, at, o) {
    o = o || {};
    const F = PP.F;
    const x = o.x == null ? 960 : o.x,
      y = o.y == null ? 540 : o.y;
    let fill = null;
    if (o.target) {
      fill = PP.el("div", "pp-flash-fill", o.target);
      tl.set(fill, { opacity: 0 }, 0);
      tl.fromTo(fill, { opacity: 0 }, { opacity: 1, duration: 4 * F, ease: "power2.in", immediateRender: false }, at - 4 * F);
      tl.set(fill, { opacity: 0 }, at + 3 * F);
    }
    const size = o.size || 2400;
    const mkRing = (cls, r0, r1, w0, w1, a0, a1, t, dur, ease) => {
      const ring = PP.el("div", cls, parent);
      ring.style.opacity = "0";
      const set = (k) => {
        const r = r0 + (r1 - r0) * k;
        ring.style.width = ring.style.height = 2 * r + "px";
        ring.style.left = x - r + "px";
        ring.style.top = y - r + "px";
        ring.style.borderWidth = w0 + (w1 - w0) * k + "px";
        ring.style.opacity = k <= 0 || k >= 1 ? "0" : String(a0 + (a1 - a0) * k);
      };
      PP.drive(tl, set, 0, 1, t, dur, ease);
      return ring;
    };
    const ring = mkRing("pp-ring", 8, size / 2, 30, 4, 1, 0.15, at, 9 * F, "power3.out");
    const ring2 = mkRing("pp-ring thin", 8, size * 0.3, 5, 2, 0.9, 0, at + 2 * F, 13 * F, "power2.out");
    const bloom = PP.el("div", "pp-bloom", parent);
    bloom.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(46,230,201,0.55) 0%, rgba(46,230,201,0.18) 30%, rgba(46,230,201,0) 65%)`;
    tl.set(bloom, { opacity: 0 }, 0);
    tl.fromTo(bloom, { opacity: 0 }, { opacity: 1, duration: 2 * F, ease: "none", immediateRender: false }, at - 2 * F);
    tl.fromTo(bloom, { opacity: 1 }, { opacity: 0, duration: 14 * F, ease: "power2.out", immediateRender: false }, at);
    return { ring, ring2, bloom, fill };
  };

  // Rolling counter: each digit is a vertical strip that spins (motion-blurred) and lands at `land` (+stagger).
  PP.rollCounter = function (tl, parent, final, at, land, o) {
    o = o || {};
    const row = PP.el("div", "pp-roll", parent);
    const digs = [];
    Array.from(final).forEach((ch, i) => {
      if (!/\d/.test(ch)) {
        PP.el("span", "pp-roll-static", row, { text: ch });
        return;
      }
      const win = PP.el("span", "pp-roll-win", row);
      const strip = PP.el("span", "pp-roll-strip", win);
      const turns = 2 + i;
      const n = turns * 10 + Number(ch);
      for (let k = 0; k <= n; k++) PP.el("span", "pp-roll-d", strip, { text: String(k % 10) });
      digs.push({ win, strip, n });
      const lnd = land + i * (o.stagger == null ? 2 / 30 : o.stagger);
      tl.fromTo(strip, { yPercent: 0 }, { yPercent: (-100 * n) / (n + 1), duration: lnd - at, ease: o.ease || "power3.inOut", immediateRender: false }, at);
      tl.fromTo(strip, { filter: "blur(0px)" }, { filter: "blur(7px)", duration: (lnd - at) * 0.3, ease: "power1.in", immediateRender: false }, at);
      tl.fromTo(strip, { filter: "blur(7px)" }, { filter: "blur(0px)", duration: (lnd - at) * 0.35, ease: "power2.out", immediateRender: false }, lnd - (lnd - at) * 0.35);
    });
    return { row, digs };
  };

  // Typed wordmark: the official PUREPEPTIDE SVG revealed letter by letter + a sheen sweeping while it types.
  PP.WM_EDGES = [0.0671, 0.1686, 0.27, 0.3625, 0.4583, 0.5499, 0.6457, 0.7406, 0.7897, 0.8969, 0.9902];
  PP.typedWordmark = function (tl, parent, width, at, o) {
    o = o || {};
    const per = o.perLetter || PP.F * 1.5;
    const src = o.dark ? "assets/brand/brand-wordmark.svg" : "assets/brand/brand-wordmark-light.svg";
    const box = PP.el("div", "pp-wm", parent);
    box.style.width = width + "px";
    box.style.height = width * PP.WORDMARK_RATIO + "px";
    const img = PP.el("img", "", box, { src, alt: "PurePeptide" });
    img.style.width = width + "px";
    img.style.height = width * PP.WORDMARK_RATIO + "px";
    const sheen = PP.el("div", "pp-wm-sheen", box);
    PP.maskCss(sheen, `url("${src}")`);
    sheen.style.webkitMaskSize = sheen.style.maskSize = "100% 100%";
    const setClip = (k) => {
      const i = Math.round(k);
      const r = i <= 0 ? 0 : PP.WM_EDGES[Math.min(i, 11) - 1] + 0.004;
      box.style.clipPath = `inset(-20% ${((1 - (i >= 11 ? 1.02 : r)) * 100).toFixed(2)}% -20% 0)`;
    };
    PP.drive(tl, setClip, 0, 11, at, per * 11, "none");
    PP.drive(tl, (v) => sheen.style.setProperty("--p", v.toFixed(1) + "%"), -40, 140, at, per * 11 + (o.sheenTail || 0.45), "power1.inOut");
    return { box, img, sheen, end: at + per * 11 };
  };

  // Zoom-through: `el` scales around (x, y) by `amount`, expo.in.
  PP.zoomThrough = function (tl, el, x, y, at, o) {
    o = o || {};
    tl.set(el, { transformOrigin: `${x}px ${y}px` }, 0);
    return tl.fromTo(el, { scale: 1 }, { scale: o.amount || 14, duration: o.dur || 10 * PP.F, ease: o.ease || "expo.in", immediateRender: false }, at);
  };

  // ---------------------------------------------------------------- ported from film.js
  // Stage video move (the <video> is a stage-level clip; only its transform is tweened). a/b = {s, x, y}.
  PP.vmove = function (tl, id, t0, t1, a, b, ease) {
    const v = typeof id === "string" ? document.getElementById(id) : id;
    return tl.fromTo(v, { scale: a.s || 1, x: a.x || 0, y: a.y || 0 }, { scale: b.s || 1, x: b.x || 0, y: b.y || 0, duration: t1 - t0, ease: ease || "none", immediateRender: false }, t0);
  };
  // Video push at `rate` %/s from scale s, framing offset (x, y) held.
  PP.vpush = function (tl, id, t0, t1, rate, s, x, y) {
    s = s || 1;
    const b = s * (1 + (rate / 100) * (t1 - t0));
    return PP.vmove(tl, id, t0, t1, { s, x: x || 0, y: y || 0 }, { s: b, x: x || 0, y: y || 0 });
  };
  // Edge feather: a CSS background on an overlay element listed after the video (e.g. left black → transparent).
  PP.feather = (el, css) => (el.style.background = css);
  // One glass highlight sweep: a 105° band, screen blend, moving x0 → x1 (% of the element) over [t0, t1], peak alpha a.
  PP.sweep = function (tl, parent, t0, t1, x0, x1, a, o) {
    o = o || {};
    const el = PP.el("div", "layer pp-sweep", parent);
    const ang = o.angle || 105,
      half = o.half || 14;
    el.style.opacity = "0";
    PP.drive(tl, (x) => {
      el.style.opacity = x <= x0 || x >= x1 ? "0" : "1";
      el.style.background = `linear-gradient(${ang}deg, rgba(255,255,255,0) ${x - half}%, rgba(255,255,255,${a}) ${x}%, rgba(255,255,255,0) ${x + half}%)`;
    }, x0, x1, t0, t1 - t0, o.ease || "none");
    return el;
  };

  // ---------------------------------------------------------------- worlds, grain, vignette (BRIEF §4)
  // Hard world switch at t (INK / PAPER / NAVY). Grain opacity 7 / 5 / 6 %, vignette on INK and NAVY only.
  PP.WORLD = { ink: { grain: 0.07, vig: 1 }, paper: { grain: 0.05, vig: 0 }, navy: { grain: 0.06, vig: 1 } };
  PP.world = function (tl, name, t) {
    const w = document.getElementById("world");
    ["ink", "paper", "navy"].forEach((k) => tl.set(w.querySelector(".w-" + k), { opacity: k === name ? 1 : 0 }, t));
    tl.set("#grain", { opacity: PP.WORLD[name].grain }, t);
    tl.set("#vignette", { opacity: PP.WORLD[name].vig }, t);
  };
  // Grain: 8 tiles, reseeded every 2 frames from PP.rng; frozen over the stop beat f1215–f1230.
  PP.grain = function (tl) {
    const g = document.getElementById("grain");
    const R = PP.rng(99);
    const N = PP.DUR * 30;
    const offs = Array.from({ length: N / 2 + 1 }, () => [Math.floor(R() * 512), Math.floor(R() * 512), Math.floor(R() * 8)]);
    PP.drive(tl, (v) => {
      let n = Math.max(0, Math.min(N - 1, Math.round(v)));
      if (n >= 1215 && n < 1230) n = 1214; // stop beat: grain frozen
      const k = offs[n >> 1];
      g.style.backgroundImage = `url(assets/fx/grain${k[2]}.png)`;
      g.style.backgroundPosition = `${k[0]}px ${k[1]}px`;
    }, 0, N, 0, PP.DUR, "none");
  };
})();
