// Shared slide runtime for pitch.html / demo.html. __fill(d) writes every [data-k] slot of the scenes
// in d.scenes and THROWS on an empty one; [data-src] <img> slots take a data: URL. __show(id) shows a
// scene and fades its parts in. __overflow(id) reports anything outside its card or the frame.
window.__fill = (d) => {
  for (const id of d.hide ?? []) document.getElementById(id)?.remove(); // alternative cards not used in this take
  for (const el of document.querySelectorAll("[data-k],[data-src]")) {
    const sc = el.closest(".scene");
    if (sc && !d.scenes.includes(sc.id)) continue;
    const k = el.dataset.k ?? el.dataset.src;
    const v = d[k];
    if (v === undefined || v === null || String(v).trim() === "") throw new Error(`slot "${k}" in #${sc ? sc.id : "page"} has no value`);
    if (el.dataset.src) el.src = String(v); else el.textContent = String(v);
  }
  return true;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A .fade with data-at="S" appears S seconds after the scene starts (timed to the narration); the rest
// fade in one after another, 450 ms apart, from the scene start.
window.__show = async (id) => {
  for (const s of document.querySelectorAll(".scene")) s.classList.toggle("on", s.id === id);
  const t0 = performance.now();
  for (const p of document.querySelectorAll(`#${id} .fade[data-at]`))
    setTimeout(() => p.classList.add("in"), Math.max(0, +p.dataset.at * 1000 - (performance.now() - t0)));
  for (const p of document.querySelectorAll(`#${id} .fade:not([data-at])`)) { p.classList.add("in"); await sleep(450); }
};
window.__overflow = (id) => {
  for (const s of document.querySelectorAll(".scene")) s.classList.toggle("on", s.id === id);
  for (const p of document.querySelectorAll(`#${id} .fade`)) { p.style.transition = "none"; p.classList.add("in"); }
  const W = innerWidth, H = innerHeight, bad = [];
  const name = (el) => el.dataset.k ?? el.dataset.src ?? (el.className ? "." + String(el.className).split(" ")[0] : el.tagName);
  for (const el of document.querySelectorAll(`#${id} *`)) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) bad.push(`${name(el)} leaves the frame (${Math.round(r.left)},${Math.round(r.top)})–(${Math.round(r.right)},${Math.round(r.bottom)})`);
    const card = el.parentElement?.closest(".card,.step,.tile,.term");
    if (card) {
      const c = card.getBoundingClientRect();
      if (r.right > c.right + 1 || r.bottom > c.bottom + 1 || r.left < c.left - 1) bad.push(`${name(el)} spills out of its ${card.className.split(" ")[0]}`);
    }
    if ((el.dataset.k || el.tagName === "PRE") && (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "visible"))
      bad.push(`${name(el)} is clipped horizontally`);
  }
  for (const s of document.querySelectorAll(`#${id} .card,#${id} .term`))
    if (s.scrollWidth > s.clientWidth + 1 || s.scrollHeight > s.clientHeight + 1) bad.push(`${name(s)} content overflows (${s.scrollWidth}×${s.scrollHeight} > ${s.clientWidth}×${s.clientHeight})`);
  return bad;
};
