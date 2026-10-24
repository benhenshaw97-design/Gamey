// The 3D ritual ground: stone circle, candles, embers, the horror built from its
// grafted parts, and the cultists that wander around it.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SCENE, PARTS, FLESH, BALANCE } from './config.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = t => Math.max(0, Math.min(1, t));
const easeOut = t => 1 - Math.pow(1 - t, 3);
const elastic = t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI) / 3) + 1;
const UP = V3(0, 1, 0);

let renderer, scene, camera, controls, timer, hooks = {};
let canvasEl, viewInset = { top: 0, bottom: 0 };
let lastInteract = -1e9, frameNo = 0, time = 0;
const tweens = [];
const isMobile = matchMedia('(pointer: coarse)').matches;

/* =====================================================================
   Procedural textures and helpers
   ===================================================================== */
function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  t.anisotropy = 4;
  return t;
}
function noiseFill(g, s, base, spread, n) {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) {
    const v = Math.floor(rand(-spread, spread));
    g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`;
    const r = rand(1, s / 40);
    g.beginPath(); g.arc(rand(0, s), rand(0, s), r, 0, Math.PI * 2); g.fill();
  }
}
const TEX = {};
function makeTextures() {
  TEX.glow = canvasTex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,220,160,.8)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  TEX.flame = canvasTex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s * .62, 0, s / 2, s * .62, s * .42);
    gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(.35, 'rgba(255,190,80,.95)'); gr.addColorStop(1, 'rgba(255,90,0,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(s / 2, s * .55, s * .22, s * .45, 0, 0, Math.PI * 2); g.fill();
  });
  TEX.ground = canvasTex(512, (g, s) => {
    noiseFill(g, s, '#2a2420', 40, 2600);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5;
    for (let i = 0; i < 40; i++) { g.beginPath(); let x = rand(0, s), y = rand(0, s); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rand(-30, 30); y += rand(-30, 30); g.lineTo(x, y); } g.stroke(); }
  }, 10);
  TEX.flags = canvasTex(512, (g, s) => {
    g.fillStyle = '#0d0b0c'; g.fillRect(0, 0, s, s);
    const n = 9, w = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const off = (y % 2) * w / 2, v = Math.floor(rand(48, 72));
      g.fillStyle = `rgb(${v},${v - 6},${v - 10})`;
      g.beginPath();
      g.roundRect(x * w + off - w / 2 + rand(2, 5), y * w + rand(2, 5), w - rand(5, 10), w - rand(5, 10), 6);
      g.fill();
    }
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${rand(.05, .25)})`; g.fillRect(rand(0, s), rand(0, s), rand(1, 4), rand(1, 4)); }
  }, 3);
  TEX.stone = canvasTex(256, (g, s) => {
    noiseFill(g, s, '#4a4644', 50, 1600);
    g.fillStyle = 'rgba(40,60,30,.35)';
    for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(rand(0, s), rand(s * .6, s), rand(4, 18), 0, Math.PI * 2); g.fill(); }
  }, 1);
}
// Optional image files in /assets/textures replace the procedural ones.
function loadOptionalTexture(base, onLoad) {
  const loader = new THREE.TextureLoader();
  const tryExt = exts => {
    if (!exts.length) return;
    loader.load(`${base}.${exts[0]}`, t => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; onLoad(t); }, undefined, () => tryExt(exts.slice(1)));
  };
  tryExt(['jpg', 'png', 'webp']);
}

// A tapered tube along a curve (horns, quills).
function taperTube(curve, segs, r0, r1, radial = 7) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = curve.getPointAt(t), r = lerp(r0, r1, t), N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j < radial; j++) {
      const a = j / radial * Math.PI * 2;
      pos.push(p.x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * r, p.y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * r, p.z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * r);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial, c = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function jitterGeometry(g, amt) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + rand(-amt, amt), p.getY(i) + rand(-amt, amt), p.getZ(i) + rand(-amt, amt));
  g.computeVertexNormals();
  return g;
}
function tween(seconds, fn, done) { tweens.push({ t0: time, d: seconds, fn, done }); }
const wait = s => new Promise(r => tween(s, () => {}, r));

/* =====================================================================
   World: ground, circle, stones, moon, candles, embers
   ===================================================================== */
const world = { candles: [], candleLights: [], embers: null, emberData: null, chalk: null, stones: [] };
const MAT = {};

function buildWorld() {
  scene.background = new THREE.Color(SCENE.background);
  scene.fog = new THREE.FogExp2(SCENE.fog.color, SCENE.fog.density);
  scene.add(new THREE.HemisphereLight('#3a3550', '#0a0508', SCENE.ambient));
  const moon = new THREE.DirectionalLight(SCENE.moonColor, SCENE.moonIntensity);
  moon.position.set(-6, 10, -4);
  scene.add(moon);
  world.moon = moon;
  // a cold light from behind picks out the creature's silhouette
  const rim = new THREE.DirectionalLight('#7a5aa0', .7);
  rim.position.set(3, 5, -8);
  scene.add(rim);
  // a dim warm fill that follows the camera so the horror always reads
  world.fill = new THREE.DirectionalLight('#ffb080', .55);
  scene.add(world.fill, world.fill.target);

  MAT.ground = new THREE.MeshStandardMaterial({ map: TEX.ground, roughness: 1, color: '#8a8080' });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), MAT.ground);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  MAT.flags = new THREE.MeshStandardMaterial({ map: TEX.flags, roughness: .95, color: '#8a8080' });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(5.6, 48), MAT.flags);
  floor.rotation.x = -Math.PI / 2; floor.position.y = .01;
  scene.add(floor);
  loadOptionalTexture(SCENE.textures.ground, t => { t.repeat.set(10, 10); MAT.ground.map = t; MAT.ground.needsUpdate = true; });

  // standing stones
  MAT.stone = new THREE.MeshStandardMaterial({ map: TEX.stone, roughness: .95, flatShading: true });
  loadOptionalTexture(SCENE.textures.stone, t => { MAT.stone.map = t; MAT.stone.needsUpdate = true; });
  const st = SCENE.stones;
  for (let i = 0; i < st.count; i++) {
    const a = i / st.count * Math.PI * 2 + .2, h = rand(st.height[0], st.height[1]);
    const g = jitterGeometry(new THREE.BoxGeometry(rand(.55, .8), h, rand(.35, .5), 2, 3, 2), .05);
    const m = new THREE.Mesh(g, MAT.stone);
    m.position.set(Math.cos(a) * st.radius, h / 2 - .1, Math.sin(a) * st.radius);
    m.rotation.set(rand(-.06, .06), -a + Math.PI / 2, rand(-.08, .08));
    scene.add(m);
    world.stones.push(m);
  }
  for (let i = 0; i < 14; i++) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(.08, .22), 0), MAT.stone);
    const a = rand(0, Math.PI * 2), d = rand(5.8, 8);
    r.position.set(Math.cos(a) * d, .05, Math.sin(a) * d);
    r.rotation.set(rand(0, 3), rand(0, 3), 0);
    scene.add(r);
  }
  // optional model for the standing stones
  new GLTFLoader().load(SCENE.models.stone, gltf => {
    world.stones.forEach(s => {
      const m = gltf.scene.clone();
      const box = new THREE.Box3().setFromObject(m), size = box.getSize(V3());
      m.scale.setScalar(s.geometry.parameters.height / size.y);
      m.position.set(s.position.x, 0, s.position.z);
      m.rotation.y = s.rotation.y;
      scene.add(m);
      s.visible = false;
    });
  }, undefined, () => {});

  // moon
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: '#c8c8ff', fog: false, transparent: true, depthWrite: false }));
  moonSprite.position.set(-26, 20, -40); moonSprite.scale.set(9, 9, 1);
  scene.add(moonSprite);
  world.moonSprite = moonSprite;

  // chalk circle (redrawn per stage)
  world.chalk = new THREE.Group();
  scene.add(world.chalk);

  // the candle lights are created once (changing light counts recompiles shaders)
  for (let i = 0; i < SCENE.candles.lights; i++) {
    const l = new THREE.PointLight('#ffae5a', SCENE.candles.lightIntensity, SCENE.candles.lightRange, 2);
    scene.add(l);
    world.candleLights.push(l);
  }
  world.torchLight = new THREE.PointLight('#ff7a2a', 0, 14, 1.6);
  world.torchLight.position.set(0, 2.5, 0);
  scene.add(world.torchLight);

  buildEmbers();
}

function buildChalk(stage) {
  world.chalk.clear();
  const ring = (r, w, op, col = '#c9b9a6') => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - w, r, 72), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = .02;
    world.chalk.add(m);
    return m;
  };
  ring(3.7, .04, .22);
  if (stage >= 1) ring(3.35, .025, .15);
  if (stage >= 2) {
    const pts = [];
    for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; pts.push(V3(Math.cos(a) * 3.3, .025, Math.sin(a) * 3.3)); }
    world.chalk.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#b3262e', transparent: true, opacity: .55 })));
  }
  if (stage >= 3) world.glowRing = ring(4.3, .12, .35, '#b3262e');
  else world.glowRing = null;
}

function buildCandles(stage) {
  world.candles.forEach(c => scene.remove(c.group));
  world.candles = [];
  const c = SCENE.candles, n = c.base + c.perStage * stage;
  MAT.wax = MAT.wax || new THREE.MeshStandardMaterial({ color: '#d8ceb4', roughness: .6, emissive: '#3a2a10', emissiveIntensity: .4 });
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + .35, r = c.radius + (i % 2) * .25, h = rand(.18, .42);
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, h, 7), MAT.wax);
    wax.position.y = h / 2;
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.flame, color: '#ffd48a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    flame.position.y = h + .07; flame.scale.set(.09, .16, 1);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: '#ff9a3a', transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.y = h + .06; halo.scale.set(.7, .7, 1);
    g.add(wax, flame, halo);
    scene.add(g);
    world.candles.push({ group: g, flame, halo, h, phase: rand(0, 100), lit: 1 });
  }
  // spread the real lights evenly over the candles
  world.candleLights.forEach((l, k) => {
    const cd = world.candles[Math.floor(k * n / world.candleLights.length)];
    l.position.set(cd.group.position.x, cd.h + .25, cd.group.position.z);
    l.userData.candle = cd;
  });
}
function updateCandles() {
  const f = SCENE.candles.flicker;
  world.candles.forEach(c => {
    const n = (Math.sin(time * 11 + c.phase) + Math.sin(time * 17.3 + c.phase * 2) * .6 + Math.sin(time * 5.1 + c.phase) * .4) / 2;
    c.flame.scale.set(.09 * c.lit, (.16 + n * .03) * c.lit, 1);
    c.halo.material.opacity = (.3 + n * .08) * c.lit;
    c.flicker = 1 + n * f;
  });
  world.candleLights.forEach(l => {
    const c = l.userData.candle;
    l.intensity = c ? SCENE.candles.lightIntensity * c.flicker * c.lit : 0;
  });
}

function buildEmbers() {
  const n = isMobile ? SCENE.embers.mobileCount : SCENE.embers.count, A = SCENE.embers.area;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), data = [];
  const ember = new THREE.Color('#ff8a3a'), dust = new THREE.Color('#8a8070');
  for (let i = 0; i < n; i++) {
    const c = Math.random() < .55 ? ember : dust;
    col.set([c.r, c.g, c.b], i * 3);
    data.push({ x: rand(-A, A), y: rand(0, 5), z: rand(-A, A), s: rand(.4, 1.2), ph: rand(0, 6) });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: .05, map: TEX.glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .8 });
  world.embers = new THREE.Points(g, m);
  world.emberData = data;
  world.emberSpeed = 1;
  scene.add(world.embers);
}
function updateEmbers(dt) {
  const A = SCENE.embers.area, p = world.embers.geometry.attributes.position, sp = SCENE.embers.rise * world.emberSpeed;
  world.emberData.forEach((e, i) => {
    e.y += dt * sp * e.s;
    e.x += Math.sin(time * .7 + e.ph) * dt * .12 * world.emberSpeed;
    e.z += Math.cos(time * .6 + e.ph) * dt * .12 * world.emberSpeed;
    if (e.y > 5.5) { e.y = 0; e.x = rand(-A, A); e.z = rand(-A, A); }
    p.setXYZ(i, e.x, e.y, e.z);
  });
  p.needsUpdate = true;
}

/* =====================================================================
   Blood particles
   ===================================================================== */
const blood = { pts: null, data: [], next: 0 };
function buildBlood() {
  const n = 260, pos = new Float32Array(n * 3).fill(-50);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  blood.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: .07, color: '#9a0a14', transparent: true, depthWrite: false }));
  blood.pts.frustumCulled = false;
  blood.data = Array.from({ length: n }, () => ({ live: false }));
  scene.add(blood.pts);
}
function splash(at, count, power = 3) {
  for (let i = 0; i < count; i++) {
    const d = blood.data[blood.next];
    blood.next = (blood.next + 1) % blood.data.length;
    const a = rand(0, Math.PI * 2), up = rand(.3, 1);
    Object.assign(d, { live: true, x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * power * rand(.3, 1), vy: up * power * 1.3, vz: Math.sin(a) * power * rand(.3, 1) });
  }
}
function updateBlood(dt) {
  const p = blood.pts.geometry.attributes.position;
  blood.data.forEach((d, i) => {
    if (!d.live) return;
    d.vy -= 9 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
    if (d.y < .02) { d.live = false; p.setXYZ(i, 0, -50, 0); return; }
    p.setXYZ(i, d.x, d.y, d.z);
  });
  p.needsUpdate = true;
}

/* =====================================================================
   The horror: a marching-cubes flesh mass with procedural parts
   ===================================================================== */
const C = {
  root: null, body: null, flesh: null, partsGroup: null, links: null, light: null,
  balls: [], parts: [], cs: SCENE.cellSize, N: 4, scale: 1, targetScale: 1, height: 1, radius: 1,
  key: '', pulse: 1, lunge: V3(), frozen: false, fleshColor: new THREE.Color(), grey: 0,
};
function fleshOf(parts) {
  const count = {};
  parts.forEach(p => { const g = PARTS[p.type].group; if (g) count[g] = (count[g] || 0) + p.cells.length; });
  const best = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
  return FLESH[best] || FLESH.none;
}
function buildCreatureBase() {
  C.root = new THREE.Group();       // moves for lunges and endings
  C.body = new THREE.Group();       // scales with the stage
  C.root.add(C.body);
  scene.add(C.root);
  MAT.flesh = new THREE.MeshStandardMaterial({ color: '#4a5a40', roughness: .42, metalness: .05, emissive: '#200808', emissiveIntensity: .6 });
  C.flesh = new MarchingCubes(SCENE.fleshResolution, MAT.flesh, false, false, 40000);
  C.flesh.isolation = 80;
  C.flesh.frustumCulled = false;
  C.body.add(C.flesh);
  C.partsGroup = new THREE.Group();
  C.links = new THREE.Group();
  C.body.add(C.partsGroup, C.links);
  C.light = new THREE.PointLight('#ff3a2a', SCENE.creatureLightIntensity, 7, 1.8);
  C.root.add(C.light);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .5, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .015;
  C.shadow = shadow;
  scene.add(shadow);

  // shared part materials
  Object.assign(MAT, {
    bone: new THREE.MeshStandardMaterial({ color: '#d8ccae', roughness: .65 }),
    sclera: new THREE.MeshStandardMaterial({ color: '#efe6c8', roughness: .25 }),
    iris: new THREE.MeshStandardMaterial({ color: '#d4a82a', roughness: .3, emissive: '#6a4a00', emissiveIntensity: .8 }),
    black: new THREE.MeshBasicMaterial({ color: '#050203' }),
    cavity: new THREE.MeshStandardMaterial({ color: '#140204', roughness: 1 }),
    gum: new THREE.MeshStandardMaterial({ color: '#7a1a22', roughness: .5 }),
    tentacle: new THREE.MeshStandardMaterial({ color: '#2d6a5a', roughness: .4, emissive: '#06201a', emissiveIntensity: .6 }),
    sucker: new THREE.MeshStandardMaterial({ color: '#c8b8a0', roughness: .5 }),
    claw: new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: .7 }),
    membrane: new THREE.MeshStandardMaterial({ color: '#6a3a5a', roughness: .6, side: THREE.DoubleSide, transparent: true, opacity: .9, emissive: '#2a0a20', emissiveIntensity: .8 }),
    heart: new THREE.MeshStandardMaterial({ color: '#b0182a', roughness: .35, emissive: '#7a0010', emissiveIntensity: .8 }),
    hive: new THREE.MeshStandardMaterial({ color: '#8a6a2a', roughness: .8, flatShading: true }),
    voidRing: new THREE.MeshBasicMaterial({ color: '#a07ae8', transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }),
    core: new THREE.MeshStandardMaterial({ color: '#c8202a', emissive: '#b0101a', emissiveIntensity: .9, roughness: .3 }),
    link: new THREE.MeshBasicMaterial({ color: '#ffcf7a', transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }),
  });
}

// cell (gx, gy) of an N-grid -> local position on the creature's front plane
function cellPos(gx, gy) {
  return V3((gx - C.N / 2 + .5) * C.cs, (C.N - 1 - gy + .5) * C.cs + C.yOff, 0);
}

// Each builder returns { group, update(t, dt) }. Parts are built in cell units (cs).
const BUILD = {
  core(ctx) {
    const g = new THREE.Group(), cs = C.cs;
    const m = new THREE.Mesh(new THREE.SphereGeometry(cs * .55, 18, 14), MAT.core);
    m.position.copy(ctx.cent).setZ(cs * .62);
    g.add(m);
    return { group: g, update: t => { const b = heartbeat(t); m.scale.setScalar(1 + b * .15); MAT.core.emissiveIntensity = .7 + b * .9; } };
  },
  eye(ctx) {
    const g = new THREE.Group(), cs = C.cs, eyes = [];
    ctx.pts.forEach((p, i) => {
      const e = new THREE.Group();
      const r = cs * .42;
      const scl = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), MAT.sclera);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(r * .55, 14, 10), MAT.iris);
      iris.scale.z = .4; iris.position.z = r * .82;
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * .5, 10, 8), MAT.black);
      pupil.scale.set(.25, 1, .3); pupil.position.z = r * .93;
      e.add(scl, iris, pupil);
      const holder = new THREE.Group();
      holder.position.copy(p).setZ(cs * .55);
      holder.add(e);
      g.add(holder);
      eyes.push({ e, holder, next: rand(1, 5), blink: 0, look: V3(rand(-1, 1), rand(-.5, .5), 3) });
    });
    return {
      group: g, update: (t, dt) => eyes.forEach(o => {
        // blink now and then; look at the camera or wander
        o.next -= dt;
        if (o.next < 0) { o.blink = .18; o.next = rand(2, 6); if (Math.random() < .5) o.look.set(rand(-2, 2), rand(-1, 1.5), 3); else o.look.set(0, 0, 0); }
        o.blink = Math.max(0, o.blink - dt);
        o.e.scale.y = o.blink > 0 ? .1 : 1;
        const target = o.look.lengthSq() ? o.holder.localToWorld(o.look.clone()) : camera.position;
        const q0 = o.e.quaternion.clone();
        o.e.lookAt(target);
        o.e.quaternion.copy(q0.slerp(o.e.quaternion, Math.min(1, dt * 4)));
      }),
    };
  },
  maw(ctx) { return mouthPart(ctx, ctx.pts.length > 1 ? 1 : .5, 8); },
  mouth(ctx) { return mouthPart(ctx, .5, 5); },
  tentacle(ctx) {
    const cs = C.cs, g = new THREE.Group();
    g.position.copy(ctx.base);
    g.quaternion.setFromUnitVectors(UP, ctx.out);
    const segs = 8, len = (ctx.pts.length + 1.6) * cs, sl = len / segs, joints = [];
    let parent = g;
    for (let i = 0; i < segs; i++) {
      const j = new THREE.Group();
      j.position.y = i ? sl : 0;
      const r0 = cs * .28 * (1 - i / segs) + cs * .03, r1 = cs * .28 * (1 - (i + 1) / segs) + cs * .03;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, sl * 1.08, 8), MAT.tentacle);
      seg.position.y = sl / 2;
      j.add(seg);
      if (i % 2 === 1) { const s = new THREE.Mesh(new THREE.SphereGeometry(r0 * .35, 6, 5), MAT.sucker); s.position.set(0, sl / 2, r0 * .85); j.add(s); }
      parent.add(j);
      joints.push(j);
      parent = j;
    }
    const ph = rand(0, 6);
    return { group: g, update: t => joints.forEach((j, i) => { j.rotation.z = Math.sin(t * 1.8 + ph + i * .55) * .22; j.rotation.x = Math.cos(t * 1.3 + ph + i * .4) * .15; }) };
  },
  claw(ctx) {
    const cs = C.cs, g = new THREE.Group();
    g.position.copy(ctx.base);
    g.quaternion.setFromUnitVectors(UP, ctx.out);
    const L = (ctx.pts.length * .7 + .5) * cs;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(cs * .16, cs * .24, L, 8), MAT.claw);
    arm.position.y = L / 2;
    const hand = new THREE.Group();
    hand.position.y = L;
    [-0.5, 0, .5].forEach(a => {
      const curve = new THREE.QuadraticBezierCurve3(V3(0, 0, 0), V3(Math.sin(a) * cs * .3, cs * .45, cs * .1), V3(Math.sin(a) * cs * .45, cs * .75, cs * .45));
      hand.add(new THREE.Mesh(taperTube(curve, 8, cs * .09, cs * .01, 6), MAT.bone));
    });
    g.add(arm, hand);
    const ph = rand(0, 6);
    return { group: g, update: t => { hand.rotation.x = Math.sin(t * 1.4 + ph) * .3; g.rotation.z = Math.sin(t * .7 + ph) * .04; } };
  },
  horn(ctx) {
    const cs = C.cs, g = new THREE.Group();
    ctx.pts.forEach(p => {
      const h = new THREE.Group();
      h.position.copy(p).setZ(cs * .3);
      h.quaternion.setFromUnitVectors(UP, ctx.out.clone().add(V3(0, .4, .2)).normalize());
      const curve = new THREE.QuadraticBezierCurve3(V3(0, 0, 0), V3(cs * .1, cs * .8, cs * .1), V3(cs * .55, cs * 1.35, -cs * .1));
      h.add(new THREE.Mesh(taperTube(curve, 12, cs * .24, cs * .02, 8), MAT.bone));
      g.add(h);
    });
    return { group: g, update: () => {} };
  },
  wing(ctx) {
    const cs = C.cs, g = new THREE.Group();
    g.position.copy(ctx.base).setZ(-cs * .1);
    g.quaternion.setFromUnitVectors(UP, ctx.out.clone().add(V3(0, .5, -.2)).normalize());
    const flap = new THREE.Group();
    g.add(flap);
    const L = cs * 3, tips = [-.9, -.3, .3].map(a => V3(Math.sin(a) * L, Math.cos(a) * L, 0));
    tips.forEach(tp => {
      const bone = new THREE.Mesh(new THREE.CylinderGeometry(cs * .03, cs * .07, tp.length(), 5), MAT.bone);
      bone.position.copy(tp).multiplyScalar(.5);
      bone.quaternion.setFromUnitVectors(UP, tp.clone().normalize());
      flap.add(bone);
    });
    // membrane: fan between the finger tips, with scalloped edges pulled inward
    const verts = [V3()];
    for (let i = 0; i < tips.length; i++) {
      verts.push(tips[i]);
      if (i < tips.length - 1) verts.push(tips[i].clone().lerp(tips[i + 1], .5).multiplyScalar(.7));
    }
    const pos = [];
    for (let i = 1; i < verts.length - 1; i++) pos.push(0, 0, 0, verts[i].x, verts[i].y, 0, verts[i + 1].x, verts[i + 1].y, 0);
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    mg.computeVertexNormals();
    flap.add(new THREE.Mesh(mg, MAT.membrane));
    const ph = rand(0, 6);
    return { group: g, update: t => { flap.rotation.y = Math.sin(t * 1.6 + ph) * .55; flap.rotation.x = Math.sin(t * 1.6 + ph + 1) * .12; } };
  },
  spine(ctx) {
    const cs = C.cs, g = new THREE.Group();
    ctx.pts.forEach((p, i) => [-1, 1].forEach(s => {
      const q = new THREE.Mesh(new THREE.ConeGeometry(cs * .1, cs * rand(.8, 1.1), 6), MAT.bone);
      const dir = ctx.out.clone().add(V3(s * .25, 0, .35)).normalize();
      q.quaternion.setFromUnitVectors(UP, dir);
      q.position.copy(p).add(dir.clone().multiplyScalar(cs * .55)).add(V3(0, 0, cs * .2));
      g.add(q);
    }));
    return { group: g, update: () => {} };
  },
  heart(ctx) {
    const cs = C.cs, g = new THREE.Group(), h = new THREE.Group();
    const a = new THREE.Mesh(new THREE.SphereGeometry(cs * .22, 12, 10), MAT.heart); a.position.set(-cs * .13, cs * .08, 0);
    const b = a.clone(); b.position.x = cs * .13;
    const c = new THREE.Mesh(new THREE.ConeGeometry(cs * .3, cs * .42, 12), MAT.heart); c.rotation.z = Math.PI; c.position.y = -cs * .16;
    h.add(a, b, c);
    h.position.copy(ctx.pts[0]).setZ(cs * .55);
    g.add(h);
    const ph = rand(0, 1);
    return { group: g, update: t => h.scale.setScalar(1 + heartbeat(t + ph) * .28) };
  },
  hive(ctx) {
    const cs = C.cs, g = new THREE.Group(), c = ctx.cent.clone().setZ(cs * .45);
    [[0, 0, 0, .7], [-.45, .35, -.1, .45], [.45, .3, -.1, .5], [-.4, -.4, 0, .5], [.45, -.42, 0, .45]].forEach(([x, y, z, r]) => {
      const s = new THREE.Mesh(jitterGeometry(new THREE.IcosahedronGeometry(cs * r, 1), cs * .04), MAT.hive);
      s.position.set(c.x + x * cs, c.y + y * cs, c.z + z * cs);
      g.add(s);
      const hole = new THREE.Mesh(new THREE.SphereGeometry(cs * .1, 6, 5), MAT.black);
      hole.position.set(s.position.x, s.position.y, s.position.z + cs * r * .92);
      g.add(hole);
    });
    const flies = [];
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(cs * .05, 4, 3), MAT.black);
      g.add(f);
      flies.push({ f, r: cs * rand(1, 1.6), s: rand(2, 4), ph: rand(0, 6), y: rand(-.5, .5) });
    }
    return { group: g, update: t => flies.forEach(o => o.f.position.set(c.x + Math.cos(t * o.s + o.ph) * o.r, c.y + o.y * C.cs + Math.sin(t * 3 + o.ph) * C.cs * .2, c.z + Math.sin(t * o.s + o.ph) * o.r)) };
  },
  bone(ctx) {
    const cs = C.cs, g = new THREE.Group();
    ctx.pts.forEach((p, i) => {
      const m = new THREE.Mesh(jitterGeometry(new THREE.BoxGeometry(cs * .85, cs * .78, cs * .2, 2, 2, 1), cs * .03), MAT.bone);
      m.position.copy(p).setZ(cs * .62);
      m.rotation.set(rand(-.15, .15), rand(-.15, .15), rand(-.2, .2));
      g.add(m);
    });
    return { group: g, update: () => {} };
  },
  void(ctx) {
    const cs = C.cs, g = new THREE.Group();
    const p = ctx.pts[0].clone().setZ(cs * .6);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(cs * .4, 18, 14), MAT.black);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(cs * .55, cs * .035, 6, 32), MAT.voidRing);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(cs * .7, cs * .02, 6, 32), MAT.voidRing);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: '#6a3ac8', transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(cs * 2.4);
    halo.userData.ownMat = true;
    [orb, ring, ring2, halo].forEach(o => { o.position.copy(p); g.add(o); });
    return { group: g, update: t => { ring.rotation.set(t * 1.3, t * .7, 0); ring2.rotation.set(-t * .5, t * 1.1, .4); orb.scale.setScalar(1 + Math.sin(t * 2.2) * .06); } };
  },
};
function mouthPart(ctx, size, teeth) {
  const cs = C.cs, g = new THREE.Group(), [a, b] = [ctx.pts[0], ctx.pts[ctx.pts.length - 1]];
  const mid = a.clone().add(b).multiplyScalar(.5);
  const holder = new THREE.Group();
  holder.position.copy(mid).setZ(cs * .55);
  holder.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
  const half = a.distanceTo(b) / 2 + cs * .42 * (size > .5 ? 1 : .8);
  const cav = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), MAT.cavity);
  cav.scale.set(half, cs * .32, cs * .25);
  const lips = new THREE.Mesh(new THREE.TorusGeometry(1, .09, 8, 28), MAT.gum);
  lips.scale.set(half, cs * .34, cs * 2);
  const top = new THREE.Group(), bot = new THREE.Group();
  for (let i = 0; i < teeth; i++) {
    const x = -half * .78 + i * (half * 1.56 / (teeth - 1));
    const t1 = new THREE.Mesh(new THREE.ConeGeometry(cs * .07, cs * .22, 5), MAT.bone);
    t1.rotation.z = Math.PI; t1.position.set(x, 0, cs * .12);
    top.add(t1);
    const t2 = new THREE.Mesh(new THREE.ConeGeometry(cs * .065, cs * .2, 5), MAT.bone);
    t2.position.set(x * .92, 0, cs * .12);
    bot.add(t2);
  }
  holder.add(cav, lips, top, bot);
  g.add(holder);
  const ph = rand(0, 6);
  return {
    group: g, update: t => {
      const open = (Math.sin(t * 1.9 + ph) * .5 + .5) * (C.chomp || 1);
      cav.scale.y = cs * (.2 + open * .22); lips.scale.y = cs * (.22 + open * .22);
      top.position.y = cs * (.1 + open * .14); bot.position.y = -cs * (.1 + open * .14);
    },
  };
}
function heartbeat(t) { const p = (t * 1.1) % 1; return Math.max(0, Math.sin(p * Math.PI * 6) * (p < .17 ? 1 : p < .34 ? .6 : 0)); }

function partContext(p) {
  const pts = p.cells.map(([x, y]) => cellPos(x, y));
  const cent = pts.reduce((s, q) => s.add(q), V3()).multiplyScalar(1 / pts.length);
  const coreCent = C.coreCent;
  const out = V3(cent.x - coreCent.x, cent.y - coreCent.y, 0);
  if (out.lengthSq() < 1e-4) out.set(0, 1, 0);
  out.normalize().add(V3(0, 0, .3)).normalize();
  const ordered = pts.slice().sort((a, b) => a.dot(out) - b.dot(out));
  const base = ordered[0].clone().addScaledVector(out, -C.cs * .15);
  return { pts, cent, out, ordered, base };
}

// Rebuild the creature from the run's parts. fresh = uid of a part that should animate in.
export function setCreature(run, opts = {}) {
  const st = BALANCE.stages[run.stage];
  C.N = run.grid;
  C.targetScale = st.scale;
  if (opts.instant) { C.scale = st.scale; snapCamera = true; }
  const flesh = fleshOf(run.parts);
  MAT.flesh.color.set(flesh.light).multiplyScalar(1.35);
  MAT.flesh.emissive.set(flesh.vein);
  MAT.flesh.emissiveIntensity = SCENE.fleshGlow;
  C.fleshColor.copy(MAT.flesh.color);
  C.light.color.set(flesh.vein).lerp(new THREE.Color('#ff3a2a'), .75);
  // sit the lowest occupied row on the ground
  const maxRow = Math.max(...run.parts.flatMap(p => p.cells.map(c => c[1])));
  C.yOff = 0;
  C.yOff = C.cs * .45 - cellPos(0, maxRow).y;
  const core = run.parts.find(p => p.type === 'core');
  C.coreCent = core.cells.map(([x, y]) => cellPos(x, y)).reduce((s, q) => s.add(q), V3()).multiplyScalar(.25);

  // flesh balls: two layers per cell plus a foot under the lowest row
  C.balls = [];
  run.parts.forEach(p => p.cells.forEach(([x, y]) => {
    const q = cellPos(x, y);
    C.balls.push({ p: q, r: C.cs * .64, ph: rand(0, 6) });
    C.balls.push({ p: q.clone().setZ(-C.cs * .45), r: C.cs * .56, ph: rand(0, 6) });
    if (y === maxRow) C.balls.push({ p: q.clone().setY(C.cs * .15), r: C.cs * .6, ph: rand(0, 6) });
  }));
  C.balls.push({ p: C.coreCent.clone().setZ(-C.cs * .2), r: C.cs * 1.05, ph: 0, core: true });
  const ys = C.balls.map(b => b.p.y), xs = C.balls.map(b => Math.abs(b.p.x));
  C.height = Math.max(...ys) + C.cs;
  C.boxCenter = V3(0, (Math.max(...ys) + Math.min(...ys)) / 2, -C.cs * .2);
  C.boxHalf = Math.max(Math.max(...xs) + C.cs * 1.4, (Math.max(...ys) - Math.min(...ys)) / 2 + C.cs * 1.4);
  C.flesh.position.copy(C.boxCenter);
  C.flesh.scale.setScalar(C.boxHalf);
  C.radius = (Math.max(...xs) + C.cs) * st.scale;

  // parts
  const keep = {};
  C.parts.forEach(o => { keep[o.uid] = o.born; disposeGroup(o.group); C.partsGroup.remove(o.group); });
  C.parts = run.parts.map(p => {
    const built = BUILD[p.type](partContext(p));
    C.partsGroup.add(built.group);
    const born = p.uid === opts.fresh ? time : (keep[p.uid] != null ? keep[p.uid] - 10 : time - 10);
    return { uid: p.uid, type: p.type, group: built.group, update: built.update, born };
  });
  // glowing links between synergy pairs
  disposeGroup(C.links); C.links.clear();
  (opts.synergies || []).forEach(s => {
    const a = partContext(s.a).cent.setZ(C.cs * .85), b = partContext(s.b).cent.setZ(C.cs * .85);
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(C.cs * .05, C.cs * .05, len, 6), MAT.link.clone());
    m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: '#ffcf7a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.copy(m.position); glow.scale.setScalar(C.cs * 1.3);
    m.userData.ownMat = glow.userData.ownMat = true;
    m.userData.fresh = opts.newSynergy && s.syn === opts.newSynergy.syn ? time : -10;
    C.links.add(m, glow);
  });
  C.light.position.set(0, C.height * .4 * st.scale, -C.cs * .2);
  buildChalk(run.stage);
  if (world.stage !== run.stage) { buildCandles(run.stage); world.stage = run.stage; }
  rebuildFlesh();
}
function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry && o !== C.flesh) o.geometry.dispose();
    if (o.material && o.userData.ownMat) o.material.dispose();
  });
}
function rebuildFlesh() {
  // a high 'subtract' keeps each ball's reach short, so the mass hugs its cells
  const f = C.flesh, H = C.boxHalf, sub = 60;
  f.reset();
  const beat = heartbeat(time);
  C.balls.forEach(b => {
    const wob = 1 + Math.sin(time * 1.6 + b.ph) * .035 + (b.core ? beat * .08 : beat * .02);
    const rn = (b.r * wob * C.pulse) / (2 * H);
    const p = b.p.clone().sub(C.boxCenter).divideScalar(2 * H).addScalar(.5);
    f.addBall(p.x, p.y, p.z, rn * rn * (80 + sub), sub);
  });
  f.update();
}
// Grow pulse after evolving: scale up with a flash and a burst of embers
export function growPulse() {
  const from = C.scale;
  tweens.push({ t0: time, d: 1.6, growth: true, fn: t => { C.scale = lerp(from, C.targetScale, elastic(t)); C.light.intensity = SCENE.creatureLightIntensity * (1 + 3 * (1 - t)); } });
  world.emberSpeed = 6;
  tween(2.5, t => { world.emberSpeed = lerp(6, 1, t); });
}

function updateCreature(dt) {
  if (!C.frozen) {
    if (Math.abs(C.scale - C.targetScale) > .001 && !tweens.some(t => t.growth)) C.scale = lerp(C.scale, C.targetScale, dt * 2);
    if (frameNo % SCENE.fleshAnimateEvery === 0) rebuildFlesh();
    C.parts.forEach(o => {
      o.update(time, dt);
      // attach animation: pop out, overshoot and settle, with a wriggle
      const a = (time - o.born) / .9;
      if (a < 1) { o.group.scale.setScalar(Math.max(.001, elastic(clamp01(a)))); o.group.rotation.z = Math.sin(a * 20) * (1 - a) * .15; }
      else if (o.group.scale.x !== 1) { o.group.scale.setScalar(1); o.group.rotation.z = 0; }
    });
    C.links.children.forEach(m => {
      if (m.isSprite) { m.material.opacity = .35 + Math.sin(time * 3) * .25; return; }
      const f = clamp01(1 - (time - m.userData.fresh) / 2);
      m.material.opacity = .3 + Math.sin(time * 2.5) * .15 + f * .7;
    });
  }
  C.body.scale.setScalar(C.scale);
  C.root.position.copy(C.lunge).add(C.offset || V3());
  C.shadow.scale.setScalar(C.radius * 1.3 * C.scale / C.targetScale);
  C.shadow.position.x = C.root.position.x; C.shadow.position.z = C.root.position.z;
  if (C.grey) MAT.flesh.color.copy(C.fleshColor).lerp(new THREE.Color('#5a5a5a'), C.grey);
}

/* =====================================================================
   Cultists
   ===================================================================== */
const cult = {};          // id -> sprite
let cultModel = null;
function partsPresent() { return new Set(C.parts.map(p => p.type)); }
function ringRadius() { return Math.max(1.6, C.radius) + SCENE.cultist.ringPadding; }

function makeCultistMesh(c) {
  const H = SCENE.cultist.height, g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const robeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(c.robe).multiplyScalar(1.8), roughness: .85, flatShading: true, transparent: true });
  const faceMat = new THREE.MeshBasicMaterial({ color: '#050203', transparent: true });
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffcf7a', transparent: true });
  const mats = [robeMat, faceMat, eyeMat];
  let arms = null;
  if (cultModel) {
    const m = cultModel.clone();
    m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; mats.push(o.material); } });
    body.add(m);
  } else {
    const robe = new THREE.Mesh(new THREE.ConeGeometry(H * .25, H * .78, 7), robeMat);
    robe.position.y = H * .39;
    const hood = new THREE.Mesh(new THREE.IcosahedronGeometry(H * .14, 1), robeMat);
    hood.position.y = H * .82; hood.scale.set(1, 1.15, 1.05);
    const peak = new THREE.Mesh(new THREE.ConeGeometry(H * .08, H * .16, 6), robeMat);
    peak.position.set(0, H * .93, -H * .05); peak.rotation.x = -.5;
    const face = new THREE.Mesh(new THREE.SphereGeometry(H * .085, 8, 6), faceMat);
    face.position.set(0, H * .8, H * .08); face.scale.set(1, 1.15, .55);
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(H * .014, 4, 3), eyeMat);
    e1.position.set(-H * .03, H * .815, H * .125);
    const e2 = e1.clone(); e2.position.x = H * .03;
    arms = [-1, 1].map(s => {
      const pivot = new THREE.Group();
      pivot.position.set(s * H * .14, H * .66, 0);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(H * .035, H * .045, H * .34, 5), robeMat);
      arm.position.y = -H * .17;
      pivot.add(arm);
      pivot.rotation.set(-.3, 0, s * .25);
      body.add(pivot);
      return pivot;
    });
    body.add(robe, hood, peak, face, e1, e2);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(H * .26, 12), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .45, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .012;
  g.add(shadow);
  mats.push(shadow.material);
  return { g, body, arms, mats };
}
function addCultistSprite(c, instant) {
  const m = makeCultistMesh(c);
  scene.add(m.g);
  const R = ringRadius();
  const s = {
    id: c.id, ...m, ang: rand(0, Math.PI * 2), rad: instant ? R * rand(.95, 1.15) : 11, tAng: 0, tRad: R, state: 'walk', act: 'walk', until: 0,
    t: rand(0, 10), opacity: 1, sink: 0, lift: null,
  };
  s.tAng = s.ang + rand(-.6, .6);
  s.tRad = R * rand(.95, 1.15);
  cult[c.id] = s;
}
function setOpacity(s, o) { s.opacity = o; s.mats.forEach(m => { m.opacity = m === s.mats[s.mats.length - 1] ? .45 * o : o; }); }
function killSprite(s) {
  scene.remove(s.g);
  s.g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  s.mats.forEach(m => m.dispose());
  delete cult[s.id];
}
let cultReady = false;
export function syncCultists(cultists) {
  const vis = cultists.slice(0, BALANCE.maxVisibleCultists);
  vis.forEach(c => { if (!cult[c.id]) addCultistSprite(c, !cultReady); });
  Object.values(cult).forEach(s => { if (!s.dying && !cultists.some(c => c.id === s.id)) killSprite(s); });
  cultReady = true;
  return Math.max(0, cultists.length - vis.length);
}
function pickActivity() {
  const has = partsPresent();
  const w = { bow: 2, kneel: 2, chant: 2.5, idle: 1.2, walk: 3 };
  if (has.has('eye')) w.cower = 2.2;
  if (has.has('maw') || has.has('mouth')) w.kneelFront = 3;
  if (has.has('tentacle')) w.dance = 2;
  if (has.has('void') || has.has('wing')) w.stare = 2;
  if (has.has('heart')) w.chant += 2;
  if (has.has('hive')) w.swat = 1.5;
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const k in w) if ((r -= w[k]) < 0) return k;
  return 'idle';
}
function cultPos(s) { return V3(Math.cos(s.ang) * s.rad, 0, Math.sin(s.ang) * s.rad); }
function updateCultist(s, dt) {
  s.t += dt;
  const R = ringRadius(), sp = SCENE.cultist.walkSpeed;
  let bow = 0, kneel = 0, armUp = 0, bob = 0, jitter = 0, sway = 0;
  if (s.state === 'walk' || s.state === 'leave' || s.state === 'charge') {
    // move around the ring in polar coordinates so nobody walks through the horror
    let dA = Math.atan2(Math.sin(s.tAng - s.ang), Math.cos(s.tAng - s.ang));
    const dR = s.tRad - s.rad;
    const arc = Math.abs(dA) * s.rad, dist = Math.hypot(arc, dR);
    const speed = sp * (s.state === 'leave' ? 2.2 : s.state === 'charge' ? 1.6 : 1);
    if (dist < .05) {
      if (s.state === 'leave') { killSprite(s); return; }
      if (s.state === 'charge') { s.state = 'act'; s.act = s.after || 'idle'; s.until = 1e9; }
      else if (s.act === 'cowerGo' || s.act === 'kneelGo') { s.state = 'act'; s.act = s.act === 'cowerGo' ? 'cower' : 'kneel'; s.until = time + rand(3, 6); }
      else {
        const a = pickActivity();
        if (a === 'walk') { s.tAng = s.ang + rand(-1.4, 1.4); s.tRad = R * rand(.95, 1.15); }
        else if (a === 'cower') { s.act = 'cowerGo'; s.tAng = s.ang + rand(-1, 1); s.tRad = R * rand(1.3, 1.5); }
        else if (a === 'kneelFront') { s.act = 'kneelGo'; s.tAng = Math.PI / 2 + rand(-.6, .6); s.tRad = R * .95; }
        else { s.state = 'act'; s.act = a; s.until = time + rand(2.5, 6); }
      }
    } else {
      const k = Math.min(1, speed * dt / dist);
      const prev = cultPos(s);
      s.ang += dA * k; s.rad += dR * k;
      const now = cultPos(s);
      if (now.distanceToSquared(prev) > 1e-8) s.g.rotation.y = Math.atan2(now.x - prev.x, now.z - prev.z);
      bob = Math.abs(Math.sin(s.t * 9)) * .04;
    }
  }
  if (s.state === 'act') {
    const p = cultPos(s);
    s.g.rotation.y = Math.atan2(-p.x, -p.z) + (s.act === 'cower' ? Math.PI : 0);
    switch (s.act) {
      case 'bow': bow = .45 + Math.sin(s.t * 2) * .2; break;
      case 'kneel': kneel = 1; bow = .25; break;
      case 'chant': armUp = 1; bob = Math.abs(Math.sin(s.t * 3)) * .03; break;
      case 'cower': kneel = .4; jitter = Math.sin(s.t * 40) * .02; break;
      case 'dance': sway = Math.sin(s.t * 3) * .35; armUp = Math.sin(s.t * 3) > 0 ? 1 : .3; break;
      case 'stare': bob = .06 + Math.sin(s.t * 1.5) * .04; break;
      case 'swat': armUp = Math.sin(s.t * 14) > 0 ? 1 : .2; sway = Math.sin(s.t * 14) * .08; break;
      case 'flee': break;
    }
    if (time > s.until) { s.state = 'walk'; s.act = 'walk'; s.tAng = s.ang + rand(-1.4, 1.4); s.tRad = R * rand(.95, 1.15); }
  }
  const pos = cultPos(s);
  if (s.lift) { pos.lerp(s.lift.to, s.lift.k); pos.y = s.lift.k * s.lift.to.y; }
  s.g.position.set(pos.x + jitter, bob - s.sink + (s.lift ? pos.y : 0), pos.z);
  s.body.rotation.x = bow + (s.fall || 0);
  s.body.rotation.z = sway;
  s.body.scale.set(s.scale ?? 1, (1 - kneel * .3) * (s.scale ?? 1), s.scale ?? 1);
  s.body.position.y = -kneel * .05;
  if (s.arms) s.arms.forEach((a, i) => { a.rotation.x = lerp(-.3, -2.7, armUp); a.rotation.z = (i ? 1 : -1) * lerp(.25, .5, armUp); });
}

// The horror lunges, a red flash and a burst of blood, and the cultist is gone.
export function eat(id) {
  const s = cult[id];
  if (!s) return wait(.6);
  s.dying = true; s.state = 'frozen';
  const target = cultPos(s);
  const dir = target.clone().setY(0).normalize();
  const mouthAt = V3(0, C.height * C.scale * .5, 0).addScaledVector(dir, C.radius * .6);
  return new Promise(resolve => {
    C.chomp = 2.2;
    tween(.25, t => { C.lunge.copy(dir).multiplyScalar(easeOut(t) * Math.min(1.2, target.length() * .35)); C.root.rotation.x = easeOut(t) * .12; });
    s.lift = { to: mouthAt, k: 0 };
    tween(.32, t => { s.lift.k = easeOut(t); }, () => {
      splash(mouthAt, 40, 3.2);
      hooks.onBlood && hooks.onBlood();
      C.light.intensity = SCENE.creatureLightIntensity * 4;
      tween(.18, t => { s.scale = 1 - t; }, () => killSprite(s));
      tween(.5, t => { C.lunge.copy(dir).multiplyScalar((1 - easeOut(t)) * Math.min(1.2, target.length() * .35)); C.root.rotation.x = (1 - t) * .12; C.light.intensity = SCENE.creatureLightIntensity * lerp(4, 1, t); },
        () => { C.chomp = 1; resolve(); });
    });
  });
}
export function slay(id) {
  const s = cult[id];
  if (!s) return wait(.4);
  s.dying = true; s.state = 'frozen';
  splash(cultPos(s).setY(.5), 18, 1.6);
  hooks.onBlood && hooks.onBlood(.5);
  return new Promise(r => tween(1, t => { s.fall = easeOut(t) * 1.5; s.sink = Math.max(0, t - .5) * .8; setOpacity(s, 1 - Math.max(0, t - .4) / .6); }, () => { killSprite(s); r(); }));
}
export function leave(id) {
  const s = cult[id];
  if (!s) return wait(.2);
  s.dying = true; s.state = 'leave'; s.tRad = 13; s.tAng = s.ang;
  tween(2.5, t => setOpacity(s, 1 - t));
  return wait(.4);
}

/* =====================================================================
   Ending moments
   ===================================================================== */
const extras = new THREE.Group();
function liveCult() { return Object.values(cult).filter(s => !s.dying); }
export async function playMoment(name) {
  const D = SCENE.momentDuration;
  controls.autoRotate = true;
  switch (name) {
    case 'devour': {
      for (const s of liveCult()) { await eat(s.id); }
      const s0 = C.scale;
      await new Promise(r => tween(1.6, t => { C.targetScale = C.scale = lerp(s0, s0 * .25, t * t); C.offset = V3(0, -t * C.height * s0 * .5, 0); }, r));
      break;
    }
    case 'burst': {
      const s0 = C.scale;
      await new Promise(r => tween(D * .6, t => { C.scale = s0 * (1 + t * t * .9); C.offset = V3(rand(-1, 1) * t * .05, 0, rand(-1, 1) * t * .05); C.light.intensity = SCENE.creatureLightIntensity * (1 + t * 3); }, r));
      splash(V3(0, C.height * C.scale * .5, 0), 220, 6);
      hooks.onBlood && hooks.onBlood(1);
      C.root.visible = false;
      await wait(D * .4);
      break;
    }
    case 'turning': {
      liveCult().forEach(s => { s.state = 'charge'; s.tRad = ringRadius() * .55; s.after = 'chant'; });
      await wait(1.6);
      for (let i = 0; i < 4; i++) { splash(V3(rand(-.5, .5), C.height * C.scale * rand(.3, .7), rand(.2, .6)), 30, 2); hooks.onBlood && hooks.onBlood(.4); C.offset = V3(rand(-.1, .1), 0, rand(-.1, .1)); await wait(.35); }
      await new Promise(r => tween(1.4, t => { C.offset = V3(0, -t * C.height * C.scale, 0); C.light.intensity = SCENE.creatureLightIntensity * (1 - t); }, r));
      break;
    }
    case 'rapture': {
      liveCult().forEach(s => { s.state = 'charge'; s.tRad = .3; s.after = 'idle'; tween(2.4, t => { s.scale = 1 - t * t; }); });
      C.light.color.set('#ffcf7a');
      tween(2.6, t => { C.light.intensity = SCENE.creatureLightIntensity * (1 + 2 * Math.sin(t * Math.PI)); });
      await wait(2.6);
      C.frozen = true;
      tween(1.5, t => { C.light.intensity = SCENE.creatureLightIntensity * (1 - t); C.grey = t * .6; });
      await wait(1.5);
      break;
    }
    case 'cage': {
      const s0 = C.scale;
      tween(1.5, t => { C.targetScale = C.scale = lerp(s0, s0 * .6, t); C.grey = t; C.light.intensity = SCENE.creatureLightIntensity * (1 - t * .8); });
      const cage = new THREE.Group(), R = C.radius * .75 + .35, H = C.height * s0 * .7 + .6;
      const bar = new THREE.MeshStandardMaterial({ color: '#9a9a9a', metalness: .3, roughness: .5, emissive: '#1a1a1a' });
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, b = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, H, 5), bar); b.position.set(Math.cos(a) * R, H / 2, Math.sin(a) * R); cage.add(b); }
      const top = new THREE.Mesh(new THREE.TorusGeometry(R, .05, 6, 28), bar); top.rotation.x = Math.PI / 2; top.position.y = H; cage.add(top);
      cage.position.y = 8;
      extras.add(cage);
      await wait(1);
      await new Promise(r => tween(.6, t => { cage.position.y = 8 * (1 - t * t); }, r));
      splash(V3(0, .1, 0), 20, 1.5);
      await wait(D - 1.6);
      break;
    }
    case 'exodus': {
      liveCult().forEach(s => { s.state = 'leave'; s.tRad = 14; s.tAng = s.ang + rand(-.3, .3); s.dying = true; tween(2.5, t => setOpacity(s, 1 - t)); });
      const d0 = scene.fog.density;
      tween(D, t => { scene.fog.density = lerp(d0, d0 * 2.4, t); C.light.color.set(Math.sin(t * 30) > 0 ? '#8d6bd1' : '#2a1a4a'); });
      await wait(D);
      break;
    }
    case 'fade': {
      const d0 = scene.fog.density;
      tween(D, t => { scene.fog.density = lerp(d0, d0 * 4, t); });
      await candlesOut(D);
      break;
    }
    case 'lonely': {
      tween(D, t => { C.light.intensity = SCENE.creatureLightIntensity * (1 - t * .85); controls.minDistance = Math.min(controls.minDistance, 3); });
      await candlesOut(D);
      break;
    }
    case 'torches': {
      const n = 16, torches = [];
      const stickMat = new THREE.MeshStandardMaterial({ color: '#3a2414', roughness: 1 });
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, g = new THREE.Group();
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, 1.3, 5), stickMat);
        stick.position.y = .65;
        const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.flame, color: '#ffa040', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        fl.position.y = 1.45; fl.scale.set(.35, .55, 1);
        g.add(stick, fl);
        g.position.set(Math.cos(a) * 11, 0, Math.sin(a) * 11);
        extras.add(g);
        torches.push({ g, a, fl, ph: rand(0, 6) });
      }
      world.emberSpeed = 3;
      await new Promise(r => tween(D, t => {
        world.torchLight.intensity = 30 * t;
        torches.forEach(o => { const rr = lerp(11, 5.6, easeOut(t)); o.g.position.set(Math.cos(o.a) * rr, Math.sin(time * 8 + o.ph) * .03, Math.sin(o.a) * rr); o.fl.scale.set(.35 + Math.sin(time * 13 + o.ph) * .05, .55 + Math.sin(time * 9 + o.ph) * .08, 1); });
        liveCult().forEach(s => { if (s.state !== 'act' || s.act !== 'cower') { s.state = 'act'; s.act = 'cower'; s.until = 1e9; } });
      }, r));
      break;
    }
    case 'rise': {
      const bg0 = scene.background.clone();
      world.emberSpeed = 8;
      liveCult().forEach(s => { s.state = 'act'; s.act = 'kneel'; s.until = 1e9; });
      await new Promise(r => tween(D, t => {
        C.offset = V3(0, easeOut(t) * 1.8, 0);
        C.scale = C.targetScale * (1 + t * .35);
        C.light.intensity = SCENE.creatureLightIntensity * (2 + Math.sin(time * 6) * 1.5);
        scene.background.copy(bg0).lerp(new THREE.Color('#3a0610'), t);
        scene.fog.color.copy(scene.background);
      }, r));
      break;
    }
  }
}
function candlesOut(D) {
  const list = world.candles.slice().sort(() => Math.random() - .5);
  list.forEach((c, i) => setTimeout(() => tween(.3, t => { c.lit = 1 - t; }), (i / list.length) * D * 900));
  return wait(D);
}
// Back to normal for a new run.
export function resetScene() {
  tweens.length = 0;
  extras.clear();
  C.light.intensity = SCENE.creatureLightIntensity;
  world.candles.forEach(c => { c.lit = 1; });
  C.chomp = 1;
  Object.values(cult).forEach(killSprite);
  cultReady = false;
  C.root.visible = true; C.frozen = false; C.grey = 0; C.offset = V3(); C.lunge.set(0, 0, 0); C.root.rotation.set(0, 0, 0);
  scene.background.set(SCENE.background);
  scene.fog.color.set(SCENE.fog.color);
  scene.fog.density = SCENE.fog.density;
  world.torchLight.intensity = 0;
  world.emberSpeed = 1;
  world.stage = -1;
  controls.minDistance = SCENE.camera.minDistance;
}

/* =====================================================================
   Camera, input, snapshots and the frame loop
   ===================================================================== */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // shift the picture so the creature sits between the top bar and the card
  const shift = (viewInset.bottom - viewInset.top) / 2;
  camera.setViewOffset(w, h, 0, shift, w, h);
  camera.updateProjectionMatrix();
}
export function setViewInset(top, bottom) {
  viewInset = { top, bottom };
  resize();
}
// how far the camera must sit to fit the horror (and some of its cult) in the visible gap
let snapCamera = true;
function framingDistance() {
  const h = window.innerHeight, frac = Math.max(.3, (h - viewInset.top - viewInset.bottom) / h);
  const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
  const vis = Math.atan(Math.tan(vf) * frac), hor = Math.atan(Math.tan(vf) * camera.aspect);
  const halfW = (C.radius + .9) * 1.15, halfH = (C.height * C.scale * .5 + .5) * 1.2;
  return Math.min(SCENE.camera.maxDistance, Math.max(SCENE.camera.distance, halfW / Math.tan(hor), halfH / Math.tan(vis)));
}
function frameTarget() { return V3(C.root.position.x, Math.max(.6, C.height * C.scale * .45), C.root.position.z); }

// Renders the creature from the front into an image (for the legacy screen and card portraits).
// The canvas is briefly resized to the image size; the real view is redrawn in the same task,
// so nothing flickers on screen.
export function snapshot(tight) {
  const W = tight ? 256 : 700, Hh = tight ? 256 : 500, aspect = W / Hh;
  const h = C.height * C.scale;
  const halfW = Math.max(C.radius, .7) * (tight ? 1.05 : 1.35), halfH = h * .5 * (tight ? 1.1 : 1.3) + .2;
  // stay inside the ring of stones and widen the lens instead of backing away
  const dist = Math.min(5.5, Math.max(2.4, halfH * 2.4, halfW * 2));
  const vfov = 2 * Math.atan(Math.max(halfH / dist, halfW / dist / aspect));
  const cam = new THREE.PerspectiveCamera(Math.min(100, THREE.MathUtils.radToDeg(vfov)), aspect, .1, 100);
  cam.position.set(C.root.position.x + dist * .2, h * .5 + dist * .18, C.root.position.z + dist);
  cam.lookAt(C.root.position.x, h * .5, C.root.position.z);
  const size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(W, Hh, false);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/jpeg', .85);
  renderer.setPixelRatio(pr);
  renderer.setSize(size.x, size.y, false);
  renderer.render(scene, camera);
  return url;
}

function onPointer() {
  // tap (not drag) on a cultist shows who they are
  let down = null;
  canvasEl.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; lastInteract = time; });
  canvasEl.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved > 8 || dt > 400) return;
    const r = canvasEl.getBoundingClientRect();
    const ndc = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(Object.values(cult).map(s => s.body), true);
    if (hits.length) {
      const s = Object.values(cult).find(s => { let o = hits[0].object; while (o) { if (o === s.body) return true; o = o.parent; } return false; });
      if (s && hooks.onCultistTap) hooks.onCultistTap(s.id, e.clientX, e.clientY);
    }
  });
}

function loop() {
  requestAnimationFrame(loop);
  timer.update();
  const dt = Math.min(.1, timer.getDelta());
  time += dt;
  frameNo++;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i], p = clamp01((time - tw.t0) / tw.d);
    tw.fn(p);
    if (p >= 1) { tweens.splice(i, 1); tw.done && tw.done(); }
  }
  updateCandles();
  updateEmbers(dt);
  updateBlood(dt);
  updateCreature(dt);
  Object.values(cult).forEach(s => updateCultist(s, dt));
  if (world.glowRing) world.glowRing.material.opacity = .25 + Math.sin(time * 1.5) * .12;
  // cinematic drift when idle
  if (time - lastInteract > SCENE.camera.idleSeconds) controls.autoRotate = true;
  controls.target.lerp(frameTarget().add(V3(0, Math.sin(time * .3) * .08, 0)), .03);
  const d = camera.position.distanceTo(controls.target), want = framingDistance();
  if (controls.autoRotate && Math.abs(d - want) > .05) camera.position.sub(controls.target).multiplyScalar(lerp(1, want / d, snapCamera ? 1 : .03)).add(controls.target);
  snapCamera = false;
  controls.update();
  world.fill.position.copy(camera.position).add(V3(0, 2, 0));
  world.fill.target.position.copy(controls.target);
  renderer.render(scene, camera);
}

export async function initScene(canvas, h) {
  hooks = h || {};
  canvasEl = canvas;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: SCENE.antialias, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SCENE.maxPixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(SCENE.camera.fov, 1, .1, 120);
  camera.position.set(0, SCENE.camera.height, SCENE.camera.distance);
  controls = new OrbitControls(camera, canvas);
  Object.assign(controls, {
    enableDamping: true, dampingFactor: .08, enablePan: false, rotateSpeed: .6, zoomSpeed: .8,
    minDistance: SCENE.camera.minDistance, maxDistance: SCENE.camera.maxDistance,
    minPolarAngle: .35, maxPolarAngle: Math.PI * .45, autoRotate: true, autoRotateSpeed: SCENE.camera.autoRotateSpeed,
  });
  controls.target.set(0, .8, 0);
  controls.addEventListener('start', () => { controls.autoRotate = false; lastInteract = time; });
  controls.addEventListener('end', () => { lastInteract = time; });
  timer = new THREE.Timer();
  timer.connect(document);
  makeTextures();
  buildWorld();
  buildBlood();
  buildCreatureBase();
  scene.add(extras);
  world.stage = -1;
  // optional cultist model
  await new Promise(res => new GLTFLoader().load(SCENE.models.cultist, gltf => {
    const m = gltf.scene, box = new THREE.Box3().setFromObject(m), size = box.getSize(V3());
    m.scale.setScalar(SCENE.cultist.height / size.y);
    m.position.y = -box.min.y * m.scale.y;
    cultModel = new THREE.Group().add(m);
    res();
  }, undefined, () => res()));
  window.addEventListener('resize', resize);
  resize();
  onPointer();
  loop();
}
