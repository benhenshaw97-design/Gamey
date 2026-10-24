# Audio

Every sound in the game is synthesised with the Web Audio API. To replace one, drop a file
here with one of these names. Use `.mp3` or `.ogg`; if both exist, `.mp3` wins.
Missing files are skipped and the synthesised version plays instead.

| File name             | What it is                                   | Notes                              |
| --------------------- | -------------------------------------------- | ---------------------------------- |
| `drone.mp3`           | The low ambient loop under everything        | Loops. It is pitched down as the horror grows |
| `chant.mp3`           | The cult's chanting loop                     | Loops. Louder with more cultists   |
| `sacrifice.mp3`       | A cultist is eaten                           |                                    |
| `slain.mp3`           | A cultist is killed by someone else          |                                    |
| `leave.mp3`           | A cultist walks away                         |                                    |
| `recruit.mp3`         | A new cultist joins                          |                                    |
| `growth.mp3`          | The horror reaches a new stage               |                                    |
| `death.mp3`           | The run ends                                 |                                    |
| `swipe.mp3`           | A card is swiped away                        |                                    |
| `attach.mp3`          | A part is grafted onto the body              |                                    |
| `tap.mp3`             | Small UI tap (tapping a cultist)             |                                    |

Open the Sound panel (the ♪ button) after your first tap to see which of your files were loaded.
The names and the folder are set in `AUDIO` in `js/config.js`.

Missing files show up as 404s in the browser's network log. That is expected and harmless.
