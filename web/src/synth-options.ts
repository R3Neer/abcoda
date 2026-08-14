import type ABCJS from "abcjs";

// SynthController.setWarp() unconditionally writes to abcjs's own tempo input.
// The whole abcjs control lives in our hidden host, but this particular input
// must still be created or live tempo changes crash with `el is null`.
export const hiddenSynthVisualOptions: ABCJS.SynthVisualOptions = {
  displayLoop: false,
  displayPlay: false,
  displayProgress: false,
  displayRestart: false,
  displayWarp: true,
};
