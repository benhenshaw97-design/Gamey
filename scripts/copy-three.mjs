// Copies the parts of the three npm package the game uses into /lib/three,
// so the site has no external dependencies. Run after `npm install`:
//   npm run copy-three
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const src = 'node_modules/three';
const dest = 'lib/three';
const files = [
  ['build/three.module.js', 'three.module.js'],
  ['build/three.core.js', 'three.core.js'],
  ['examples/jsm/controls/OrbitControls.js', 'addons/controls/OrbitControls.js'],
  ['examples/jsm/objects/MarchingCubes.js', 'addons/objects/MarchingCubes.js'],
  ['examples/jsm/loaders/GLTFLoader.js', 'addons/loaders/GLTFLoader.js'],
  ['examples/jsm/utils/BufferGeometryUtils.js', 'addons/utils/BufferGeometryUtils.js'],
  ['examples/jsm/utils/SkeletonUtils.js', 'addons/utils/SkeletonUtils.js'],
  ['LICENSE', 'LICENSE'],
];

rmSync(dest, { recursive: true, force: true });
for (const [from, to] of files) {
  const out = `${dest}/${to}`;
  mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
  cpSync(`${src}/${from}`, out);
}
console.log(`Copied ${files.length} files into ${dest}`);
