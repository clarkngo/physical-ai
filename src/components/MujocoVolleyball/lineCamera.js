// Virtual line-call camera: how well can an ordinary video camera locate where
// the ball landed?
//
// MuJoCo gives the true flight at 1 kHz. A pinhole camera, placed on the
// extension of the nearest boundary line and looking along it (like a line
// judge), films it at a chosen frame rate, shutter speed and resolution:
//   - each frame records the centroid of the ball's motion-blur streak (the
//     average of its projected position over the exposure), plus detector noise
//     that grows with the streak length;
//   - frames start at a random phase, so the bounce falls anywhere between them.
// The estimator never sees the truth. It splits the frames at the bounce, fits
// a quadratic to the image track before and after, takes the point where the
// two fits meet as the bounce in the image, and back-projects it onto the
// plane of the ball's centre at contact (z = radius) using the camera
// calibration. The error is that estimate minus MuJoCo's first contact point,
// split into camera error (against the middle of the floor contact, which is
// what the image shows) and skid bias (middle of contact vs first touch, which
// is what the rule judges).
//
// Pure JS so it runs in the browser and in Node.

import { BALL, COURT } from './volleyballScene.js';
import { lineMargin } from './volleyballSim.js';

export const RESOLUTIONS = {
  '1080p': { label: '1080p', w: 1920, h: 1080 },
  '4k': { label: '4K', w: 3840, h: 2160 },
};
export const FRAME_RATES = [30, 60, 120, 240];
export const SHUTTERS = {
  60: { label: '1/60 s (phone default)', s: 1 / 60 },
  250: { label: '1/250 s', s: 1 / 250 },
  1000: { label: '1/1000 s', s: 1 / 1000 },
};

const HFOV = 60; // degrees
const CAM_BACK = 3; // metres beyond the end of the line
const CAM_HEIGHT = 1.5; // metres
const NOISE_PX_1080 = 0.5; // detector centroid noise for a sharp ball at 1080p
const BLUR_NOISE = 0.05; // extra noise per pixel of streak length
const FIT_WINDOW = 0.12; // seconds of track used each side of the bounce (at least 3 frames)
export const NEAR_LINE = 0.5; // only landings this close to a line are scored (m)

// ── Small vector helpers ────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Seeded random numbers (mulberry32) so a run can be repeated. */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng) {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/**
 * Fly one serve and keep the dense (1 ms) track around the landing.
 * Returns null for serves that never reach the far court's floor.
 */
export function recordServe(sim, aimed) {
  sim.launch(aimed);
  const path = [];
  while (!sim.done && sim.time < 8) {
    sim.stepOnce();
    const q = sim.data.qpos;
    path.push([sim.time, q[0], q[1], q[2]]);
  }
  if (!sim.done) sim.finish();
  const r = sim.result;
  if (!r?.landing || r.landing.x < 0 || sim.fault) return null;
  const t0 = r.landing.t;
  // While squashed against the floor the ball keeps travelling. Its lowest
  // point is the middle of that skid: what a camera sees as "the bounce".
  const window = path.filter(([t]) => t >= t0 && t < t0 + 0.1);
  const low = window.reduce((a, p) => (p[3] < a[3] ? p : a), window[0]);
  const touching = window.filter(([, , , z]) => z < BALL.radius);
  const lastTouch = touching[touching.length - 1] ?? low;
  return {
    landing: { x: r.landing.x, y: r.landing.y, t: t0 },
    mid: { x: low[1], y: low[2] },
    contactMs: (lastTouch[0] - t0) * 1000,
    skid: Math.hypot(lastTouch[1] - r.landing.x, lastTouch[2] - r.landing.y),
    call: r.call,
    margin: r.margin,
    impactSpeed: r.impactSpeed,
    path: path.filter(([t]) => t > t0 - 0.9 && t < t0 + 0.5),
  };
}

/** The boundary line nearest the landing, and which way "out" points across it. */
export function nearestLine({ x, y }) {
  const toEnd = Math.abs(COURT.halfLength - x);
  const toSide = COURT.halfWidth - Math.abs(y);
  if (toEnd < Math.abs(toSide)) return { kind: 'end', label: 'end line' };
  return { kind: 'side', side: Math.sign(y) || 1, label: 'sideline' };
}

/** A camera on the extension of `line`, looking along it. */
export function lineCamera(line, landing, resolution) {
  const { w, h } = RESOLUTIONS[resolution];
  let pos;
  let target;
  if (line.kind === 'side') {
    const y = line.side * COURT.halfWidth;
    pos = [COURT.halfLength + CAM_BACK, y, CAM_HEIGHT];
    target = [COURT.halfLength / 2, y, 0];
  } else {
    const s = Math.sign(landing.y) || 1;
    pos = [COURT.halfLength, s * (COURT.halfWidth + CAM_BACK), CAM_HEIGHT];
    target = [COURT.halfLength, 0, 0];
  }
  const f = norm(sub(target, pos));
  const r = norm(cross(f, [0, 0, 1]));
  const up = cross(r, f);
  const fpx = w / 2 / Math.tan(((HFOV / 2) * Math.PI) / 180);
  return { pos, f, r, up, fpx, w, h, cx: w / 2, cy: h / 2, line };
}

export function project(cam, p) {
  const d = sub(p, cam.pos);
  const z = dot(d, cam.f);
  if (z <= 0.1) return null;
  return [cam.cx + (cam.fpx * dot(d, cam.r)) / z, cam.cy - (cam.fpx * dot(d, cam.up)) / z];
}

/** Back-project an image point onto the horizontal plane z = height. */
export function backProject(cam, [u, v], height) {
  const a = (u - cam.cx) / cam.fpx;
  const b = (cam.cy - v) / cam.fpx;
  const dir = [0, 1, 2].map((i) => cam.f[i] + a * cam.r[i] + b * cam.up[i]);
  if (Math.abs(dir[2]) < 1e-9) return null;
  const s = (height - cam.pos[2]) / dir[2];
  if (s <= 0) return null;
  return { x: cam.pos[0] + s * dir[0], y: cam.pos[1] + s * dir[1] };
}

/** Film the dense track. Returns frames { t (mid-exposure), u, v }. */
export function film(path, cam, { fps, shutter, rng }) {
  const frames = [];
  const noise0 = NOISE_PX_1080 * (cam.w / 1920);
  const start = path[0][0] + rng() / fps;
  const end = path[path.length - 1][0] - shutter;
  for (let t = start; t < end; t += 1 / fps) {
    let su = 0;
    let sv = 0;
    let n = 0;
    let first = null;
    let last = null;
    for (const [pt, x, y, z] of path) {
      if (pt < t || pt > t + shutter) continue;
      const p = project(cam, [x, y, z]);
      if (!p) continue;
      su += p[0];
      sv += p[1];
      n += 1;
      if (!first) first = p;
      last = p;
    }
    if (!n) {
      // Shutter shorter than the 1 ms track step: use the nearest sample.
      const k = path.findIndex(([pt]) => pt >= t);
      const p = k >= 0 ? project(cam, path[k].slice(1)) : null;
      if (!p) continue;
      su = p[0];
      sv = p[1];
      n = 1;
      first = last = p;
    }
    const u = su / n;
    const v = sv / n;
    if (u < 0 || u > cam.w || v < 0 || v > cam.h) continue;
    const streak = Math.hypot(last[0] - first[0], last[1] - first[1]);
    const sigma = noise0 + BLUR_NOISE * streak;
    frames.push({ t: t + shutter / 2, u: u + sigma * gauss(rng), v: v + sigma * gauss(rng), streak });
  }
  return frames;
}

// Least-squares quadratic a + b·τ + c·τ² (τ = t − t0), via 3×3 normal equations.
function fitQuadratic(ts, ys, t0) {
  const S = Array.from({ length: 5 }, () => 0);
  const B = [0, 0, 0];
  ts.forEach((t, i) => {
    const tau = t - t0;
    let p = 1;
    for (let k = 0; k < 5; k++) {
      S[k] += p;
      if (k < 3) B[k] += p * ys[i];
      p *= tau;
    }
  });
  const M = [
    [S[0], S[1], S[2]],
    [S[1], S[2], S[3]],
    [S[2], S[3], S[4]],
  ];
  // Gaussian elimination.
  for (let i = 0; i < 3; i++) {
    let piv = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[piv][i])) piv = k;
    [M[i], M[piv]] = [M[piv], M[i]];
    [B[i], B[piv]] = [B[piv], B[i]];
    for (let k = i + 1; k < 3; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j < 3; j++) M[k][j] -= f * M[i][j];
      B[k] -= f * B[i];
    }
  }
  const c = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let s = B[i];
    for (let j = i + 1; j < 3; j++) s -= M[i][j] * c[j];
    c[i] = s / M[i][i];
  }
  return (t) => {
    const tau = t - t0;
    return c[0] + c[1] * tau + c[2] * tau * tau;
  };
}

function fitSide(frames) {
  const ts = frames.map((f) => f.t);
  const t0 = ts[ts.length - 1];
  const fu = fitQuadratic(ts, frames.map((f) => f.u), t0);
  const fv = fitQuadratic(ts, frames.map((f) => f.v), t0);
  return (t) => [fu(t), fv(t)];
}

/**
 * Estimate the landing point from the frames alone. Returns
 * { x, y, framesBefore, framesAfter } or null when there are too few frames.
 */
export function estimateLanding(frames, cam) {
  if (frames.length < 6) return null;
  // The bounce is near the lowest image point (largest v). That frame may be
  // just before or just after the bounce, so try both splits and keep the one
  // whose two fitted tracks actually meet.
  let k = 0;
  frames.forEach((f, i) => {
    if (f.v > frames[k].v) k = i;
  });
  let best = null;
  for (const split of [k + 1, k]) {
    if (split < 1 || split >= frames.length) continue;
    const tSplit = (frames[split - 1].t + frames[split].t) / 2;
    let pre = frames.slice(0, split).filter((f) => f.t > tSplit - FIT_WINDOW);
    let post = frames.slice(split).filter((f) => f.t < tSplit + FIT_WINDOW);
    if (pre.length < 3) pre = frames.slice(Math.max(0, split - 3), split);
    if (post.length < 3) post = frames.slice(split, split + 3);
    if (pre.length < 3 || post.length < 3) continue;
    const a = fitSide(pre);
    const b = fitSide(post);
    const tA = pre[pre.length - 1].t;
    const tB = post[0].t;
    let gap = Infinity;
    let point = null;
    for (let i = 0; i <= 100; i++) {
      const t = tA + ((tB - tA) * i) / 100;
      const pa = a(t);
      const pb = b(t);
      const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
      if (d < gap) {
        gap = d;
        point = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
      }
    }
    if (!best || gap < best.gap) best = { gap, point, framesBefore: pre.length, framesAfter: post.length };
  }
  if (!best) return null;
  const p = backProject(cam, best.point, BALL.radius);
  return p && { ...p, framesBefore: best.framesBefore, framesAfter: best.framesAfter };
}

/** Error across the line (+ = estimate further out than the truth), in metres. */
function acrossLineError(line, truth, est) {
  if (line.kind === 'end') return est.x - truth.x;
  return line.side * (est.y - truth.y);
}

function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[i];
}

/**
 * Score one camera setup over recorded serves.
 * Returns error statistics across the line and how the calls compare.
 */
export function evaluate(records, { fps, shutter, resolution, seed = 7 }) {
  const rng = makeRng(seed + fps * 13 + Math.round(shutter * 1e5));
  const rows = [];
  let missed = 0;
  const scored = records.filter((r) => Math.abs(r.margin) < NEAR_LINE);
  for (const rec of scored) {
    const line = nearestLine(rec.landing);
    const cam = lineCamera(line, rec.landing, resolution);
    const frames = film(rec.path, cam, { fps, shutter, rng });
    const est = estimateLanding(frames, cam);
    if (!est) {
      missed += 1;
      continue;
    }
    const err = acrossLineError(line, rec.landing, est);
    const camErr = acrossLineError(line, rec.mid, est);
    const trueIn = rec.margin >= 0;
    const estIn = lineMargin(est.x, est.y) >= 0;
    rows.push({
      err,
      abs: Math.abs(err),
      camErr,
      dist: Math.hypot(est.x - rec.landing.x, est.y - rec.landing.y),
      margin: rec.margin,
      correct: trueIn === estIn,
      streak: frames.length ? Math.max(...frames.map((f) => f.streak)) : 0,
      est,
      truth: rec.landing,
      line: line.label,
    });
  }
  const abs = rows.map((r) => r.abs).sort((a, b) => a - b);
  const p95 = percentile(abs, 0.95);
  const near = rows.filter((r) => Math.abs(r.margin) < 0.1);
  // A call is only made when the estimate is further from the line than the
  // 95th-percentile error; otherwise it is "too close to call".
  const decided = rows.filter((r) => Math.abs(lineMargin(r.est.x, r.est.y)) > p95);
  const camAbs = rows.map((r) => Math.abs(r.camErr)).sort((a, b) => a - b);
  const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
  return {
    n: rows.length,
    missed,
    camMedian: percentile(camAbs, 0.5),
    camP95: percentile(camAbs, 0.95),
    skidBias: mean(scored.map((r) => acrossLineError(nearestLine(r.landing), r.landing, r.mid))),
    contactMs: mean(scored.map((r) => r.contactMs)),
    skid: mean(scored.map((r) => r.skid)),
    median: percentile(abs, 0.5),
    p95,
    bias: rows.length ? rows.reduce((s, r) => s + r.err, 0) / rows.length : NaN,
    accuracy: rows.length ? rows.filter((r) => r.correct).length / rows.length : NaN,
    nearN: near.length,
    nearAccuracy: near.length ? near.filter((r) => r.correct).length / near.length : NaN,
    tooClose: rows.length ? 1 - decided.length / rows.length : NaN,
    decidedAccuracy: decided.length ? decided.filter((r) => r.correct).length / decided.length : NaN,
    maxStreak: rows.length ? Math.max(...rows.map((r) => r.streak)) : 0,
    rows,
  };
}

/**
 * Serves aimed close to the boundary lines (within ±25 cm), so the test is
 * dominated by the calls that matter.
 */
export function lineTestServe(rng) {
  const lerp = (a, b) => a + (b - a) * rng();
  const jump = rng() < 0.55;
  const off = lerp(-0.25, 0.25);
  let target;
  if (rng() < 0.4) target = { x: COURT.halfLength + off, y: lerp(-4, 4) };
  else {
    const s = rng() < 0.5 ? -1 : 1;
    target = { x: lerp(3, 8.5), y: s * (COURT.halfWidth + off) };
  }
  return {
    x: lerp(-11, -9.3),
    y: lerp(-4.2, 4.2),
    z: jump ? lerp(3.0, 3.4) : lerp(2.4, 2.8),
    speed: jump ? lerp(19, 26) : lerp(13, 18),
    spinRps: jump ? lerp(3, 8) : lerp(-0.3, 0.3),
    target,
  };
}
