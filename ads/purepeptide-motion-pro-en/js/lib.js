// PurePeptide "A LINE OF LIGHT" (45 s, 1920x1080, 30 fps) — motion library (SHOTS §0.6). Based on PREV
// (purepeptide-motion-en/js/lib.js); the PAPER/NAVY world machinery is gone (the film has one background: black).
// Every visual state is a pure function of timeline time: no callbacks, clocks, rAF, timers or Math.random
// (PP.rng for anything stochastic); every fromTo carries immediateRender:false; no will-change, no backdrop-filter.
// The 2D phone rig lives in js/phone.js (window.PH); the screen timeline in js/screen_tl.js (PP.screenTL).
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
  PP.fr = (t) => Math.round(t * 30 + 1e-6) / 30; // snap a time to the frame grid

  // Palette (BRIEF §3.4). Same values as css/tokens.css. The site colours are fills only (never type).
  PP.C = {
    void: "#000000",
    glow: "radial-gradient(60% 50% at 50% 55%, #0A1020 0%, #000 70%)",
    type: "rgba(255,255,255,.90)",
    small: "#C3CBD6", // small caps, URL underline, legal
    legal: "#C3CBD6",
    frost: "#FFFFFF",
    frostTint: "#DCEBFF",
    device: "#33466E",
    deviceEdge: "#9FB2CF",
    statusBar: "#123A78",
    page: "#FBFCFE",
    siteTeal: "#16A48F", // fill only (ship bar) — used by js/phone.js
    barGreen: "#2BB58A", // fill only (ship bar full) — used by js/phone.js
    brandA: "#123A78",
    brandB: "#2A9AC2",
    brandC: "#16A48F",
  };

  // Shot windows in frames [in, out) — SHOTS §1. main.js shows/hides each <section> with tl.set(opacity) on these.
  PP.WIN = {
    S01: [0, 126], S02: [126, 216], S03: [216, 306], S04: [306, 396], S05: [396, 546], S06: [546, 636], S07: [636, 738],
    S08: [738, 822], S09: [822, 936], S10: [936, 1044], S11: [1044, 1152], S12: [1152, 1206], S13: [1206, 1350],
  };
  PP.SHOTS = Object.keys(PP.WIN);
  PP.IN = (id) => PP.WIN[id][0] / 30;
  PP.OUT = (id) => PP.WIN[id][1] / 30;
  // Beat grid: 0.6 s = 18 f anchored on the DROP (f738); PP.grid(k) = frame of grid line k from the DROP.
  PP.DROP = 738;
  PP.STOP = [1188, 1206];
  PP.LOGO = 1206;
  PP.grid = (k) => PP.DROP + 18 * k;

  // Shot registry: js/shots/<id>.js calls PP.shot(id, build); main.js runs build(tl, root) in shot order.
  PP._shots = [];
  PP.shot = (id, build) => PP._shots.push({ id, build });
  PP.scene = PP.shot; // PREV name

  // Music cues (js/cues.js, window.CUES, frozen once the music is measured). Provisional values until then.
  PP.CUES = window.CUES || { HIT1: 1.0, DROP: 24.6, STOP: 39.6, LOGO: 40.2, BEAT: 0.6 };

  // ---------------------------------------------------------------- VO word times (BRIEF §5)
  // VO.w(id, i): onset of word i (number) or of the first word starting with a prefix (string, case-insensitive).
  // The transcript writes numbers as digits and "Janosik": spoken-form prefixes are aliased below.
  const VO = window.VO;
  const ALIAS = { ninety: "99", "ninety-nine": "99", percent: "%", "twenty": "24", "twenty-four": "24", janoshik: "janosik", dot: ".care", care: ".care" };
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
    VO.f = (id, i) => PP.toF(VO.w(id, i)); // word onset as a frame
    VO.at = (id) => VO[id].at;
    VO.end = (id) => VO[id].end;
  }
  // Clamp rule: word-locked events are clamped into the shot window; warn when it fires.
  PP.clamp = function (t, lo, hi, label) {
    const c = Math.min(hi, Math.max(lo, t));
    if (Math.abs(c - t) > 1e-6) console.warn(`[clamp] ${label || ""} ${t.toFixed(3)} s -> ${c.toFixed(3)} s`);
    return c;
  };
  // Word time clamped into a shot window (seconds, frame-snapped): PP.word('S05', 'L04', 5) or ('S05', 'L04', 'Tested').
  PP.word = (shot, line, i, label) => PP.fr(PP.clamp(VO.w(line, i), PP.IN(shot), PP.OUT(shot) - PP.F, label || `${shot} ${line}[${i}]`));

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
  // One setter per heavy animation: tween a value and push it into `setter` during render (seek-safe, no callbacks).
  //   PP.drive(tl, setter, from, to, at, dur, ease)      → proxy {v()}
  //   PP.drive(tl, t0, dur, fn)                           → §0.6 short form: fn(u) with u 0..1 linear over [t0, t0+dur]
  PP.drive = function (tl, a, b, c, d, e, f) {
    if (typeof a === "number") return PP.drive(tl, c, 0, 1, a, b, "none");
    const setter = a, from = b, to = c, at = d, dur = e, ease = f;
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
  // Split an element's text into per-glyph spans (class pp-g; spaces stay as text nodes so the line wraps and kerns as
  // one word run). Idempotent: an element already split returns its spans. Returns the array of glyph spans.
  PP.glyphs = function (el, text) {
    if (el._ppGlyphs && text == null) return el._ppGlyphs;
    const src = text != null ? text : el.textContent;
    el.textContent = "";
    const out = [];
    let word = null;
    Array.from(src).forEach((ch) => {
      if (ch === " ") {
        word = null;
        el.appendChild(document.createTextNode(" "));
        return;
      }
      if (!word) word = PP.el("span", "pp-w", el);
      out.push(PP.el("span", "pp-g", word, { text: ch }));
    });
    el._ppGlyphs = out;
    return out;
  };
  // Per-glyph reveal (BRIEF §4 rule): opacity 0→1 + rise 8 px → 0, 1 f stagger, 20 f expo.out.
  //   PP.wordIn(tl, el, t, {rise:8, stagger:1/30, dur:20/30, ease:'expo.out', overshoot:0})
  // `el` = one element (split into glyphs) or an array of targets (each treated as one unit).
  PP.wordIn = function (tl, el, t, o) {
    o = o || {};
    const targets = Array.isArray(el) || el instanceof NodeList ? Array.from(el) : PP.glyphs(el);
    const rise = o.rise == null ? 8 : o.rise, stagger = o.stagger == null ? 1 / 30 : o.stagger, dur = o.dur || 20 / 30, ease = o.ease || "expo.out";
    if (o.set !== false) tl.set(targets, { opacity: 0, y: rise }, 0);
    if (o.overshoot) {
      // 104 % overshoot: scale 0.96→1.04→1 inside the same duration (cheap: scale on the glyph spans)
      tl.fromTo(targets, { scale: 0.96 }, { scale: o.overshoot, duration: dur * 0.6, ease: "power2.out", stagger, immediateRender: false }, t);
      tl.to(targets, { scale: 1, duration: dur * 0.4, ease: "power2.inOut", stagger, immediateRender: false }, t + dur * 0.6);
    }
    tl.fromTo(targets, { y: rise, opacity: 0 }, { y: 0, opacity: 1, duration: dur, ease, stagger, immediateRender: false }, t);
    return { targets, end: t + dur + stagger * (targets.length - 1) };
  };
  // Exit (BRIEF §4): 8 f power3.in, opacity → 0 with a small rise. PP.textOut(tl, el, t, dur = 8/30, ease = 'power3.in')
  // (PREV form PP.textOut(tl, targets, at, {dur, stagger}) still accepted).
  PP.textOut = function (tl, el, t, dur, ease) {
    let o = {};
    if (typeof dur === "object" && dur) o = dur;
    else o = { dur, ease };
    const targets = Array.isArray(el) || el instanceof NodeList ? Array.from(el) : el;
    return tl.fromTo(targets, { opacity: 1, y: 0 }, { opacity: 0, y: -12, duration: o.dur || 8 / 30, ease: o.ease || "power3.in", stagger: o.stagger || 0, immediateRender: false }, t);
  };
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
  // Masked line reveal. in: yPercent 110→0, 12 f power4.out. out: 0→−110, 8 f power3.in.
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
  // Split text into per-character spans (class pp-c). Returns the spans.
  PP.chars = function (el, text) {
    el.textContent = "";
    return Array.from(text).map((ch) => PP.el("span", "pp-c", el, { text: ch === " " ? " " : ch }));
  };
  // Type-on: chars appear one per `perChar` seconds (hard, like a caret typing). S13 URL: 16 ticks over 18 f.
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
  // DrawSVG on paths: PP.draw(tl, paths, at, dur, {from, to, ease, stagger})
  PP.draw = function (tl, paths, at, dur, o) {
    o = o || {};
    return tl.fromTo(paths, { drawSVG: o.from || "0%" }, { drawSVG: o.to || "100%", duration: dur, ease: o.ease || "power2.inOut", stagger: o.stagger || 0, immediateRender: o.immediate !== false }, at);
  };
  // Slow push on a wrapper: scale 1 → 1+amount, linear.
  PP.camera = function (tl, cam, start, end, amount) {
    return tl.fromTo(cam, { scale: 1 }, { scale: 1 + (amount || 0.03), duration: end - start, ease: "none", immediateRender: false }, start);
  };

  // ---------------------------------------------------------------- brand art (end card only)
  PP.WORDMARK_RATIO = 62 / 611; // brand-wordmark*.svg viewBox 611 x 62
  PP.SYMBOL_RATIO = 456 / 405; // brand-symbol*.svg viewBox 405 x 456
  PP.logo = function (parent, o) {
    o = o || {};
    const w = o.width || 560;
    const img = PP.el("img", "pp-logo", parent, { src: o.dark ? "assets/brand/brand-wordmark.svg" : "assets/brand/brand-wordmark-light.svg", alt: "PurePeptide" });
    img.style.width = w + "px";
    img.style.height = w * PP.WORDMARK_RATIO + "px";
    return { el: img, width: w, height: w * PP.WORDMARK_RATIO };
  };
  PP.symbol = function (parent, height, o) {
    o = o || {};
    const img = PP.el("img", "pp-symbol", parent, { src: o.neon ? "assets/brand/brand-symbol-neon.svg" : "assets/brand/brand-symbol.svg", alt: "" });
    img.style.height = height + "px";
    img.style.width = height / PP.SYMBOL_RATIO + "px";
    return { el: img, width: height / PP.SYMBOL_RATIO, height };
  };
  // Inline a brand SVG so its paths can be drawn (DrawSVG): the markup comes from <template id="svg-<name>"> that
  // tools/assemble.py embeds (symbol = brand-symbol.svg, viewBox 429 196 405 456; wordmark = brand-wordmark-light.svg,
  // viewBox 327 434 611 62). Returns the <svg> (inside a .pp-svg-wrap div appended to parent).
  PP.inlineSvg = function (name, parent) {
    const t = document.getElementById("svg-" + name);
    if (!t) throw new Error("PP.inlineSvg: no <template id=svg-" + name + "> (tools/assemble.py SVGS)");
    const wrap = PP.el("div", "pp-svg-wrap", parent);
    wrap.innerHTML = t.innerHTML;
    return wrap.querySelector("svg");
  };

  // ---------------------------------------------------------------- recipes
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
  // Zoom-through: `el` scales around (x, y) by `amount`, expo.in.
  PP.zoomThrough = function (tl, el, x, y, at, o) {
    o = o || {};
    tl.set(el, { transformOrigin: `${x}px ${y}px` }, 0);
    return tl.fromTo(el, { scale: 1 }, { scale: o.amount || 14, duration: o.dur || 10 * PP.F, ease: o.ease || "expo.in", immediateRender: false }, at);
  };

  // ---------------------------------------------------------------- stage video helpers (ported from film.js)
  // Stage video move (the <video> is a stage-level clip; only its transform is tweened). a/b = {s, x, y}.
  PP.vmove = function (tl, id, t0, t1, a, b, ease) {
    const v = typeof id === "string" ? document.getElementById(id) : id;
    if (!v) return console.warn("[PP.vmove] no element " + id);
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

  // ---------------------------------------------------------------- light band (SHOTS §0.6 / S03 / S04)
  // PP.band(tl, el, t0, dur, angle, from, to, o): a light band (default 105°, 220 px wide, screen blend) inside `el`,
  // sweeping xPercent from → to (percent of el's width; −120 → 120 crosses it fully) over [t0, t0+dur], ease o.ease
  // (default expo.inOut), peak alpha o.alpha (0.55). Hidden outside the window. Returns the band element.
  // Vertical pass: angle 0 with o.axis = 'y' (sweeps yPercent; the band is horizontal).
  PP.band = function (tl, el, t0, dur, angle, from, to, o) {
    o = o || {};
    const b = PP.el("div", "pp-band", el);
    const ang = angle == null ? 105 : angle, w = o.width || 220, a = o.alpha == null ? 0.55 : o.alpha;
    const axis = o.axis || "x";
    if (axis === "x") {
      b.style.cssText = `position:absolute; top:-20%; height:140%; left:0; width:${w}px; margin-left:${-w / 2}px; mix-blend-mode:screen; pointer-events:none; opacity:0;` +
        `background:linear-gradient(${ang}deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${a * 0.35}) 38%, rgba(255,255,255,${a}) 50%, rgba(255,255,255,${a * 0.35}) 62%, rgba(255,255,255,0) 100%)`;
    } else {
      b.style.cssText = `position:absolute; left:-20%; width:140%; top:0; height:${w}px; margin-top:${-w / 2}px; mix-blend-mode:screen; pointer-events:none; opacity:0;` +
        `background:linear-gradient(${ang + 180}deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${a * 0.35}) 38%, rgba(255,255,255,${a}) 50%, rgba(255,255,255,${a * 0.35}) 62%, rgba(255,255,255,0) 100%)`;
    }
    const W = () => (axis === "x" ? el.clientWidth || PP.W : el.clientHeight || PP.H);
    const set = (p) => {
      const lo = Math.min(from, to), hi = Math.max(from, to);
      const on = p > lo + 1e-6 && p < hi - 1e-6;
      b.style.opacity = on ? String(o.opacity == null ? 1 : o.opacity) : "0";
      b.style.transform = axis === "x" ? `translateX(${((p / 100) * W()).toFixed(2)}px)` : `translateY(${((p / 100) * W()).toFixed(2)}px)`;
    };
    PP.drive(tl, set, from, to, t0, dur, o.ease || "expo.inOut");
    return b;
  };
  // PREV one-shot sweep (gradient rebuilt per frame): kept for S02 fallback / glass sheens. a = peak alpha.
  PP.sweep = function (tl, parent, t0, t1, x0, x1, a, o) {
    o = o || {};
    const el = PP.el("div", "layer pp-sweep", parent);
    const ang = o.angle || 105, half = o.half || 14;
    el.style.opacity = "0";
    PP.drive(tl, (x) => {
      el.style.opacity = x <= x0 || x >= x1 ? "0" : "1";
      el.style.background = `linear-gradient(${ang}deg, rgba(255,255,255,0) ${x - half}%, rgba(255,255,255,${a}) ${x}%, rgba(255,255,255,0) ${x + half}%)`;
    }, x0, x1, t0, t1 - t0, o.ease || "none");
    return el;
  };

  // ---------------------------------------------------------------- finish: grain, vignette, glow, CA (BRIEF §3.5)
  // Grain 2 %: 8 tiles, reseeded every 2 frames from PP.rng(5); FROZEN over the STOP f1188–f1206 (the seed holds).
  PP.GRAIN = 0.02;
  PP.grain = function (tl) {
    const g = document.getElementById("grain");
    if (!g) return;
    const R = PP.rng(5);
    const N = PP.DUR * 30;
    const offs = Array.from({ length: N / 2 + 1 }, () => [Math.floor(R() * 512), Math.floor(R() * 512), Math.floor(R() * 8)]);
    g.style.opacity = String(PP.GRAIN);
    PP.drive(tl, (v) => {
      let n = Math.max(0, Math.min(N - 1, Math.round(v)));
      if (n >= PP.STOP[0] && n < PP.STOP[1]) n = PP.STOP[0] - 1; // STOP: grain frozen
      const k = offs[n >> 1];
      g.style.backgroundImage = `url(assets/fx/grain${k[2]}.png)`;
      g.style.backgroundPosition = `${k[0]}px ${k[1]}px`;
    }, 0, N, 0, PP.DUR, "none");
  };
  // Vignette strength in percent (22 = BRIEF default, 0 on the end card). With (tl, t) it is keyed on the timeline
  // (hard set at t, or eased over o.dur); without, it is applied immediately.
  PP.vignette = function (pct, tl, t, o) {
    const v = document.getElementById("vignette");
    if (!v) return;
    const op = Math.max(0, Math.min(1, pct / 100));
    if (!tl) return (v.style.opacity = String(op));
    o = o || {};
    if (o.dur) return tl.to(v, { opacity: op, duration: o.dur, ease: o.ease || "none" }, t);
    return tl.set(v, { opacity: op }, t);
  };
  // Void glow (#world .glow): 0/1 switches or an eased ramp. PP.glow(tl, 1, t, {dur})
  PP.glow = function (tl, on, t, o) {
    const g = document.querySelector("#world .glow");
    if (!g) return;
    o = o || {};
    if (o.dur) return tl.to(g, { opacity: on, duration: o.dur, ease: o.ease || "sine.inOut" }, t);
    return tl.set(g, { opacity: on }, t);
  };
  // Chromatic aberration (≤ 2 px) on ONE element only — the phone webm layer — over [t0, t1], peaking at the middle
  // (sine). Implemented as an SVG filter (#ca in index.html: R shifted +dx, B shifted −dx, screen-added), never as
  // cloned channel layers of #stage. PP.ca(tl, t0, t1, px, el = '#v-take')
  PP.ca = function (tl, t0, t1, px, el) {
    const target = typeof el === "string" ? document.querySelector(el || "#v-take") : el || document.querySelector("#v-take");
    const r = document.getElementById("ca-r"), b = document.getElementById("ca-b");
    if (!target || !r || !b) return console.warn("[PP.ca] missing target or #ca filter");
    px = px == null ? 2 : Math.min(2, px);
    PP.drive(tl, (u) => {
      const a = u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u);
      const dx = (px * a).toFixed(3);
      if (a <= 0.001) {
        if (target.style.filter) target.style.filter = "";
        return;
      }
      r.setAttribute("dx", dx);
      b.setAttribute("dx", String(-dx));
      target.style.filter = "url(#ca)";
    }, 0, 1, t0, t1 - t0, "none");
  };

  // ---------------------------------------------------------------- misc
  PP.lerp = (a, b, u) => a + (b - a) * u;
  PP.clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  // CSS cubic-bezier(0.6, 0, 0.2, 1): the film's camera/phone ease (SHOTS §0.8) as a GSAP CustomEase name "cam".
  PP.registerEases = function () {
    if (!window.CustomEase) return;
    try {
      CustomEase.create("cam", "M0,0 C0.6,0 0.2,1 1,1");
      CustomEase.create("iosPush", "M0,0 C0.32,0.72 0,1 1,1");
    } catch (e) { /* already registered */ }
  };
})();
