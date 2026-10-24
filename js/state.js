// Game state, rules and saving. No DOM or rendering in here: functions return
// lists of events ("a cultist was eaten", "it grew") for the UI, scene and audio to show.
import { BALANCE, PARTS, SYNERGIES, LEGACY, CULT } from './config.js';
import { CARDS } from './cards.js';

export const METERS = ['hunger', 'devotion', 'dread', 'suspicion'];
export const METER_LABEL = { hunger: 'Hunger', devotion: 'Devotion', dread: 'Dread', suspicion: 'Suspicion' };
export const G = { run: null, meta: null };   // the live run and the persistent memory between runs

const pick = a => a[Math.floor(Math.random() * a.length)];
const asList = v => v == null ? [] : Array.isArray(v) ? v : [v];
export const cardById = id => CARDS.find(c => c.id === id);
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/* ---------- Saving ---------- */
export function save() {
  try { localStorage.setItem(BALANCE.saveKey, JSON.stringify({ v: 4, run: G.run, meta: G.meta })); } catch (e) { /* storage unavailable */ }
}
function freshMeta() {
  return { endings: {}, inheritance: null, runs: 0, bestDay: 0, seenHelp: false, volume: null, muted: false };
}
export function loadGame() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(BALANCE.saveKey)); } catch (e) { /* corrupt */ }
  if (d && d.v === 4) { G.run = d.run; G.meta = { ...freshMeta(), ...d.meta }; return; }
  G.meta = freshMeta();
  // carry discovered endings over from older versions
  for (const k of BALANCE.legacyKeys) {
    try {
      const old = JSON.parse(localStorage.getItem(k));
      if (old && old.meta && old.meta.endings) Object.assign(G.meta.endings, old.meta.endings);
    } catch (e) { /* ignore */ }
  }
  G.run = null;
}
export function wipeMemory() {
  const keepAudio = { volume: G.meta.volume, muted: G.meta.muted };
  G.meta = { ...freshMeta(), ...keepAudio, seenHelp: true };
}

/* ---------- Run setup ---------- */
function makeCultist() {
  const run = G.run;
  const used = run.cultists.map(c => c.name);
  const free = CULT.names.filter(n => !used.includes(n));
  return { id: run.nextCid++, name: pick(free.length ? free : CULT.names), quirk: pick(CULT.quirks), robe: pick(CULT.robes) };
}
export function newRun() {
  const meta = G.meta;
  const run = G.run = {
    day: 1, meters: { ...BALANCE.startMeters }, cultists: [], nextCid: 1, seed: Math.floor(Math.random() * 1e9),
    grid: BALANCE.stages[0].grid, stage: 0, parts: [], tray: [], nextUid: 1,
    flags: {}, history: [], chains: [{ card: 'intro', day: 1 }], log: [], card: null, elderDay: null, ended: null,
  };
  const o = run.grid / 2 - 1;
  run.parts.push({ uid: run.nextUid++, type: 'core', cells: [[o, o], [o + 1, o], [o, o + 1], [o + 1, o + 1]] });
  BALANCE.startTray.forEach(t => addToTray(t));
  let extraCult = 0;
  const inh = meta.inheritance && LEGACY[meta.inheritance];
  if (inh) {
    if (inh.part) addToTray(inh.part);
    if (inh.meters) Object.assign(run.meters, inh.meters);
    if (inh.cultists) extraCult = inh.cultists;
    addLog(`Inheritance: ${inh.text}`, 'part');
  }
  meta.inheritance = null;
  for (let i = 0; i < BALANCE.startCultists + extraCult; i++) run.cultists.push(makeCultist());
  meta.runs++;
  drawNextCard();
  save();
}
export function addLog(text, kind) {
  const run = G.run;
  run.log.unshift({ day: run.day, text, kind: kind || '' });
  if (run.log.length > 120) run.log.length = 120;
}

/* ---------- Parts and the body grid ---------- */
export function addToTray(type) {
  if (type === 'random' || type === 'rare') {
    const pool = Object.keys(PARTS).filter(k => PARTS[k].rarity && (type === 'random' || PARTS[k].rarity === 'rare'));
    type = pick(pool);
  }
  G.run.tray.push({ uid: G.run.nextUid++, type });
  return type;
}
export function rotateShape(cells, rot) {
  let c = cells.map(p => p.slice());
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) c = c.map(([x, y]) => [-y, x]);
  const mx = Math.min(...c.map(p => p[0])), my = Math.min(...c.map(p => p[1]));
  return c.map(([x, y]) => [x - mx, y - my]);
}
export function occupancy(exceptUid) {
  const m = {};
  G.run.parts.forEach(p => { if (p.uid !== exceptUid) p.cells.forEach(([x, y]) => m[x + ',' + y] = p.uid); });
  return m;
}
// Where a shape lands if tapped at (cx, cy): its middle cell goes under the finger,
// nudged back inside the grid if it would hang off an edge.
export function placeAt(shape, cx, cy) {
  const mx = shape.reduce((s, p) => s + p[0], 0) / shape.length, my = shape.reduce((s, p) => s + p[1], 0) / shape.length;
  const piv = shape.slice().sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my))[0];
  const cells = shape.map(([x, y]) => [x - piv[0] + cx, y - piv[1] + cy]);
  const N = G.run.grid;
  const minX = Math.min(...cells.map(p => p[0])), maxX = Math.max(...cells.map(p => p[0]));
  const minY = Math.min(...cells.map(p => p[1])), maxY = Math.max(...cells.map(p => p[1]));
  const dx = minX < 0 ? -minX : maxX >= N ? N - 1 - maxX : 0;
  const dy = minY < 0 ? -minY : maxY >= N ? N - 1 - maxY : 0;
  return cells.map(([x, y]) => [x + dx, y + dy]);
}
export function placementError(cells, exceptUid) {
  const N = G.run.grid, occ = occupancy(exceptUid);
  if (cells.some(([x, y]) => x < 0 || y < 0 || x >= N || y >= N)) return 'It does not fit there.';
  if (cells.some(([x, y]) => occ[x + ',' + y])) return 'Something is already growing there.';
  if (!cells.some(([x, y]) => NB.some(([a, b]) => occ[(x + a) + ',' + (y + b)]))) return 'It must touch the flesh.';
  return '';
}
// Would removing this part leave other parts cut off from the core?
export function wouldDisconnect(uid) {
  const occ = occupancy(uid);
  const core = G.run.parts.find(p => p.type === 'core');
  const seen = new Set(core.cells.map(c => c[0] + ',' + c[1])), q = [...seen];
  while (q.length) {
    const [x, y] = q.shift().split(',').map(Number);
    NB.forEach(([a, b]) => { const k = (x + a) + ',' + (y + b); if (occ[k] && !seen.has(k)) { seen.add(k); q.push(k); } });
  }
  return Object.keys(occ).some(k => !seen.has(k));
}
export const mass = () => G.run.parts.filter(p => p.type !== 'core').reduce((s, p) => s + p.cells.length, 0);
export const hasPart = t => G.run.parts.some(p => p.type === t);
export const canPayMove = () => G.run.meters.devotion > BALANCE.moveCost;

export function synergies() {
  const run = G.run, occ = occupancy(), byUid = {};
  run.parts.forEach(p => byUid[p.uid] = p);
  const pairs = new Set();
  run.parts.forEach(p => p.cells.forEach(([x, y]) => NB.forEach(([a, b]) => {
    const o = occ[(x + a) + ',' + (y + b)];
    if (o && o !== p.uid) pairs.add(Math.min(o, p.uid) + '-' + Math.max(o, p.uid));
  })));
  const out = [];
  pairs.forEach(k => {
    const [u1, u2] = k.split('-').map(Number), A = byUid[u1], B = byUid[u2];
    const s = SYNERGIES.find(s => (s.a === A.type && s.b === B.type) || (s.a === B.type && s.b === A.type));
    if (s) out.push({ syn: s, a: A, b: B });
  });
  return out;
}
export function modifiers() {
  const run = G.run;
  const drift = { ...BALANCE.baseDrift }, mult = { hunger: 1, devotion: 1, dread: 1, suspicion: 1 };
  drift.hunger += BALANCE.stageHungerDrift[run.stage];
  const addFx = d => {
    if (d.drift) for (const k in d.drift) drift[k] += d.drift[k];
    if (d.mult) for (const k in d.mult) mult[k] *= d.mult[k];
  };
  run.parts.forEach(p => addFx(PARTS[p.type]));
  synergies().forEach(s => addFx(s.syn));
  return { drift, mult };
}
// Returns the new stage numbers reached (usually none or one).
function checkGrowth() {
  const run = G.run, grown = [];
  for (;;) {
    const next = BALANCE.stages[run.stage + 1];
    if (!next || mass() < next.mass) break;
    run.stage++;
    const shift = (next.grid - run.grid) / 2;
    if (shift > 0) run.parts.forEach(p => p.cells = p.cells.map(([x, y]) => [x + shift, y + shift]));
    run.grid = next.grid;
    if (run.stage === 3 && run.elderDay == null) run.elderDay = run.day;
    addLog(`It grows. The horror is now ${/^[AEIOU]/.test(next.name) ? 'an' : 'a'} ${next.name}.`, 'grown');
    grown.push(run.stage);
  }
  return grown;
}
// Graft a part from the tray, or put down a part that is being moved.
// Returns { grown, newSynergies } or { error }.
export function graft(item, cells, isMove) {
  const run = G.run;
  const err = placementError(cells, null);
  if (err) return { error: err };
  const before = synergies().length;
  if (isMove) run.meters.devotion -= BALANCE.moveCost;
  else {
    run.tray = run.tray.filter(t => t.uid !== item.uid);
    addLog(`${PARTS[item.type].name} grafted onto the horror.`, 'part');
  }
  run.parts.push({ uid: item.uid, type: item.type, cells });
  const grown = checkGrowth();
  const syn = synergies();
  save();
  return { grown, newSynergies: syn.length > before ? syn.slice(before) : [] };
}
export function liftPart(uid) {
  const p = G.run.parts.find(q => q.uid === uid);
  if (!p || PARTS[p.type].locked) return { error: 'It will not come loose.' };
  if (wouldDisconnect(uid)) return { error: 'Other parts grow from it. Move them first.' };
  G.run.parts = G.run.parts.filter(q => q !== p);
  return { part: p };
}
export function putBack(part) { G.run.parts.push(part); }
export function removeToTray(uid) {
  const r = liftPart(uid);
  if (r.error) return r;
  G.run.tray.push({ uid: r.part.uid, type: r.part.type });
  G.run.meters.devotion -= BALANCE.moveCost;
  addLog(`${PARTS[r.part.type].name} torn away and returned to the Offerings.`, '');
  save();
  return {};
}

/* ---------- Cards ---------- */
function condOk(cond) {
  if (!cond) return true;
  const run = G.run, cnt = run.cultists.length;
  if (cond.minDay && run.day < cond.minDay) return false;
  if (cond.minStage != null && run.stage < cond.minStage) return false;
  if (cond.maxStage != null && run.stage > cond.maxStage) return false;
  if (cond.minCult && cnt < cond.minCult) return false;
  if (cond.maxCult != null && cnt > cond.maxCult) return false;
  if (asList(cond.has).some(t => !hasPart(t))) return false;
  if (asList(cond.lacks).some(t => hasPart(t))) return false;
  if (asList(cond.flag).some(f => !run.flags[f])) return false;
  if (asList(cond.noFlag).some(f => run.flags[f])) return false;
  if (cond.below) for (const m in cond.below) if (run.meters[m] >= cond.below[m]) return false;
  if (cond.above) for (const m in cond.above) if (run.meters[m] <= cond.above[m]) return false;
  return true;
}
export function drawNextCard() {
  const run = G.run;
  let card = null;
  // chained cards whose day has come take priority
  run.chains.sort((a, b) => a.day - b.day);
  for (let i = 0; i < run.chains.length; i++) {
    const ch = run.chains[i], c = cardById(ch.card);
    if (!c) { run.chains.splice(i--, 1); continue; }
    if (ch.day > run.day) continue;
    if (condOk({ ...c.cond, chainOnly: undefined })) { card = c; run.chains.splice(i, 1); break; }
    if (run.day - ch.day > BALANCE.chainExpireDays) run.chains.splice(i--, 1);
  }
  if (!card) {
    const recent = new Set(run.history.filter(h => run.day - h.day < BALANCE.noRepeatDays).map(h => h.id));
    let pool = CARDS.filter(c => !(c.cond && c.cond.chainOnly) && condOk(c.cond));
    const fresh = pool.filter(c => !recent.has(c.id));
    if (fresh.length) pool = fresh;
    const total = pool.reduce((s, c) => s + (c.w || 1), 0);
    let r = Math.random() * total;
    card = pool.find(c => (r -= (c.w || 1)) < 0) || pool[0];
  }
  const c = run.cultists.length ? pick(run.cultists) : null;
  run.card = { id: card.id, cid: c ? c.id : null };
  run.history.push({ id: card.id, day: run.day });
  if (run.history.length > 40) run.history.shift();
}
export function ctxName() {
  const run = G.run;
  const c = run.cultists.find(c => c.id === run.card.cid) || run.cultists[0];
  return c ? c.name : 'a stranger';
}
export const fillText = s => String(s || '').replace(/\{c\}/g, ctxName());
export function resolveChoice(card, side) {
  const ch = card[side === 'l' ? 'left' : 'right'];
  const alt = (ch.alt || []).find(a => hasPart(a.has));
  return alt ? { ...alt, unlockedBy: alt.has } : ch;
}

/* ---------- Choosing ---------- */
// Applies a choice and ends the day. Returns { before, events, ending }.
export function choose(side, whoName) {
  const run = G.run;
  const card = cardById(run.card.id);
  const ch = resolveChoice(card, side);
  const before = { ...run.meters };
  const { mult } = modifiers();
  const name = ctxName();
  const target = run.cultists.find(c => c.id === run.card.cid) || run.cultists[0];
  const events = [];
  const removeCult = (c, type) => { run.cultists = run.cultists.filter(x => x.id !== c.id); events.push({ type, cultist: c }); };

  addLog(`${fillText(whoName)}: ${fillText(ch.label)}.`, '');
  if (ch.fx) for (const m in ch.fx) {
    const v = ch.fx[m];
    run.meters[m] += v > 0 ? v * mult[m] : v;
  }
  if (ch.log) addLog(fillText(ch.log), '');
  if (ch.cult < 0 && target) { removeCult(target, 'eaten'); addLog(`${name} is devoured.`, 'bad'); }
  if (ch.slain && target) { removeCult(target, 'slain'); if (!ch.log) addLog(`${name} is gone.`, 'bad'); }
  if (ch.leave && target) { removeCult(target, 'leave'); addLog(`${name} walks out into the night.`, 'bad'); }
  if (ch.cult > 0) for (let i = 0; i < ch.cult; i++) {
    const n = makeCultist();
    run.cultists.push(n);
    events.push({ type: 'joined', cultist: n });
    addLog(`${n.name} joins the cult.`, 'good');
  }
  if (ch.part) {
    const t = addToTray(ch.part);
    addLog(`A new part: ${PARTS[t].name}. It waits in the Offerings tray.`, 'part');
    events.push({ type: 'part', part: t });
  }
  asList(ch.flag).forEach(f => run.flags[f] = true);
  asList(ch.unflag).forEach(f => delete run.flags[f]);
  if (ch.chain) run.chains.push({ card: ch.chain.card, day: run.day + ch.chain.in });

  // end of the day: drift, and a starving horror helps itself
  const { drift } = modifiers();
  run.day++;
  METERS.forEach(m => run.meters[m] += drift[m]);
  if (run.meters.hunger < BALANCE.starvingBelow && run.cultists.length > 1 && Math.random() < BALANCE.starvingEatChance) {
    const v = pick(run.cultists);
    removeCult(v, 'starve');
    run.meters.hunger += BALANCE.starvingEatFeeds;
    addLog(`Starving, the horror snatches ${v.name} from the circle and eats them.`, 'bad');
  }
  const ending = checkEnding();
  if (!ending) drawNextCard();
  save();
  return { before, events, ending };
}
function checkEnding() {
  const run = G.run;
  for (const m of METERS) {
    if (run.meters[m] <= 0) return m + '_low';
    if (run.meters[m] >= 100) return m + '_high';
  }
  if (run.cultists.length === 0) return 'alone';
  if (run.elderDay != null && run.day - run.elderDay >= BALANCE.ascensionDays) return 'ascension';
  return null;
}
export function endRun(id, ending) {
  const run = G.run, meta = G.meta;
  if (run.ended) return false;
  run.ended = id;
  meta.endings[id] = (meta.endings[id] || 0) + 1;
  meta.inheritance = ending.reward;
  meta.bestDay = Math.max(meta.bestDay, run.day);
  addLog(`${ending.title}. ${ending.epitaph}`, 'bad');
  save();
  return true;
}
