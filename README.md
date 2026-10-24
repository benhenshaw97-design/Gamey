# The Hungering Dark

A turn-based cult horror game for the browser. Each day is one card: swipe or tap one of two choices,
keep Hunger, Devotion, Dread and Suspicion away from both extremes, graft parts onto a growing horror,
and watch your cult wander the 3D ritual circle.

No build step. Plain HTML, CSS and ES modules, with Three.js vendored in `lib/three/`.

## Running it

ES modules do not load from `file://`, so serve the folder over http:

```
python3 -m http.server
# then open http://localhost:8000
```

On GitHub Pages: Settings → Pages → Deploy from a branch → pick this branch and `/ (root)`.

## Files

| Path | What lives there |
| ---- | ---------------- |
| `index.html` | The page shell and the import map |
| `css/style.css` | All styling for the overlay |
| `js/main.js` | Boot, and the glue between state, scene, audio and UI |
| `js/config.js` | **All balance numbers and content**: meters, drift, parts, synergies, characters, endings, scene and audio settings |
| `js/cards.js` | **All decision cards** (74), their conditions and chains |
| `js/state.js` | Game rules, the body grid, card drawing and saving (localStorage key `hungering-dark-v4`) |
| `js/scene.js` | The Three.js ritual ground, the creature built from its parts, cultists and the ending moments |
| `js/audio.js` | Web Audio drone, chants and effects, plus optional audio files |
| `js/ui.js` | Meters, card and swipe, the body-map editor, chronicle, sound settings, legacy screen |
| `js/parts2d.js` | Flat SVG drawings for the body map and card portraits |
| `assets/audio/`, `assets/textures/`, `assets/models/` | Optional files that replace the procedural versions (see the README in each) |
| `lib/three/` | The three.js module build and the few addons the game uses |

## Updating three.js

```
npm install three@<version>
npm run copy-three
```

`scripts/copy-three.mjs` copies the module build and the needed addons into `lib/three/`.
