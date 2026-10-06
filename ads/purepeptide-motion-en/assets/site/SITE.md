# Real purepeptide.care captures — iPhone 17 Pro (402 x 874 pt viewport, @3x)

Captured from the live site on 2026-10-06 with `tools/capture_site.cjs` (headless Chromium, iPhone Safari UA).
All coordinates below are in **page points** (CSS px at 1x; the PNGs are 3x = 1206 px wide). Full-page PNGs have the
sticky header un-stuck (it sits at page y 46..117); `phone-screen.js` re-sticks it while scrolling.

Screen component: `screen/phone-screen.css` + `screen/phone-screen.js` (status bar 9:41 tinted with the site's
#123A78 banner colour, the page, iOS 26 Safari floating glass bar "purepeptide.care", home indicator, `.ps-tap` touch
ring). A page point (px, py) at scroll s is on screen at (px, 62 + py − s). Visible page band = s .. s+734 (Safari bar
covers screen y 796..846). Stills rendered with `tools/render_screens.cjs`: `screen_home.png`, `screen_product.png`
(product_3 at scroll 1000), `screen_cart.png` (cart3 at scroll 150) — 1206 x 2622, used as Blender screen textures.

| file (raw/) | page height | what it shows |
|---|---|---|
| gate_top.png / gate_checked_top.png | viewport only | "Researcher verification" modal over the blurred home (21+ and researcher boxes unticked / ticked, "Enter PurePeptide" button at y 612, h 50) — authentic compliance moment |
| home.png (+ _top) | 9117 | banner "Research use only · Not for human or animal consumption · 21+", header, hero vial, "RESEARCH PEPTIDES / **Purity, proven.**" (H1 y 354 h 67), "See the tests" chip (Janoshik mini-logo, y 503), "Explore the catalog" button (x 41 y 542 w 320 h 50), ticker "24H DISPATCH · COLD-CHAIN SHIPPING · HPLC ≥ 99% PURITY" (y ~698), cards "≥ 99% HPLC purity / 100% Lab tested" (y ~810) |
| shop.png | 4402 | Shop grid. **Avoid**: category chips "Cognitive / Growth / Recovery" (y 355), card badges (Recovery/Growth/Cognitive), MT-2 (y 1470–1680) and Retatrutide (y 1857–2060) cards. Usable: "Volume pricing — 2 vials of the same compound: 5% off. 3 or more…" card (y 410–530) |
| product.png / product_2.png / product_3.png | 5748 | BPC-157 / TB-500 page; product_2 = "2 vials −5%" selected, product_3 = "3+ vials −8%" selected. Bundle & Save options: 1 vial (y 1084), 2 vials −5% MOST POPULAR (y 1160), **3+ vials −8% BEST VALUE (x 20 y 1235 w 362 h 66, centre 201,1268)**; price line y ~1325: product = $84.99, product_3 = **$234.57 ~~$254.97~~ $78.19 / vial**; **"Add to cart · $234.57" button x 20 y 1443 w 362 h 52 (centre 201,1469)**; quantity stepper y ~1000–1050 shows 3. **Avoid** (never readable on screen): "RECOVERY" pill (y 662), the description "…blend studied for tissue repair…" (y ~760–800), "Pairs with bacteriostatic water for reconstitution" (y 1510), "Buy with G Pay" button (y ~1640), anything below y 1600 (recovery research copy). Good framing: scroll ≈ 1000 and crop the phone/zoom so the band y 1060..1500 is what reads. |
| drawer_top.png | viewport | product page right after Add to cart: green notice "3 × "BPC-157 / TB-500" have been added to your cart. [View cart]", cart badge 3 |
| cart1.png | 2712 | 1 vial: progress card "**$115.01 away from free shipping**" (y 259, bar ~1/3), item $84.99, stepper "+" button (x 211 y 495 w 30 h 30), Summary, "Proceed to checkout" (x 45 y 1228 w 312 h 50) |
| cart2.png | 2733 | 2 vials (same compound): "**$38.52 away from free shipping**" (bar ~3/4), "**Volume discount −5%**" (x 117 y 453, green), $80.74/vial, line total **$161.48**, "+" at (x 211 y 515) |
| cart3.png | 2733 | 3 vials: "**Free shipping unlocked!**" (y 259, bar full, card turns teal-outlined), "**Volume discount −8%**" (x 117 y 453), $78.19/vial, **$234.57**; "Proceed to checkout" at y 1249. **Avoid** the "BAC Water … reconstituting your peptides" upsell card (y 760–900) in readable close-ups |
| cart_from_product.png | — | same as cart3 reached from the product page (with the "added" notice) |
| nav.png | 71 pt | the sticky header alone (cart badge 0) |

Facts the captures prove (usable in the ad):
- The volume discount is **per compound**: 2 vials of the same compound −5 %, 3 or more −8 %, applied automatically
  (cart line "Volume discount −8%", no coupon needed). Example: 3 × BPC-157 / TB-500 = $234.57 instead of $254.97.
- Free shipping over $200 shows as a progress bar in the cart: "$115.01 away" → "$38.52 away" → "Free shipping unlocked!".
- Site banner on every page: "Research use only · Not for human or animal consumption · 21+"; researcher verification gate on entry.

Best compliant click-path for the iPhone sequence: home hero ("Purity, proven.") → product page at the Bundle & Save
block → tap "3+ vials −8%" (price $84.99 → $234.57, ~~$254.97~~) → tap "Add to cart · $234.57" → cart: "Volume discount
−8%" + "Free shipping unlocked!" → tap "Proceed to checkout". Alternative inside the cart: tap "+" twice on cart1 →
cart2 → cart3 (discount line appears −5 % then −8 %, free-shipping bar fills) — the most satisfying micro-interaction.
Never visit the shop grid in a readable way (effect-category chips, MT-2, Retatrutide).
