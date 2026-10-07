// S02 · P0-E · the type-vial plate (SCENES §S02 "Motion inside the plate"). Canvas 2D, one pure function of time:
// TV.draw(T) paints absolute time T (s) — plate frame n = (T − 3.5)·30, f105 … f278. Rendered offline to
// assets/plates/typevial.mp4 by tools/render_typevial.sh; TV.density() feeds assets/typevial/density.json (SFX #4).
// Inputs: assets/typevial/silhouette.js (window.SIL, tools/trace_vial.py), sub/typevial/s01.js (window.S01 = S01's
// assets/s01/outline.json: the exact outline + clean "pure" of S01's OUT frame), js/vo.js + js/lib.js (VO.w), gsap eases.
// Every word-locked event reads VO.w(); nothing is hard-coded to a word time.
(function () {
  const SIL = window.SIL, S01 = window.S01, PP = window.PP, VO = window.VO;
  const F = 1 / 30;
  const T0 = 3.5; // plate frame 0 = f105
  const fr = (n) => n / 30; // absolute frame -> s
  const E = (name) => gsap.parseEase(name);
  const expoOut = E("expo.out"), expoInOut = E("expo.inOut"), back08 = E("back.out(0.8)"), p2out = E("power2.out"),
    p3inOut = E("power3.inOut"), p2in = E("power2.in");
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const C = { text: "#F3F6FA", soft: "#93A1B8", acc: "#2EE6C9", cap: "#3F7FE8", crimp: "#C3CBD6" };
  const ROW_FONT = 26, CAP_H = 0.727 * ROW_FONT; // Inter cap height
  const INSET = 7; // glyph ends sit 7 src px inside the glass edge

  // ------------------------------------------------------------------ timing (absolute s)
  const clampW = (t, lo, hi, l) => PP.clamp(t, lo, hi, "S02 plate " + l);
  const TW = clampW(VO.w("L02", 0), fr(105), fr(112), "We'd"); // "pure" unspools, the fill starts
  const TID = clampW(VO.w("L03", 0), fr(150), fr(250), "Identity");
  const TCONF = clampW(VO.w("L03", 1), TID + 6 * F, fr(250), "confirmed");
  const TPUR = clampW(VO.w("L04", 0), fr(170), fr(250), "Purity");
  const THPLC = clampW(VO.w("L04", "HPLC"), TPUR + 6 * F, fr(252), "HPLC");
  const ROW_STAGGER = 2 * F, GLYPH_STAGGER = 0.3 * F, FLY = 14 * F;
  const TCAP = fr(164), CAP_ROW = 1.5 * F, CAP_GLYPH = 0.15 * F, CAP_DUR = 8 * F;
  const BAND_T0 = fr(262), BAND_DUR = 16 * F; // light band: centre crosses the vial axis at f270 (HIT9)
  // Glass glint (polish): one slow specular line runs down the filled type between "confirmed" and "HPLC", so the
  // ~1.7 s between the light-ups never sits dead. Word-locked: starts 12 f after "confirmed", lands 4 f before "HPLC".
  const G0 = TCONF + 12 * F, G1 = THPLC - 4 * F, G_ON = G1 - G0 > 20 * F;
  const G_TILT = 0.45, G_W = 46, G_FROM = -260, G_TO = 1240; // q = y + tilt·(x − axis), src px
  const sineIO = E("sine.inOut");

  // ------------------------------------------------------------------ camera (SCENES §S02 Camera)
  // stage = s·src + t.  f105: s 0.957 about (960,540) (= S01).  f105–f232 linear, f232–f262 power-in to s 1.000 with the
  // clip push's velocity at f262 (C1 join).  f262→: the measured push of hero.mp4 (silhouette.json push, media time).
  const push = SIL.push;
  const S0 = SIL.stage_scale, CEN0 = SIL.stage_centre;
  const fit = push.slice(0, 7); // slope of s over media 0.50–0.75 s
  const mx = fit.reduce((a, p) => a + p.media, 0) / fit.length, my = fit.reduce((a, p) => a + p.s, 0) / fit.length;
  const slope = fit.reduce((a, p) => a + (p.media - mx) * (p.s - my), 0) / fit.reduce((a, p) => a + (p.media - mx) ** 2, 0); // ds per media s
  const V_PUSH = slope / 30; // per frame (media runs at real time from f262)
  const far = push.slice(6);
  const CEN1 = [far.reduce((a, p) => a + p.tx / (1 - p.s), 0) / far.length, far.reduce((a, p) => a + p.ty / (1 - p.s), 0) / far.length];
  const V_LIN = 0.00008; // slow drift f105–f232 (+1 %): the plate never sits dead
  const S232 = S0 + V_LIN * (232 - 105), D = 30, DEL = 1 - S232;
  const NPOW = ((V_PUSH - V_LIN) * D) / (DEL - V_LIN * D); // power-in exponent that lands on the push velocity
  function sAt(f) {
    if (f <= 105) return S0;
    if (f <= 232) return S0 + V_LIN * (f - 105);
    const u = clamp01((f - 232) / D);
    return S232 + V_LIN * D * u + (DEL - V_LIN * D) * Math.pow(u, NPOW);
  }
  function cam(T) {
    const f = T * 30;
    if (f >= 262) {
      const m = 0.5 + (T - BAND_T0); // media time of v-hero (starts at media 0.50 on f262)
      const k = Math.max(0, Math.min(push.length - 1.0001, m * 24 - 12));
      const a = push[Math.floor(k)], b = push[Math.floor(k) + 1], w = k - Math.floor(k);
      return { s: lerp(a.s, b.s, w), tx: lerp(a.tx, b.tx, w), ty: lerp(a.ty, b.ty, w) };
    }
    const s = sAt(f), q = (s - S0) / (1 - S0);
    const cx = lerp(CEN0[0], CEN1[0], q), cy = lerp(CEN0[1], CEN1[1], q);
    return { s, tx: (1 - s) * cx, ty: (1 - s) * cy };
  }
  const toStage = (c, x, y) => [c.s * x + c.tx, c.s * y + c.ty];
  const fromStage0 = (x, y) => [CEN0[0] + (x - CEN0[0]) / S0, CEN0[1] + (y - CEN0[1]) / S0];

  // light band / hero mask edge (shared with js/scenes/S02.js: same constants, same ease)
  const AXIS = SIL.axis_src;
  const BAND_HALF = 300; // = data-cfg half in html/S02.html (tools/s02_build.py)
  const bandX = (T) => AXIS - BAND_HALF + 2 * BAND_HALF * expoInOut(clamp01((T - BAND_T0) / BAND_DUR));
  const maskEdge = (T) => bandX(T) - 20; // hero opaque left of X, transparent from X+40

  // ------------------------------------------------------------------ layout
  const ROWTEXT = {
    cap: ["PUREPEPTIDE"],
    crimp: ["PUREPEPTIDE"],
    neck: [["SIX COMPOUNDS"], ["ONE STANDARD"]],
    shoulder: ["RESEARCH USE ONLY ·", "RESEARCH USE ONLY"],
    glass: ["RESEARCH USE ONLY ·", "RESEARCH USE ONLY"],
  };
  const LABEL = ["@symbol", "@wordmark", "IDENTITY", "CONFIRMED", "PURITY MEASURED", "BY HPLC", "99% MINIMUM", "EVERY BATCH",
    "INDEPENDENTLY", "TESTED", "JANOSHIK ANALYTICAL", "SHIPPED COLD", "WITHIN 24 HOURS", "TO 10 COUNTRIES"];
  const COLOR = { cap: C.cap, crimp: C.crimp, neck: C.soft, shoulder: C.soft, glass: C.soft, label: C.text };

  let rows = [], glyphs = [], letters = [], stripes = [], checks = [], IMG = {};
  let ctx, cv;

  function layout() {
    ctx.font = `600 ${ROW_FONT}px Inter`;
    ctx.letterSpacing = "0px";
    let neckI = 0, labI = 0;
    SIL.rows.forEach((r) => {
      if (r.zone === "label_edge") return;
      let text;
      if (r.zone === "label") text = LABEL[labI++];
      else if (r.zone === "neck") text = ROWTEXT.neck[Math.min(neckI++, 1)][0];
      else {
        const W = r.x1 - r.x0 - 2 * INSET;
        text = ROWTEXT[r.zone].find((t) => ctx.measureText(t).width <= W * 0.97) || ROWTEXT[r.zone][ROWTEXT[r.zone].length - 1];
      }
      rows.push({ y: r.y, yc: r.yc, x0: r.x0 + INSET, x1: r.x1 - INSET, zone: r.zone, text, color: COLOR[r.zone], lit: null });
    });
    // fill order: bottom-up, cap rows last (their own pass)
    const fill = rows.filter((r) => r.zone !== "cap").sort((a, b) => b.y - a.y);
    const caps = rows.filter((r) => r.zone === "cap").sort((a, b) => b.y - a.y);
    const base = (r) => r.yc + CAP_H / 2;
    const R = PP.rng(202);
    fill.forEach((r, k) => {
      r.k = k;
      r.t0 = TW + k * ROW_STAGGER;
      const emit = k % 4;
      if (r.text[0] === "@") {
        const isSym = r.text === "@symbol";
        const h = isSym ? 29 : 300 * (62 / 611), w = isSym ? 29 * (405 / 456) : 300;
        glyphs.push({ img: r.text.slice(1), x: (r.x0 + r.x1) / 2 - w / 2, y: r.yc - h / 2, w, h, row: r, t0: r.t0, emit, rot: (R() - 0.5) * 30, arc: R(), ox: 0 });
        return;
      }
      const chars = [...r.text];
      const ws = chars.map((c) => ctx.measureText(c).width);
      const nat = ws.reduce((a, b) => a + b, 0);
      const track = (r.x1 - r.x0 - nat) / (chars.length - 1);
      let x = r.x0, j = 0;
      chars.forEach((c, i) => {
        if (c !== " ") glyphs.push({ ch: c, x, y: base(r), w: ws[i], row: r, t0: r.t0 + j++ * GLYPH_STAGGER, emit, rot: (R() - 0.5) * 50, arc: R(), ox: (R() - 0.5) * 60 });
        x += ws[i] + track;
      });
      r.track = track;
    });
    caps.forEach((r, k) => {
      r.k = 100 + k;
      r.t0 = TCAP + k * CAP_ROW;
      const chars = [...r.text];
      const ws = chars.map((c) => ctx.measureText(c).width);
      const nat = ws.reduce((a, b) => a + b, 0);
      const track = (r.x1 - r.x0 - nat) / (chars.length - 1);
      let x = r.x0;
      chars.forEach((c, i) => {
        glyphs.push({ ch: c, x, y: base(r), w: ws[i], row: r, t0: r.t0 + i * CAP_GLYPH, cap: true, rot: 0, arc: R(), ox: 0 });
        x += ws[i] + track;
      });
    });
    // label stripes: drawn from the axis outward when the neighbouring label row lands
    const labRows = rows.filter((r) => r.zone === "label");
    const top = labRows[0], bot = labRows[labRows.length - 1];
    SIL.stripes_src.forEach((y, i) => {
      const r = i === 0 ? top : bot;
      stripes.push({ y, x0: r.x0 - INSET + 3, x1: r.x1 + INSET - 3, t0: r.t0 + 6 * F });
    });
    // light-ups (rows 3–6 of the label) and ✓ marks
    const lab = (i) => labRows[i];
    lab(2).lit = TID; lab(3).lit = TID;
    lab(4).lit = TPUR; lab(5).lit = THPLC;
    checks.push({ row: lab(3), t0: TCONF }, { row: lab(5), t0: THPLC + 4 * F });

    // "pure": S01's exact OUT frame (stage px), split into letters
    const P = S01.pure;
    ctx.font = `800 ${P.size}px "DM Sans"`;
    ctx.letterSpacing = P.letter_spacing_px + "px";
    const word = "pure";
    let acc = P.x;
    [...word].forEach((c, i) => {
      const w = ctx.measureText(c).width; // includes the letter-spacing, like SVG
      letters.push({ ch: c, x: acc, w, total: 0, emitted: [] });
      acc += w;
    });
    ctx.letterSpacing = "0px";
    glyphs.forEach((g) => {
      if (g.emit !== undefined) letters[g.emit].emitted.push(g.t0);
    });
    letters.forEach((L) => (L.total = L.emitted.length));
  }

  // "pure" rises from the label to the shoulder and shrinks while it unspools (stage px)
  const P_RISE = 22 * F;
  function pureState(T) {
    const P = S01.pure;
    const u = p3inOut(clamp01((T - TW) / P_RISE));
    const cx = (P.ink_x[0] + P.ink_x[1]) / 2;
    const c0 = cam(T);
    const dy = toStage(c0, 0, 372)[1] - (P.baseline - 0.36 * P.size); // x-height centre → shoulder (src y 372)
    return { u, cx, dy: dy * u, sc: 1 - 0.42 * u, spread: 1 + 0.18 * u };
  }

  // ------------------------------------------------------------------ drawing
  function bez(a, c, b, e) {
    const m = 1 - e;
    return [m * m * a[0] + 2 * m * e * c[0] + e * e * b[0], m * m * a[1] + 2 * m * e * c[1] + e * e * b[1]];
  }
  function mixHex(a, b, t) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const A = p(a), B = p(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
  }
  function rgbOf(c) {
    if (c[0] === "#") return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    return c.match(/\d+/g).slice(0, 3).map(Number);
  }
  const towardWhite = (c, k) => `rgb(${rgbOf(c).map((v) => Math.round(v + (255 - v) * k)).join(",")})`;
  // glint strength at a src point (0…1)
  function glintAt(T, x, y) {
    if (!G_ON || T <= G0 || T >= G1) return 0;
    const qc = lerp(G_FROM, G_TO, sineIO((T - G0) / (G1 - G0)));
    const d = (y + G_TILT * (x - AXIS) - qc) / G_W;
    return Math.exp(-d * d);
  }
  function litState(r, T) {
    if (r.lit == null || T < r.lit) return null;
    const a = (T - r.lit) / (4 * F);
    if (a < 1) return { col: mixHex(r.color, "#FFFFFF", a), glow: 0.54 * a, sc: 1 + 0.04 * expoOut(clamp01((T - r.lit) / (6 * F))) };
    const b = clamp01((T - r.lit - 4 * F) / (8 * F));
    const e = p2out(b);
    return { col: mixHex("#FFFFFF", C.acc, e), glow: lerp(0.54, 0.45, e), sc: 1 + 0.04 * expoOut(clamp01((T - r.lit) / (6 * F))) };
  }

  function drawOutline(T, c, fillY) {
    // S01's outline (stage at f105) → src → current camera; above the liquid level it stays at full strength
    const f = T * 30;
    let base = 1;
    if (f > 236) base = 1 - clamp01((f - 236) / 22);
    const lo = 0.2 * base;
    if (base <= 0) return;
    const path = new Path2D();
    [S01.path_left, S01.path_right].forEach((d) => {
      const pts = d.replace(/[ML]/g, " ").trim().split(/\s+/).map((p) => p.split(",").map(Number));
      pts.forEach(([x, y], i) => {
        const s = fromStage0(x, y), q = toStage(c, s[0], s[1]);
        i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1]);
      });
    });
    ctx.save();
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = C.soft;
    // full above the fill level, faint below (the vessel is filled)
    const yL = toStage(c, 0, fillY)[1];
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 1920, yL);
    ctx.clip();
    ctx.globalAlpha = f <= 176 ? base : lerp(1, lo / Math.max(base, 1e-6), clamp01((f - 170) / 14)) * base;
    ctx.stroke(path);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, yL, 1920, 1080 - yL);
    ctx.clip();
    ctx.globalAlpha = lo;
    ctx.stroke(path);
    ctx.restore();
    ctx.restore();
  }

  function draw(T) {
    const c = cam(T);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 1920, 1080);

    // liquid level (src y of the top-most row that has started landing)
    let fillY = 1000;
    rows.forEach((r) => {
      if (T >= r.t0 + 4 * F) fillY = Math.min(fillY, r.y);
    });
    if (T < TW) fillY = 1000;
    drawOutline(T, c, fillY);

    // stripes
    stripes.forEach((s) => {
      const e = expoOut(clamp01((T - s.t0) / (12 * F)));
      if (e <= 0) return;
      const xm = (s.x0 + s.x1) / 2, hw = ((s.x1 - s.x0) / 2) * e;
      const a = toStage(c, xm - hw, s.y - 1.5), b = toStage(c, xm + hw, s.y + 1.5);
      ctx.fillStyle = C.cap;
      ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      // the glint crosses the rule: a short specular hot-spot where the glint line meets it
      if (G_ON && T > G0 && T < G1) {
        const qc = lerp(G_FROM, G_TO, sineIO((T - G0) / (G1 - G0)));
        const gxs = AXIS + (qc - s.y) / G_TILT;
        const hx = toStage(c, gxs, s.y)[0], hw2 = G_W * 1.6 * c.s;
        const lo = Math.max(a[0], hx - hw2), hi = Math.min(b[0], hx + hw2);
        if (hi > lo) {
          const gr = ctx.createLinearGradient(hx - hw2, 0, hx + hw2, 0);
          gr.addColorStop(0, "rgba(255,255,255,0)");
          gr.addColorStop(0.5, "rgba(255,255,255,0.75)");
          gr.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = gr;
          ctx.fillRect(lo, a[1], hi - lo, b[1] - a[1]);
        }
      }
    });

    // band slip (f262–f278): glyphs at the band edge slip 4 px down as the real glass takes over
    // Exact-frame lock with the hero mask: the renderer maps stage frame n to plate frame floor(n − 105 + 1e-9) and hero
    // frame floor((0.5 + n/30 − 8.733)·24 + 1e-9), so plate and hero agree to the frame. (`hyperframes snapshot` seeks
    // <video> in Chrome and shows the plate ~1 f early: a black slab at f270 in snapshots is that artifact, not the render.)
    const X = T >= BAND_T0 ? maskEdge(T) : -1e9;

    // glyphs
    const ps = pureState(T);
    const P = S01.pure;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    let curFont = "";
    for (const g of glyphs) {
      if (T < g.t0) continue;
      const r = g.row;
      const dur = g.cap ? CAP_DUR : FLY;
      const p = clamp01((T - g.t0) / dur);
      const L = litState(r, T);
      const rowSc = L ? L.sc : 1;
      // slot (src), with the lit-row scale about the row centre
      const ax = (r.x0 + r.x1) / 2;
      const sx = ax + (g.x - ax) * rowSc, sy = r.yc + (g.y - r.yc) * rowSc;
      let pos, sc, alpha, blur = 0, rot = 0;
      const slot = toStage(c, sx, sy);
      if (g.cap) {
        const e = back08(p);
        pos = [slot[0], slot[1] - 34 * c.s * (1 - e)];
        sc = c.s * rowSc;
        alpha = clamp01(p * 4);
      } else {
        const e = expoOut(p);
        // emitter: the centre of its "pure" letter at launch (stage)
        const Lt = letters[g.emit];
        const pp = pureState(g.t0);
        const lx = ps.cx + (Lt.x + Lt.w / 2 - ps.cx) * pp.sc * pp.spread;
        const ly = P.baseline - 0.36 * P.size + pp.dy;
        const gw = (g.img ? g.w : g.w) * c.s;
        const start = [lx - gw / 2, ly + (g.img ? -g.h * c.s / 2 : CAP_H * c.s / 2)];
        const ctrl = [lerp(start[0], slot[0], 0.62) + g.ox, Math.min(start[1], slot[1]) - (70 + 90 * g.arc)];
        pos = bez(start, ctrl, slot, e);
        sc = c.s * rowSc * (1 + 0.7 * (1 - e));
        alpha = clamp01(p * 6);
        blur = 6 * (1 - e);
        rot = (g.rot * (1 - e) * Math.PI) / 180;
      }
      let flare = 0;
      if (X > -1e8) {
        // band slip: within 40 px ahead of the hero's feather a glyph slips 4 px down and dissolves, so no type
        // survives past the real glass edge (the lit rows overhang it by their 1.04 scale)
        const gx = pos[0] + (g.w || 0) * sc;
        const d = clamp01((X + 80 - gx) / 40);
        pos = [pos[0], pos[1] + 4 * p2in(d)];
        alpha *= 1 - p2in(d);
        // polish: the light catches each glyph just before it sets into the glass (flares toward white over the
        // last 140 px ahead of the hero edge), so the wipe reads as light passing through type, not a hard matte
        flare = 0.7 * Math.pow(clamp01(1 - (gx - (X + 60)) / 140), 2);
      }
      if (!g.img && p >= 1) flare = Math.max(flare, 0.6 * glintAt(T, g.x + (g.w || 0) / 2, r.yc));
      ctx.globalAlpha = alpha;
      ctx.filter = blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : "none";
      if (g.img) {
        ctx.setTransform(sc * Math.cos(rot), sc * Math.sin(rot), -sc * Math.sin(rot), sc * Math.cos(rot), pos[0], pos[1]);
        ctx.drawImage(IMG[g.img], 0, 0, g.w, g.h);
        continue;
      }
      ctx.setTransform(sc * Math.cos(rot), sc * Math.sin(rot), -sc * Math.sin(rot), sc * Math.cos(rot), pos[0], pos[1]);
      const font = `600 ${ROW_FONT}px Inter`;
      if (font !== curFont) (ctx.font = font), (curFont = font);
      if (L && p >= 1) {
        ctx.shadowColor = `rgba(46,230,201,${Math.min(0.75, L.glow + 0.3 * flare).toFixed(3)})`;
        ctx.shadowBlur = 18 * c.s;
        ctx.fillStyle = flare > 0.004 ? towardWhite(L.col, flare) : L.col;
      } else if (flare > 0.004) {
        ctx.shadowColor = `rgba(220,235,255,${(0.5 * flare).toFixed(3)})`;
        ctx.shadowBlur = 12 * c.s;
        ctx.fillStyle = towardWhite(r.color, flare);
      } else {
        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";
        ctx.fillStyle = r.color;
      }
      ctx.fillText(g.ch, 0, 0);
    }
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.filter = "none";
    ctx.globalAlpha = 1;

    // ✓ marks at the row end (in the margin, just outside the glass)
    checks.forEach((k) => {
      const p = clamp01((T - k.t0) / (8 * F));
      // the margin ticks seal before the real glass arrives (they sit outside the vial, past the hero mask edge)
      const out = 1 - p2in(clamp01((T - fr(264)) / (6 * F)));
      if (p <= 0 || out <= 0) return;
      const e = p2out(p);
      const r = k.row, L = litState(r, T), rs = L ? L.sc : 1;
      const ax = (r.x0 + r.x1) / 2;
      const x = ax + (r.x1 + INSET - ax) * rs + 14, y = r.yc;
      const S = 34 / 44;
      const pts = [[13.5, 22.5], [19.5, 28.5], [31, 16]].map(([px, py]) => toStage(c, x + (px - 8) * S, y + (py - 22) * S));
      const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
      let len = (l1 + l2) * e;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      if (len <= l1) {
        const t = len / l1;
        ctx.lineTo(lerp(pts[0][0], pts[1][0], t), lerp(pts[0][1], pts[1][1], t));
      } else {
        ctx.lineTo(pts[1][0], pts[1][1]);
        const t = (len - l1) / l2;
        ctx.lineTo(lerp(pts[1][0], pts[2][0], t), lerp(pts[1][1], pts[2][1], t));
      }
      ctx.lineWidth = 3.4 * c.s;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = C.acc;
      ctx.globalAlpha = out;
      ctx.shadowColor = "rgba(46,230,201,.45)";
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    });

    // "pure" — S01's frame exactly until "We'd", then it rises, shrinks and unspools letter by letter
    if (T < TW) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.font = `800 ${P.size}px "DM Sans"`;
      ctx.letterSpacing = P.letter_spacing_px + "px";
      ctx.fillStyle = P.fill;
      ctx.fillText("pure", P.x, P.baseline);
      ctx.letterSpacing = "0px";
    } else {
      ctx.font = `800 ${P.size}px "DM Sans"`;
      ctx.fillStyle = P.fill;
      letters.forEach((Lt) => {
        const n = Lt.emitted.filter((t) => t <= T).length;
        const fr_ = Lt.total ? n / Lt.total : 1;
        const a = 1 - clamp01((fr_ - 0.15) / 0.85);
        if (a <= 0.003) return;
        const lsc = ps.sc * (1 - 0.3 * fr_);
        const lx = ps.cx + (Lt.x + Lt.w / 2 - ps.cx) * ps.sc * ps.spread;
        const ly = P.baseline - 0.36 * P.size + ps.dy;
        const cw = ctx.measureText(Lt.ch).width;
        ctx.globalAlpha = a;
        ctx.setTransform(lsc, 0, 0, lsc, lx, ly);
        ctx.fillText(Lt.ch, -cw / 2, 0.36 * P.size);
      });
      ctx.globalAlpha = 1;
    }
  }

  function density() {
    const n = 174, counts = new Array(n).fill(0), xs = new Array(n).fill(0);
    glyphs.forEach((g) => {
      const land = g.t0 + (g.cap ? 0.45 * CAP_DUR : 0.25 * FLY); // expo.out reaches ~97 % at p .25; back.out seats at ~.45
      const k = Math.round((land - T0) * 30);
      if (k >= 0 && k < n) {
        counts[k]++;
        xs[k] += cam(land).s * (g.x + (g.w || 0) / 2) + cam(land).tx;
      }
    });
    return { f0: 0, frame0_abs: 105, fps: 30, counts, x: xs.map((v, i) => (counts[i] ? +(v / counts[i]).toFixed(1) : null)),
      events: { cap_snap: +(TCAP + 2 * CAP_ROW + 10 * CAP_GLYPH + 0.45 * CAP_DUR).toFixed(3), lit: [TID, TPUR, THPLC], checks: [TCONF, THPLC + 4 * F] } };
  }

  async function init(canvas) {
    cv = canvas;
    ctx = cv.getContext("2d");
    const load = (k, src) =>
      new Promise((res) => {
        const im = new Image();
        im.onload = () => res((IMG[k] = im));
        im.onerror = () => res((IMG[k] = im));
        im.src = src;
      });
    await Promise.all([
      document.fonts.load(`600 ${ROW_FONT}px Inter`),
      document.fonts.load(`800 150px "DM Sans"`),
      load("symbol", "assets/brand/brand-symbol-neon.svg"),
      load("wordmark", "assets/brand/brand-wordmark-light.svg"),
    ]);
    layout();
  }

  window.TV = { init, draw, density, cam, bandX, maskEdge, BAND_T0, BAND_DUR, rows: () => rows, glyphs: () => glyphs,
    info: () => ({ V_PUSH, NPOW, CEN1, S232, TW, TID, TCONF, TPUR, THPLC }) };
})();
