// s23 — S2+S3 phone act 1 (2.80 – 10.00): the phone rises, the « Vérification chercheur » gate is ticked and
// dismissed, an iOS push opens the BPC-157 / TB-500 page, the « Vérifié · Pureté HPLC 99.0% » row lifts out as a
// lens card, the Janoshik card pops on « Janoshik », the lab line is tapped, then everything clears so that at
// 10.00 the frame is exactly: phone at P0 (untransformed), m-product.jpg at css scroll 1100, nothing else.
// All state is a pure function of timeline time (fromTo + immediateRender:false, PP.drive for raw transforms).
(function () {
  const PP = window.PP;

  PP.scene("s23", function (tl, root, cam) {
    const C = PP.C;
    const S = PP.PHONE.S; // 1.4 px per css px

    // ------------------------------------------------------------------ layout constants
    // The phone sits lower than P0 while the 3–4 line headlines occupy the top zone, and rises to P0 at the end.
    const D_L2 = 190; // phone offset under the 4-line L2 headline
    const D_L3 = 120; // phone offset under the 3-line L3 headline
    const RISE = 1400; // extra offset at 2.80 (phone fully below the frame)
    const SCROLL_PROD = 560; // product page scroll when it slides in (title + « Vérifié » row in view)
    const SCROLL_END = 1100; // hand-off scroll (contract)

    // ------------------------------------------------------------------ helpers
    const ft = (target, from, to, at, dur, ease) =>
      tl.fromTo(target, from, Object.assign({ duration: dur, ease: ease || "none", immediateRender: false }, to), at);
    // instant switch that reverts cleanly when seeking backwards
    const snap = (target, from, to, at) => ft(target, from, to, at, 0.001, "none");
    CustomEase.create("s23spring", "M0,0 C0.14,0.62 0.22,1.1 0.4,1.085 0.56,1.07 0.68,0.985 0.82,0.996 0.9,1.001 0.95,1 1,1");

    // ------------------------------------------------------------------ rig (moves the phone and everything attached to it)
    const rig = PP.el("div", "s23-rig", cam);
    const setRig = (v) => (rig.style.transform = Math.abs(v) < 0.01 ? "none" : "translateY(" + v.toFixed(3) + "px)");
    PP.drive(tl, setRig, D_L2 + RISE, D_L2, 2.8, 0.65, "power3.out");
    PP.drive(tl, setRig, D_L2, D_L3, 6.15, 0.6, "power2.inOut");
    PP.drive(tl, setRig, D_L3, 0, 9.62, 0.34, "power2.inOut");

    const phone = PP.phone(rig);
    const PL = 540 - phone.W / 2;
    const PT = 1040 - phone.H / 2;
    // page css coords -> rig (P0 frame) coords
    const at = (cx, cy, scroll, full) => {
      const p = phone.pt(cx, cy, scroll, full);
      return { x: PL + p.x, y: PT + p.y };
    };

    // settle tilt + scale as it lands (phone.el ends with transform: none)
    PP.drive(
      tl,
      (p) => {
        phone.el.style.transform = p > 0.9999 ? "none" : "perspective(1600px) rotateX(" + (14 * (1 - p)).toFixed(3) + "deg) scale(" + (0.94 + 0.06 * p).toFixed(4) + ")";
      },
      0,
      1,
      2.8,
      0.85,
      "power2.out"
    );

    // ------------------------------------------------------------------ pages
    const home = phone.addPage("assets/site/m-home.jpg", 2600);
    const homeDim = PP.el("div", "s23-dim", home.el);
    const prod = phone.addPage("assets/site/m-product.jpg", 1900);
    prod.el.classList.add("s23-prod");
    gsap.set(prod.img, { y: -SCROLL_PROD * S });
    gsap.set(prod.el, { x: phone.sw });
    // modal backdrop over the home page (blurred copy + veil, matched to the gate capture's dimmed backdrop)
    const blurImg = PP.el("img", "s23-blur", home.el, { src: "assets/site/m-home.jpg", alt: "" });
    blurImg.style.width = phone.sw + "px";
    blurImg.style.height = 2600 * S + "px";
    const veil = PP.el("div", "s23-veil", home.el);
    // give every element that is transformed later an explicit transform from the start, so a backward seek
    // lands on exactly the same compositing state as a fresh load
    gsap.set(home.el, { x: 0 });

    // gate: three full-screen captures (unticked / first ticked / both ticked), clipped to the modal card,
    // + a pressable clone of the « Entrer sur PurePeptide » button
    const gate = PP.el("div", "s23-gate", phone.screen);
    // modal card in the capture: css x 24..366, y 134..711, radius ~16.7 css
    gate.style.clipPath = `inset(${(134 * S + 0.5).toFixed(1)}px ${(24 * S + 0.5).toFixed(1)}px ${(133 * S + 0.5).toFixed(1)}px ${(24 * S + 0.5).toFixed(1)}px round ${(16.7 * S).toFixed(1)}px)`;
    const gates = [0, 1, 2].map((i) => {
      const pg = phone.addPage("assets/site/gate-" + i + ".jpg", 844, { full: true });
      gate.appendChild(pg.el);
      return pg;
    });
    gsap.set([gates[1].el, gates[2].el], { opacity: 0 });
    gsap.set(gate, { scale: 1 });
    // « Entrer sur PurePeptide » button of gate-2 (css 46,631 298x50, pill) over a white pill patch
    const BX = 46,
      BY = 631,
      BW = 298,
      BH = 50;
    const patch = PP.el("div", "s23-btnpatch", gate, { style: `left:${BX * S - 1.5}px;top:${BY * S - 1.5}px;width:${BW * S + 3}px;height:${BH * S + 3}px;border-radius:${(BH * S) / 2 + 1.5}px` });
    const btn = PP.el("div", "s23-btn", gate, { style: `left:${BX * S}px;top:${BY * S}px;width:${BW * S}px;height:${BH * S}px;border-radius:${(BH * S) / 2}px` });
    const btnImg = PP.el("img", "", btn, { src: "assets/site/gate-2.jpg", alt: "" });
    btnImg.style.cssText = `left:${-BX * S}px;top:${-BY * S}px;width:${phone.sw}px;height:${844 * S}px`;
    gsap.set(btn, { transformOrigin: `${(195 - BX) * S}px ${(656 - BY) * S}px` });
    gsap.set([patch, btn], { opacity: 0 });
    // dark status bar while the gate's dimmed backdrop is up
    const darkBar = phone.bar.cloneNode(true);
    darkBar.classList.add("s23-darkbar");
    phone.screen.insertBefore(darkBar, phone.bar.nextSibling);

    // ------------------------------------------------------------------ FX layer (outlines, link line, lab ring)
    const fx = PP.svg("svg", { class: "s23-fx", width: 1080, height: 1920, viewBox: "0 0 1080 1920" }, rig);
    const defs = PP.svg("defs", {}, fx);
    const lg = PP.svg("linearGradient", { id: "s23-grad", x1: "0", y1: "0", x2: "1", y2: "1" }, defs);
    PP.svg("stop", { offset: "0", "stop-color": C.navy }, lg);
    PP.svg("stop", { offset: "0.55", "stop-color": C.blue }, lg);
    PP.svg("stop", { offset: "1", "stop-color": C.teal }, lg);

    // source row « Vérifié · Pureté HPLC 99.0% » at scroll 560 (crop css x 16..226, y 658..691)
    const CROP = [16, 658, 210, 33];
    const src0 = at(CROP[0], CROP[1], SCROLL_PROD);
    const srcW = CROP[2] * S,
      srcH = CROP[3] * S;
    const OP = 7; // outline padding
    // the ring hugs the « Vérifié » pill row (css y 662..686, 4.5 css padding): its bottom stroke must clear the
    // « · Certificat d'analyse inclus » line just below (ascenders from css y 695)
    const ringY0 = at(0, 657.5, SCROLL_PROD).y,
      ringY1 = at(0, 690.5, SCROLL_PROD).y;
    const srcRing = PP.svg("rect", { x: src0.x - OP, y: ringY0, width: srcW + 2 * OP, height: ringY1 - ringY0, rx: 16, fill: "rgba(42,154,194,0.06)", stroke: "url(#s23-grad)", "stroke-width": 3 }, fx);

    // lens card target (P0 frame; the rig adds the phone offset)
    const LENS = { x: 360, y: 744, w: 620 };
    const LPAD = 28,
      LTOP = 22;
    const linkX = 724;
    const srcRight = src0.x + srcW + OP;
    const srcMid = src0.y + srcH / 2;
    const link = PP.svg("path", { d: `M${srcRight},${srcMid} H${linkX - 28} Q${linkX},${srcMid} ${linkX},${srcMid + 28} V${LENS.y}`, fill: "none", stroke: "url(#s23-grad)", "stroke-width": 3, "stroke-linecap": "round" }, fx);
    const dotA = PP.svg("circle", { cx: srcRight, cy: srcMid, r: 6, fill: C.blue }, fx);
    gsap.set(dotA, { transformOrigin: "50% 50%", scale: 0 });

    // lab line « Analysé par un laboratoire indépendant (HPLC + spectrométrie de masse) » at scroll 1100
    const lab0 = at(21, 1749, SCROLL_END);
    const LP = 7;
    const labRing = PP.svg("rect", { x: lab0.x - LP, y: lab0.y - LP, width: 348 * S + 2 * LP, height: 63 * S + 2 * LP, rx: 18, fill: "rgba(42,154,194,0.07)", stroke: "url(#s23-grad)", "stroke-width": 3.5 }, fx);
    gsap.set([srcRing, labRing], { attr: { "fill-opacity": 0 } });

    // ------------------------------------------------------------------ cards
    const lens = PP.el("div", "s23-card s23-lens", rig);
    lens.style.left = LENS.x + "px";
    lens.style.top = LENS.y + "px";
    lens.style.width = LENS.w + "px";
    const lbl = PP.el("div", "s23-lbl mono", lens);
    PP.el("span", "s23-lbl-dot", lbl);
    PP.el("span", "", lbl, { text: PP.cfg.heroProduct });
    const cropW = LENS.w - 2 * LPAD;
    const crop = PP.lens(lens, "assets/site/m-product.jpg", 390, 1900, CROP, cropW);
    const LBL_H = 26,
      LBL_GAP = 12;
    crop.el.style.left = LPAD + "px";
    // magnified row on top, product caption underneath
    crop.el.style.top = LTOP + "px";
    lbl.style.top = LTOP + crop.height + LBL_GAP + "px";
    const lensH = LTOP + crop.height + LBL_GAP + LBL_H + 22;
    lens.style.height = lensH + "px";
    // FLIP start: the crop sits exactly on the source row in the phone
    const s0 = srcW / cropW;
    const lx0 = src0.x - LENS.x - LPAD * s0;
    const ly0 = src0.y - LENS.y - LTOP * s0;
    gsap.set(lens, { transformOrigin: "0 0", x: lx0, y: ly0, scale: s0, opacity: 0 });
    // link end node: a child of the lens card, pinned on its top edge (as an FX-layer circle it sat UNDER the card
    // and the card's spring/float covered all but a sliver of it)
    const dotB = PP.el("div", "s23-node", lens);
    dotB.style.left = linkX - LENS.x + "px";
    gsap.set(dotB, { scale: 0 });

    const jan = PP.el("div", "s23-card s23-jan", rig);
    const JAN = { x: LENS.x, y: LENS.y + lensH + 26, w: LENS.w };
    jan.style.left = JAN.x + "px";
    jan.style.top = JAN.y + "px";
    jan.style.width = JAN.w + "px";
    PP.el("img", "s23-jan-logo", jan, { src: "assets/brand/janoshik-logo.svg", alt: "Janoshik" });
    PP.el("div", "s23-jan-name", jan, { text: PP.cfg.lab });
    const janSub = PP.el("div", "s23-jan-sub", jan);
    PP.checkIcon(janSub, 30, C.teal);
    PP.el("span", "mono", janSub, { text: "Laboratoire tiers indépendant" });
    gsap.set(jan, { transformOrigin: "30% 0%", opacity: 0 });
    gsap.set(jan.children, { opacity: 0 });

    // ------------------------------------------------------------------ touch indicator
    const touch = PP.touch(rig);
    const tap = (t) => {
      ft(touch.dot, { scale: 1 }, { scale: 0.78 }, t, 0.09, "power2.out");
      ft(touch.dot, { scale: 0.78 }, { scale: 1 }, t + 0.09, 0.25, "back.out(2)");
      snap(touch.ring, { opacity: 0, scale: 0.4 }, { opacity: 0.9, scale: 0.4 }, t);
      ft(touch.ring, { opacity: 0.9, scale: 0.4 }, { opacity: 0, scale: 2.2 }, t + 0.001, 0.55, "power2.out");
    };
    gsap.set(touch.ring, { opacity: 0 });
    const move = (a, b, t, d, e) => ft(touch.el, { x: a.x, y: a.y }, { x: b.x, y: b.y }, t, d, e);
    const fStart = { x: 742, y: 1340 };
    const cb1 = at(70, 446, 0, true);
    const cb2 = at(70, 502, 0, true);
    const enter = at(195, 656, 0, true);
    const fOut1 = { x: enter.x + 50, y: enter.y + 70 };
    const fStart2 = { x: 690, y: 1575 };
    const labTap = at(195, 1780, SCROLL_END);
    const fOut2 = { x: labTap.x + 40, y: labTap.y + 50 };
    gsap.set(touch.el, { x: fStart.x, y: fStart.y, opacity: 0 });

    // ================================================================== TIMELINE
    // 2.80–3.65 phone rise + tilt settle (whoosh 2.95) — driven above.

    // headline L2 (words on the VO)
    const hl = PP.el("div", "s23-hl", root);
    const h2 = PP.voHeadline(tl, hl, "L2", ["On ne vous demande", "pas de nous croire,", "on vous montre", "les *preuves.*"], "h2 s23-h");
    PP.textOut(tl, h2.lines, 6.05, { dur: 0.2, stagger: 0.015 });

    // camera: slow push while the story plays, back to scale 1 by 9.50 (hand-off rule)
    ft(cam, { scale: 1 }, { scale: 1.02 }, 3.45, 9.1 - 3.45, "sine.inOut");
    ft(cam, { scale: 1.02 }, { scale: 1 }, 9.1, 0.4, "power2.inOut");

    // --- gate in action
    ft(touch.el, { opacity: 0 }, { opacity: 1 }, 3.5, 0.18, "power1.out");
    ft(touch.el, { scale: 1.3 }, { scale: 1 }, 3.5, 0.35, "power2.out");
    move(fStart, cb1, 3.5, 0.42, "power3.inOut");
    tap(4.0);
    ft(gates[1].el, { opacity: 0 }, { opacity: 1 }, 4.0, 2 / 30);
    move(cb1, cb2, 4.1, 0.28, "power2.inOut");
    tap(4.45);
    ft(gates[2].el, { opacity: 0 }, { opacity: 1 }, 4.45, 2 / 30);
    move(cb2, enter, 4.6, 0.45, "power3.inOut");
    // button press on the pixel-identical clone (5.15)
    snap([patch, btn], { opacity: 0 }, { opacity: 1 }, 5.08);
    tap(5.15);
    ft(btn, { scale: 1, filter: "brightness(1)" }, { scale: 0.955, filter: "brightness(0.86)" }, 5.15, 0.08, "power2.out");
    ft(btn, { scale: 0.955, filter: "brightness(0.86)" }, { scale: 1, filter: "brightness(1)" }, 5.23, 0.28, "back.out(2.2)");
    // finger leaves
    ft(touch.el, { opacity: 1 }, { opacity: 0 }, 5.26, 0.18, "power1.in");
    move(enter, fOut1, 5.22, 0.3, "power2.in");
    // gate dismisses (modal feel): the card shrinks + fades, the dimmed/blurred backdrop clears to the home hero
    ft(gate, { opacity: 1 }, { opacity: 0 }, 5.25, 0.17, "power2.out");
    ft(gate, { scale: 1 }, { scale: 0.92 }, 5.25, 0.2, "power2.out");
    ft([blurImg, veil, darkBar], { opacity: 1 }, { opacity: 0 }, 5.28, 0.34, "power2.inOut");

    // --- 5.95 iOS push navigation to the product page (swipe)
    ft(prod.el, { x: phone.sw }, { x: 0 }, 5.95, 0.55, "power4.out");
    ft(home.el, { x: 0 }, { x: -0.3 * phone.sw }, 5.95, 0.55, "power4.out");
    ft(homeDim, { opacity: 0 }, { opacity: 0.16 }, 5.95, 0.45, "power2.out");
    // once covered, drop the home page (its anti-aliased edge would otherwise bleed at the screen's rounded corner)
    snap(home.el, { opacity: 1 }, { opacity: 0 }, 6.7);

    // headline L3 (words on the VO) — 3 lines
    const h3 = PP.voHeadline(tl, hl, "L3", ["Chaque lot est analysé", "par *Janoshik,* un", "laboratoire indépendant."], "h2 s23-h");
    // exit: the headline travels up with the phone (same move) and fades — nothing left by 9.93
    ft(h3.el, { y: 0 }, { y: -(D_L3 + 20) }, 9.62, 0.34, "power2.inOut");
    ft(h3.el, { opacity: 1 }, { opacity: 0 }, 9.7, 0.23, "power1.in");

    // --- 6.90 lens lifts out of the phone (pop)
    PP.draw(tl, srcRing, 6.78, 0.3, { ease: "power2.out" });
    ft(srcRing, { attr: { "fill-opacity": 0 } }, { attr: { "fill-opacity": 1 } }, 6.78, 0.3, "power1.out");
    snap(lens, { opacity: 0 }, { opacity: 1 }, 6.9);
    ft(lens, { x: lx0, y: ly0, scale: s0 }, { x: 0, y: 0, scale: 1 }, 6.9, 0.62, "s23spring");
    ft(lens, { backgroundColor: "rgba(255,255,255,0)" }, { backgroundColor: "rgba(255,255,255,1)" }, 6.9, 0.08, "none");
    ft(lens, { boxShadow: "0 0px 0px rgba(18,42,84,0), 0 0 0 1px rgba(230,235,242,0)" }, { boxShadow: "0 30px 70px rgba(18,42,84,0.2), 0 0 0 1px rgba(230,235,242,1)" }, 6.9, 0.35, "power2.out");
    ft(lbl, { opacity: 0, y: -6 }, { opacity: 1, y: 0 }, 7.06, 0.3, "power2.out");
    ft(dotA, { scale: 0 }, { scale: 1 }, 6.96, 0.25, "back.out(3)");
    PP.draw(tl, link, 7.0, 0.32, { ease: "power2.inOut" });
    ft(dotB, { scale: 0 }, { scale: 1 }, 7.28, 0.3, "back.out(3)");

    // --- 7.64 Janoshik card (pop on « Janoshik »)
    snap(jan, { opacity: 0 }, { opacity: 1 }, 7.64);
    ft(jan, { y: 36, scale: 0.88 }, { y: 0, scale: 1 }, 7.64, 0.6, "s23spring");
    ft(jan.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.06 }, 7.64, 0.3, "power2.out");

    // cards float gently while they are up (nothing frozen)
    ft(lens, { y: 0 }, { y: -8 }, 7.52, 9.28 - 7.52, "sine.inOut");
    ft(jan, { y: 0 }, { y: -6 }, 8.24, 9.34 - 8.24, "sine.inOut");

    // --- 8.20–8.60 scroll to the lab line, tap it
    ft([srcRing, link, dotA, dotB], { opacity: 1 }, { opacity: 0 }, 8.04, 0.16, "power1.in");
    prod.scroll(tl, SCROLL_PROD, SCROLL_END, 8.2, 0.36, "power2.inOut");
    ft(touch.el, { opacity: 0 }, { opacity: 1 }, 8.36, 0.14, "power1.out");
    ft(touch.el, { scale: 1.3 }, { scale: 1 }, 8.36, 0.26, "power2.out");
    move(fStart2, labTap, 8.36, 0.2, "power3.out");
    tap(8.6);
    PP.draw(tl, labRing, 8.6, 0.38, { ease: "power2.out" });
    ft(labRing, { attr: { "fill-opacity": 0 } }, { attr: { "fill-opacity": 1 } }, 8.6, 0.3, "power1.out");
    ft(touch.el, { opacity: 1 }, { opacity: 0 }, 8.88, 0.18, "power1.in");
    move(labTap, fOut2, 8.84, 0.3, "power2.in");

    // --- 9.28–9.68 cards leave, ring fades (phone back to P0 9.62–9.96 and L3 exit are set up above)
    ft(labRing, { opacity: 1 }, { opacity: 0 }, 9.28, 0.22, "power1.in");
    // cards swipe out to the right (opaque all the way, no ghosting over the page)
    ft(lens, { x: 0, y: -8, scale: 1 }, { x: 820, y: -18, scale: 1 }, 9.28, 0.34, "power3.in");
    ft(jan, { x: 0, y: -6, scale: 1 }, { x: 820, y: -16, scale: 1 }, 9.34, 0.34, "power3.in");
    snap([lens, jan], { opacity: 1 }, { opacity: 0 }, 9.69);
  });
})();
