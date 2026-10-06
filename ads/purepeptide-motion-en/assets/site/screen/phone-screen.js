// iPhone 17 Pro screen running Safari on the real purepeptide.care captures (assets/site/raw/<page>.png, 402 pt wide @3x).
//   el.innerHTML = PhoneScreen.markup(["home", "product_3", "cart3"], "assets/site/");   inside a 402x874 .ps root
//   PhoneScreen.scroll(el, "product_3", 980)   page scroll in points; the site's sticky header re-sticks at the top
//   PhoneScreen.show(el, "cart3")              only that page layer visible (or animate .ps-layer[data-page=..] yourself)
//   .ps-tap: touch ring (no finger) — set left/top in screen points, animate scale + opacity.
// Screen points: x 0..402, y 0..874; the page viewport starts at y 62 (under the status bar), Safari's floating bar
// covers y ~796..846. A page point (px, py) at scroll s is on screen at (px, 62 + py - s).
window.PhoneScreen = {
  NAV_Y: 46, NAV_H: 71, TOP: 62,
  markup(pages, base = "assets/site/") {
    const sig = '<svg width="19" height="12" viewBox="0 0 19 12"><g fill="#fff"><rect x="0" y="8" width="3.2" height="4" rx=".8"/><rect x="5" y="5.5" width="3.2" height="6.5" rx=".8"/><rect x="10" y="3" width="3.2" height="9" rx=".8"/><rect x="15" y="0" width="3.2" height="12" rx=".8"/></g></svg>';
    const wifi = '<svg width="17" height="12" viewBox="0 0 17 12"><g fill="#fff"><path d="M8.5 2.3c2.4 0 4.6.9 6.3 2.5l1.2-1.2C14 1.6 11.4.5 8.5.5S3 1.6 1 3.6l1.2 1.2c1.7-1.6 3.9-2.5 6.3-2.5z"/><path d="M8.5 5.6c1.5 0 2.9.6 3.9 1.5l1.2-1.2C12.3 4.6 10.5 3.8 8.5 3.8S4.7 4.6 3.4 5.9l1.2 1.2c1-.9 2.4-1.5 3.9-1.5z"/><path d="M8.5 8.9c.7 0 1.3.3 1.8.7L8.5 11.5 6.7 9.6c.5-.4 1.1-.7 1.8-.7z"/></g></svg>';
    const bat = '<svg width="28" height="13" viewBox="0 0 28 13"><rect x=".5" y=".5" width="24" height="12" rx="3.8" fill="none" stroke="#fff" stroke-opacity=".45"/><rect x="2.2" y="2.2" width="20.6" height="8.6" rx="2.4" fill="#fff"/><path d="M26 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2z" fill="#fff" fill-opacity=".45"/></svg>';
    const back = '<svg width="12" height="20" viewBox="0 0 12 20"><path d="M10 2 2 10l8 8" fill="none" stroke="#111827" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const more = '<svg width="20" height="5" viewBox="0 0 20 5"><g fill="#111827"><circle cx="2.5" cy="2.5" r="2.2"/><circle cx="10" cy="2.5" r="2.2"/><circle cx="17.5" cy="2.5" r="2.2"/></g></svg>';
    const layers = [].concat(pages).map((p, i) => `<div class="ps-layer" data-page="${p}" style="visibility:${i ? "hidden" : "visible"}">` +
      `<img class="ps-img" src="${base}raw/${p}.png" alt=""><div class="ps-nav" style="background-image:url('${base}raw/${p}.png')"></div></div>`).join("");
    return layers +
      `<div class="ps-status"><div class="ps-time">9:41</div><div class="ps-icons">${sig}${wifi}${bat}</div></div>` +
      `<div class="ps-safari"><div class="ps-glass ps-back">${back}</div><div class="ps-glass ps-url">purepeptide.care</div><div class="ps-glass ps-more">${more}</div></div>` +
      `<div class="ps-home"></div><div class="ps-tap"></div>`;
  },
  layer(el, page) { return el.querySelector(`.ps-layer[data-page="${page}"]`); },
  scroll(el, page, y) {
    const L = this.layer(el, page);
    L.querySelector(".ps-img").style.transform = `translateY(${-y}px)`;
    L.querySelector(".ps-nav").style.top = Math.max(0, this.NAV_Y - y) + "px";
  },
  show(el, page) { el.querySelectorAll(".ps-layer").forEach(L => (L.style.visibility = L.dataset.page === page ? "visible" : "hidden")); },
};
