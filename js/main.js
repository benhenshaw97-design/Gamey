// Boots the game and ties together state, the 3D scene, audio and the overlay UI.
import { CHARACTERS, ENDINGS, SCENE, PARTS, AUDIO } from './config.js';
import { G, loadGame, newRun, save, choose, cardById, synergies, endRun, wipeMemory } from './state.js';
import * as Scene from './scene.js';
import * as Audio from './audio.js';
import * as UI from './ui.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
let portraitCache = { key: '', url: null };

function refreshWorld(opts = {}) {
  Scene.setCreature(G.run, { synergies: synergies(), ...opts });
  const extra = Scene.syncCultists(G.run.cultists);
  UI.renderAll();
  if (extra) document.getElementById('scene-tag').textContent += ` (+${extra} beyond the light)`;
  Audio.setStage(G.run.stage);
  Audio.setChantLevel(Math.min(1, G.run.cultists.length / 8));
}

// A day passes: apply the choice, play what happened in 3D, then show the next card.
async function onChoose(side) {
  if (UI.isBusy() || G.run.ended) return;
  UI.setBusy(true);
  const card = cardById(G.run.card.id);
  const res = choose(side, CHARACTERS[card.who].name);
  Audio.sfx('swipe');
  UI.flashMeters(res.before);
  const out = UI.animateCardOut(side);
  UI.renderAll();
  // play the consequences one after another
  for (const ev of res.events) {
    if (ev.type === 'eaten' || ev.type === 'starve') {
      if (ev.type === 'starve') await sleep(250);
      Audio.sfx('sacrifice');
      await Scene.eat(ev.cultist.id);
    } else if (ev.type === 'slain') { Audio.sfx('slain'); await Scene.slay(ev.cultist.id); }
    else if (ev.type === 'leave') { Audio.sfx('leave'); await Scene.leave(ev.cultist.id); }
    else if (ev.type === 'joined') { Audio.sfx('recruit'); Scene.syncCultists(G.run.cultists); }
    else if (ev.type === 'part') { UI.toast(`New part: ${PARTS[ev.part].name}`); Audio.sfx('attach'); }
  }
  await out;
  refreshWorld();
  if (res.ending) { await playEnding(res.ending); return; }
  UI.cardIn();
  await sleep(380);
  UI.setBusy(false);
}

async function playEnding(id) {
  const e = ENDINGS[id];
  const image = Scene.snapshot(false);       // the creature as it was, before the end
  Audio.sfx('death');
  Audio.swellDrone(.6);
  await Promise.race([Scene.playMoment(e.moment), sleep(SCENE.momentDuration * 1000 + 6000)]);
  endRun(id, e);
  UI.renderAll();
  UI.showLegacy(id, image);
}

function startNewRun() {
  Scene.resetScene();
  newRun();
  portraitCache.key = '';
  refreshWorld({ instant: true });
  UI.cardIn();
  UI.setBusy(false);
}

function afterGraft(res, uid) {
  refreshWorld({ fresh: uid, newSynergy: res.newSynergies[0] });
  if (uid) Audio.sfx('attach');
  if (res.newSynergies.length) UI.toast(`Synergy: ${res.newSynergies[0].syn.name}`);
  if (res.grown.length) {
    Scene.growPulse();
    Audio.sfx('growth');
    Audio.swellDrone(1);
    UI.toast(`It grows: ${G.run.stage === 3 ? 'Elder Horror' : ['Spawn', 'Larva', 'Abomination'][G.run.stage]}`);
  }
}

function horrorImage() {
  const key = JSON.stringify([G.run.parts, G.run.stage]);
  if (key !== portraitCache.key) { portraitCache = { key, url: Scene.snapshot(true) }; }
  return portraitCache.url;
}

async function boot() {
  loadGame();
  if (!G.run) newRun();
  await Scene.initScene(document.getElementById('scene'), {
    onCultistTap: (id, x, y) => { UI.showTip(id, x, y); Audio.sfx('tap'); },
    onBlood: s => UI.redFlash(s ?? .7),
  });
  UI.initUI({
    choose: onChoose, afterGraft, horrorImage, save,
    onNewRun: startNewRun,
    onWipe: () => { wipeMemory(); startNewRun(); },
    onVolume: v => { G.meta.volume = v; Audio.setVolume(v); save(); },
    onMute: m => { G.meta.muted = m; Audio.setMuted(m); save(); },
    onLayout: (top, bottom) => Scene.setViewInset(top, bottom),
    defaultVolume: AUDIO.defaultVolume,
    loadedAudio: Audio.loadedFiles,
  });
  refreshWorld({ instant: true });
  if (G.run.ended) UI.showLegacy(G.run.ended, Scene.snapshot(false));
  // audio may only start after the first tap
  const unlock = () => {
    Audio.startAudio({ volume: G.meta.volume ?? AUDIO.defaultVolume, muted: G.meta.muted });
    Audio.setStage(G.run.stage);
    Audio.setChantLevel(Math.min(1, G.run.cultists.length / 8));
  };
  addEventListener('pointerdown', unlock, { once: true });
  addEventListener('keydown', unlock, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.__booted = true;
  document.getElementById('boot').remove();
  // handy for debugging in the console
  window.HD = { G, choose: onChoose };
}

boot().catch(err => {
  console.error(err);
  document.getElementById('boot').innerHTML = `<p>Something went wrong while waking the horror.</p><pre>${String(err && err.message || err)}</pre>`;
});
