// The iPhone rig (PREV SCENES §0.4, copied verbatim; the only change is PH.init's {root, bake} options — SHOTS §0.1/§0.4):
// Blender front layers (2x renders) + the live Safari screen on the clean captures. In this film it is the SCREEN AUTHOR
// (screen/bake.html, bake mode) and the zero-cost 2D fallback (#phone2d in index.html, hidden by default).
// Built by main.js (PH.init) before any shot. Every call is seek-safe: it only adds tweens/sets to
// the master timeline, and every query (PH.stage, PH.scrollAt, PH.camAt, PH.pageAt) is a pure function of time,
// computed from the segments the calls recorded. Calls must therefore be made in time order per property (scenes are
// built in order S01→S11, so this holds as long as each scene adds its PH calls in time order).
//
// Units: "screen points" (pt) are iPhone points, x 0..402, y 0..874. Page points (px, py) at scroll s sit on screen at
// (px, 62 + py − s). Stage px = 1920x1080 composition pixels.
(function () {
  const PP = window.PP;
  const PH = (window.PH = {});

  // ------------------------------------------------------------ geometry (assets/iphone/screen_rect.json @1920x1080)
  PH.SX = 759.85; // screen rect left (stage px at REST)
  PH.SY = 105.27; // screen rect top
  PH.K = 400.31 / 402; // 0.99580 stage px per screen pt
  PH.W = 402;
  PH.H = 874;
  PH.TOP = 62; // page viewport top (screen pt), under the status bar
  PH.NAV_Y = 46; // sticky header page y 46..117 (71 pt); stuck at screen y 62..133 once s >= 46
  PH.NAV_H = 71;
  PH.BASE = "assets/site/clean/"; // NEVER raw/ (BRIEF §10)
  PH.PAGES = ["home", "product", "cart1", "cart2", "cart3"];
  // Ship bar on the cart captures (page pt, measured on the 3x pixels): track x 37.33–364.67, y 295–303.
  PH.BAR = { x: 37.33, y: 295, w: 327.33, h: 8, r: 4, track: "#EEF2F7", frac: { cart1: 0.4196, cart2: 0.8106, cart3: 1 } };
  PH.BADGE = { x: 329, y: 70 }; // cart count bubble centre, page pt (inside the nav band 46..117)

  // Camera keyframes (SCENES §0.4): screen pt (ox, oy) placed at stage (cx, cy) at scale g.
  PH.CAMS = {
    REST: { g: 1.0, ox: 201, oy: 437, cx: 960.0, cy: 540.4 },
    HOME: { g: 1.02, ox: 201, oy: 437, cx: 960.0, cy: 540.4 },
    PROD: { g: 1.5, ox: 201, oy: 352, cx: 1290, cy: 540 },
    CART: { g: 2.0, ox: 201, oy: 470, cx: 1290, cy: 540 },
    WIDE: { g: 1.0, ox: 201, oy: 437, cx: 1340, cy: 540 },
    DIVE: { g: 1.6, ox: 201, oy: 516, cx: 1340, cy: 618.7 },
  };

  const F = 1 / 30;
  const ease = (e) => (typeof e === "function" ? e : gsap.parseEase(e || "none"));
  const lerp = (a, b, u) => a + (b - a) * u;
  const rectOf = (r) => (Array.isArray(r) ? { x: r[0], y: r[1], w: r[2], h: r[3] } : r);

  // ------------------------------------------------------------ build
  // PH.init(tl, o): called once by main.js. Creates #phone's layers, page layers and their initial (hidden) state.
  // o.root: id of the rig root (default "phone"; the pro film uses "phone2d"). o.bake: BAKE MODE (screen/bake.html):
  // the .ps root is the whole stage (PH.SX = PH.SY = 0, PH.K = 1), no shadow/body/glass layers — the bake screenshots
  // the bare 402x874 pt screen at deviceScaleFactor 3 (1206x2622) for the 3D screen SEQUENCE (SHOTS §0.4).
  PH.init = function (tl, o) {
    o = o || {};
    PH.bake = !!o.bake;
    if (PH.bake) { PH.SX = 0; PH.SY = 0; PH.K = 1; }
    gsap.registerEase && window.CustomEase && CustomEase.create("iosPush", "M0,0 C0.32,0.72 0,1 1,1");
    const root = (PH.el = document.getElementById(o.root || "phone"));
    root.innerHTML = "";
    if (!PH.bake) PP.el("img", "ph-full ph-shadow", root, { src: "assets/iphone/front_shadow.png", alt: "" });
    const ps = (PH.ps = PP.el("div", "ps", root, { id: "ps" }));
    if (!PH.bake) PP.el("img", "ph-full ph-body", root, { src: "assets/iphone/front_body.png", alt: "" });
    // front_glass.png (RGBA, normal blend): the screen-blend variant is opaque black and #phone is an isolated group
    if (!PH.bake) PP.el("img", "ph-full ph-glass", root, { src: "assets/iphone/front_glass.png", alt: "" });
    gsap.set(root, { x: 0, y: 0, scale: 1, transformOrigin: "0 0" });

    // blank screen (status bar + Safari bar + home hero background): always visible, bottom-most
    const blank = PP.el("div", "ps-layer ps-blank", ps, { "data-page": "blank" });
    PP.el("img", "ps-blank-img", blank, { src: PH.BASE + "screen_blank.png", alt: "" });
    PH.pages = {};
    PH.PAGES.forEach((name) => {
      const layer = PP.el("div", "ps-layer ps-page", ps, { "data-page": name });
      const scroll = PP.el("div", "ps-scroll", layer);
      const img = PP.el("img", "ps-img", scroll, { src: PH.BASE + name + ".png", alt: "" });
      const ov = PP.el("div", "ps-ov", scroll);
      const nav = PP.el("div", "ps-nav", layer);
      nav.style.backgroundImage = `url('${PH.BASE + name}.png')`;
      const navAlt = PP.el("div", "ps-nav-alt", nav);
      const dim = PP.el("div", "ps-dim", layer);
      const P = { name, layer, scroll, img, ov, nav, navAlt, dim, segs: [], st: { s: 0, blur: 0 } };
      PH.pages[name] = P;
      apply(P);
      tl.set(layer, { visibility: "hidden", x: 0, zIndex: 1 }, 0);
      tl.set(dim, { opacity: 0 }, 0);
    });
    // iOS chrome from phone-screen.js (status bar, Safari bar, home indicator) — markup([]) = chrome only, no pages
    ps.insertAdjacentHTML("beforeend", window.PhoneScreen.markup([], PH.BASE));
    PH.url = ps.querySelector(".ps-url");
    PH.safari = ps.querySelector(".ps-safari");
    PH.status = ps.querySelector(".ps-status");
    PH._cams = [];
    PH._shows = [];
  };

  function apply(P) {
    const s = P.st.s;
    P.scroll.style.transform = `translateY(${-s}px)`;
    P.nav.style.top = Math.max(0, PH.NAV_Y - s) + "px";
    P.img.style.filter = P.st.blur > 0.05 ? `blur(${P.st.blur.toFixed(2)}px)` : "none";
  }
  const page = (name) => {
    const P = PH.pages[name];
    if (!P) throw new Error("PH: unknown page " + name + " (pages: " + PH.PAGES.join(", ") + ")");
    return P;
  };
  PH.layer = (name) => page(name).layer;
  PH.ov = (name) => page(name).ov; // page-space overlay container (children in page pt, scrolls with the page)

  // ------------------------------------------------------------ camera
  PH.camAt = function (t) {
    let c = { g: 1, tx: 0, ty: 0 };
    for (const k of PH._cams) {
      if (t < k.t0) break;
      if (t >= k.t1) c = k.to;
      else {
        const u = k.ease((t - k.t0) / (k.t1 - k.t0));
        c = { g: lerp(k.from.g, k.to.g, u), tx: lerp(k.from.tx, k.to.tx, u), ty: lerp(k.from.ty, k.to.ty, u) };
      }
    }
    return c;
  };
  // Stage point of a camera state for screen point (X, Y).
  PH.camState = (o) => ({ g: o.g, tx: o.cx - o.g * (PH.SX + PH.K * o.ox), ty: o.cy - o.g * (PH.SY + PH.K * o.oy) });
  // PH.cam(tl, t0, dur, {g, ox, oy, cx, cy} | "PROD", ease): tween g, tx, ty together from the state at t0.
  PH.cam = function (tl, t0, dur, o, e) {
    if (typeof o === "string") o = PH.CAMS[o];
    const from = PH.camAt(t0);
    const to = PH.camState(o);
    const last = PH._cams[PH._cams.length - 1];
    if (last && t0 < last.t1 - 1e-6) console.warn(`[PH.cam] segment at ${t0.toFixed(3)} overlaps the previous one (ends ${last.t1.toFixed(3)})`);
    PH._cams.push({ t0, t1: t0 + dur, from, to, ease: ease(e) });
    tl.fromTo(PH.el, { x: from.tx, y: from.ty, scale: from.g }, { x: to.tx, y: to.ty, scale: to.g, duration: dur, ease: e || "none", immediateRender: false }, t0);
  };
  // Stage point (x, y) of screen point (X, Y) at time t.
  PH.stage = function (X, Y, t) {
    const c = PH.camAt(t);
    return { x: c.tx + c.g * (PH.SX + PH.K * X), y: c.ty + c.g * (PH.SY + PH.K * Y), g: c.g, s: c.g * PH.K };
  };
  // Stage rect of a screen-pt rect at time t: {x, y, w, h}.
  PH.stageRect = function (r, t) {
    r = rectOf(r);
    const a = PH.stage(r.x, r.y, t);
    return { x: a.x, y: a.y, w: r.w * a.s, h: r.h * a.s };
  };

  // ------------------------------------------------------------ pages, scroll
  PH.scrollAt = function (name, t) {
    let s = 0;
    for (const k of page(name).segs) {
      if (t < k.t0) break;
      s = t >= k.t1 ? k.s1 : k.fn(t);
    }
    return s;
  };
  // Screen point of page point (px, py) at time t (uses that page's scroll at t).
  PH.pageScreen = (name, px, py, t) => ({ x: px, y: PH.TOP + py - PH.scrollAt(name, t) });
  // Stage point of page point (px, py) at time t.
  PH.pageStage = function (name, px, py, t) {
    const p = PH.pageScreen(name, px, py, t);
    return PH.stage(p.x, p.y, t);
  };
  PH.pageAt = function (t) {
    let p = null;
    for (const k of PH._shows) if (t >= k.t) p = k.page;
    return p;
  };

  function addSeg(tl, name, seg, blur) {
    const P = page(name);
    P.segs.push(seg);
    P.segs.sort((a, b) => a.t0 - b.t0);
    const prev = (t) => (seg.t1 > seg.t0 ? seg.fn(Math.max(seg.t0, t)) : seg.s1);
    if (seg.t1 <= seg.t0) {
      // instantaneous scroll set
      PP.drive(tl, (v) => { P.st.s = v; P.st.blur = 0; apply(P); }, seg.s1, seg.s1, seg.t0, 0.001, "none");
      return;
    }
    PP.driveT(tl, (t) => {
      const s = t >= seg.t1 ? seg.s1 : seg.fn(t);
      P.st.s = s;
      P.st.blur = blur && t < seg.t1 ? Math.min(2, 0.04 * Math.abs(s - prev(t - F))) : 0;
      apply(P);
    }, seg.t0, seg.t1);
  }
  // Show `name` at t (hard cut), hiding the other pages. Optional scroll s at that frame.
  PH.show = function (tl, t, name, s) {
    page(name);
    PH.PAGES.forEach((n) => tl.set(PH.pages[n].layer, { visibility: n === name ? "visible" : "hidden", x: 0, zIndex: n === name ? 2 : 1 }, t));
    PH._shows.push({ t, page: name });
    PH._shows.sort((a, b) => a.t - b.t);
    if (s != null) PH.setScroll(tl, name, s, t);
  };
  // Hard-set a page's scroll at t.
  PH.setScroll = (tl, name, s, t) => addSeg(tl, name, { t0: t, t1: t, s0: s, s1: s, fn: () => s });
  // Tweened scroll s0 → s1 over [t0, t0+dur].
  PH.scroll = function (tl, name, s0, s1, t0, dur, e) {
    const E = ease(e || "power2.inOut");
    addSeg(tl, name, { t0, t1: t0 + dur, s0, s1, fn: (t) => lerp(s0, s1, E(Math.min(1, Math.max(0, (t - t0) / dur)))) });
  };
  // Momentum flick: 8 f power2.in to 20 % of the distance, then 14 f expo.out (22 f total), velocity blur ≤ 2 pt.
  PH.flick = function (tl, name, s0, s1, t0) {
    const d = s1 - s0,
      a = 8 * F,
      b = 14 * F;
    const p2i = ease("power2.in"),
      eo = ease("expo.out");
    const fn = (t) => {
      const u = t - t0;
      if (u <= 0) return s0;
      if (u < a) return s0 + 0.2 * d * p2i(u / a);
      if (u < a + b) return s0 + 0.2 * d + 0.8 * d * eo((u - a) / b);
      return s1;
    };
    addSeg(tl, name, { t0, t1: t0 + a + b, s0, s1, fn }, true);
    return t0 + a + b;
  };
  // Safari push over 12 f cubic-bezier(.32,.72,0,1): incoming x 402→0 pt with a left-edge shadow; outgoing 0→−120 pt,
  // dimmed 0→20 %. The incoming page is set to scroll sTo at t0. Returns the end time.
  PH.push = function (tl, t0, from, to, sTo) {
    const A = page(from),
      B = page(to),
      d = 12 * F,
      E = "iosPush";
    if (sTo != null) PH.setScroll(tl, to, sTo, t0);
    tl.set(A.layer, { zIndex: 1 }, t0);
    tl.set(B.layer, { visibility: "visible", zIndex: 2, boxShadow: "-10px 0 28px rgba(10,30,70,0.18)" }, t0);
    tl.fromTo(B.layer, { x: 402 }, { x: 0, duration: d, ease: E, immediateRender: false }, t0);
    tl.fromTo(A.layer, { x: 0 }, { x: -120, duration: d, ease: E, immediateRender: false }, t0);
    tl.fromTo(A.dim, { opacity: 0 }, { opacity: 0.2, duration: d, ease: E, immediateRender: false }, t0);
    tl.set(A.layer, { visibility: "hidden", x: 0 }, t0 + d);
    tl.set(A.dim, { opacity: 0 }, t0 + d);
    tl.set(B.layer, { boxShadow: "none" }, t0 + d);
    PH._shows.push({ t: t0, page: to });
    PH._shows.sort((a, b) => a.t - b.t);
    return t0 + d;
  };

  // ------------------------------------------------------------ crops, taps, presses
  // A div showing the page-pt rect of a capture, sized in screen pt (w x h). Not attached unless o.parent is given.
  PH.crop = function (name, r, o) {
    o = o || {};
    r = rectOf(r);
    const el = PP.el("div", "ps-crop " + (o.cls || ""), o.parent || null);
    el.style.width = r.w + "px";
    el.style.height = r.h + "px";
    el.style.backgroundImage = `url('${PH.BASE + name}.png')`;
    el.style.backgroundSize = "402px auto";
    el.style.backgroundPosition = `${-r.x}px ${-r.y}px`;
    return el;
  };
  // Touch ring (no finger) at screen pt (X, Y): scale 0.4→1, opacity 0.6→0, 12 f power2.out. o.white for navy buttons.
  PH.tap = function (tl, t, X, Y, o) {
    o = o || {};
    const ring = PP.el("div", "ps-tapr" + (o.white ? " white" : ""), PH.ps);
    ring.style.left = X + "px";
    ring.style.top = Y + "px";
    tl.set(ring, { opacity: 0, scale: 0.4 }, 0);
    tl.fromTo(ring, { scale: 0.4, opacity: 0.6 }, { scale: 1, opacity: 0, duration: 12 * F, ease: "power2.out", immediateRender: false }, t);
    return ring;
  };
  // Pixel colour of a capture at page pt (x, y), or null while the image is not decoded (used by PH.press).
  const sampled = {};
  PH.sample = function (name, x, y) {
    const key = name + ":" + x + ":" + y;
    if (sampled[key]) return sampled[key];
    const img = page(name).img;
    if (!img.complete || !img.naturalWidth) return null;
    try {
      const k = img.naturalWidth / 402;
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      const g = c.getContext("2d");
      g.drawImage(img, Math.round(x * k), Math.round(y * k), 1, 1, 0, 0, 1, 1);
      const d = g.getImageData(0, 0, 1, 1).data;
      return (sampled[key] = `rgb(${d[0]},${d[1]},${d[2]})`);
    } catch (e) {
      return null;
    }
  };
  // Press: a sprite cropped from the page scales 0.97 over 3 f power2.out, then springs back over 6 f back.out(0.8).
  // A patch in the surrounding colour (sampled 3 pt left of the rect, or o.bg; rounded with o.radius) hides the
  // original edges. Pass o.radius = the control's corner radius in pt (e.g. 25 for the 50 pt pill buttons).
  // State changes belong at t + 2 f. Returns { sprite, patch }.
  PH.press = function (tl, t, name, r, o) {
    o = o || {};
    r = rectOf(r);
    const P = page(name);
    const rad = o.radius || 0;
    const patch = PP.el("div", "ps-press-patch", P.ov, { style: `left:${r.x - 0.5}px;top:${r.y - 0.5}px;width:${r.w + 1}px;height:${r.h + 1}px;border-radius:${rad + 0.5}px;opacity:0` });
    const sprite = PH.crop(name, r, { parent: P.ov, cls: "ps-press" });
    sprite.style.left = r.x + "px";
    sprite.style.top = r.y + "px";
    sprite.style.borderRadius = rad + "px";
    sprite.style.opacity = "0";
    const sx = o.sampleAt ? o.sampleAt[0] : Math.max(1, r.x - 3),
      sy = o.sampleAt ? o.sampleAt[1] : r.y + r.h / 2;
    PP.drive(tl, (v) => {
      if (!o.bg && v > 0) patch.style.background = PH.sample(name, sx, sy) || "#FFFFFF";
    }, 0, 1, t, 9 * F, "none");
    if (o.bg) patch.style.background = o.bg;
    tl.set([sprite, patch], { opacity: 0 }, 0);
    tl.set([sprite, patch], { opacity: 1 }, t);
    tl.fromTo(sprite, { scale: 1 }, { scale: 0.97, duration: 3 * F, ease: "power2.out", immediateRender: false }, t);
    tl.fromTo(sprite, { scale: 0.97 }, { scale: 1, duration: 6 * F, ease: "back.out(0.8)", immediateRender: false }, t + 3 * F);
    tl.set([sprite, patch], { opacity: 0 }, t + 9 * F);
    return { sprite, patch };
  };
  // Swap the nav of the page on screen at t (or o.on) to srcPage's nav (e.g. cart1: badge "1"), with a 1→1.3→1 pop
  // over 8 f on a 24x24 pt crop around the badge (page pt PH.BADGE = 329,70).
  PH.navBadge = function (tl, t, srcPage, o) {
    o = o || {};
    const on = page(o.on || PH.pageAt(t));
    const alt = on.navAlt;
    alt.style.backgroundImage = `url('${PH.BASE + srcPage}.png')`;
    const b = PH.BADGE;
    const pop = PH.crop(srcPage, { x: b.x - 12, y: b.y - 12, w: 24, h: 24 }, { parent: alt, cls: "ps-badge-pop" });
    pop.style.left = b.x - 12 + "px";
    pop.style.top = b.y - 12 - PH.NAV_Y + "px";
    tl.set(alt, { opacity: 0 }, 0);
    tl.set(alt, { opacity: 1 }, t);
    tl.fromTo(pop, { scale: 1 }, { scale: 1.3, duration: 3 * F, ease: "power2.out", immediateRender: false }, t);
    tl.fromTo(pop, { scale: 1.3 }, { scale: 1, duration: 5 * F, ease: "back.out(0.8)", immediateRender: false }, t + 3 * F);
    return { alt, pop };
  };
  // HTML ship bar over the captured one on `name` (page pt PH.BAR): fill fraction f0→f1 and colour c0→c1 over
  // [t0, t0+dur] (o.ease, default power3.out). Visible from t0 until o.until (if given). Returns { el, fill }.
  PH.barFill = function (tl, t0, dur, name, f0, f1, c0, c1, o) {
    o = o || {};
    const B = PH.BAR;
    const el = PP.el("div", "ps-bar", page(name).ov, { style: `left:${B.x}px;top:${B.y}px;width:${B.w}px;height:${B.h}px;border-radius:${B.r}px;background:${o.track || B.track}` });
    const fill = PP.el("div", "ps-bar-fill", el, { style: `border-radius:${B.r}px` });
    const ci = gsap.utils.interpolate(c0 || PP.C.siteTeal, c1 || c0 || PP.C.siteTeal);
    PP.drive(tl, (u) => {
      fill.style.width = (B.w * lerp(f0, f1, u)).toFixed(2) + "px";
      fill.style.background = ci(u);
    }, 0, 1, t0, dur, o.ease || "power3.out");
    tl.set(el, { opacity: 0 }, 0);
    tl.set(el, { opacity: 1 }, t0);
    if (o.until != null) tl.set(el, { opacity: 0 }, o.until);
    return { el, fill };
  };
})();
