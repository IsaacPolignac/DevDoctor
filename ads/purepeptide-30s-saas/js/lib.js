// PurePeptide SaaS ad — motion library. Brand tokens from purepeptide.care, deterministic helpers,
// reusable components (phone with scrollable site captures, touch indicator, zoom lens, cards).
// Every visual state is a pure function of timeline time: no callbacks, clocks or Math.random.
(function () {
  const PP = (window.PP = window.PP || {});
  const SVGNS = "http://www.w3.org/2000/svg";

  PP.W = 1080;
  PP.H = 1920;
  PP.C = {
    bg: "#F5F8FB",
    white: "#FFFFFF",
    ink: "#16233F",
    inkSoft: "#5C697F",
    line: "#E6EBF2",
    navy: "#123A78",
    blue: "#2A9AC2",
    teal: "#16A48F",
    cap: "#1746B8",
    grad: "linear-gradient(115deg,#123A78 0%,#2A9AC2 55%,#16A48F 100%)",
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
  PP.fr = (s) => s.replace(/ ([?!:;])/g, " $1").replace(/« /g, "« ").replace(/ »/g, " »");

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
  // Per-word mask reveal: yPercent 110 -> 0 + blur, with an opacity gate so parked words never peek.
  PP.wordIn = function (tl, word, at, o) {
    o = o || {};
    const d = o.dur || 0.5;
    tl.fromTo(word, { yPercent: 110, filter: `blur(${o.blur == null ? 8 : o.blur}px)` }, { yPercent: 0, filter: "blur(0px)", duration: d, ease: o.ease || "expo.out" }, at);
    tl.fromTo(word, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "power1.out" }, at);
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
    return tl.fromTo(targets, { yPercent: 0, opacity: 1 }, { yPercent: -40, opacity: 0, duration: o.dur || 0.25, ease: "power2.in", stagger: o.stagger || 0, immediateRender: false }, at);
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
    const img = PP.el("img", "pp-logo", parent, { src: o.light ? "assets/brand/brand-wordmark-light.svg" : "assets/brand/brand-wordmark.svg", alt: "PurePeptide" });
    img.style.width = w + "px";
    img.style.height = w * PP.WORDMARK_RATIO + "px";
    return { el: img, width: w, height: w * PP.WORDMARK_RATIO };
  };
  PP.symbol = function (parent, height) {
    const img = PP.el("img", "pp-symbol", parent, { src: "assets/brand/brand-symbol.svg", alt: "" });
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
    const col = color || PP.C.teal;
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
    PP.svg("path", { d, fill: PP.C.ink }, s);
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
      const ic = PP.checkIcon(el, o.iconSize || 30, o.dark ? "#FFFFFF" : PP.C.teal);
      ic.svg.classList.add("pp-pill-ic");
    }
    PP.el("span", "", el, { text: PP.fr(text) });
    return el;
  };
})();
