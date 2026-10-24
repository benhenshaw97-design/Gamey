// All balance numbers and content (except the cards, which live in cards.js).
// Edit freely: nothing here needs a build step.

/* =====================================================================
   BALANCE: meters, daily drift, growth. Meters run 0 to 100; reaching
   0 or 100 ends the run.
   ===================================================================== */
export const BALANCE = {
  saveKey: 'hungering-dark-v4',          // new key for the multi-file version
  legacyKeys: ['hungering-dark-v3'],     // endings discovered in these older saves are carried over
  startMeters: { hunger: 50, devotion: 50, dread: 40, suspicion: 25 },
  startCultists: 4,
  startTray: ['eye'],                    // parts you begin every run with
  // Change to each meter at the end of every day, before parts are counted.
  baseDrift: { hunger: -3, devotion: -1, dread: -1.5, suspicion: 0.7 },
  stageHungerDrift: [0, -0.5, -1, -1.5], // bigger horrors are hungrier
  noRepeatDays: 8,                       // a card can't come back within this many days
  chainExpireDays: 6,                    // a chained card waits at most this long for its conditions
  starvingBelow: 15,                     // below this Hunger the horror may eat a cultist on its own
  starvingEatChance: 0.4,
  starvingEatFeeds: 12,
  dangerBand: 15,                        // meters within this of 0 or 100 pulse red
  maxVisibleCultists: 24,               // the 3D ground shows every cultist up to this many
  moveCost: 1,                           // Devotion spent to move or remove a grafted part
  ascensionDays: 10,                     // survive this many days as an Elder Horror to win
  // Growth by total mass (cells covered by grafted parts, not counting the core).
  stages: [
    { name: 'Spawn',        mass: 0,  grid: 4, scale: 1.0 },
    { name: 'Larva',        mass: 4,  grid: 6, scale: 1.12 },
    { name: 'Abomination',  mass: 11, grid: 8, scale: 1.22 },
    { name: 'Elder Horror', mass: 22, grid: 8, scale: 1.42 },
  ],
};

/* =====================================================================
   PARTS. shape: cells relative to the top-left (rotate in The Body).
   drift: added to the daily drift. mult: multiplies positive changes from
   cards (e.g. suspicion 0.8 = 20% less suspicion gained).
   group: flesh colour family (the dominant group tints the horror).
   ===================================================================== */
export const PARTS = {
  core:     { name: 'Core',         shape: [[0,0],[1,0],[0,1],[1,1]], locked: true, color: '#5a0e14', group: null,
              desc: 'The pulsing nucleus it hatched from. Everything grows from here.' },
  eye:      { name: 'Eye',          shape: [[0,0]], color: '#c9a227', group: 'sight', rarity: 'common',
              desc: 'It watches the village, and the village feels it.', drift: { dread: 0.6, suspicion: -0.3 } },
  maw:      { name: 'Maw',          shape: [[0,0],[1,0]], color: '#8a1a22', group: 'gut', rarity: 'common',
              desc: 'A mouth too large for anything. Feeding it pays off more, but it is always hungry.', drift: { hunger: -0.5 }, mult: { hunger: 1.3 } },
  mouth:    { name: 'Extra Mouth',  shape: [[0,0]], color: '#a8323a', group: 'gut', rarity: 'common',
              desc: 'It hums hymns when it is not chewing.', drift: { devotion: 0.3 }, mult: { hunger: 1.15 } },
  tentacle: { name: 'Tentacle',     shape: [[0,0],[0,1]], color: '#2d6a5a', group: 'deep', rarity: 'common',
              desc: 'It forages through drains and wells at night.', drift: { hunger: 0.8 } },
  claw:     { name: 'Claw',         shape: [[0,0],[1,0],[1,1]], color: '#6a4a2a', group: 'bone', rarity: 'common',
              desc: 'It scratches at the walls. Everyone hears it.', drift: { dread: 0.8, suspicion: 0.3 } },
  horn:     { name: 'Horn',         shape: [[0,0]], color: '#b8a070', group: 'bone', rarity: 'common',
              desc: 'A curling horn of old bone.', drift: { dread: 0.6 } },
  spine:    { name: 'Spine',        shape: [[0,0],[0,1],[0,2]], color: '#a89878', group: 'bone', rarity: 'common',
              desc: 'A ridge of quills. Hard to look at, harder to hide.', drift: { dread: 0.5 }, mult: { suspicion: 0.9 } },
  wing:     { name: 'Wing',         shape: [[0,0],[0,1],[1,1]], color: '#3a2a4a', group: 'deep', rarity: 'rare',
              desc: 'Leathery and vast. It dreams of flying over the rooftops.', drift: { dread: 1, suspicion: 0.5 } },
  heart:    { name: 'Second Heart', shape: [[0,0]], color: '#b0182a', group: 'deep', rarity: 'rare',
              desc: 'Its beat keeps the cultists in rhythm.', drift: { devotion: 0.8, hunger: -0.3 } },
  hive:     { name: 'Hive Sac',     shape: [[0,0],[1,0],[0,1],[1,1]], color: '#8a6a2a', group: 'gut', rarity: 'rare',
              desc: 'Swarms of flies bring back scraps from the village.', drift: { hunger: 1.2, suspicion: 0.4 } },
  bone:     { name: 'Bone Armour',  shape: [[0,0],[0,1],[0,2],[1,2]], color: '#cfc4a8', group: 'bone', rarity: 'rare',
              desc: 'Plates of fused bone. Stones and rumours bounce off.', mult: { suspicion: 0.8 } },
  void:     { name: 'Void Orb',     shape: [[0,0]], color: '#3a1a5a', group: 'sight', rarity: 'rare',
              desc: 'A pearl of nothing. Small things float near it.', drift: { dread: 1.2, devotion: -0.4 } },
};

// Adjacent parts (any touching edges) create synergies. Each touching pair counts.
export const SYNERGIES = [
  { a: 'eye',      b: 'void',     name: 'The Abyss Gazes', drift: { dread: 1 },             desc: 'Eye touching a Void Orb: more Dread each day.' },
  { a: 'maw',      b: 'hive',     name: 'Larder',          drift: { hunger: 1 },            desc: 'Maw touching a Hive Sac: food is stored, Hunger drains slower.' },
  { a: 'tentacle', b: 'tentacle', name: 'Twin Grasp',      drift: { hunger: 0.8 },          desc: 'Two Tentacles side by side forage as a pair.' },
  { a: 'eye',      b: 'eye',      name: 'Compound Gaze',   drift: { suspicion: -0.5 },      desc: 'Eyes side by side spot spies: Suspicion grows slower.' },
  { a: 'maw',      b: 'mouth',    name: 'Chorus of Teeth', drift: { devotion: 0.8 },        desc: 'Maw touching an Extra Mouth: they sing together.' },
  { a: 'heart',    b: 'heart',    name: 'Twin Pulse',      drift: { devotion: 1 },          desc: 'Two Second Hearts beating in time.' },
  { a: 'heart',    b: 'core',     name: 'Living Engine',   drift: { devotion: 0.5 },        desc: 'A Second Heart touching the Core.' },
  { a: 'horn',     b: 'spine',    name: 'Thornback',       drift: { dread: 0.8 },           desc: 'Horn touching a Spine.' },
  { a: 'claw',     b: 'bone',     name: 'Siege Limb',      mult: { suspicion: 0.9 },        desc: 'Claw touching Bone Armour: it hides its tracks.' },
  { a: 'wing',     b: 'spine',    name: 'Gargoyle',        drift: { dread: 0.6 },           desc: 'Wing touching a Spine.' },
  { a: 'void',     b: 'mouth',    name: 'Speaking Void',   drift: { devotion: 0.6, dread: 0.4 }, desc: 'Void Orb touching an Extra Mouth: it speaks in tongues.' },
  { a: 'hive',     b: 'heart',    name: 'Brood',           drift: { hunger: 0.7 },          desc: 'Hive Sac touching a Second Heart: the swarm breeds.' },
];

// Flesh colours, chosen by whichever group of parts covers the most cells.
// light: the flesh itself, dark: its shadowed sheen, vein: the glow beneath the skin.
export const FLESH = {
  none:  { light: '#3e5034', dark: '#0e140c', vein: '#b5d36b' },
  gut:   { light: '#7a1e24', dark: '#2a0608', vein: '#ff5a4a' },
  sight: { light: '#3e3068', dark: '#100a24', vein: '#9fe0e0' },
  bone:  { light: '#5a3e30', dark: '#1a0e06', vein: '#ff9a50' },
  deep:  { light: '#24503f', dark: '#07140e', vein: '#9be0b0' },
};

/* =====================================================================
   CHARACTERS: who appears on the cards. style picks the portrait drawing.
   ===================================================================== */
export const CHARACTERS = {
  horror:    { name: 'The Horror',            role: 'it speaks without a mouth', style: 'horror' },
  cultist:   { name: '{c}',                   role: 'one of your faithful',      style: 'hood' },
  priest:    { name: 'Father Aldous',         role: 'the village priest',        style: 'priest' },
  elder:     { name: 'Elder Mabry',           role: 'the village elder',         style: 'elder' },
  rival:     { name: 'Sister Vesper',         role: 'prophet of the Pale Worm',  style: 'rival' },
  stranger:  { name: 'The Grey Stranger',     role: 'he keeps coming back',      style: 'stranger' },
  hunter:    { name: 'Silas Crane',           role: 'witch-hunter',              style: 'hunter' },
  child:     { name: 'Little Bess',           role: 'a curious child',           style: 'child' },
  peddler:   { name: 'Old Tobiah',            role: 'a travelling peddler',      style: 'peddler' },
  digger:    { name: 'Hollis',                role: 'the gravedigger',           style: 'digger' },
  constable: { name: 'Constable Pike',        role: 'the law, such as it is',    style: 'constable' },
  village:   { name: 'The Village',           role: 'above the crypt',           style: 'village' },
  omen:      { name: 'An Omen',               role: 'the sky is wrong',          style: 'omen' },
};

/* =====================================================================
   ENDINGS. Triggered when a meter reaches 0 or 100, the cult is empty,
   or the horror survives long enough as an Elder Horror.
   moment: the 3D death scene (see momentDuration in SCENE).
   reward: inheritance for the next run ('part:x' or 'bonus:x', see LEGACY).
   ===================================================================== */
export const ENDINGS = {
  hunger_low:     { title: 'The Hollow Feast', moment: 'devour', hint: 'Hunger reaches nothing', tint: '#3a0606',
    text: 'Starving, it turns on the cult. It eats them one by one, slowly, apologetically. When the last is gone it begins on itself, and does not stop.',
    epitaph: 'It ate everything it loved, and then it ate the loving.', reward: 'part:maw' },
  hunger_high:    { title: 'Gorged', moment: 'burst', hint: 'Hunger overflows', tint: '#4a1a06',
    text: 'It eats until its skin goes tight and shining. On the last night there is a sound like a wet drum, and the crypt is painted red to the ceiling.',
    epitaph: 'Too much of a terrible thing.', reward: 'part:hive' },
  devotion_low:   { title: 'The Turning', moment: 'turning', hint: 'Devotion runs dry', tint: '#2a2a3a',
    text: 'The faithful stop believing all at once, the way frost cracks. They come down the stairs with kitchen knives, and they do not chant.',
    epitaph: 'Gods die when they are no longer prayed to. Some need help.', reward: 'part:heart' },
  devotion_high:  { title: 'Rapture', moment: 'rapture', hint: 'Devotion overflows', tint: '#4a3a0a',
    text: 'The cult loves it too much. They climb into its mouths singing, all of them, until it chokes on worship and lies still beneath a mound of the blissful dead.',
    epitaph: 'Smothered by its congregation.', reward: 'part:void' },
  dread_low:      { title: 'The Pet', moment: 'cage', hint: 'Dread fades away', tint: '#1a3a2a',
    text: 'Nobody fears it any more. Children poke it with sticks. A travelling menagerie buys it for six shillings and paints "THE CELLAR SLUG" on its cage.',
    epitaph: 'Here lies a god, admission one penny.', reward: 'part:horn' },
  dread_high:     { title: 'The Screaming Exodus', moment: 'exodus', hint: 'Dread overflows', tint: '#2a0a3a',
    text: 'The fear breaks everyone at once. Villagers and cultists flee into the hills, screaming, tearing at their eyes. It waits in the empty valley for a very long time.',
    epitaph: 'It wanted to be feared. It got its wish, and nothing else.', reward: 'bonus:devotion' },
  suspicion_low:  { title: 'Hidden Too Well', moment: 'fade', hint: 'Suspicion vanishes', tint: '#1a1a24',
    text: 'The cult is so secret that it forgets itself. Meetings lapse. Names are lost. The horror sleeps under a village that never knew it was there.',
    epitaph: 'The best-kept secret, kept forever.', reward: 'part:wing' },
  suspicion_high: { title: 'Torches at the Door', moment: 'torches', hint: 'Suspicion overflows', tint: '#5a2a06', fire: true,
    text: 'The whole village comes with torches, pitchforks and Constable Pike at the front. The chapel burns until dawn. Something under it screams in a voice like church bells.',
    epitaph: 'The village sleeps soundly again. Mostly.', reward: 'part:bone' },
  alone:          { title: 'The Last Supper', moment: 'lonely', hint: 'No cultists remain', tint: '#2a0a0a',
    text: 'There is no one left to kneel. It calls out in the empty crypt every night, softer and softer, and the candles go out one by one.',
    epitaph: 'Even gods are lonely at the end.', reward: 'bonus:cultists' },
  ascension:      { title: 'The Long Night', moment: 'rise', hint: 'Survive as an Elder Horror', tint: '#3a0a2a', win: true,
    text: 'It rises through the chapel floor, vast and complete. The sun does not come up the next morning, or any morning after. Your cult kneels in the endless dark, and is never hungry again.',
    epitaph: 'Long may it reign.', reward: 'bonus:rare' },
};

// What each inheritance gives the next run.
export const LEGACY = {
  'part:maw':       { text: 'A Maw waits in your tray.',               part: 'maw' },
  'part:hive':      { text: 'A Hive Sac waits in your tray.',          part: 'hive' },
  'part:heart':     { text: 'A Second Heart waits in your tray.',      part: 'heart' },
  'part:void':      { text: 'A Void Orb waits in your tray.',          part: 'void' },
  'part:horn':      { text: 'A Horn waits in your tray.',              part: 'horn' },
  'part:wing':      { text: 'A Wing waits in your tray.',              part: 'wing' },
  'part:bone':      { text: 'Bone Armour waits in your tray.',         part: 'bone' },
  'bonus:devotion': { text: 'Your new cult begins with 65 Devotion.',  meters: { devotion: 65 } },
  'bonus:cultists': { text: 'Two more faithful join your new cult.',   cultists: 2 },
  'bonus:rare':     { text: 'A random rare part waits in your tray.',  part: 'rare' },
};

// Cultist names, robe colours and one-line personalities.
export const CULT = {
  names: ['Agnes', 'Silas', 'Mercy', 'Obadiah', 'Ezra', 'Hester', 'Tobias', 'Prudence', 'Ambrose', 'Lilith', 'Josiah', 'Constance', 'Edmund', 'Winifred', 'Gideon', 'Ruth', 'Cornelius', 'Temperance', 'Barnaby', 'Delphine', 'Jedediah', 'Honor', 'Thaddeus', 'Bathsheba'],
  robes: ['#4a1418', '#2a1a2e', '#1e2a22', '#3a2414', '#2a2a30', '#401a2a', '#33281a'],
  quirks: [
    'Hums hymns backwards when nervous.', 'Keeps a finger bone in each pocket, for luck.',
    'Joined for the free soup. Stayed for the screaming.', 'Has never once blinked during a sacrifice.',
    'Writes love letters to the horror.', 'Is fairly sure this is a book club.',
    'Collects teeth. Not always fallen ones.', 'Was a baker. Still bakes. Do not ask what with.',
    'Sleeps curled at the altar\'s foot like a dog.', 'Laughs at funerals. Weeps at weddings.',
    'Believes the horror is their mother.', 'Counts the cult every night and gets a different number.',
    'Sharpens the knife even when it is sharp.', 'Talks to the candles. Claims they answer.',
    'Fled a convent, and brought its silver.', 'Insists on being called Brother Wormwood.',
    'Smiles too much. Far too much.', 'Has a cough that sounds like whispering.',
    'Wants to be eaten last. Or first. Undecided.', 'Keeps a diary in a language nobody taught them.',
  ],
};

/* =====================================================================
   SCENE: the 3D ritual ground.
   ===================================================================== */
export const SCENE = {
  maxPixelRatio: 1.6,          // caps sharpness so phones stay smooth
  antialias: true,
  fog: { color: '#0a0710', density: 0.075 },
  background: '#07060a',
  moonColor: '#6a6aa0', moonIntensity: 0.55,
  ambient: 0.5,
  // Candles: the first `lights` candles carry real point lights; the rest only glow.
  candles: { base: 7, perStage: 3, lights: 5, lightIntensity: 3.2, lightRange: 6, radius: 4.1, flicker: 0.35 },
  stones: { count: 12, radius: 8.8, height: [1.6, 2.8] },
  embers: { count: 220, mobileCount: 120, area: 7, rise: 0.35 },
  cellSize: 0.3,               // size of one body-map cell on the creature, before stage scaling
  fleshResolution: 30,         // marching-cubes detail for the flesh mass (lower = faster)
  fleshAnimateEvery: 2,        // rebuild the wobbling flesh every N frames
  creatureLightIntensity: 3,
  fleshGlow: 0.18,            // how much the veins glow through the skin
  cultist: { height: 0.95, walkSpeed: 0.7, ringPadding: 1.25 },
  camera: { fov: 45, distance: 6.2, height: 3.4, minDistance: 2.8, maxDistance: 9.5, autoRotateSpeed: 0.25, idleSeconds: 6 },
  momentDuration: 4.2,         // seconds each ending's 3D moment plays before the epitaph
  // Optional files in /assets. Missing files fall back to procedural versions.
  textures: { ground: 'assets/textures/ground', stone: 'assets/textures/stone' },   // .jpg, .png or .webp
  models: { cultist: 'assets/models/cultist.glb', stone: 'assets/models/standing-stone.glb' },
};

/* =====================================================================
   AUDIO: synthesised by default. Drop files into /assets/audio with these
   names (.mp3 or .ogg) to replace any sound.
   ===================================================================== */
export const AUDIO = {
  defaultVolume: 0.7,
  folder: 'assets/audio/',
  extensions: ['mp3', 'ogg'],
  // loops
  drone: { file: 'drone', gain: 0.32, stageRoots: [55, 49, 43.65, 36.71] },   // Hz: it gets deeper as it grows
  chant: { file: 'chant', gain: 0.16, scale: [0, 3, 5, 7, 10, 12], everySeconds: [2.5, 5] },
  // one-shots
  effects: ['sacrifice', 'recruit', 'growth', 'death', 'swipe', 'attach', 'slain', 'leave', 'tap'],
};
