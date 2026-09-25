// s4o — TEST overlays + OFFER (clip 30.90 → 47.60, ENGLISH), ABOVE the stage-level #sitetest video (31.40 → 45.60).
// Window edge light + corner masks and click ripples / highlights locked to the s4 camera (PP.s4cam); header
// « CHECK IT YOURSELF. » + step labels + progress; « For laboratory research use only » tag; VO keyword lower thirds
// (L12 · L13 · L14); OFFER: « 2 VIALS · 5% OFF » (43.36) and « 3+ VIALS · 8% OFF » (45.48) build as big cards over
// the dimmed site, the window recedes (45.30 → 45.58) and the cards settle into a clean full-frame panel with
// « OVER $200 · FREE SHIPPING » (pop 46.20) + « Applied automatically in the cart. »; exit whoosh 47.30, gone 47.55.
PP.scene("s4o", function (tl, root, cam) {
  const F = PP.F;
  const C = PP.s4cam;
  const T = { IN: 31.4, REC: 45.3, PANEL: 45.6, EXIT: 47.3 };

  // text width from canvas (the clip may be hidden while the timeline is built)
  const ctx = document.createElement("canvas").getContext("2d");
  const textW = (font, s, ls) => {
    ctx.font = font;
    return ctx.measureText(s).width + (ls || 0) * s.length;
  };
  const wordIn = (w, at, o) => PP.wordIn(tl, w, at, o);
  const out = (els, at, o) => {
    o = o || {};
    tl.fromTo(els, { opacity: 1, y: 0, filter: "blur(0px)" }, { opacity: 0, y: o.y == null ? -18 : o.y, filter: `blur(${o.blur == null ? 6 : o.blur}px)`, duration: o.d || 0.18, ease: "power2.in", stagger: o.stagger || 0, immediateRender: false }, at);
  };
  const fade = (el, a, b, at, d, ease) => tl.fromTo(el, { opacity: a }, { opacity: b, duration: d, ease: ease || "power2.out", immediateRender: false }, at);
  // words: [[text, isGradient], …] → spans inside `parent`
  const words = (parent, list) =>
    list.map(([txt, g], i) => {
      if (i) parent.appendChild(document.createTextNode(" "));
      return PP.el("span", "pp-w" + (g ? " grad" : ""), parent, { text: txt });
    });

  // ================================================================ window edge light + bottom corner masks (camera-locked)
  if (C) {
    const edge = PP.el("div", "s4o-edge", cam);
    edge.style.width = C.VW + "px";
    edge.style.height = C.VH + C.TBU + "px";
    edge.style.borderRadius = C.RAD + "px";
    const ring = PP.el("div", "s4o-edge-ring", edge);
    ring.style.borderRadius = C.RAD + "px";
    const r = C.RAD;
    const mk = (cls, left, pos) => {
      const m = PP.el("div", "s4o-corner " + cls, edge);
      m.style.cssText += `width:${r + 2}px;height:${r + 2}px;left:${left}px;top:${C.TBU + C.VH - r}px;background:radial-gradient(circle at ${pos}, rgba(2,3,5,0) ${r - 0.8}px, #020305 ${r + 0.2}px);`;
    };
    mk("bl", -2, `${r + 2}px 0px`);
    mk("br", C.VW - r, `0px 0px`);
    PP.drive(
      tl,
      (t) => {
        const st = C.state(t);
        edge.style.transform = C.tf(st);
        edge.style.opacity = st.op;
      },
      30.9,
      47.6,
      30.9,
      16.7,
      "none"
    );
  }

  // ================================================================ click ripples (cursor tips template-matched in the English recording, video px)
  const CLICKS = [
    [32.4, 694, 615], // « I am at least 21 years of age. »
    [33.0, 694, 717], // researcher confirmation
    [33.667, 958, 839], // « Enter PurePeptide »
    [35.5, 381, 847], // « Explore the catalog »
    [38.033, 280, 410], // BPC-157 / TB-500 card
    [42.067, 1390, 701], // « Add to cart · $84.99 »
    [43.167, 1797, 1140], // floating « Cart »
  ];
  if (C)
    CLICKS.forEach(([tc, vx, vy]) => {
      const rp = PP.el("div", "s4o-ripple", cam);
      const dot = PP.el("div", "s4o-ripple-dot", cam);
      const D = 0.6;
      PP.drive(
        tl,
        (v) => {
          if (v <= 0 || v >= 1) {
            rp.style.opacity = "0";
            dot.style.opacity = "0";
            return;
          }
          const p = C.pt(tc + v * D, vx, vy);
          const e = 1 - Math.pow(1 - v, 3);
          const d = (26 + 130 * e) * (p.k / C.K0);
          rp.style.width = rp.style.height = d + "px";
          rp.style.left = p.x - d / 2 + "px";
          rp.style.top = p.y - d / 2 + "px";
          rp.style.borderWidth = 5 - 3 * e + "px";
          rp.style.opacity = String(0.95 * (1 - v));
          const dd = 30 * (p.k / C.K0) * (1 - 0.4 * v);
          dot.style.width = dot.style.height = dd + "px";
          dot.style.left = p.x - dd / 2 + "px";
          dot.style.top = p.y - dd / 2 + "px";
          dot.style.opacity = String(v < 0.35 ? 0.55 : 0.55 * (1 - (v - 0.35) / 0.65));
        },
        0,
        1,
        tc,
        D,
        "none"
      );
    });

  // ================================================================ camera-locked highlights on the recording (video px rects)
  // drawn on left → right; the page is dimmed by the cart drawer from 43.20, so both are gone by then
  const camBox = (R, on, off, draw) => {
    const hb = PP.el("div", "s4o-perk", cam);
    PP.drive(
      tl,
      (t) => {
        if (t <= on || t >= off) {
          hb.style.opacity = "0";
          return;
        }
        const st = C.state(t);
        hb.style.left = st.X + R[0] * st.k + "px";
        hb.style.top = st.Y + R[1] * st.k + "px";
        hb.style.width = R[2] * st.k + "px";
        hb.style.height = R[3] * st.k + "px";
        hb.style.opacity = (Math.min(1, (t - on) / 0.1) * Math.min(1, (off - t) / 0.08)).toFixed(3);
        hb.style.clipPath = `inset(-8px ${(100 * (1 - Math.min(1, (t - on) / draw))).toFixed(1)}% -8px -8px round 14px)`;
      },
      on - 0.1,
      off + 0.1,
      on - 0.1,
      off - on + 0.2,
      "none"
    );
  };
  if (C) {
    camBox([1024, 1108, 618, 80], 42.22, 43.19, 0.32); // « Ships within 24 h · … · Free shipping over $200 »
    camBox([1228, 467, 208, 101], 42.8, 43.19, 0.16); // bundle « 2 VIALS −5% » (VO « Two vials » 42.80)
  }

  // ================================================================ lower thirds (VO keywords)
  const scrimBR = PP.el("div", "s4o-scrim br", cam);
  const scrimBL = PP.el("div", "s4o-scrim bl", cam);
  const big = { rise: 40, blur: 10, dur: 0.45 };
  const kick = { rise: 12, blur: 4 };

  // L12 « Pick your compound. » (36.20 · 36.32 · 36.44) — bottom right (the focused card is on the left)
  const lt12 = PP.el("div", "s4o-lt right", cam);
  const k12 = words(PP.el("div", "s4o-kick", lt12), [["Pick"], ["your"]]);
  const b12 = words(PP.el("div", "s4o-big mf", lt12), [["compound.", true]]);
  wordIn(k12[0], 36.2 - 0.06, kick);
  wordIn(k12[1], 36.32 - 0.06, kick);
  wordIn(b12[0], 36.44 - 0.05, big);
  fade(scrimBR, 0, 1, 36.1, 0.3);
  out(Array.from(lt12.children), 38.72, { stagger: 0.03 });
  fade(scrimBR, 1, 0, 38.76, 0.3, "power2.in");

  // L13 « See the purity. Verified. » (39.20 · 39.32 · 39.42 · 39.72) — bottom left (purity line is upper right)
  const lt13 = PP.el("div", "s4o-lt left", cam);
  const k13 = words(PP.el("div", "s4o-kick", lt13), [["See"], ["the"], ["purity."]]);
  const b13 = words(PP.el("div", "s4o-big mf", lt13), [["Verified.", true]]);
  wordIn(k13[0], 39.2 - 0.06, kick);
  wordIn(k13[1], 39.32 - 0.06, kick);
  wordIn(k13[2], 39.42 - 0.06, kick);
  wordIn(b13[0], 39.72 - 0.05, big);
  fade(scrimBL, 0, 1, 39.1, 0.3);
  out(Array.from(lt13.children), 41.76, { stagger: 0.03 });

  // L14 « Order. » (42.00) — bottom left, hands over to the offer cards (L15, 42.80)
  const lt14 = PP.el("div", "s4o-lt left", cam);
  const b14 = words(PP.el("div", "s4o-big mf", lt14), [["Order.", true]]);
  wordIn(b14[0], 42.0 - 0.05, big);
  out(Array.from(lt14.children), 42.68, { y: -24 });
  fade(scrimBL, 1, 0, 42.62, 0.3, "power2.in");

  // ================================================================ header: « CHECK IT YOURSELF. » + step label + progress
  const hdr = PP.el("div", "s4o-hdr", cam);
  const plate = PP.el("div", "s4o-plate", hdr);
  const row = PP.el("div", "s4o-row", hdr);
  const lab = PP.el("div", "s4o-lab mf", row);
  const labL = [PP.el("span", "grad", lab, { text: "Check it" }), PP.el("span", "grad", lab, { text: "yourself." })];
  const sep = PP.el("div", "s4o-sep", row);
  const stack = PP.el("div", "s4o-stack", row);
  const STEPS = [
    { t: 31.5, end: 35.4, n: "01", w: "Enter" },
    { t: 35.5, end: 38.9, n: "02", w: "Pick" },
    { t: 39.0, end: 41.9, n: "03", w: "Verify" },
    { t: 42.0, end: 45.5, n: "04", w: "Order" },
  ];
  const labs = STEPS.map((s) => {
    const l = PP.el("div", "s4o-step mf", stack);
    PP.el("span", "neon", l, { text: s.n });
    PP.el("span", "s4o-dot", l, { text: " · " });
    PP.el("span", "", l, { text: s.w });
    return l;
  });
  stack.style.width = Math.ceil(Math.max(...STEPS.map((s) => textW('400 64px "Anton"', `${s.n} · ${s.w}`.toUpperCase(), 0.32)))) + 4 + "px";
  const meta = PP.el("div", "s4o-meta", hdr);
  const bars = PP.el("div", "s4o-bars", meta);
  const fills = STEPS.map(() => PP.el("i", "", PP.el("b", "", bars)));
  const ctr = PP.el("div", "s4o-ctr mono", row);
  const ctrs = STEPS.map((s, i) => PP.el("span", "", ctr, { text: `Step ${i + 1}/4` }));

  STEPS.forEach((s, i) => {
    gsap.set([labs[i], ctrs[i]], { opacity: 0 });
    tl.fromTo(labs[i], { opacity: 0, y: 26, filter: "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.32, ease: "expo.out", immediateRender: false }, s.t);
    tl.fromTo(ctrs[i], { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "none", immediateRender: false }, s.t);
    if (i < STEPS.length - 1) {
      tl.fromTo(labs[i], { opacity: 1, y: 0 }, { opacity: 0, y: -22, duration: 0.1, ease: "power2.in", immediateRender: false }, STEPS[i + 1].t - 0.1);
      tl.fromTo(ctrs[i], { opacity: 1 }, { opacity: 0, duration: 0.06, ease: "none", immediateRender: false }, STEPS[i + 1].t - 0.06);
    }
    tl.fromTo(fills[i], { scaleX: 0 }, { scaleX: 1, duration: s.end - s.t, ease: "none", immediateRender: false }, s.t);
  });
  gsap.set(fills, { scaleX: 0, transformOrigin: "0% 50%" });
  gsap.set([plate, meta], { opacity: 0 });
  // nothing of the header exists before the window flies in (s3 owns the frame until 31.39)
  gsap.set(hdr, { opacity: 0 });
  tl.fromTo(hdr, { opacity: 0 }, { opacity: 1, duration: 0.001, ease: "none", immediateRender: false }, T.IN);
  gsap.set(sep, { opacity: 0 });
  fade(sep, 0, 1, 31.5, 0.25);
  fade(plate, 0, 1, 31.42, 0.3);
  PP.wordsIn(tl, labL, 31.44, { stagger: 0.07, rise: 16, blur: 6, dur: 0.4 });
  tl.fromTo(meta, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", immediateRender: false }, 31.6);

  // research-use tag (third header row) during the demo
  const rtag = PP.el("div", "s4o-rtag", hdr);
  PP.el("i", "", rtag);
  PP.el("span", "", rtag, { text: "For laboratory research use only" });
  gsap.set(rtag, { opacity: 0 });
  tl.fromTo(rtag, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", immediateRender: false }, 31.72);
  // header leaves as the window recedes
  tl.fromTo(hdr, { opacity: 1, y: 0 }, { opacity: 0, y: -40, duration: 0.2, ease: "power2.in", immediateRender: false }, T.REC + 0.04);

  // ================================================================ OFFER — cards over the dimmed site → full-frame panel
  const off = PP.el("div", "s4o-offer", cam);
  const scrimL = PP.el("div", "s4o-scrim l", off);
  const offIn = PP.el("div", "s4o-offer-in", off); // panel content (slow living push from 45.60)
  const glow = PP.el("div", "s4o-oglow", offIn);
  gsap.set([scrimL, glow], { opacity: 0 });
  fade(scrimL, 0, 1, 42.66, 0.4);
  fade(scrimL, 1, 0, 45.42, 0.3, "power1.in");
  fade(glow, 0, 1, 45.45, 0.6);

  const CW = 500,
    CH = 520,
    GAP = 40,
    CY = 536;
  const SC = 0.92; // over-site pose scale
  const vialSrc = PP.cfg.catalog[0].img; // BPC-157 / TB-500 — the product added to the cart in the recording
  const truck = `<svg width="132" height="96" viewBox="0 0 66 48" fill="none" stroke="${PP.C.neon}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M3 9 H39 V36 H3 Z"/><path d="M39 17 H52 L62 28 V36 H39"/><path d="M47 17 V28 H62"/><circle cx="14" cy="38" r="6" fill="#0a0f19"/><circle cx="51" cy="38" r="6" fill="#0a0f19"/></svg>`;
  const card = (i, o) => {
    const cx = 960 + (i - 1) * (CW + GAP);
    const pose = PP.el("div", "s4o-pose", offIn);
    pose.style.cssText += `left:${cx - CW / 2}px;top:${CY - CH / 2}px;width:${CW}px;height:${CH}px;`;
    const c = PP.neonCard(pose, { x: CW / 2, y: CH / 2, w: CW, h: CH, radius: 30 });
    c.el.classList.add("s4o-ocard");
    const burst = PP.el("div", "s4o-oc-burst", c.body);
    const ico = PP.el("div", "s4o-oc-ico", c.body);
    if (o.vials) for (let k = 0; k < o.vials; k++) PP.el("img", "", ico, { src: vialSrc, alt: "" });
    else ico.innerHTML = truck;
    const labEl = PP.el("div", "s4o-oc-lab", c.body, { text: o.label });
    const num = PP.el("div", "s4o-oc-num mf", c.body);
    const n = PP.el("span", "grad", num, { text: o.num });
    const sub = PP.el("div", "s4o-oc-sub", c.body, { text: o.sub });
    // slot-machine anticipation: the digit spins (blurred) in the number slot until the slam
    let roll = null;
    if (o.roll) {
      roll = PP.el("div", "s4o-oc-roll mf", c.body);
      PP.rollCounter(tl, roll, o.num, o.roll[0], o.roll[1], { ease: "power2.inOut" });
      gsap.set(roll, { opacity: 0 });
      tl.fromTo(roll, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "none", immediateRender: false }, o.roll[0]);
      tl.fromTo(roll, { opacity: 1 }, { opacity: 0, duration: 0.08, ease: "none", immediateRender: false }, o.roll[1] - 0.02);
    }
    gsap.set(c.el, { opacity: 0 });
    return { pose, el: c.el, burst, ico, lab: labEl, num, n, sub, roll, cx };
  };
  const c1 = card(0, { vials: 2, label: "2 vials", num: "5%", sub: "off", roll: [42.86, 43.36 - F] });
  const c2 = card(1, { vials: 3, label: "3+ vials", num: "8%", sub: "off", roll: [44.7, 45.48 - F] });
  const c3 = card(2, { label: "over $200", num: "Free", sub: "shipping" });
  const cards = [c1, c2, c3];

  // card body in (back.out pop), number slam (+ burst), caption
  const cardIn = (c, at, from) => PP.popIn(tl, c.el, at - F, { from: from || 0.82, dur: 0.5, y: 26 });
  const numSlam = (c, at) => {
    tl.fromTo(c.num, { opacity: 0, scale: 1.55, filter: "blur(14px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.34, ease: "expo.out", immediateRender: false }, at - F);
    tl.fromTo(c.burst, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.12, ease: "power2.out", immediateRender: false }, at - F);
    tl.fromTo(c.burst, { opacity: 1, scale: 1 }, { opacity: 0, scale: 1.5, duration: 0.6, ease: "power2.out", immediateRender: false }, at + 0.12);
  };
  cards.forEach((c) => {
    gsap.set([c.num, c.sub, c.burst], { opacity: 0 });
    gsap.set(c.num, { transformOrigin: "50% 55%" });
  });

  // over-site pose for cards 1 · 2 (left of the cart drawer), then they settle into the panel
  const POSE = [
    { x: 396 - c1.cx, y: 572 - CY },
    { x: 874 - c2.cx, y: 572 - CY },
  ];
  [c1, c2].forEach((c, i) => {
    gsap.set(c.pose, { x: POSE[i].x, y: POSE[i].y, scale: SC });
    tl.fromTo(c.pose, { x: POSE[i].x, y: POSE[i].y, scale: SC }, { x: 0, y: 0, scale: 1, duration: 0.6, ease: "power3.inOut", immediateRender: false }, 45.56 + i * 0.04);
  });

  // L15 « Two vials, 5% off. Three or more, 8%. » — 42.80 · 42.92 · 43.36 · 43.96 · 44.64 · 45.04 · 45.16 · 45.48
  cardIn(c1, 42.8);
  numSlam(c1, 43.36);
  wordIn(c1.sub, 43.96 - 0.04, { rise: 10, blur: 4 });
  cardIn(c2, 44.64);
  numSlam(c2, 45.48);
  wordIn(c2.sub, 45.6, { rise: 10, blur: 4 });
  // pop 46.20 — free shipping over $200
  cardIn(c3, 46.2, 0.6);
  tl.fromTo(c3.num, { opacity: 0, scale: 1.3, filter: "blur(10px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.34, ease: "expo.out", immediateRender: false }, 46.2 + 0.03);
  tl.fromTo(c3.burst, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.12, ease: "power2.out", immediateRender: false }, 46.2);
  tl.fromTo(c3.burst, { opacity: 1, scale: 1 }, { opacity: 0, scale: 1.5, duration: 0.6, ease: "power2.out", immediateRender: false }, 46.32);
  wordIn(c3.sub, 46.26, { rise: 10, blur: 4 });

  // panel furniture: « BUNDLE & SAVE » (site wording) · « Applied automatically in the cart. » · research-use tag
  const okick = PP.el("div", "s4o-okick", offIn);
  const rules = [PP.el("i", "", okick), null, null];
  const okText = PP.el("span", "", okick, { text: "Bundle & save" });
  rules[1] = PP.el("i", "", okick);
  const note = PP.el("div", "s4o-onote", offIn);
  const ck = PP.checkIcon(note, 36, PP.C.neon);
  PP.el("span", "", note, { text: "Applied automatically in the cart." });
  const otag = PP.el("div", "s4o-otag", offIn);
  PP.el("i", "", otag);
  PP.el("span", "", otag, { text: "For laboratory research use only" });
  gsap.set([okText, note, otag], { opacity: 0 });
  gsap.set([rules[0], rules[1]], { scaleX: 0 });
  gsap.set(rules[0], { transformOrigin: "100% 50%" });
  gsap.set(rules[1], { transformOrigin: "0% 50%" });
  wordIn(okText, 45.66, { rise: 18, blur: 6, dur: 0.45 });
  tl.fromTo([rules[0], rules[1]], { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power3.out", immediateRender: false }, 45.72);
  tl.fromTo(otag, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out", immediateRender: false }, 45.8);
  wordIn(note, 46.5, { rise: 14, blur: 5, dur: 0.4 });
  PP.draw(tl, ck.tick, 46.56, 0.3);
  tl.set(ck.tick, { drawSVG: "0%" }, 0);

  gsap.set(offIn, { transformOrigin: "960px 540px" });
  tl.fromTo(offIn, { scale: 1 }, { scale: 1.028, duration: T.EXIT - T.PANEL, ease: "none", immediateRender: false }, T.PANEL);

  // exit whoosh 47.30 — everything lifts away, gone by 47.55
  tl.fromTo(off, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }, { opacity: 0, y: -60, scale: 1.04, filter: "blur(8px)", duration: 0.22, ease: "power2.in", immediateRender: false }, T.EXIT);
  gsap.set(off, { transformOrigin: "960px 540px" });
});
