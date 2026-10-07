// P0-A clean recapture of purepeptide.care for the ad (SCENES §0.6–0.7, BRIEF §10).
//   node tools/capture_clean.cjs   -> assets/site/clean/{home,product,cart1,cart2,cart3}.png (402 pt wide @3x) + clean/meta.json
// Derived from tools/capture_site.cjs (researcher gate, 3 vials of the SAME compound) plus the MASK / hideRecon idea of
// purepeptide-proof-en/tools/record_site.cjs. Every hide is visibility:hidden, so layout and coordinates equal raw/.
//   hidden: home hero lede (.hero__sub, "…certificate of analysis"), .hero__jano, .pd__cat, .pd__coa, .pd__desc,
//           .pd__pairs, .pp-express, .cart-addon, every "SECURE CHECKOUT" .marquee__item and its dot; plus a safety
//           sweep that hides any remaining leaf whose text matches the forbidden list (logged in meta.hidden_sweep).
//   marquee frozen (animation:none) with "HPLC ≥ 99% PURITY · THIRD-PARTY TESTED" in the 0–402 window.
//   painted with the page background: home y ≥ 734, product y ≥ 1500, cart1 y ≥ 1450, cart2/cart3 y ≥ 1470.
//   cropped: home 0–900, product/cart* 0–1900. Carts: the Summary card is closed (height) 2 pt above the paint line.
// States: product = fresh visitor, "1 vial" selected (badge 0) — the S07 state; product_2 / product_3 = alternates with
// "2 vials −5%" / "3+ vials −8%" selected; cart1/2/3 = 1, 2, 3 × BPC-157 / TB-500 (id 93).
// Never adds Retatrutide (86) or MT-2 (95).
const puppeteer = require('/home/user/DevDoctor/ads/purepeptide-film-en/node_modules/puppeteer-core');
const fs = require('fs');
const OUT = __dirname + '/../assets/site/clean/';
fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const HIDE = '.cartdw,.cookiebar,#pp-cookiebar,.cart-fab,.pp-agegate{display:none!important} header.nav{position:relative!important}' +
  'html{scroll-behavior:auto!important}' +
  '.hero__sub,.hero__jano,.pd__cat,.pd__coa,.pd__desc,.pd__pairs,.pp-express,.cart-addon,.pp-clean-hide{visibility:hidden!important}' +
  '.marquee__track{animation:none!important}';
const FORBID = /certif|\bCOA\b|bacterio|reconstitut|Retatrutide|Recovery|repair|G\s?Pay|Pharmaceutical|SECURE|MT-2/i;
const PLAN = {
  home: { paint: 734, crop: 900 },
  product: { paint: 1500, crop: 1900 },
  product_2: { paint: 1500, crop: 1900 },
  product_3: { paint: 1500, crop: 1900 },
  cart1: { paint: 1450, crop: 1900 },
  cart2: { paint: 1470, crop: 1900 },
  cart3: { paint: 1470, crop: 1900 },
};
const meta = { captured: new Date().toISOString().slice(0, 10), source: 'https://purepeptide.care', viewport: '402x874 @3x',
  note: 'coordinates in page points; every hide is visibility:hidden so boxes equal raw/meta.json; a page point (px,py) at scroll s is on screen at (px, 62+py-s)' };
const wait = ms => new Promise(r => setTimeout(r, ms));

async function session(fn) {
  const b = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb', '--proxy-server=' + (process.env.HTTPS_PROXY || '')] });
  const p = await b.newPage();
  await p.setUserAgent(UA);
  await p.setViewport({ width: 402, height: 874, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await fn(p);
  await b.close();
}
async function go(p, url) {   // retries: the agent proxy sometimes answers "upstream request failed"
  for (let k = 1; ; k++) {
    try { await p.goto(url, { waitUntil: 'networkidle2', timeout: 90000 }); await wait(1500);
      if (await p.evaluate(() => !!document.querySelector('header.nav') && !!document.querySelector('.ruo-bar'))) return;
    } catch (e) { if (k >= 5) throw e; }
    if (k >= 5) throw new Error('page did not load: ' + url);
    console.log('retry', k, url); await wait(3000 * k);
  }
}
async function enter(p) {   // researcher verification gate + cookie notice
  await p.evaluate(() => { document.querySelectorAll('[data-agegate-check]').forEach(c => { if (!c.checked) c.click() }); document.getElementById('pp-agegate-enter')?.click();
    const bt = document.querySelectorAll('.cookiebar__btn'); if (bt[1]) bt[1].click(); document.cookie = 'pp_consent=accepted; path=/'; });
  await wait(1200);
}
async function clean(p, name) {
  const tag = await p.addStyleTag({ content: HIDE });
  // walk the page once so lazy images / reveal-on-scroll content are in their final state, then back to the top
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < Math.min(H, PLAN[name].crop + 900); y += 400) { await p.evaluate(y => scrollTo(0, y), y); await wait(120); }
  await p.evaluate(() => scrollTo(0, 0)); await wait(600);
  return p.evaluate((FORBID_SRC, plan) => {
    const FORBID = new RegExp(FORBID_SRC, 'i');
    const out = { marquee: null, sweep: [] };
    // marquee: freeze, hide SECURE CHECKOUT items and the dot after each, park HPLC at x 14
    const track = document.querySelector('.marquee__track');
    if (track) {
      track.style.transform = 'none';
      const items = [...track.querySelectorAll('.marquee__item')];
      for (const it of items) if (/secure/i.test(it.textContent)) {
        it.classList.add('pp-clean-hide');
        const d = it.nextElementSibling; if (d && d.classList.contains('marquee__dot')) d.classList.add('pp-clean-hide');
      }
      const tr = track.getBoundingClientRect();
      const first = items.find(i => /HPLC/i.test(i.textContent));
      const off = first.getBoundingClientRect().x - tr.x;
      track.style.transform = `translateX(${14 - off}px)`;
      out.marquee = { translateX: 14 - off, window: [...items].filter(i => { const r = i.getBoundingClientRect(); return r.right > 0 && r.x < 402 && getComputedStyle(i).visibility !== 'hidden'; }).map(i => i.textContent.trim()) };
    }
    // safety sweep: smallest visible elements (within the crop) whose own text matches the forbidden list
    for (const e of document.body.querySelectorAll('*')) {
      if (!e.innerText || getComputedStyle(e).visibility === 'hidden') continue;
      const r = e.getBoundingClientRect(); const y = r.y + scrollY;
      if (r.width === 0 || y > plan.paint || y + r.height < 0) continue;
      if (!FORBID.test(e.innerText)) continue;
      if ([...e.children].some(c => c.innerText && FORBID.test(c.innerText))) continue;
      e.classList.add('pp-clean-hide');
      out.sweep.push({ cls: String(e.className).slice(0, 50), text: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 80), y: Math.round(y) });
    }
    // cart: close the Summary card just above the paint line (its own border, radius and shadow; nothing above moves)
    const note = document.querySelector('.cart-note');
    if (note) {
      let card = note.parentElement;
      while (card && card !== document.body) { const cs = getComputedStyle(card); if (parseFloat(cs.borderTopLeftRadius) > 0 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') break; card = card.parentElement; }
      if (card && card !== document.body) {
        const top = card.getBoundingClientRect().y + scrollY;
        card.style.cssText += `;box-sizing:border-box;height:${plan.paint - 2 - top}px;overflow:hidden`;
        out.card = { cls: String(card.className).slice(0, 50), y0: Math.round(top), y1: plan.paint - 2 };
      }
    }
    // paint the page background (the colour just above the paint line at the left edge) over everything at/after the
    // paint line, with a 12 pt feather so shadows that cross the line fade instead of stopping on a hard edge
    scrollTo(0, plan.paint - 400);
    let n = document.elementFromPoint(2, 397), bg = 'rgba(0, 0, 0, 0)';
    for (; n && n.nodeType === 1; n = n.parentElement) { bg = getComputedStyle(n).backgroundColor; if (bg !== 'rgba(0, 0, 0, 0)' && !/, 0\)$/.test(bg)) break; }
    if (!n || n.nodeType !== 1) bg = getComputedStyle(document.body).backgroundColor;
    scrollTo(0, 0);
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:0;top:${plan.paint}px;width:100%;height:${document.documentElement.scrollHeight - plan.paint}px;background:linear-gradient(${bg.replace('rgb(', 'rgba(').replace(')', ', 0)')} 0, ${bg} 12px);z-index:2147483000;pointer-events:none`;
    document.body.appendChild(d);
    out.paint = { y: plan.paint, color: bg };
    return out;
  }, FORBID.source, PLAN[name]);
}
async function shot(p, name, extra = {}) {
  const info = await clean(p, name);
  await wait(500);
  await p.screenshot({ path: OUT + name + '.png', clip: { x: 0, y: 0, width: 402, height: PLAN[name].crop }, captureBeyondViewport: true });
  const data = await p.evaluate((crop, paint) => {
    const vis = e => { for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.visibility === 'hidden' || s.display === 'none') return false; } return true; };
    const boxes = [...document.querySelectorAll('h1,h2,h3,button,a,.price,.amount,input,img,span,p,li,strong,del,ins')].map(e => {
      const r = e.getBoundingClientRect(); const t = (e.innerText || e.alt || e.value || '').trim();
      return { e, tag: e.tagName, cls: String(e.className || '').slice(0, 50), text: t.slice(0, 90), x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
    }).filter(o => o.w > 0 && o.h > 0 && o.text && o.text.length < 90 && o.y < paint && o.x < 402 && o.x + o.w > 0 && vis(o.e)).map(({ e, ...o }) => o);
    const q = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +(r.y + scrollY).toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), text: (e.innerText || '').trim().slice(0, 90), style: e.getAttribute('style') }; };
    return { url: location.href, height_pt: crop, page_height_pt: document.documentElement.scrollHeight, boxes,
      els: { ship_bar: q('.ship-bar'), ship_msg: q('.ship-bar__msg'), ship_track: q('.ship-bar__track'), ship_fill: q('.ship-bar__fill'),
        h1: q('h1'), eyebrow: q('.hero__eyebrow, .hero .eyebrow, .hero [class*=eyebrow]'), checkout: q('a.cart-checkout'), add_to_cart: q('.single_add_to_cart_button, button[name=add-to-cart]'), cart_note: q('.cart-note'),
        badge: (() => { const e = [...document.querySelectorAll('header.nav .cart-btn *')].find(e => /^\d+$/.test((e.innerText || '').trim()) && e.getBoundingClientRect().width > 0); if (!e) return null; const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +(r.y + scrollY).toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), text: e.innerText.trim() }; })(),
        plus: [...document.querySelectorAll('[data-qty-step="1"]')].map(e => { const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +(r.y + scrollY).toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) }; }),
        bundle: [...document.querySelectorAll('button.bundle-opt')].map(e => { const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +(r.y + scrollY).toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), text: e.innerText.replace(/\s+/g, ' ').trim(), active: e.classList.contains('is-active') }; }) } };
  }, PLAN[name].crop, PLAN[name].paint);
  meta[name] = { ...data, crop: [0, PLAN[name].crop], paint: info.paint, card_closed: info.card || null, marquee: info.marquee, hidden_sweep: info.sweep, ...extra };
  console.log(name, data.url, 'sweep:', JSON.stringify(info.sweep), info.marquee ? JSON.stringify(info.marquee) : '');
}

(async () => {
  await session(async p => {                                       // fresh visitor: home, product (1 vial selected, badge 0)
    await go(p, 'https://purepeptide.care/?lang=en'); await enter(p);
    await go(p, 'https://purepeptide.care/?lang=en');
    await shot(p, 'home');
    await go(p, 'https://purepeptide.care/product/bpc-157-tb-500/');
    const act = await p.evaluate(() => [...document.querySelectorAll('button.bundle-opt')].map(b => b.classList.contains('is-active')));
    await shot(p, 'product', { bundle_active: act });
    for (const [i, n] of [[1, 'product_2'], [2, 'product_3']]) {   // alternates: "2 vials −5%" / "3+ vials −8%" selected
      await go(p, 'https://purepeptide.care/product/bpc-157-tb-500/');
      await p.evaluate(i => document.querySelectorAll('button.bundle-opt')[i].click(), i); await wait(800);
      await shot(p, n);
    }
  });
  await session(async p => {                                       // fresh visitor: 1, 2, 3 vials of the same compound
    await go(p, 'https://purepeptide.care/?lang=en'); await enter(p);
    for (const n of [1, 2, 3]) { await go(p, 'https://purepeptide.care/cart/?add-to-cart=93&quantity=1'); await go(p, 'https://purepeptide.care/cart/'); await shot(p, 'cart' + n); }
  });
  const old = fs.existsSync(OUT + 'meta.json') ? JSON.parse(fs.readFileSync(OUT + 'meta.json', 'utf8')) : {};
  fs.writeFileSync(OUT + 'meta.json', JSON.stringify({ ...old, ...meta }, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
