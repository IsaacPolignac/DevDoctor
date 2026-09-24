// s67 — S6+S7 DROP + PROOF (15.90 – 24.20).
// 16.00 DROP: frame-wide light pulse + hero framing (camera pushed-in on vial 1, pulls back by 16.52) + beat kicks;
// the six catalog vials slam into a 3+3 grid, one per beat (contact frame 16.00 … 18.50), each with a flash ring,
// a squash-and-settle and a name/amount label; L6 headline word-synced (PP.voHeadline).
// 18.54 the grid glides down (camera tilt) to open the trust zone; four pills pop on 18.75 / 19.25 / 19.75 / 20.25.
// 20.28 PROOF: labels + vials drop out, pills lift away in cascade (20.40 → 20.85), site eyebrow + headline
// « Un standard de pureté… » (20.50+), three stat cards land on 20.50 / 21.00 / 21.50 with counters;
// 22.00 – 22.62 the stack settles up, the source line appears, one shine passes over the cards at ~22.7.
// 23.58 – 23.95 exit (whoosh 23.75): zoom-through + blur + fade; nothing left by 23.95 (s8 blooms from 23.92).
// Every visual state is a pure function of timeline time (fromTo + immediateRender:false, PP.drive).
(function () {
  const PP = window.PP;

  PP.scene("s67", function (tl, root, cam) {
    const C = PP.C;

    // ------------------------------------------------------------------ timing (sound-event table)
    const T_V = [16.0, 16.5, 17.0, 17.5, 18.0, 18.5]; // impact + vial pops (landing frame)
    const T_P = [18.75, 19.25, 19.75, 20.25]; // pill pops
    const T_S = [20.5, 21.0, 21.5]; // stat hits (landing frame)
    const T_TILT = 18.54; // grid glides down to open the trust zone
    const T_CLEAR = 20.28; // drop content clears (pills last, so the 20.25 pill still reads)
    const T_SETTLE = 22.0; // proof stack settles up
    const T_EXIT = 23.6; // exit starts; whoosh 23.75
    const PRE = 0.1; // vial fall time before the landing frame

    // ------------------------------------------------------------------ helpers
    const ft = (target, from, to, at, dur, ease) =>
      tl.fromTo(target, from, Object.assign({ duration: dur, ease: ease || "none", immediateRender: false }, to), at);
    const snap = (target, from, to, at) => ft(target, from, to, at, 0.001, "none");
    CustomEase.create("s67spring", "M0,0 C0.14,0.62 0.22,1.1 0.4,1.085 0.56,1.07 0.68,0.985 0.82,0.996 0.9,1.001 0.95,1 1,1");
    const box = (el, x, y, w, h) => {
      el.style.left = x + "px";
      el.style.top = y + "px";
      if (w != null) el.style.width = w + "px";
      if (h != null) el.style.height = h + "px";
      return el;
    };
    // pulse: 0 -> peak quickly, then back to 0 (two chained segments, seek-safe)
    const pulse = (el, prop, peak, at, up, down, easeDown) => {
      ft(el, { [prop]: 0 }, { [prop]: peak }, at, up, "power1.out");
      ft(el, { [prop]: peak }, { [prop]: 0 }, at + up, down, easeDown || "power2.out");
    };

    // ------------------------------------------------------------------ layers
    //   cam (exit) ─┬─ pulseLayer (full-frame light)
    //               ├─ kick (beat kicks) ── dolly (16.00 hero push-in → pull-back) ── grid (vials, labels; tilt A→B)
    //               ├─ pillLayer
    //               ├─ proof (stat cards, own slow push)
    //               └─ hl (headlines, eyebrow, source line)
    const flash = PP.el("div", "s67-flash", cam);
    const kick = PP.el("div", "s67-kick", cam);
    const dolly = PP.el("div", "s67-dolly", kick);
    const grid = PP.el("div", "s67-grid", dolly);
    const pillLayer = PP.el("div", "s67-pills", cam);
    const proof = PP.el("div", "s67-proof", cam);
    const hl = PP.el("div", "s67-hl", cam);

    // ================================================================== DROP — vials
    const COLS = [270, 540, 810];
    const VH = 330;
    const VW = VH * PP.VIAL_RATIO; // 161
    const LAB_GAP = 12; // label bottom → vial top
    const ROW_TOP = [872, 1308]; // vial tops in pose B (the "real" layout)
    const TILT_Y = -300; // pose A offset (drop composition, centred under the headline)
    const TILT_S = 1; // no scale: labels keep their size and stay inside x 120→960

    gsap.set(grid, { y: TILT_Y, scale: TILT_S, transformOrigin: "540px 1000px" });

    const vials = PP.cfg.catalog.map((p, i) => {
      const col = i % 3;
      const row = i < 3 ? 0 : 1;
      const cx = COLS[col];
      const top = ROW_TOP[row];
      const T = T_V[i];

      const slot = box(PP.el("div", "s67-v", grid), cx - VW / 2, top, VW, VH);
      // flash: soft white light + brand ring, centred on the vial body
      const D = VH * (i === 0 ? 1.3 : 1.05);
      const glow = box(PP.el("div", "s67-glow", slot), VW / 2 - D * 0.7, VH * 0.52 - D * 0.7, D * 1.4, D * 1.4);
      const ring = box(PP.el("div", "s67-ring", slot), VW / 2 - D / 2, VH * 0.52 - D / 2, D, D);
      const shadow = box(PP.el("div", "s67-shadow", slot), VW / 2 - VW * 0.7, VH - 22, VW * 1.4, 40);
      const land = PP.el("div", "s67-v-land", slot);
      const flo = PP.el("div", "s67-v-flo", land);
      const sq = PP.el("div", "s67-v-sq", flo);
      PP.vial(sq, p.img, VH);

      gsap.set([glow, ring], { opacity: 0 });
      gsap.set(shadow, { opacity: 0 });
      gsap.set(land, { opacity: 0, transformOrigin: "50% 100%" });
      gsap.set(sq, { transformOrigin: "50% 100%" });

      // slam: falls from above/in front of the lens during PRE, contact exactly on the beat
      snap(land, { opacity: 0 }, { opacity: 1 }, T - PRE);
      ft(land, { y: -150, scale: 1.32, filter: "blur(5px)" }, { y: 0, scale: 1, filter: "blur(0px)" }, T - PRE, PRE, "power2.in");
      // squash + springy settle
      ft(sq, { scaleX: 1, scaleY: 1 }, { scaleX: 1.07, scaleY: 0.9 }, T, 0.06, "power2.out");
      ft(sq, { scaleX: 1.07, scaleY: 0.9 }, { scaleX: 1, scaleY: 1 }, T + 0.06, 0.55, "elastic.out(1.05, 0.38)");
      // flash ring + light
      pulse(ring, "opacity", 1, T, 0.03, 0.5, "power2.in");
      ft(ring, { scale: 0.42 }, { scale: 1.28 }, T, 0.53, "expo.out");
      pulse(glow, "opacity", 1, T, 0.03, 0.42, "power2.out");
      ft(glow, { scale: 0.5 }, { scale: 1.12 }, T, 0.45, "expo.out");
      ft(shadow, { opacity: 0, scaleX: 1.5 }, { opacity: 1, scaleX: 1 }, T, 0.35, "power2.out");

      // label (name + amount) above the vial
      const lab = PP.el("div", "s67-lab", grid);
      const nm = PP.el("div", "s67-lab-name", lab);
      const nmIn = PP.el("span", "", nm, { text: p.name });
      const am = PP.el("div", "s67-lab-amt", lab, { text: p.amount });
      const lw = lab.offsetWidth;
      const lh = lab.offsetHeight;
      let lx = cx - lw / 2;
      lx = Math.max(128, Math.min(952 - lw, lx));
      box(lab, lx, top - LAB_GAP - lh);
      gsap.set(nm, { opacity: 0 });
      gsap.set(nmIn, { yPercent: 110 });
      gsap.set(am, { opacity: 0, y: 10 });
      ft(nmIn, { yPercent: 110 }, { yPercent: 0 }, T + 0.04, 0.45, "expo.out");
      ft(nm, { opacity: 0 }, { opacity: 1 }, T + 0.04, 0.1, "none");
      ft(am, { opacity: 0, y: 10 }, { opacity: 1, y: 0 }, T + 0.12, 0.35, "power3.out");

      return { slot, land, flo, sq, lab, T, cx, top, phase: i * 1.37 };
    });

    // idle float (pure function of time): each vial bobs on its own phase after it has settled
    PP.drive(
      tl,
      (t) => {
        vials.forEach((v) => {
          const k = Math.max(0, Math.min(1, (t - (v.T + 0.45)) / 0.6));
          const y = k * 6 * Math.sin(((t - v.T) / 1.9) * Math.PI * 2 + v.phase);
          v.flo.style.transform = k === 0 ? "none" : "translateY(" + y.toFixed(2) + "px)";
        });
      },
      15.9,
      20.7,
      15.9,
      4.8,
      "none"
    );

    // 16.00 impact: frame-wide light pulse, brand shockwave from the first vial, camera kick
    snap(flash, { opacity: 0 }, { opacity: 1 }, 15.998); // full on the impact frame
    ft(flash, { opacity: 1 }, { opacity: 0 }, 15.999, 0.6, "power2.out");
    const v0 = vials[0];
    const SW = 1500;
    const shock = PP.svg("svg", { class: "s67-shock", width: SW, height: SW, viewBox: `0 0 ${SW} ${SW}` }, grid);
    box(shock, v0.cx - SW / 2, v0.top + VH * 0.52 - SW / 2);
    const sd = PP.svg("defs", {}, shock);
    const sg = PP.svg("linearGradient", { id: "s67-shock-grad", x1: "0", y1: "0", x2: "1", y2: "1" }, sd);
    PP.svg("stop", { offset: "0", "stop-color": C.navy }, sg);
    PP.svg("stop", { offset: "0.55", "stop-color": C.blue }, sg);
    PP.svg("stop", { offset: "1", "stop-color": C.teal }, sg);
    const shockC = PP.svg("circle", { cx: SW / 2, cy: SW / 2, r: SW / 2 - 8, fill: "none", stroke: "url(#s67-shock-grad)", "stroke-width": 5 }, shock);
    gsap.set(shock, { opacity: 0, scale: 0.08, transformOrigin: "50% 50%" });
    pulse(shock, "opacity", 0.75, 16.0, 0.03, 0.62, "power1.in");
    ft(shock, { scale: 0.08 }, { scale: 1 }, 16.0, 0.65, "expo.out");
    ft(shockC, { attr: { "stroke-width": 9 } }, { attr: { "stroke-width": 2 } }, 16.0, 0.65, "power2.out");

    // hero framing on the drop: the camera starts pushed-in and centred on the first vial, holds the impact,
    // then pulls back to reveal the grid just before the second beat
    const vc = { x: v0.cx, y: v0.top + VH * 0.5 + TILT_Y }; // first vial centre (pose A, frame coords)
    const DS = 1.3;
    const DX = 540 - (540 + (vc.x - 540) * DS);
    const DY = 830 - (900 + (vc.y - 900) * DS);
    gsap.set(dolly, { transformOrigin: "540px 900px", scale: DS, x: DX, y: DY });
    ft(dolly, { scale: DS, x: DX, y: DY }, { scale: DS * 0.985, x: DX * 0.97, y: DY * 0.97 }, 16.0, 0.1, "power2.out");
    ft(dolly, { scale: DS * 0.985, x: DX * 0.97, y: DY * 0.97 }, { scale: 1, x: 0, y: 0 }, 16.1, 0.42, "power3.inOut");

    gsap.set(kick, { transformOrigin: "540px 900px" });
    ft(kick, { scale: 1.045, y: 14 }, { scale: 1, y: 0 }, 16.0, 0.46, "expo.out");
    T_V.slice(1).forEach((t) => ft(kick, { scale: 1.012, y: 4 }, { scale: 1, y: 0 }, t, 0.3, "power3.out"));

    // 18.54 tilt: the grid glides down (pose A → B) to open the trust zone under the headline
    ft(grid, { y: TILT_Y, scale: TILT_S }, { y: 0, scale: 1 }, T_TILT, 0.46, "power3.inOut");
    ft(dolly, { scale: 1 }, { scale: 1.01 }, T_TILT + 0.46, T_CLEAR - (T_TILT + 0.46), "sine.inOut");

    // ================================================================== L6 headline (word-synced)
    const fit = (h, maxW) => {
      let widest = 0;
      h.lines.forEach((ln) => {
        const ws = ln.querySelectorAll(".pp-w");
        widest = Math.max(widest, ws[ws.length - 1].getBoundingClientRect().right - ws[0].getBoundingClientRect().left);
      });
      if (widest > maxW) h.el.style.fontSize = Math.floor((parseFloat(getComputedStyle(h.el).fontSize) * maxW) / widest) + "px";
    };
    const h6 = PP.voHeadline(tl, hl, "L6", ["Expédition sous *24* *heures,*", "vers *10* *pays.*"], "h2 s67-h s67-h6");
    fit(h6, 820);
    PP.textOut(tl, [...h6.lines].reverse(), 20.28, { dur: 0.18, stagger: 0.03 });

    // ================================================================== trust pills
    const trust = PP.cfg.trust;
    const PILLS = ["Réservé à un usage de recherche", trust[4], trust[1], trust[5]]; // 24 h · chaîne du froid · labo indépendant · paiement
    const PILL_TOP = 452;
    const PILL_STEP = 78;
    const pills = PILLS.map((text, i) => {
      const wrap = PP.el("div", "s67-pw", pillLayer);
      const flo = PP.el("div", "s67-pflo", wrap);
      const pill = PP.pill(flo, text, { check: true, iconSize: 30 });
      const w = pill.offsetWidth;
      box(wrap, 540 - w / 2, PILL_TOP + i * PILL_STEP, w, pill.offsetHeight);
      const circ = pill.querySelector("circle");
      const tick = pill.querySelector("path");
      gsap.set([circ, tick], { drawSVG: "0%" });
      gsap.set(pill, { opacity: 0, scale: 0.72, y: 26 });
      const T = T_P[i];
      const T0 = T - 1 / 30; // onset one frame early: the beat frame already shows the pop
      ft(pill, { opacity: 0, scale: 0.72, y: 26 }, { opacity: 1, scale: 1, y: 0 }, T0, 0.5, "back.out(2.1)");
      ft(pill, { opacity: 0 }, { opacity: 1 }, T0, 0.08, "none");
      ft(circ, { drawSVG: "0%" }, { drawSVG: "100%" }, T + 0.04, 0.34, "power2.out");
      ft(tick, { drawSVG: "0%" }, { drawSVG: "100%" }, T + 0.2, 0.22, "power2.out");
      return { wrap, flo, pill, T };
    });
    PP.drive(
      tl,
      (t) => {
        pills.forEach((p, i) => {
          const k = Math.max(0, Math.min(1, (t - (p.T + 0.4)) / 0.5));
          const y = k * 3 * Math.sin(((t - p.T) / 1.7) * Math.PI * 2 + i * 1.1);
          p.flo.style.transform = k === 0 ? "none" : "translateY(" + y.toFixed(2) + "px)";
        });
      },
      18.7,
      20.8,
      18.7,
      2.1,
      "none"
    );

    // ================================================================== clear the drop (20.30)
    vials.forEach((v, i) => {
      const at = T_CLEAR + [0, 0.025, 0.05, 0.015, 0.04, 0.065][i];
      ft(v.slot, { y: 0, opacity: 1, filter: "blur(0px)" }, { y: 240, opacity: 0, filter: "blur(10px)" }, at, 0.2, "power2.in");
      ft(v.lab, { opacity: 1 }, { opacity: 0 }, 20.24 + i * 0.01, 0.08, "power1.in"); // gone before card 1 appears (20.38)
    });
    pills.forEach((p, i) => {
      const at = 20.4 + i * 0.09;
      ft(p.wrap, { y: 0, opacity: 1, filter: "blur(0px)" }, { y: -56, opacity: 0, filter: "blur(8px)" }, at, 0.18, "power2.in");
    });

    // ================================================================== PROOF
    // eyebrow + site headline (not the VO: plain word reveal)
    const eyebrow = PP.el("div", "s67-eyebrow mono", hl, { text: "La qualité sans compromis" });
    gsap.set(eyebrow, { opacity: 0 });
    ft(eyebrow, { opacity: 0, y: 12 }, { opacity: 1, y: 0 }, 20.5, 0.4, "power3.out");
    const hp = PP.headline(hl, ["Un standard de pureté", "que vous pouvez", "*vérifier* vous-même."], "h2 s67-h s67-hp");
    PP.wordsIn(tl, hp.words, 20.52, { stagger: 0.05 });
    // gradient underline under « vérifier »
    const vw = hp.words.find((w) => w.classList.contains("grad"));
    const under = PP.el("div", "s67-under", vw);
    gsap.set(under, { scaleX: 0 });
    ft(under, { scaleX: 0 }, { scaleX: 1 }, 21.7, 0.5, "power3.inOut");

    // stat cards
    const STATS = [
      { to: 99, ge: true, pct: true, l1: "Pureté", l2: "HPLC", dur: 0.95, icon: "peak" },
      { to: 2, l1: "Méthodes", l2: "analytiques", dur: 0.55, icon: "methods" },
      { to: 1, l1: "COA", l2: "par lot", dur: 0.45, icon: "doc" },
    ];
    const ICONS = {
      // HPLC chromatogram: one sharp peak on a baseline
      peak: ["M5 33 H13 L15.5 31 L20 8 L24.5 31 L27 33 H35"],
      // two methods: a peak (HPLC) + mass-spectrum bars
      methods: ["M4 33 H8 L11.5 11 L15 33 H18", "M24 33 V21", "M29.5 33 V13", "M35 33 V25"],
      // certificate: page with folded corner + check
      doc: ["M11 5.5 H24 L31 12.5 V34.5 H11 Z", "M24 5.5 V12.5 H31", "M15.5 23.5 L19.2 27.2 L26.5 19.8"],
    };
    const CARD_W = 840;
    const CARD_H = 196;
    const CARD_GAP = 22;
    const STACK_TOP = 610; // settled position (after 22.00)
    const STACK_DROP = 172; // landing offset (clear of the pill zone while the pills leave)
    const stack = PP.el("div", "s67-stack", proof);
    gsap.set(stack, { y: STACK_DROP });
    const cards = STATS.map((s, i) => {
      const w = box(PP.el("div", "s67-cw", stack), 540 - CARD_W / 2, STACK_TOP + i * (CARD_H + CARD_GAP), CARD_W, CARD_H);
      const card = PP.el("div", "s67-card", w);
      const accent = PP.el("div", "s67-accent", card);
      const tile = PP.el("div", "s67-tile", card);
      const ic = PP.svg("svg", { width: 48, height: 48, viewBox: "0 0 40 40", class: "s67-icon" }, tile);
      const idf = PP.svg("defs", {}, ic);
      // user-space gradient: vertical strokes have a zero-width bbox (objectBoundingBox would not paint)
      const ig = PP.svg("linearGradient", { id: "s67-ig-" + i, x1: "4", y1: "4", x2: "36", y2: "36", gradientUnits: "userSpaceOnUse" }, idf);
      PP.svg("stop", { offset: "0", "stop-color": C.navy }, ig);
      PP.svg("stop", { offset: "0.55", "stop-color": C.blue }, ig);
      PP.svg("stop", { offset: "1", "stop-color": C.teal }, ig);
      const strokes = ICONS[s.icon].map((d) => PP.svg("path", { d, fill: "none", stroke: "url(#s67-ig-" + i + ")", "stroke-width": 3.1, "stroke-linecap": "round", "stroke-linejoin": "round" }, ic));
      const num = PP.el("div", "s67-num grad", card);
      if (s.ge) PP.el("span", "s67-ge", num, { text: "≥" });
      const val = PP.el("span", "s67-val", num, { text: "0" });
      if (s.pct) PP.el("span", "s67-pct", num, { text: "%" });
      const lbl = PP.el("div", "s67-lbl", card);
      PP.el("div", "", lbl, { text: s.l1 });
      PP.el("div", "soft", lbl, { text: s.l2 });
      const hi = PP.el("div", "s67-hi", card);
      const shine = PP.el("div", "s67-shine", card);
      const T = T_S[i];
      gsap.set(shine, { xPercent: -160, skewX: -18 });
      ft(shine, { xPercent: -160 }, { xPercent: 560 }, 22.72 + i * 0.12, 0.7, "power2.inOut");
      gsap.set(w, { opacity: 0 });
      gsap.set(accent, { scaleY: 0 });
      gsap.set(hi, { opacity: 0 });
      gsap.set(strokes, { drawSVG: "0%" });
      ft(w, { opacity: 0 }, { opacity: 1 }, T - 0.12, 0.07, "power1.out");
      ft(w, { y: -26, scale: 1.08, filter: "blur(4px)" }, { y: 0, scale: 1, filter: "blur(0px)" }, T - 0.12, 0.12, "power2.in");
      ft(card, { scaleX: 1, scaleY: 1 }, { scaleX: 1.012, scaleY: 0.96 }, T, 0.05, "power2.out");
      ft(card, { scaleX: 1.012, scaleY: 0.96 }, { scaleX: 1, scaleY: 1 }, T + 0.05, 0.5, "elastic.out(1, 0.45)");
      pulse(hi, "opacity", 1, T, 0.03, 0.55, "power2.in");
      ft(accent, { scaleY: 0 }, { scaleY: 1 }, T, 0.4, "expo.out");
      ft(tile, { scale: 0.6 }, { scale: 1 }, T + 0.02, 0.45, "back.out(2.6)");
      strokes.forEach((st, k) => ft(st, { drawSVG: "0%" }, { drawSVG: "100%" }, T + 0.08 + k * 0.06, 0.42, "power2.inOut"));
      if (s.to > 2) PP.counter(tl, val, { from: s.to === 99 ? 90 : 0, to: s.to, at: T, dur: s.dur, format: (x) => String(Math.round(x)), ease: "power3.out" });
      else
        // small counts (2 méthodes, 1 COA): same 0 → n curve (the mix ticks on each change) but the « 0 » state is
        // never shown — « 0 COA par lot » must not be readable; the digit appears on its first tick.
        // (a no-break space, not opacity: the parent .grad clips its gradient to the child glyphs)
        PP.drive(
          tl,
          (x) => {
            const n = Math.round(x);
            val.textContent = n < 1 ? " " : String(n);
          },
          0,
          s.to,
          T,
          s.dur,
          "power3.out"
        );
      return { w, card, num };
    });
    PP.drive(
      tl,
      (t) => {
        cards.forEach((c, i) => {
          const k = Math.max(0, Math.min(1, (t - (T_S[i] + 0.5)) / 0.6));
          const y = k * 3.5 * Math.sin(((t - T_S[i]) / 2.2) * Math.PI * 2 + i * 1.3);
          c.card.style.translate = k === 0 ? "none" : "0px " + y.toFixed(2) + "px";
        });
      },
      20.4,
      23.6,
      20.4,
      3.2,
      "none"
    );
    // settle: the stack glides up once all three have landed, then the source line appears
    ft(stack, { y: STACK_DROP }, { y: 0 }, T_SETTLE, 0.62, "power3.inOut");
    const src = PP.el("div", "s67-src", proof);
    PP.el("span", "s67-src-dot", src);
    PP.el("span", "", src, { text: PP.cfg.url });
    box(src, 0, STACK_TOP + 3 * CARD_H + 2 * CARD_GAP + 44, 1080);
    gsap.set(src, { opacity: 0 });
    ft(src, { opacity: 0, y: 14 }, { opacity: 1, y: 0 }, T_SETTLE + 0.42, 0.45, "power3.out");
    // slow push on the proof layer (starts at scale 1 while the cards land)
    gsap.set(proof, { transformOrigin: "540px 900px" });
    ft(proof, { scale: 1 }, { scale: 1.025 }, 20.4, T_EXIT - 20.4, "sine.inOut");

    // ================================================================== EXIT 23.58 → 23.95 (whoosh 23.75)
    // zoom-through: speed peaks on the whoosh (power2.inOut centred on 23.765), blur + fade in the second half
    ft(cam, { scale: 1, y: 0 }, { scale: 1.22, y: -90 }, 23.58, 0.37, "power2.inOut");
    ft(cam, { filter: "blur(0px)" }, { filter: "blur(16px)" }, 23.64, 0.3, "power2.in");
    ft(cam, { opacity: 1 }, { opacity: 0 }, 23.68, 0.27, "power2.in");
  });
})();
