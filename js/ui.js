// The HTML overlay on top of the 3D canvas: meters, the card, the body map,
// chronicle, help, sound settings and the legacy screen.
import { BALANCE, PARTS, SYNERGIES, CHARACTERS, ENDINGS, LEGACY } from './config.js';
import { DRAW, partGeom, portrait } from './parts2d.js';
import {
  G, METERS, METER_LABEL, cardById, resolveChoice, fillText, mass, synergies, rotateShape, placeAt,
  placementError, occupancy, graft, liftPart, putBack, removeToTray, canPayMove,
} from './state.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f1 = n => (+n).toFixed(1);
let H = {};          // handlers from main.js
let busy = false;
export const setBusy = b => { busy = b; };
export const isBusy = () => busy;

/* =====================================================================
   Markup
   ===================================================================== */
const HUD = `
  <div class="top" id="hud-top">
    <header>
      <div><h1>The Hungering Dark</h1><div class="day" id="day"></div></div>
      <div class="hbtns">
        <button class="ghost" id="btn-log">Chronicle</button>
        <button class="ghost" id="btn-sound" aria-label="Sound settings">♪</button>
        <button class="ghost" id="btn-help" aria-label="How to play">?</button>
      </div>
    </header>
    <div class="meters" id="meters"></div>
  </div>
  <div class="middle">
    <div class="scene-tag" id="scene-tag"></div>
    <button id="btn-body">The Body<span class="n" id="tray-n">0</span></button>
  </div>
  <div class="bottom" id="hud-bottom">
    <div id="card">
      <div class="hint l" id="hint-l"></div><div class="hint r" id="hint-r"></div>
      <div class="card-top"><div class="portrait" id="portrait"></div><div class="who" id="who"></div></div>
      <p class="ctext" id="ctext"></p>
    </div>
    <div class="choices"><button class="choice l" id="ch-l"></button><button class="choice r" id="ch-r"></button></div>
    <div class="swipe-note">Swipe the card or tap a choice · drag the scene to look around</div>
  </div>`;

const OVERLAYS = `
  <div class="overlay" id="body-ov"><div class="dialog">
    <div class="sheet-head"><h2>The Body</h2><button class="ghost" id="body-close">Done</button></div>
    <div class="mass" id="mass"></div>
    <div id="grid-wrap"><svg id="grid-svg"></svg></div>
    <div class="msg" id="body-msg"></div>
    <div id="part-info"></div>
    <div class="pbtns">
      <button id="bt-rot">Rotate</button>
      <button id="bt-move">Move<br><small>−${BALANCE.moveCost} Devotion</small></button>
      <button id="bt-rem">Remove<br><small>−${BALANCE.moveCost} Devotion</small></button>
      <button id="bt-cancel">Cancel</button>
    </div>
    <h3>Offerings</h3><div id="tray"></div>
    <h3>Synergies</h3><div id="syn-list"></div>
  </div></div>

  <div class="overlay" id="log-ov"><div class="dialog">
    <div class="sheet-head"><h2>Chronicle</h2><button class="ghost" id="log-close">Close</button></div>
    <div id="log"></div>
  </div></div>

  <div class="overlay" id="sound-ov"><div class="dialog small">
    <div class="sheet-head"><h2>Sound</h2><button class="ghost" id="sound-close">Close</button></div>
    <label class="srow"><input type="checkbox" id="snd-mute"> Mute</label>
    <label class="srow">Volume <input type="range" id="snd-vol" min="0" max="1" step="0.05"></label>
    <p class="note" id="snd-files"></p>
    <p class="note">Sound starts after your first tap. Put your own .mp3 or .ogg files in <code>assets/audio/</code> to replace any sound (see the README there).</p>
  </div></div>

  <div class="overlay" id="help-ov"><div class="dialog">
    <h2>How to Play</h2>
    <p>In a ring of standing stones behind the old chapel, something has hatched. You lead the cult that feeds it.</p>
    <ul>
      <li><b>Each day is one card.</b> Swipe left or right, or tap a choice. The day only moves on when you decide.</li>
      <li><b>Four meters:</b> Hunger, Devotion, Dread and Suspicion. If any one empties or fills completely, the cult is finished. While you drag a card, glowing dots show which meters will move, but not by how much.</li>
      <li><b>The Body.</b> Some choices give you parts. Open <i>The Body</i> to graft them onto the grid. Parts must touch the flesh. Each part changes the daily drift of the meters, and some parts placed side by side create <b>synergies</b>. Moving or removing a part costs ${BALANCE.moveCost} Devotion.</li>
      <li><b>Growth.</b> The more mass you graft, the bigger it grows: Spawn, Larva, Abomination, Elder Horror. The grid grows with it, and parts open up new choices on the cards.</li>
      <li><b>The cult.</b> Your cultists wander the circle. Tap one to learn about them. Some choices cost a cultist, and a starving horror helps itself.</li>
      <li><b>Look around.</b> Drag the scene to orbit, pinch or scroll to zoom.</li>
      <li>Every ending is remembered, and each death leaves an <b>inheritance</b> for your next cult. Can you find all ten endings?</li>
    </ul>
    <div class="row"><button class="ghost" id="btn-abandon">Abandon this cult</button><button class="ghost" id="btn-wipe">Erase all memory</button></div>
    <button class="primary" id="help-close">Descend</button>
  </div></div>

  <div class="overlay" id="legacy-ov"><div class="dialog">
    <h2 id="lg-title"></h2>
    <div class="legacy-art"><img id="lg-art" alt="Your horror as it was at the end"></div>
    <p id="lg-text"></p>
    <div class="epitaph"><i id="lg-epitaph"></i><small id="lg-days"></small></div>
    <div class="inherit" id="lg-inherit"></div>
    <h3 id="lg-count"></h3>
    <div class="endings" id="lg-endings"></div>
    <button class="primary" id="lg-new">Begin a new cult</button>
  </div></div>`;

/* =====================================================================
   Meters
   ===================================================================== */
const ICONS = {
  hunger: 'M12,10 Q20,4 28,10 L30,22 Q20,34 10,22 Z M14,14 l2,6 l2,-6 M22,14 l2,6 l2,-6',
  devotion: 'M17,14 h6 v20 h-6 Z M20,4 Q24,9 20,13 Q16,9 20,4 Z',
  dread: 'M4,20 Q20,6 36,20 Q20,34 4,20 Z M20,15 a5,5 0 1,0 0.01,0 Z',
  suspicion: 'M17,18 h6 l-1,18 h-4 Z M20,3 Q28,10 24,17 Q22,13 20,18 Q18,13 16,17 Q12,10 20,3 Z',
};
const METER_COL = { hunger: '#c8323a', devotion: '#e9d8a0', dread: '#8d6bd1', suspicion: '#e07a2c' };
function buildMeters() {
  $('meters').innerHTML = METERS.map(m => `
    <div class="meter" id="m-${m}"><span class="dot"></span>
      <svg viewBox="0 0 40 40"><defs><clipPath id="clip-${m}"><rect id="clipr-${m}" x="0" y="40" width="40" height="0"/></clipPath></defs>
        <path d="${ICONS[m]}" fill="#2a2230" stroke="#4a3a50" stroke-width="1" fill-rule="evenodd"/>
        <path d="${ICONS[m]}" fill="${METER_COL[m]}" clip-path="url(#clip-${m})" fill-rule="evenodd"/></svg>
      <div class="mlabel">${METER_LABEL[m]}</div></div>`).join('');
}
function renderMeters() {
  METERS.forEach(m => {
    const v = Math.max(0, Math.min(100, G.run.meters[m]));
    const r = $('clipr-' + m);
    r.setAttribute('y', f1(40 - v * .4)); r.setAttribute('height', f1(v * .4));
    $('m-' + m).classList.toggle('danger', v < BALANCE.dangerBand || v > 100 - BALANCE.dangerBand);
  });
}
export function flashMeters(before) {
  METERS.forEach(m => {
    const d = G.run.meters[m] - before[m], el = $('m-' + m);
    if (Math.abs(d) < .5) return;
    el.classList.remove('up', 'down'); void el.offsetWidth; el.classList.add(d > 0 ? 'up' : 'down');
  });
}
function previewMeters(side) {
  const ch = side && G.run.card && !G.run.ended ? resolveChoice(cardById(G.run.card.id), side) : null;
  METERS.forEach(m => $('m-' + m).classList.toggle('preview', !!(ch && ch.fx && ch.fx[m])));
}

/* =====================================================================
   Card
   ===================================================================== */
function renderCard() {
  if (!G.run.card) return;
  const card = cardById(G.run.card.id), who = CHARACTERS[card.who];
  $('portrait').innerHTML = portrait(who.style, who.style === 'horror' && H.horrorImage ? H.horrorImage() : null);
  $('who').innerHTML = `${esc(fillText(who.name))}<small>${esc(who.role)}</small>`;
  $('ctext').textContent = fillText(card.text);
  ['l', 'r'].forEach(side => {
    const ch = resolveChoice(card, side);
    const tags = [];
    if (ch.unlockedBy) tags.push(`<span class="u">✦ ${esc(PARTS[ch.unlockedBy].name)}</span>`);
    if (ch.part) tags.push('<span class="p">+ a part</span>');
    if (ch.cult < 0 || ch.slain || ch.leave) tags.push('<span class="k">− a cultist</span>');
    if (ch.cult > 0) tags.push(`<span>+${ch.cult} cultist${ch.cult > 1 ? 's' : ''}</span>`);
    $('ch-' + side).innerHTML = esc(fillText(ch.label)) + (tags.length ? `<span class="tags">${tags.join(' · ')}</span>` : '');
    $('hint-' + side).textContent = fillText(ch.label);
  });
}
export function animateCardOut(side) {
  const c = $('card');
  c.classList.remove('dragging');
  c.style.transform = `translateX(${side === 'l' ? -120 : 120}%) rotate(${side === 'l' ? -18 : 18}deg)`;
  c.style.opacity = '0';
  previewMeters(null);
  return new Promise(res => setTimeout(() => {
    c.style.transition = 'none';
    c.style.transform = ''; c.style.opacity = '0';
    $('hint-l').style.opacity = 0; $('hint-r').style.opacity = 0;
    void c.offsetWidth;
    c.style.transition = '';
    res();
  }, 320));
}
export function cardIn() {
  const c = $('card');
  c.style.opacity = '';
  c.classList.remove('enter'); void c.offsetWidth; c.classList.add('enter');
}
function setupSwipe() {
  const c = $('card');
  let x0 = null, dx = 0, id = null;
  c.addEventListener('pointerdown', e => {
    if (busy || G.run.ended) return;
    x0 = e.clientX; dx = 0; id = e.pointerId;
    c.setPointerCapture(id);
    c.classList.add('dragging');
  });
  c.addEventListener('pointermove', e => {
    if (x0 == null || e.pointerId !== id) return;
    dx = e.clientX - x0;
    c.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    const side = dx < -25 ? 'l' : dx > 25 ? 'r' : null;
    $('hint-l').style.opacity = side === 'l' ? Math.min(1, -dx / 90) : 0;
    $('hint-r').style.opacity = side === 'r' ? Math.min(1, dx / 90) : 0;
    previewMeters(side);
  });
  const end = e => {
    if (x0 == null || e.pointerId !== id) return;
    x0 = null;
    c.classList.remove('dragging');
    if (Math.abs(dx) > 90 && !busy) H.choose(dx < 0 ? 'l' : 'r');
    else { c.style.transform = ''; $('hint-l').style.opacity = 0; $('hint-r').style.opacity = 0; previewMeters(null); }
  };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
  ['l', 'r'].forEach(side => {
    const b = $('ch-' + side);
    b.addEventListener('pointerenter', () => previewMeters(side));
    b.addEventListener('pointerleave', () => previewMeters(null));
    b.addEventListener('click', () => { if (!busy) H.choose(side); });
  });
}

/* =====================================================================
   The Body (grid editor)
   ===================================================================== */
let sel = null;          // { from: 'tray'|'grid'|'move', uid, rot, part, shape }
let hoverCell = null;
function openBody() {
  if (G.run.ended || busy) return;
  sel = null; hoverCell = null;
  $('body-msg').textContent = '';
  renderBody();
  show('body-ov');
}
function closeBody() {
  if (sel && sel.from === 'move') { putBack(sel.part); sel = null; }
  hide('body-ov');
  renderAll();
}
function selShape() {
  if (!sel || sel.from === 'grid') return null;
  if (sel.from === 'move') return rotateShape(sel.shape, sel.rot);
  return rotateShape(PARTS[G.run.tray.find(t => t.uid === sel.uid).type].shape, sel.rot);
}
function fmtFx(def) {
  const out = [];
  if (def.drift) for (const k in def.drift) out.push(`${def.drift[k] > 0 ? '+' : '−'}${Math.abs(def.drift[k])} ${METER_LABEL[k]}/day`);
  if (def.mult) for (const k in def.mult) out.push(`${METER_LABEL[k]} gains ×${def.mult[k]}`);
  return out.join(', ');
}
function partInfo(type) {
  const d = PARTS[type];
  const syns = SYNERGIES.filter(s => s.a === type || s.b === type).map(s => s.name);
  return `<b>${d.name}</b> · ${d.shape.length} cell${d.shape.length > 1 ? 's' : ''}<br>${d.desc}` +
    (fmtFx(d) ? `<br><span class="fx">${fmtFx(d)}</span>` : '') + (syns.length ? `<br>Synergies: ${syns.join(', ')}` : '');
}
function renderBody() {
  const run = G.run, N = run.grid, st = BALANCE.stages[run.stage], next = BALANCE.stages[run.stage + 1];
  $('mass').innerHTML = `Stage: <b>${st.name}</b> · Mass ${mass()}` + (next ? ` / ${next.mass} to become ${next.name}` : ' · fully grown') + ` · Grid ${N}×${N}`;
  const syn = synergies();
  let s = `<defs><filter id="bm-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".08"/></filter>
    <radialGradient id="bm-core"><stop offset="0" stop-color="#ff8a6a"/><stop offset=".5" stop-color="#b0182a"/><stop offset="1" stop-color="#3a0408"/></radialGradient></defs>`;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) s += `<rect x="${x + .04}" y="${y + .04}" width=".92" height=".92" rx=".12" fill="#0b090d" stroke="#2a2130" stroke-width=".03"/>`;
  run.parts.forEach(p => {
    const col = PARTS[p.type].color, selected = sel && sel.uid === p.uid;
    s += `<clipPath id="bmc-${p.uid}">${p.cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`).join('')}</clipPath>`;
    s += p.cells.map(([x, y]) => `<rect x="${x + .04}" y="${y + .04}" width=".92" height=".92" rx=".14" fill="${col}" fill-opacity=".35" stroke="${selected ? '#ffcf7a' : col}" stroke-width="${selected ? .07 : .04}"/>`).join('');
    const g = partGeom(p, N, 1);
    const inner = DRAW[p.type]({ ...g, cs: 1, uid: p.uid, idp: 'bm', col, flesh: { vein: '#ff6a5a' } });
    s += `<g clip-path="url(#bmc-${p.uid})"><g transform="translate(${N / 2} ${N / 2})">${inner}</g></g>`;
  });
  syn.forEach(q => {
    const c = cells => [cells.reduce((t, k) => t + k[0], 0) / cells.length + .5, cells.reduce((t, k) => t + k[1], 0) / cells.length + .5];
    const ca = c(q.a.cells), cb = c(q.b.cells);
    s += `<line x1="${f1(ca[0])}" y1="${f1(ca[1])}" x2="${f1(cb[0])}" y2="${f1(cb[1])}" stroke="#ffcf7a" stroke-width=".09" stroke-linecap="round" stroke-dasharray=".15 .1" filter="url(#bm-glow)"><animate attributeName="stroke-opacity" values=".4;1;.4" dur="1.6s" repeatCount="indefinite"/></line>`;
    s += `<circle cx="${f1((ca[0] + cb[0]) / 2)}" cy="${f1((ca[1] + cb[1]) / 2)}" r=".12" fill="#ffcf7a"/>`;
  });
  const shape = selShape();
  if (shape && hoverCell) {
    const cells = placeAt(shape, hoverCell[0], hoverCell[1]);
    const ok = !placementError(cells, null);
    s += cells.map(([x, y]) => `<rect x="${x + .06}" y="${y + .06}" width=".88" height=".88" rx=".14" fill="${ok ? '#9be0b0' : '#e2686b'}" fill-opacity=".35" stroke="${ok ? '#9be0b0' : '#e2686b'}" stroke-width=".05"/>`).join('');
  }
  $('grid-svg').setAttribute('viewBox', `0 0 ${N} ${N}`);
  $('grid-svg').innerHTML = s;

  $('tray').innerHTML = run.tray.length ? run.tray.map(t => {
    const sh = PARTS[t.type].shape, w = Math.max(...sh.map(c => c[0])) + 1, h = Math.max(...sh.map(c => c[1])) + 1, m = Math.max(w, h);
    const tiles = sh.map(([x, y]) => `<rect x="${x + (m - w) / 2 + .05}" y="${y + (m - h) / 2 + .05}" width=".9" height=".9" rx=".15" fill="${PARTS[t.type].color}" stroke="#000" stroke-width=".04"/>`).join('');
    return `<button class="titem ${sel && sel.uid === t.uid ? 'sel' : ''}" data-uid="${t.uid}"><svg viewBox="0 0 ${m} ${m}">${tiles}</svg>${esc(PARTS[t.type].name)}</button>`;
  }).join('') : '<div class="empty">No parts waiting. Some choices on the cards will give you parts.</div>';

  let info = 'Tap a part in the Offerings tray, then tap the grid to graft it. Parts must touch the flesh. Tap a grafted part to inspect, move or remove it.';
  if (sel) {
    const type = sel.from === 'tray' ? run.tray.find(t => t.uid === sel.uid).type : sel.from === 'move' ? sel.part.type : run.parts.find(p => p.uid === sel.uid).type;
    info = partInfo(type) + (sel.from === 'move' ? '<br><i>Tap a cell to put it down.</i>' : sel.from === 'tray' ? '<br><i>Tap a cell to graft it.</i>' : '');
  }
  $('part-info').innerHTML = info;
  const gridSel = sel && sel.from === 'grid' ? run.parts.find(p => p.uid === sel.uid) : null;
  const movable = gridSel && !PARTS[gridSel.type].locked && canPayMove();
  $('bt-rot').disabled = !(sel && sel.from !== 'grid');
  $('bt-move').disabled = !movable;
  $('bt-rem').disabled = !movable;
  $('bt-cancel').disabled = !sel;

  const counts = {};
  syn.forEach(q => counts[q.syn.name] = (counts[q.syn.name] || 0) + 1);
  $('syn-list').innerHTML = SYNERGIES.map(q => `<div class="syn ${counts[q.name] ? 'on' : ''}">${counts[q.name] ? '✦' : '·'} <b>${q.name}</b>${counts[q.name] > 1 ? ' ×' + counts[q.name] : ''}: ${q.desc} <span class="fx">(${fmtFx(q)})</span></div>`).join('');
}
function cellFromEvent(e) {
  const r = $('grid-svg').getBoundingClientRect(), N = G.run.grid;
  const x = Math.floor((e.clientX - r.left) / r.width * N), y = Math.floor((e.clientY - r.top) / r.height * N);
  return x >= 0 && y >= 0 && x < N && y < N ? [x, y] : null;
}
function bodyMsg(t) { $('body-msg').textContent = t; clearTimeout(bodyMsg.tm); bodyMsg.tm = setTimeout(() => $('body-msg').textContent = '', 2200); }
function gridTap(e) {
  const cell = cellFromEvent(e);
  if (!cell) return;
  const shape = selShape();
  if (shape) {
    const cells = placeAt(shape, cell[0], cell[1]);
    const item = sel.from === 'tray' ? G.run.tray.find(t => t.uid === sel.uid) : sel.part;
    const res = graft(item, cells, sel.from === 'move');
    if (res.error) { bodyMsg(res.error); hoverCell = cell; renderBody(); return; }
    sel = null; hoverCell = null;
    renderBody();
    H.afterGraft(res, item.uid);
    return;
  }
  const uid = occupancy()[cell[0] + ',' + cell[1]];
  sel = uid ? { from: 'grid', uid } : null;
  renderBody();
}
function setupBody() {
  const g = $('grid-svg');
  g.addEventListener('click', gridTap);
  g.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !selShape()) return;
    const c = cellFromEvent(e);
    if (String(c) !== String(hoverCell)) { hoverCell = c; renderBody(); }
  });
  $('tray').addEventListener('click', e => {
    const b = e.target.closest('.titem');
    if (!b) return;
    if (sel && sel.from === 'move') putBack(sel.part);
    const uid = +b.dataset.uid;
    sel = sel && sel.uid === uid ? null : { from: 'tray', uid, rot: 0 };
    renderBody();
  });
  $('bt-rot').addEventListener('click', () => { if (sel && sel.from !== 'grid') { sel.rot = (sel.rot + 1) % 4; renderBody(); } });
  $('bt-cancel').addEventListener('click', () => { if (sel && sel.from === 'move') putBack(sel.part); sel = null; hoverCell = null; renderBody(); });
  $('bt-move').addEventListener('click', () => {
    if (!sel || sel.from !== 'grid') return;
    const r = liftPart(sel.uid);
    if (r.error) { bodyMsg(r.error); return; }
    const p = r.part, mx = Math.min(...p.cells.map(c => c[0])), my = Math.min(...p.cells.map(c => c[1]));
    // a moved part keeps the orientation it had on the body
    sel = { from: 'move', uid: p.uid, part: p, rot: 0, shape: p.cells.map(([x, y]) => [x - mx, y - my]) };
    renderBody();
  });
  $('bt-rem').addEventListener('click', () => {
    if (!sel || sel.from !== 'grid') return;
    const r = removeToTray(sel.uid);
    if (r.error) { bodyMsg(r.error); return; }
    sel = null;
    renderBody();
    H.afterGraft({ grown: [], newSynergies: [] }, null);
  });
  $('body-close').addEventListener('click', closeBody);
}

/* =====================================================================
   Small things: overlays, toast, tooltip, flash
   ===================================================================== */
const show = id => $(id).classList.add('show');
const hide = id => $(id).classList.remove('show');
export function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.tm);
  toast.tm = setTimeout(() => t.classList.remove('show'), 2600);
}
export function redFlash(strength = .7) {
  const f = $('flash');
  f.style.setProperty('--a', strength);
  f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
}
export function showTip(id, x, y) {
  const c = G.run.cultists.find(c => c.id === id);
  if (!c) return;
  const tip = $('tip');
  tip.innerHTML = `<b>${esc(c.name)}</b>: ${esc(c.quirk)}`;
  tip.style.left = Math.max(120, Math.min(innerWidth - 120, x)) + 'px';
  tip.style.top = (y - 14) + 'px';
  tip.classList.add('show');
  clearTimeout(showTip.tm);
  showTip.tm = setTimeout(() => tip.classList.remove('show'), 2800);
}

/* =====================================================================
   Legacy screen
   ===================================================================== */
export function showLegacy(id, image) {
  const run = G.run, meta = G.meta, e = ENDINGS[id];
  $('lg-title').textContent = e.title;
  $('lg-art').src = image || '';
  $('lg-art').parentElement.style.setProperty('--tint', e.tint);
  $('lg-text').textContent = e.text;
  $('lg-epitaph').textContent = `"${e.epitaph}"`;
  $('lg-days').textContent = `${BALANCE.stages[run.stage].name} · survived ${run.day} day${run.day === 1 ? '' : 's'}`;
  $('lg-inherit').textContent = `Inheritance for your next cult: ${LEGACY[e.reward].text}`;
  const ids = Object.keys(ENDINGS), found = ids.filter(k => meta.endings[k]).length;
  $('lg-count').textContent = `Endings discovered: ${found} / ${ids.length}`;
  $('lg-endings').innerHTML = ids.map(k => `<span class="${meta.endings[k] ? 'got' : ''}">${meta.endings[k] ? '✦ ' + ENDINGS[k].title : '??? ' + ENDINGS[k].hint}</span>`).join('');
  show('legacy-ov');
}

/* =====================================================================
   Render + init
   ===================================================================== */
export function renderAll() {
  const run = G.run, st = BALANCE.stages[run.stage];
  let dayTxt = `Day ${run.day} · ${st.name}`;
  if (run.elderDay != null) dayTxt += ` · Long Night in ${Math.max(0, BALANCE.ascensionDays - (run.day - run.elderDay))}`;
  $('day').textContent = dayTxt;
  $('scene-tag').textContent = `${run.cultists.length} faithful`;
  $('tray-n').textContent = run.tray.length;
  $('btn-body').classList.toggle('has', run.tray.length > 0);
  renderMeters();
  if (!run.ended) renderCard();
  $('log').innerHTML = run.log.map(l => `<p class="${l.kind}"><span class="d">Day ${l.day}</span>${esc(l.text)}</p>`).join('');
}
function reportLayout() {
  const top = $('hud-top').getBoundingClientRect().bottom;
  const bottom = innerHeight - $('hud-bottom').getBoundingClientRect().top;
  H.onLayout && H.onLayout(top, bottom);
}
export function initUI(handlers) {
  H = handlers;
  $('hud').innerHTML = HUD;
  $('overlays').insertAdjacentHTML('beforeend', OVERLAYS);
  buildMeters();
  setupSwipe();
  setupBody();
  $('btn-body').addEventListener('click', openBody);
  $('btn-log').addEventListener('click', () => show('log-ov'));
  $('log-close').addEventListener('click', () => hide('log-ov'));
  $('btn-help').addEventListener('click', () => show('help-ov'));
  $('help-close').addEventListener('click', () => { G.meta.seenHelp = true; H.save(); hide('help-ov'); });
  $('btn-sound').addEventListener('click', () => {
    $('snd-mute').checked = !!G.meta.muted;
    $('snd-vol').value = G.meta.volume ?? H.defaultVolume;
    const files = H.loadedAudio ? H.loadedAudio() : [];
    $('snd-files').textContent = files.length ? `Using your files: ${files.join(', ')}.` : '';
    show('sound-ov');
  });
  $('sound-close').addEventListener('click', () => hide('sound-ov'));
  $('snd-mute').addEventListener('change', e => H.onMute(e.target.checked));
  $('snd-vol').addEventListener('input', e => H.onVolume(+e.target.value));
  $('btn-abandon').addEventListener('click', () => {
    if (!confirm('Abandon this cult and begin again? Your endings and inheritance are kept.')) return;
    hide('help-ov'); H.onNewRun();
  });
  $('btn-wipe').addEventListener('click', () => {
    if (!confirm('Erase everything, including discovered endings?')) return;
    hide('help-ov'); H.onWipe();
  });
  $('lg-new').addEventListener('click', () => { hide('legacy-ov'); H.onNewRun(); });
  // tapping outside a dialog closes the light overlays
  ['log-ov', 'sound-ov'].forEach(id => $(id).addEventListener('click', e => { if (e.target.id === id) hide(id); }));
  new ResizeObserver(reportLayout).observe($('hud-bottom'));
  new ResizeObserver(reportLayout).observe($('hud-top'));
  addEventListener('resize', reportLayout);
  if (!G.meta.seenHelp) show('help-ov');
}
