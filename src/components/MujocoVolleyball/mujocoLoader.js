// Loads the official MuJoCo WebAssembly build once and shares it.
//
// We use the single-threaded build: the multi-threaded one needs
// cross-origin-isolation headers that GitHub Pages cannot send.
// The `?url` import makes Vite copy mujoco.wasm into the build with a hashed
// name under the site's base path (/physical-ai/), so it loads on Pages.

import loadMujoco from '@mujoco/mujoco';
import wasmUrl from '@mujoco/mujoco/mujoco.wasm?url';

let modulePromise = null;

export function getMujoco() {
  if (!modulePromise) {
    modulePromise = loadMujoco({ locateFile: () => wasmUrl }).catch((err) => {
      modulePromise = null; // allow a retry after a failed download
      throw err;
    });
  }
  return modulePromise;
}
