# Models

Everything is built from procedural geometry by default. You can drop in glTF binary models (`.glb`):

| File name             | Replaces                         | How it is used |
| --------------------- | -------------------------------- | -------------- |
| `cultist.glb`         | The low-poly robed cultist       | Scaled to `SCENE.cultist.height` (about 1 unit tall), feet at the origin, facing +Z. The game still moves, bows and kneels it, but the procedural arm animation is lost. Its materials are cloned per cultist so they can fade out. |
| `standing-stone.glb`  | Each standing stone in the ring  | Scaled to the height of the stone it replaces, base at the origin. |

Keep models low-poly (a few thousand triangles) so phones stay smooth. Embedded textures are fine.
Skinned animation clips are not played.

The paths are set in `SCENE.models` in `js/config.js`.
