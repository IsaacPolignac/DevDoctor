// Real site test of https://purepeptide.care (FR), recorded frame by frame at 30 fps.
// A scripted user: passes the researcher gate, opens the catalog, picks BPC-157 / TB-500, checks the purity,
// adds to cart. Virtual-time capture: CSS animations/transitions slowed x5 (CDP Animation.setPlaybackRate) and
// real time paced at 1/5 speed, so each frame = 1/30 s of site time. Page loads are cut (not recorded).
// Masked for ad compliance (no effect claims / no excluded products): category chips & tags, "étudié pour…"
// descriptions, BAC water / reconstitution upsell, MT-2 & Retatrutide cards, mistranslated "Détails du compte".
// Usage: node tools/record_site.cjs <outDir>   -> outDir/f_00001.jpg … + outDir/marks.json
const path = require("path");
const fs = require("fs");
const puppeteer = require(path.resolve(__dirname, "../node_modules/puppeteer-core"));
const OUT = process.argv[2] || path.resolve(__dirname, "../assets/site-test/frames");
const CHROME = process.env.CHROME;
const W = 1440, H = 900, DPR = 1.3334;
const SLOW = 5, FPS = 30;
const MASK = `
.chips,.product__tag,.product__desc,.product__details,.shop-promos,.pd__cat,.pd__desc,.pd__pairs{display:none!important}
article.product[data-name*="retatrutide"],article.product[data-name*="mt-2"],article.product[data-name*="melanotan"],article.product[data-name*="bac"]{display:none!important}
#pp-cookiebar,.woocommerce-notices-wrapper,.pp-rec-hide{display:none!important}
html{scroll-behavior:auto!important}
#pp-rec-cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:30px;height:38px;transform-origin:3px 2px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))}
#pp-rec-ring{position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:3px solid #16A48F;opacity:0}
.pp-rec-hl{outline:3px solid #16A48F!important;outline-offset:6px;border-radius:10px;box-shadow:0 0 0 10px rgba(22,164,143,.14)!important;transition:none!important}
`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
  const b = await puppeteer.launch({ executablePath: CHROME, args: ["--no-sandbox", "--hide-scrollbars", "--force-color-profile=srgb"] });
  const pg = await b.newPage();
  await pg.setViewport({ width: W, height: H, deviceScaleFactor: DPR });
  await pg.evaluateOnNewDocument((css) => {
    const add = () => {
      if (document.getElementById("pp-rec-style")) return;
      const s = document.createElement("style");
      s.id = "pp-rec-style";
      s.textContent = css;
      document.documentElement.appendChild(s);
      const c = document.createElement("div");
      c.id = "pp-rec-cursor";
      c.innerHTML = '<svg width="30" height="38" viewBox="0 0 46 58"><path d="M4 3 L4 47 L15.5 36.5 L23.5 54 L31 50.5 L23 33.5 L39 33.5 Z" fill="#111" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>';
      const r = document.createElement("div");
      r.id = "pp-rec-ring";
      document.documentElement.appendChild(r);
      document.documentElement.appendChild(c);
    };
    // hide the reconstitution upsell (BAC water) wherever it is rendered (cart drawer)
    const hideRecon = () => {
      document.querySelectorAll(".cartdw *").forEach((e) => {
        if (e.children.length && /reconstituer/i.test(e.textContent) && e.parentElement && /Code promo|Subtotal|Sous-total/i.test(e.parentElement.textContent) && !/Code promo|Subtotal|Sous-total/i.test(e.textContent)) e.classList.add("pp-rec-hide");
      });
    };
    document.addEventListener("DOMContentLoaded", add);
    new MutationObserver(() => { add(); hideRecon(); }).observe(document, { childList: true, subtree: true });
  }, MASK);
  const cdp = await pg.target().createCDPSession();
  await cdp.send("Animation.enable");

  // pre-roll (not recorded): cookies accepted so only the researcher gate shows
  await pg.goto("https://purepeptide.care/?lang=fr", { waitUntil: "networkidle2", timeout: 90000 });
  await pg.evaluate(() => { const bt = document.querySelectorAll(".cookiebar__btn"); if (bt[1]) bt[1].click(); });
  await pg.evaluate(() => { document.cookie = "pp_consent=accepted; path=/"; });
  await sleep(600);
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 / SLOW });

  const _eval = pg.evaluate.bind(pg);
  pg.evaluate = async (...a) => {
    for (let k = 0; ; k++) {
      try { return await _eval(...a); } catch (e) {
        if (k > 30 || !/context|destroyed|detached|navigat/i.test(String(e))) throw e;
        await sleep(400);
        t0 = Date.now() - (n * 1000 * SLOW) / FPS;
      }
    }
  };
  let n = 0, t0 = Date.now(), mx = 720, my = 560;
  const marks = [];
  const mark = (name) => marks.push({ name, frame: n, t: +(n / FPS).toFixed(3) });
  const setCursor = async (x, y, press) => {
    await pg.mouse.move(x, y);
    await pg.evaluate((x, y, p) => {
      const c = document.getElementById("pp-rec-cursor");
      if (c) c.style.transform = `translate(${x - 3}px,${y - 2}px) scale(${p ? 0.82 : 1})`;
    }, x, y, !!press);
  };
  const shot = async () => {
    n++;
    await pg.screenshot({ path: path.join(OUT, `f_${String(n).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
    const due = t0 + (n * 1000 * SLOW) / FPS; // pace real time at 1/SLOW
    const w = due - Date.now();
    if (w > 0) await sleep(w);
    else t0 += -w; // screenshot slower than budget: shift the clock (keeps animation speed consistent)
  };
  const hold = async (sec) => { for (let i = 0; i < Math.round(sec * FPS); i++) await shot(); };
  const move = async (x, y, sec) => {
    const x0 = mx, y0 = my, k = Math.max(1, Math.round(sec * FPS));
    for (let i = 1; i <= k; i++) { const e = ease(i / k); await setCursor(x0 + (x - x0) * e, y0 + (y - y0) * e); await shot(); }
    mx = x; my = y;
  };
  const center = async (sel, dy) => pg.evaluate((s, dy) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 + (dy || 0) }; }, sel, dy || 0);
  const ring = async (x, y) => pg.evaluate((x, y) => { const r = document.getElementById("pp-rec-ring"); r.animate([{ transform: `translate(${x}px,${y}px) scale(.3)`, opacity: .9 }, { transform: `translate(${x}px,${y}px) scale(1.6)`, opacity: 0 }], { duration: 450, easing: "ease-out" }); }, x, y);
  const click = async (sel, nav) => {
    await setCursor(mx, my, true); await shot();
    await ring(mx, my);
    if (nav) {
      await Promise.all([pg.waitForNavigation({ waitUntil: "networkidle2", timeout: 90000 }), pg.click(sel)]);
      for (let k = 0; k < 40; k++) { try { await pg.waitForNetworkIdle({ idleTime: 800, timeout: 20000 }); await pg.evaluate(() => document.readyState); break; } catch (e) { await sleep(500); } }
      await sleep(1200);
      await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 / SLOW });
      await sleep(300); t0 = Date.now() - (n * 1000 * SLOW) / FPS;
      await setCursor(mx, my);
    } else {
      await pg.click(sel);
      await setCursor(mx, my, false);
    }
  };
  const scrollTo = async (y1, sec) => {
    const y0 = await pg.evaluate(() => scrollY), k = Math.round(sec * FPS);
    for (let i = 1; i <= k; i++) { await pg.evaluate((y) => scrollTo(0, y), y0 + (y1 - y0) * ease(i / k)); await shot(); }
  };

  // ---------------- storyboard ----------------
  await setCursor(mx, my);
  mark("gate");
  await hold(0.4);
  const cbs = await pg.$$eval(".pp-agegate__check", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + 26, y: r.top + r.height / 2 }; }));
  await move(cbs[0].x, cbs[0].y, 0.55); await click(".pp-agegate__check:nth-of-type(1)"); mark("check1"); await hold(0.2);
  await move(cbs[1].x, cbs[1].y, 0.35); await click(".pp-agegate__check:nth-of-type(2)"); mark("check2"); await hold(0.2);
  let c = await center("#pp-agegate-enter");
  await move(c.x, c.y, 0.45); mark("enter"); await click("#pp-agegate-enter"); await hold(0.9);
  mark("home");
  c = await pg.evaluate(() => { const a = [...document.querySelectorAll("a")].find((a) => /Explorer le catalogue/.test(a.textContent) && a.getBoundingClientRect().top > 0 && a.getBoundingClientRect().top < 900); const r = a.getBoundingClientRect(); a.id = "pp-rec-cta"; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await move(c.x, c.y, 0.7); await hold(0.2); mark("catalog-click"); await click("#pp-rec-cta", true);
  mark("shop"); await hold(0.3);
  await scrollTo(150, 0.8);
  c = await pg.evaluate(() => { const a = document.querySelector('article.product[data-name="bpc-157 / tb-500"] .product__media'); a.id = "pp-rec-bpc"; const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await move(c.x, c.y, 0.8); await hold(0.6); mark("product-click"); await click("#pp-rec-bpc", true);
  mark("product"); await hold(0.4);
  c = await center(".pd__purity");
  await move(c.x - 40, c.y, 0.7);
  await pg.evaluate(() => document.querySelector(".pd__purity").classList.add("pp-rec-hl")); mark("purity-hl");
  await hold(1.4);
  await pg.evaluate(() => document.querySelector(".pd__purity").classList.remove("pp-rec-hl"));
  await scrollTo(260, 0.7);
  c = await center(".pd__buy .add-btn");
  await move(c.x, c.y, 0.6); await hold(0.2); mark("add-click"); await click(".pd__buy .add-btn", true);
  await pg.evaluate(() => scrollTo(0, 260)); await hold(0.3);
  c = await center("#cart-fab");
  await move(c.x, c.y, 0.6); await hold(0.15); mark("cart-click"); await click("#cart-fab"); await hold(0.2); mark("cart-open");
  await hold(2.2);
  mark("end");
  fs.writeFileSync(path.join(OUT, "marks.json"), JSON.stringify({ fps: FPS, frames: n, marks }, null, 1));
  console.log("frames", n, JSON.stringify(marks));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
