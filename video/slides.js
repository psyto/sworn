// Shared slide runtime for pitch.html / demo.html. __fill(d) writes every [data-k] slot of the scenes
// in d.scenes and THROWS on an empty one; [data-src] <img> slots take a data: URL. __show(id) shows a
// scene and runs its cues. __overflow(id) reports anything outside its card or the frame.
//
// Cues: any element with data-at="S" gets the class "in" S seconds after its scene starts (a .fade fades
// in; flow.css gives other cue classes their motion); data-off="S" adds "off" at S. A .fade without
// data-at fades in one after another, 450 ms apart. A .count element counts up to the text its slot
// was filled with, ending on exactly that text.

// ── the shared "Only hashes cross this line" motif (flow.css), rendered into each <div data-flow> ──────
// data-flow lists the cue times: cards, wit (witness leaves), ring (prover runs), chip (digest emitted),
// cross (digest crosses the line), badge, ok, bad. The digest slot is [data-k="digest"], filled from
// the fixture by the recorder; nothing here is a figure.
const DOC = '<svg class="dfx-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 1.5h6l3 3v10h-9z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M9.5 1.5v3h3M5.5 8h5M5.5 10.5h5M5.5 13h3" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>';
const LOCK = '<svg class="dfx-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
for (const el of document.querySelectorAll("[data-flow]")) {
  const t = Object.fromEntries(el.dataset.flow.split(",").map((p) => p.split(":")).map(([k, v]) => [k.trim(), +v]));
  const c = t.cards ?? 0.4, step = t.step ?? 0.35;
  const at = (k) => (t[k] === undefined ? "" : ` data-at="${t[k]}"`);
  const btn = t.btn === undefined ? "" : `<div class="dfx-btn"${at("btn")}><span>Start local proof job</span></div>`;
  el.classList.add("dfx");
  el.innerHTML = `<div class="dfx-stage"><span class="dfx-tint fade" data-at="${c}"></span>
  <div class="dfx-card card dfx-private fade" data-at="${c}"><p class="dfx-eb">Private · Zone operator</p>
    <div class="dfx-ledger"><span><i>sender → recipient</i><i>amount</i></span><span><i>sender → recipient</i><i>amount</i></span><span><i>account → withdraw</i><i>amount</i></span></div>
    <p class="dfx-lock"${at("lock")}>${LOCK} Never published</p>${btn}
    <div class="dfx-slot"><span class="dfx-doc">${DOC} witness</span></div></div>
  <span class="dfx-wire fade" data-at="${c + step}"></span>
  <div class="dfx-card card dfx-prover fade" data-at="${c + step}"><p class="dfx-eb">Sworn prover · SP1</p><div class="dfx-h">Tempo's own Zone code</div>
    <p class="dfx-run"><span class="dfx-ring"${at("ring")}${t.chip === undefined ? "" : ` data-off="${t.chip}"`}></span><span>re-executes the batch</span></p>
    <div class="dfx-slot"><span class="dfx-chip cue"${at("chip")} data-k="digest"></span></div></div>
  <div class="dfx-bnd fade" data-at="${c + 2 * step}"><span class="dfx-bnd-l"${at("cross")}>Only hashes<br>cross this line</span></div>
  <div class="dfx-card card dfx-public fade" data-at="${c + 3 * step}"><p class="dfx-eb">Public · Tempo</p><div class="dfx-h">SwornZoneVerifier</div>
    <p class="dfx-badge cue"${at("badge")}>✓ ZoneBatchVerified</p>
    <div class="dfx-slot"><span class="dfx-chip cue"${t.cross === undefined ? "" : ` data-at="${t.cross + 1.4}"`} data-k="digest"></span></div></div>
  <span class="dfx-wire fade" data-at="${c + 4 * step}"></span>
  <div class="dfx-card card dfx-reviewer fade" data-at="${c + 4 * step}"><p class="dfx-eb">Reviewer</p><div class="dfx-h">verify(…)</div>
    <p class="dfx-ok cue"${at("ok")}>✓ true</p><p class="dfx-bad cue"${at("bad")}>✗ InvalidProof() — one field changed</p>
    <div class="dfx-slot"></div></div>
  <span class="dfx-tok dfx-tok-wit"${at("wit")}>${DOC}</span>
  <span class="dfx-tok dfx-tok-dig"${at("cross")} data-k="digest"></span>
  <span class="dfx-tok dfx-tok-pulse"${t.ok === undefined ? "" : ` data-at="${t.ok - 0.6}"`}></span>
</div>`;
}

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

/** Count a filled number ("24,443,996", "891 s") up from zero, ending on exactly its text. */
function countUp(el, ms = 1800) {
  const final = el.dataset.final ?? (el.dataset.final = el.textContent);
  const m = final.match(/^([^\d]*)([\d,]+)(.*)$/);
  if (!m) return;
  const target = +m[2].replace(/,/g, ""), comma = m[2].includes(",");
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3);
    const n = Math.round(target * e);
    el.textContent = p < 1 ? m[1] + (comma ? n.toLocaleString("en-US") : String(n)) + m[3] : final;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function cue(el, cls) {
  el.classList.add(cls);
  if (cls === "in" && el.classList.contains("count")) countUp(el);
}

window.__show = async (id) => {
  for (const s of document.querySelectorAll(".scene")) s.classList.toggle("on", s.id === id);
  const t0 = performance.now();
  const later = (el, s, cls) => setTimeout(() => cue(el, cls), Math.max(0, +s * 1000 - (performance.now() - t0)));
  for (const p of document.querySelectorAll(`#${id} [data-at]`)) later(p, p.dataset.at, "in");
  for (const p of document.querySelectorAll(`#${id} [data-off]`)) later(p, p.dataset.off, "off");
  for (const p of document.querySelectorAll(`#${id} .fade:not([data-at])`)) { p.classList.add("in"); await sleep(450); }
};
window.__overflow = (id) => {
  for (const s of document.querySelectorAll(".scene")) s.classList.toggle("on", s.id === id);
  for (const p of document.querySelectorAll(`#${id} .fade, #${id} [data-at]`)) { p.style.transition = "none"; p.classList.add("in"); }
  for (const p of document.querySelectorAll(`#${id} [data-off]`)) p.classList.add("off"); // the scene's final state
  const W = innerWidth, H = innerHeight, bad = [];
  const name = (el) => el.dataset.k ?? el.dataset.src ?? (el.className ? "." + String(el.className.baseVal ?? el.className).split(" ")[0] : el.tagName);
  for (const el of document.querySelectorAll(`#${id} *`)) {
    if (el.closest(".dfx-tok")) continue; // travelling tokens are measured at rest inside the stage below
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) bad.push(`${name(el)} leaves the frame (${Math.round(r.left)},${Math.round(r.top)})–(${Math.round(r.right)},${Math.round(r.bottom)})`);
    const card = el.parentElement?.closest(".card,.step,.tile,.term");
    if (card) {
      const c = card.getBoundingClientRect();
      if (r.right > c.right + 1 || r.bottom > c.bottom + 1 || r.left < c.left - 1) bad.push(`${name(el)} spills out of its ${String(card.className).split(" ")[0]}`);
    }
    if ((el.dataset.k || el.tagName === "PRE") && (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "visible"))
      bad.push(`${name(el)} is clipped horizontally`);
  }
  for (const s of document.querySelectorAll(`#${id} .card,#${id} .term`))
    if (s.scrollWidth > s.clientWidth + 1 || s.scrollHeight > s.clientHeight + 1) bad.push(`${name(s)} content overflows (${s.scrollWidth}×${s.scrollHeight} > ${s.clientWidth}×${s.clientHeight})`);
  return bad;
};
