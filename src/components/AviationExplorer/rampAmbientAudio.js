export function createRampAmbientAudio() {
  let audioContext = null;

  function ensureContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioContext) audioContext = new AudioCtx();
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }

  function start() {
    return ensureContext();
  }

  function dispose() {
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
  }

  return { start, dispose, getContext: ensureContext };
}
