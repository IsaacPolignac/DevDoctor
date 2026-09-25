// PurePeptide 60 s manifesto (16:9) — motion library (shared with the neon 9:16 ad). Dark "product launch" look (black, one neon accent derived
// from the brand gradient), deterministic helpers, and the motion recipes measured on the reference
// (ads/reference-trendtrack/ANALYSE.md): VO-synced words, flash + neon ring, cursor clicks, roll counter,
// typed wordmark with sheen, zoom-through, highlight bar, pill -> card morph, wireframe globe.
// Every visual state is a pure function of timeline time: no callbacks, clocks or Math.random.
(function () {
  const PP = (window.PP = window.PP || {});
  const SVGNS = "http://www.w3.org/2000/svg";

  PP.W = 1920;
  PP.H = 1080;
  PP.C = {
    bg: "#04070D",
    card: "#0B111C",
    card2: "#101827",
    ink: "#F3F6FA", // main text on black
    inkSoft: "#93A1B8", // secondary text (contrast 7.4:1 on bg)
    line: "rgba(255,255,255,0.10)",
    neon: "#2EE6C9", // the single accent (brand teal, pushed to neon)
    neon2: "#38BDF8", // brand blue, pushed to neon (gradient partner only)
    navy: "#123A78",
    blue: "#2A9AC2",
    teal: "#16A48F",
    grad: "linear-gradient(100deg,#5AA8FF 0%,#38BDF8 45%,#2EE6C9 100%)",
  };

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
  // French typography: narrow no-break space before ? ! : ; and inside « »
  PP.fr = (s) => s.replace(/(\d) (%)/g, "$1\u202F$2").replace(/(\d) (h|mg|ml|pays)\b/g, "$1\u00A0$2").replace(/ ([?!:;])/g, " $1").replace(/« /g, "« ").replace(/ »/g, " »");

  // ---------------------------------------------------------------- text
  // lines: array of strings; wrap a word in *asterisks* for the brand gradient. Returns { el, lines, words }.
  PP.headline = function (parent, lines, cls) {
    const el = PP.el("div", "pp-h " + (cls || "h1"), parent);
    const lineEls = [];
    const words = [];
    lines.forEach((line) => {
      const ln = PP.el("div", "pp-ln", el);
      lineEls.push(ln);
      PP.fr(line)
        .split(" ")
        .forEach((w, i) => {
          if (i) ln.appendChild(document.createTextNode(" "));
          const acc = /^\*.*\*$/.test(w);
          words.push(PP.el("span", "pp-w" + (acc ? " grad" : ""), ln, { text: acc ? w.slice(1, -1) : w }));
        });
    });
    return { el, lines: lineEls, words };
  };
  // Per-word reveal measured on the reference: opacity in 2-3 frames, ~12 px rise, small blur, expo settle.
  PP.wordIn = function (tl, word, at, o) {
    o = o || {};
    const d = o.dur || 0.4;
    tl.fromTo(word, { y: o.rise == null ? 14 : o.rise, filter: `blur(${o.blur == null ? 6 : o.blur}px)` }, { y: 0, filter: "blur(0px)", duration: d, ease: o.ease || "expo.out" }, at);
    tl.fromTo(word, { opacity: 0 }, { opacity: 1, duration: 0.09, ease: "none" }, at);
  };
  PP.wordsIn = function (tl, words, at, o) {
    o = o || {};
    words.forEach((w, i) => PP.wordIn(tl, w, at + i * (o.stagger == null ? 0.06 : o.stagger), o));
  };
  // Headline whose words appear exactly when the voice-over says them (PP.VO word timings).
  // lines: display strings (same word count as the VO line, *word* = gradient). lead: seconds before the word.
  PP.voHeadline = function (tl, parent, lineId, lines, cls, o) {
    o = o || {};
    const h = PP.headline(parent, lines, cls);
    const vo = PP.VO.find((l) => l.id === lineId);
    const lead = o.lead == null ? 0.08 : o.lead;
    const n = h.words.length;
    h.times = h.words.map((w, i) => {
      const vw = vo && vo.words.length === n ? vo.words[i] : null;
      const t = vw ? vw.t0 : vo ? vo.at + ((vo.end - vo.at) * i) / n : 0;
      return Math.max(0, t - lead);
    });
    h.words.forEach((w, i) => PP.wordIn(tl, w, h.times[i], o));
    return h;
  };
  PP.textOut = function (tl, targets, at, o) {
    o = o || {};
    return tl.fromTo(targets, { y: 0, opacity: 1, filter: "blur(0px)" }, { y: -24, opacity: 0, filter: "blur(6px)", duration: o.dur || 0.2, ease: "power2.in", stagger: o.stagger || 0, immediateRender: false }, at);
  };
  PP.chars = function (el, text) {
    el.textContent = "";
    return Array.from(text).map((ch) => PP.el("span", "pp-c", el, { text: ch === " " ? " " : ch }));
  };
  PP.typeOn = function (tl, chars, at, perChar) {
    return tl.fromTo(chars, { opacity: 0 }, { opacity: 1, duration: 0.001, ease: "none", stagger: perChar || 0.025 }, at);
  };
  PP.counter = function (tl, el, o) {
    const d = o.decimals == null ? 0 : o.decimals;
    const fmt = o.format || ((x) => x.toFixed(d));
    return PP.drive(tl, (x) => (el.textContent = fmt(x)), o.from || 0, o.to, o.at, o.dur, o.ease || "power3.out");
  };
  PP.popIn = function (tl, targets, at, o) {
    o = o || {};
    return tl.fromTo(targets, { scale: o.from || 0.85, opacity: 0, y: o.y || 0 }, { scale: 1, opacity: 1, y: 0, duration: o.dur || 0.45, ease: o.ease || "back.out(1.7)", stagger: o.stagger || 0 }, at);
  };
  PP.draw = function (tl, paths, at, dur, o) {
    o = o || {};
    return tl.fromTo(paths, { drawSVG: "0%" }, { drawSVG: "100%", duration: dur, ease: o.ease || "power2.inOut", stagger: o.stagger || 0 }, at);
  };
  PP.camera = function (tl, cam, start, end, amount) {
    return tl.fromTo(cam, { scale: 1 }, { scale: 1 + (amount || 0.03), duration: end - start, ease: "none", immediateRender: false }, start);
  };

  // ---------------------------------------------------------------- brand art
  PP.WORDMARK_RATIO = 62 / 611; // brand-wordmark.svg viewBox 611 x 62
  PP.SYMBOL_RATIO = 456 / 405; // brand-symbol.svg viewBox 405 x 456
  PP.logo = function (parent, o) {
    o = o || {};
    const w = o.width || 600;
    const img = PP.el("img", "pp-logo", parent, { src: o.dark ? "assets/brand/brand-wordmark.svg" : "assets/brand/brand-wordmark-light.svg", alt: "PurePeptide" });
    img.style.width = w + "px";
    img.style.height = w * PP.WORDMARK_RATIO + "px";
    return { el: img, width: w, height: w * PP.WORDMARK_RATIO };
  };
  PP.symbol = function (parent, height) {
    const img = PP.el("img", "pp-symbol", parent, { src: "assets/brand/brand-symbol-neon.svg", alt: "" });
    img.style.height = height + "px";
    img.style.width = height / PP.SYMBOL_RATIO + "px";
    return { el: img, width: height / PP.SYMBOL_RATIO, height };
  };
  // Product vial render (606 x 1240 PNG with transparency). Returns { el, img, width, height }.
  PP.VIAL_RATIO = 606 / 1240;
  PP.vial = function (parent, src, height) {
    const el = PP.el("div", "pp-vial", parent);
    el.style.width = height * PP.VIAL_RATIO + "px";
    el.style.height = height + "px";
    const img = PP.el("img", "", el, { src, alt: "" });
    return { el, img, width: height * PP.VIAL_RATIO, height };
  };

  PP.checkIcon = function (parent, size, color) {
    const s = PP.svg("svg", { width: size, height: size, viewBox: "0 0 44 44", class: "pp-check" }, parent);
    const col = color || PP.C.neon;
    const circle = PP.svg("circle", { cx: 22, cy: 22, r: 20, fill: "none", stroke: col, "stroke-width": 2.4 }, s);
    const tick = PP.svg("path", { d: "M13.5 22.5 L19.5 28.5 L31 16", fill: "none", stroke: col, "stroke-width": 2.8, "stroke-linecap": "round", "stroke-linejoin": "round" }, s);
    return { svg: s, circle, tick };
  };
  PP.qr = function (parent, text, size) {
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    const z = 2;
    const s = PP.svg("svg", { width: size, height: size, viewBox: `0 0 ${n + z * 2} ${n + z * 2}`, "shape-rendering": "crispEdges", class: "pp-qr" }, parent);
    PP.svg("rect", { x: 0, y: 0, width: n + z * 2, height: n + z * 2, fill: "#FFFFFF" }, s);
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + z} ${r + z}h1v1h-1z`;
    PP.svg("path", { d, fill: "#04070D" }, s);
    return s;
  };

  // ---------------------------------------------------------------- phone
  // iPhone-style device showing mobile captures of purepeptide.care (390 css px wide, captured @3x).
  // Standard pose P0: centre (540, 1040), CSS scale 1.4 -> screen 546 x 1182, outer 572 x 1208.
  PP.PHONE = { S: 1.4, cssW: 390, cssH: 844, status: 47, bezel: 13, radius: 74, x: 540, y: 1040 };
  PP.phone = function (parent, o) {
    o = o || {};
    const P = PP.PHONE;
    const S = o.scale || P.S;
    const sw = P.cssW * S,
      sh = P.cssH * S,
      bz = P.bezel * (S / P.S);
    const W = sw + 2 * bz,
      H = sh + 2 * bz;
    const el = PP.el("div", "pp-phone", parent);
    el.style.width = W + "px";
    el.style.height = H + "px";
    el.style.left = (o.x == null ? P.x : o.x) - W / 2 + "px";
    el.style.top = (o.y == null ? P.y : o.y) - H / 2 + "px";
    el.style.borderRadius = P.radius * (S / P.S) + "px";
    const screen = PP.el("div", "pp-screen", el);
    screen.style.left = screen.style.top = bz + "px";
    screen.style.width = sw + "px";
    screen.style.height = sh + "px";
    screen.style.borderRadius = (P.radius - P.bezel) * (S / P.S) + "px";
    const view = PP.el("div", "pp-view", screen);
    view.style.top = P.status * S + "px";
    // iOS status bar + dynamic island
    const bar = PP.el("div", "pp-status", screen);
    bar.style.height = P.status * S + "px";
    bar.style.fontSize = 15.5 * S + "px";
    PP.el("span", "pp-time", bar, { text: "9:41", "data-layout-allow-overlap": "" });
    const icons = PP.el("span", "pp-icons", bar);
    icons.innerHTML = `<svg viewBox="0 0 70 14" width="${70 * S * 0.62}" height="${14 * S * 0.62}"><g fill="${PP.C.ink}"><rect x="0" y="9" width="3.2" height="5" rx="1"/><rect x="5" y="6.5" width="3.2" height="7.5" rx="1"/><rect x="10" y="4" width="3.2" height="10" rx="1"/><rect x="15" y="1" width="3.2" height="13" rx="1"/><path d="M29 4.2c2.6-2.4 6.8-2.4 9.4 0l-1.3 1.3c-1.9-1.7-4.9-1.7-6.8 0zM31.4 6.8c1.3-1.2 3.4-1.2 4.7 0l-1.3 1.3c-.6-.5-1.5-.5-2.1 0zM33.7 9.4l1.1 1.1-1.1 1.1-1.1-1.1z"/><rect x="45" y="1.5" width="21" height="11" rx="3" fill="none" stroke="${PP.C.ink}" stroke-opacity=".45" stroke-width="1.2"/><rect x="47" y="3.5" width="17" height="7" rx="1.6"/><rect x="67" y="5.2" width="1.6" height="3.6" rx=".8" fill-opacity=".45"/></g></svg>`;
    const island = PP.el("div", "pp-island", screen);
    island.style.width = 124 * S + "px";
    island.style.height = 36 * S + "px";
    island.style.top = 11 * S + "px";
    island.style.marginLeft = (-124 * S) / 2 + "px";
    const glare = PP.el("div", "pp-glare", el);
    const api = { el, screen, view, bar, glare, S, W, H, sw, sh, pages: [] };
    // A page = one capture; cssH = height of the capture in css px (image px / 3). scroll in css px.
    api.addPage = function (src, cssH, po) {
      po = po || {};
      const pg = PP.el("div", "pp-page", po.full ? screen : view);
      if (po.full) pg.style.top = "0px";
      const img = PP.el("img", "", pg, { src, alt: "" });
      img.style.width = sw + "px";
      img.style.height = cssH * S + "px";
      const page = {
        el: pg,
        img,
        cssH,
        // tween the page scroll (css px) — seek-safe
        scroll(tl, y0, y1, at, dur, ease) {
          return tl.fromTo(img, { y: -y0 * S }, { y: -y1 * S, duration: dur, ease: ease || "power2.inOut", immediateRender: false }, at);
        },
        set(tl, y, at) {
          return tl.set(img, { y: -y * S }, at);
        },
      };
      api.pages.push(page);
      return page;
    };
    // Convert a point in page css coordinates (x, y at a given scroll) to phone-local px.
    api.pt = (cx, cy, scroll, full) => ({ x: bz + cx * S, y: bz + (full ? 0 : P.status * S) + (cy - (scroll || 0)) * S });
    return api;
  };

  // Touch indicator (finger tap): { el, tap(tl, at) } — you move `el` yourself (x/y tweens, centred).
  PP.touch = function (parent) {
    const el = PP.el("div", "pp-touch", parent);
    const dot = PP.el("div", "pp-touch-dot", el);
    const ring = PP.el("div", "pp-touch-ring", el);
    return {
      el,
      dot,
      ring,
      tap(tl, at) {
        tl.fromTo(dot, { scale: 1 }, { scale: 0.78, duration: 0.09, ease: "power2.out", immediateRender: false }, at);
        tl.fromTo(dot, { scale: 0.78 }, { scale: 1, duration: 0.25, ease: "back.out(2)", immediateRender: false }, at + 0.09);
        tl.fromTo(ring, { scale: 0.4, opacity: 0.9 }, { scale: 2.2, opacity: 0, duration: 0.55, ease: "power2.out", immediateRender: false }, at);
      },
    };
  };

  // Zoom lens: a card showing a crop of a capture, magnified. crop = [x, y, w, h] in capture css px.
  // Returns { el, inner }. `width` = on-screen width in px; height follows the crop ratio.
  PP.lens = function (parent, src, imgCssW, imgCssH, crop, width) {
    const [cx, cy, cw, ch] = crop;
    const k = width / cw;
    const el = PP.el("div", "pp-lens", parent);
    el.style.width = width + "px";
    el.style.height = ch * k + "px";
    const img = PP.el("img", "", el, { src, alt: "" });
    img.style.width = imgCssW * k + "px";
    img.style.height = imgCssH * k + "px";
    img.style.left = -cx * k + "px";
    img.style.top = -cy * k + "px";
    return { el, img, width, height: ch * k, k };
  };

  PP.pill = function (parent, text, o) {
    o = o || {};
    const el = PP.el("div", "pp-pill" + (o.dark ? " dark" : ""), parent);
    if (o.check) {
      const ic = PP.checkIcon(el, o.iconSize || 30, PP.C.neon);
      ic.svg.classList.add("pp-pill-ic");
    }
    PP.el("span", "", el, { text: PP.fr(text) });
    return el;
  };

  // ================================================================ NEON RECIPES (reference analysis §3)
  PP.F = 1 / 30; // one frame
  PP.HERO_RATIO = 1024 / 1536; // assets/vials/hero.png (big hero vial render)
  PP.heroVial = function (parent, height) {
    const el = PP.el("div", "pp-vial pp-hero", parent);
    el.style.width = height * PP.HERO_RATIO + "px";
    el.style.height = height + "px";
    const img = PP.el("img", "", el, { src: PP.cfg.heroVial, alt: "" });
    return { el, img, width: height * PP.HERO_RATIO, height };
  };

  // Dark UI card with 1 px border and the neon edge light on its top-left edges (reference: every UI card).
  // o: { x, y, w, h (centre x/y in parent px), radius, glow (0..1) }. Returns { el, body, edge }.
  PP.neonCard = function (parent, o) {
    o = o || {};
    const el = PP.el("div", "pp-ncard", parent);
    const w = o.w || 600,
      h = o.h || 300;
    el.style.width = w + "px";
    el.style.height = h + "px";
    el.style.left = (o.x == null ? 960 : o.x) - w / 2 + "px";
    el.style.top = (o.y == null ? 540 : o.y) - h / 2 + "px";
    el.style.borderRadius = (o.radius == null ? 28 : o.radius) + "px";
    const edge = PP.el("div", "pp-ncard-edge", el);
    const body = PP.el("div", "pp-ncard-body", el);
    return { el, body, edge, w, h };
  };

  // Recipe 3 — flash + neon ring (6.4 / 49.3 / 59.0 s on the reference).
  // `at` = the impact frame. Frames at-4..at: `target` (optional element) fills solid neon;
  // at..at+8f: a ring born at (x, y) expands past the frame edges (ease-out), full-frame bloom decays.
  // parent should be a full-frame layer (1080x1920). Returns { ring, bloom, fill }.
  PP.flashRing = function (tl, parent, at, o) {
    o = o || {};
    const F = PP.F;
    const x = o.x == null ? 960 : o.x,
      y = o.y == null ? 540 : o.y;
    let fill = null;
    if (o.target) {
      fill = PP.el("div", "pp-flash-fill", o.target);
      tl.fromTo(fill, { opacity: 0 }, { opacity: 1, duration: 4 * F, ease: "power2.in", immediateRender: false }, at - 4 * F);
      tl.set(fill, { opacity: 0 }, at + 3 * F);
      tl.set(fill, { opacity: 0 }, 0);
    }
    const size = o.size || 2600; // final diameter (px) — past the frame corners
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

  // Recipe 5 — real mouse cursor. Position = arrow tip. api.move(tl, x, y, at, dur) ; api.click(tl, at).
  // Highlight your target yourself 1 frame BEFORE the click (reference detail).
  PP.cursor = function (parent, x0, y0, scale) {
    const el = PP.el("div", "pp-cursor", parent);
    const k = scale || 1;
    el.innerHTML = `<svg width="${46 * k}" height="${58 * k}" viewBox="0 0 46 58"><path d="M4 3 L4 47 L15.5 36.5 L23.5 54 L31 50.5 L23 33.5 L39 33.5 Z" fill="#FFFFFF" stroke="#04070D" stroke-width="3" stroke-linejoin="round"/></svg>`;
    const pulse = PP.el("div", "pp-cursor-pulse", el);
    gsap.set(el, { x: x0 || 0, y: y0 || 0 });
    return {
      el,
      move(tl, x, y, at, dur, ease) {
        return tl.to(el, { x, y, duration: dur || 0.35, ease: ease || "power3.inOut" }, at);
      },
      click(tl, at) {
        const svg = el.firstChild;
        tl.fromTo(svg, { scale: 1 }, { scale: 0.82, duration: 0.07, ease: "power2.out", immediateRender: false }, at);
        tl.fromTo(svg, { scale: 0.82 }, { scale: 1, duration: 0.2, ease: "back.out(2.5)", immediateRender: false }, at + 0.07);
        tl.fromTo(pulse, { scale: 0.2, opacity: 0.95 }, { scale: 1.6, opacity: 0, duration: 0.45, ease: "power2.out", immediateRender: false }, at);
      },
    };
  };

  // Recipe 7b — rolling counter. Each digit is a vertical strip that spins (motion-blurred) and lands.
  // parent gets a row of digit windows; final = string like "99". at = start, land = landing time.
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
      const turns = 2 + i; // later digits spin more
      const n = turns * 10 + Number(ch);
      for (let k = 0; k <= n; k++) PP.el("span", "pp-roll-d", strip, { text: String(k % 10) });
      digs.push({ win, strip, n });
      const lnd = land + i * (o.stagger == null ? 0.08 : o.stagger);
      tl.fromTo(strip, { yPercent: 0 }, { yPercent: (-100 * n) / (n + 1), duration: lnd - at, ease: o.ease || "power3.inOut", immediateRender: false }, at);
      tl.fromTo(strip, { filter: "blur(0px)" }, { filter: "blur(7px)", duration: (lnd - at) * 0.3, ease: "power1.in", immediateRender: false }, at);
      tl.fromTo(strip, { filter: "blur(7px)" }, { filter: "blur(0px)", duration: (lnd - at) * 0.35, ease: "power2.out", immediateRender: false }, lnd - (lnd - at) * 0.35);
    });
    return { row, digs };
  };

  // Recipe 7a — typed wordmark: the official PUREPEPTIDE SVG revealed letter by letter (1 letter / frame by
  // default) + a neon sheen sweeping across while it types. Letter right edges measured on the SVG.
  PP.WM_EDGES = [0.0671, 0.1686, 0.27, 0.3625, 0.4583, 0.5499, 0.6457, 0.7406, 0.7897, 0.8969, 0.9902];
  PP.typedWordmark = function (tl, parent, width, at, o) {
    o = o || {};
    const per = o.perLetter || PP.F * 1.5;
    const box = PP.el("div", "pp-wm", parent);
    box.style.width = width + "px";
    box.style.height = width * PP.WORDMARK_RATIO + "px";
    const img = PP.el("img", "", box, { src: "assets/brand/brand-wordmark-light.svg", alt: "PurePeptide" });
    img.style.width = width + "px";
    img.style.height = width * PP.WORDMARK_RATIO + "px";
    const sheen = PP.el("div", "pp-wm-sheen", box);
    sheen.style.webkitMaskImage = sheen.style.maskImage = 'url("assets/brand/brand-wordmark-light.svg")';
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

  // Recipe 2 — zoom-through: `el` (usually a camera wrapper) scales around (x, y) by `amount` in 4 frames,
  // exponential acceleration. The next scene must be visible "inside" by the last frame.
  PP.zoomThrough = function (tl, el, x, y, at, o) {
    o = o || {};
    tl.set(el, { transformOrigin: `${x}px ${y}px` }, 0);
    return tl.fromTo(el, { scale: 1 }, { scale: o.amount || 14, duration: o.dur || 4 * PP.F, ease: "expo.in", immediateRender: false }, at);
  };

  // Recipe 6 — highlight bar gliding from row to row. rows: [{ y, h }] in parent px; times: when each lights.
  PP.highlightBar = function (tl, parent, x, w, rows, times, o) {
    o = o || {};
    const bar = PP.el("div", "pp-hbar", parent);
    bar.style.left = x + "px";
    bar.style.width = w + "px";
    tl.set(bar, { opacity: 0, y: rows[0].y, height: rows[0].h }, 0);
    tl.fromTo(bar, { opacity: 0, scaleX: 0.6 }, { opacity: 1, scaleX: 1, duration: 0.18, ease: "power2.out", immediateRender: false }, times[0] - PP.F);
    for (let i = 1; i < rows.length; i++) tl.to(bar, { y: rows[i].y, height: rows[i].h, duration: 0.22, ease: "power3.inOut" }, times[i] - 0.18);
    return bar;
  };

  // Wireframe globe (SVG) rotating deterministically. Returns { svg, spin(tl, at, dur, turns) }.
  PP.globe = function (parent, size, o) {
    o = o || {};
    const r = size / 2 - 4;
    const s = PP.svg("svg", { width: size, height: size, viewBox: `${-size / 2} ${-size / 2} ${size} ${size}`, class: "pp-globe" }, parent);
    PP.svg("circle", { cx: 0, cy: 0, r, fill: "rgba(46,230,201,0.04)", stroke: "rgba(46,230,201,0.85)", "stroke-width": 2 }, s);
    for (let k = -2; k <= 2; k++) {
      const yy = (k * r) / 3;
      const rx = Math.sqrt(r * r - yy * yy);
      PP.svg("ellipse", { cx: 0, cy: yy, rx, ry: rx * 0.16, fill: "none", stroke: "rgba(56,189,248,0.45)", "stroke-width": 1.5 }, s);
    }
    const mer = [];
    const M = o.meridians || 8;
    for (let i = 0; i < M; i++) mer.push(PP.svg("ellipse", { cx: 0, cy: 0, rx: r, ry: r, fill: "none", stroke: "rgba(46,230,201,0.55)", "stroke-width": 1.5 }, s));
    const setRot = (a) => {
      mer.forEach((m, i) => {
        const th = a + (i * Math.PI) / M;
        m.setAttribute("rx", Math.abs(r * Math.cos(th)).toFixed(2));
        m.setAttribute("stroke-opacity", (0.35 + 0.65 * Math.abs(Math.sin(th))).toFixed(2));
      });
    };
    setRot(0);
    return {
      svg: s,
      r,
      spin(tl, at, dur, turns) {
        PP.drive(tl, setRot, 0, (turns || 0.5) * Math.PI * 2, at, dur, "none");
      },
    };
  };

  // Recipe 4 — pill -> card morph: animates a card element from a small pill rectangle to its full size.
  // card = element positioned at its final rect (w x h). from = { dx, dy, w, h } pill rect relative to card top-left.
  PP.morphFromPill = function (tl, card, w, h, from, at, dur) {
    tl.fromTo(
      card,
      { clipPath: `inset(${from.dy}px ${w - from.dx - from.w}px ${h - from.dy - from.h}px ${from.dx}px round ${from.h / 2}px)` },
      { clipPath: `inset(0px 0px 0px 0px round 28px)`, duration: dur || 9 * PP.F, ease: "expo.out", immediateRender: false },
      at
    );
  };
})();
