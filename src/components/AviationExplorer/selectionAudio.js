export function playSelectionBlip(audioContext) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  const ctx = audioContext ?? new AudioCtx();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;

  const ping = ctx.createOscillator();
  ping.type = 'sine';
  ping.frequency.setValueAtTime(1240, now);
  ping.frequency.exponentialRampToValueAtTime(620, now + 0.07);

  const pingGain = ctx.createGain();
  pingGain.gain.setValueAtTime(0.0001, now);
  pingGain.gain.exponentialRampToValueAtTime(0.28, now + 0.008);
  pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

  const click = ctx.createOscillator();
  click.type = 'triangle';
  click.frequency.setValueAtTime(2200, now);
  click.frequency.exponentialRampToValueAtTime(900, now + 0.025);

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.0001, now);
  clickGain.gain.exponentialRampToValueAtTime(0.12, now + 0.004);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

  ping.connect(pingGain).connect(ctx.destination);
  click.connect(clickGain).connect(ctx.destination);

  ping.start(now);
  ping.stop(now + 0.12);
  click.start(now);
  click.stop(now + 0.05);

  return ctx;
}
