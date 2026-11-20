// Torque-controlled planar arm on MuJoCo.
//
// No DOM or three.js, so it runs in Node too. The arm's joints are driven by
// motors; each physics step this class computes the motor torques from a
// controller (P, PD, or PD + gravity compensation) tracking a desired joint
// trajectory. MuJoCo integrates the resulting motion, including gravity,
// inertia, joint limits, torque saturation and contacts.

import { ARM, buildArmXML } from './armScene.js';

export const CONTROLLERS = {
  p: { label: 'P only', usesKd: false, gravity: false },
  pd: { label: 'PD', usesKd: true, gravity: false },
  pdg: { label: 'PD + gravity comp.', usesKd: true, gravity: true },
};

// Gains are given for the shoulder and scaled down for the lighter distal joints.
export const GAIN_SCALE = [1, 0.6, 0.2];

const TWO_PI = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const minJerk = (t) => {
  const s = Math.min(Math.max(t, 0), 1);
  return s * s * s * (10 - 15 * s + 6 * s * s);
};

/** Bring an angle into the joint's range by adding/subtracting full turns. */
function intoRange(a, [lo, hi]) {
  for (const k of [0, 1, -1, 2, -2]) {
    const v = a + k * TWO_PI;
    if (v >= lo && v <= hi) return v;
  }
  return null;
}

/**
 * Inverse kinematics for the tool centre point (TCP).
 * x, z: TCP position in the arm plane, relative to the shoulder.
 * phi: direction the gripper points (−π/2 = straight down).
 * Returns both elbow solutions that respect joint limits.
 */
export function inverseKinematics(x, z, phi) {
  const { L1, L2, L3, tcpOffset, jointRange } = ARM;
  const lt = L3 + tcpOffset;
  const wx = x - lt * Math.cos(phi);
  const wz = z - lt * Math.sin(phi);
  const r2 = wx * wx + wz * wz;
  const c2 = (r2 - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  if (c2 < -1 || c2 > 1) return [];

  const out = [];
  for (const sign of [1, -1]) {
    const q2 = sign * Math.acos(c2);
    const q1raw = Math.atan2(wz, wx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
    const q1 = intoRange(q1raw, jointRange[0]);
    const q3 = intoRange(wrap(phi - q1raw - q2), jointRange[2]);
    if (q1 === null || q3 === null || Math.abs(q2) > jointRange[1][1]) continue;
    const elbowZ = L1 * Math.sin(q1);
    out.push({ q: [q1, q2, q3], elbowZ });
  }
  return out;
}

/** Pick the elbow-up solution (or the one closest to `near`, for smooth paths). */
export function solveIK(x, z, phi, near = null) {
  const sols = inverseKinematics(x, z, phi);
  if (!sols.length) return null;
  if (near) {
    const dist = (s) => s.q.reduce((acc, v, i) => acc + (v - near[i]) ** 2, 0);
    return sols.reduce((a, b) => (dist(a) <= dist(b) ? a : b)).q;
  }
  return sols.reduce((a, b) => (a.elbowZ >= b.elbowZ ? a : b)).q;
}

export class ArmSim {
  constructor(mujoco, { withTask = false, withPayload = false } = {}) {
    this.mj = mujoco;
    this.model = mujoco.MjModel.from_xml_string(buildArmXML({ withTask, withPayload }));
    this.data = new mujoco.MjData(this.model);
    this.timestep = this.model.opt.timestep;

    const id = (type, name) => mujoco.mj_name2id(this.model, mujoco.mjtObj[type].value, name);
    this.ids = {
      hand: id('mjOBJ_BODY', 'hand'),
      tcp: id('mjOBJ_SITE', 'tcp'),
      payload: withPayload ? id('mjOBJ_BODY', 'payload') : -1,
      payloadGeom: withPayload ? id('mjOBJ_GEOM', 'payload') : -1,
      cubeBody: withTask ? id('mjOBJ_BODY', 'cube') : -1,
      cubeGeom: withTask ? id('mjOBJ_GEOM', 'cube') : -1,
      fingers: [id('mjOBJ_GEOM', 'finger_l'), id('mjOBJ_GEOM', 'finger_r')],
      gripActuators: [id('mjOBJ_ACTUATOR', 'grip_l'), id('mjOBJ_ACTUATOR', 'grip_r')],
      armActuators: ['shoulder', 'elbow', 'wrist'].map((n) => id('mjOBJ_ACTUATOR', n)),
    };
    // Where each arm joint lives in qpos / qvel (other bodies, like the cube, may come first).
    const joints = ['shoulder', 'elbow', 'wrist'].map((n) => id('mjOBJ_JOINT', n));
    this.qadr = joints.map((j) => this.model.jnt_qposadr[j]);
    this.dadr = joints.map((j) => this.model.jnt_dofadr[j]);

    this.forceBuf = new mujoco.DoubleBuffer(6); // out-parameter for mj_contactForce
    this.controller = { mode: 'pdg', kp: 400, kd: 40 };
    this.torque = [0, 0, 0];
    this.reset();
  }

  reset(q0 = [Math.PI / 2, 0, 0]) {
    this.mj.mj_resetData(this.model, this.data);
    const qpos = this.data.qpos;
    this.qadr.forEach((a, j) => {
      qpos[a] = q0[j];
    });
    this.mj.mj_forward(this.model, this.data);
    this.segments = [];
    this.segStart = 0;
    this.hold = { q: [...q0], qd: [0, 0, 0] };
    this.gripTarget = 0; // 0 = open, ARM.fingerTravel = fully closed
    this.pushUntil = -1;
    this.unstable = false;
  }

  // ── State accessors (copied out of WASM memory) ──────────────────────────
  get time() {
    return this.data.time;
  }

  jointPositions() {
    const q = this.data.qpos;
    return this.qadr.map((a) => q[a]);
  }

  jointVelocities() {
    const v = this.data.qvel;
    return this.dadr.map((a) => v[a]);
  }

  /** TCP position [x, y, z] in world coordinates. */
  tcp() {
    const p = this.data.site_xpos;
    const i = this.ids.tcp * 3;
    return [p[i], p[i + 1], p[i + 2]];
  }

  desired() {
    return this.sampleDesired(this.data.time);
  }

  // ── Runtime model edits ──────────────────────────────────────────────────
  setPayloadMass(kg) {
    if (this.ids.payload < 0) return;
    this.model.body_mass[this.ids.payload] = Math.max(kg, 0.001);
  }

  setGripForce(newtons) {
    const fr = this.model.actuator_forcerange;
    for (const a of this.ids.gripActuators) {
      fr[a * 2] = -newtons;
      fr[a * 2 + 1] = newtons;
    }
  }

  setCubeMass(kg) {
    if (this.ids.cubeBody < 0) return;
    // Scale inertia with mass so the cube stays a uniform-density box.
    const b = this.ids.cubeBody;
    const ratio = kg / this.model.body_mass[b];
    this.model.body_mass[b] = kg;
    const inertia = this.model.body_inertia;
    for (let k = 0; k < 3; k++) inertia[b * 3 + k] *= ratio;
  }

  /** Sliding friction of the cube (fingers are low-friction, MuJoCo uses the larger value). */
  setCubeFriction(mu) {
    if (this.ids.cubeGeom < 0) return;
    this.model.geom_friction[this.ids.cubeGeom * 3] = mu;
  }

  /** Push down on the hand with `newtons` for `seconds` (a disturbance test). */
  push(newtons = 80, seconds = 0.15) {
    this.pushForce = newtons;
    this.pushUntil = this.data.time + seconds;
  }

  // ── Trajectories ─────────────────────────────────────────────────────────
  /** Jump the setpoint to `q` immediately (a step input). */
  stepTo(q) {
    this.segments = [];
    this.hold = { q: [...q], qd: [0, 0, 0] };
  }

  /**
   * Queue motion segments. Each is one of:
   *   { kind: 'joint', to: [q1,q2,q3], duration }      smooth joint-space move
   *   { kind: 'line', to: {x, z, phi}, duration }        straight TCP line (IK each step)
   *   { kind: 'grip', closed: bool, duration }          open/close fingers, then wait
   *   { kind: 'wait', duration }
   * `label` is passed through for UIs.
   */
  runSegments(segments) {
    const start = this.data.time;
    let t = start;
    let fromQ = this.sampleDesired(start).q;
    this.segments = segments.map((s) => {
      const seg = { ...s, t0: t, t1: t + s.duration, fromQ };
      if (s.kind === 'joint') fromQ = [...s.to];
      if (s.kind === 'line') {
        seg.fromTcp = this.fkTcp(fromQ);
        const end = solveIK(s.to.x, s.to.z - ARM.shoulderZ, s.to.phi, fromQ);
        if (!end) throw new Error(`Target out of reach: ${JSON.stringify(s.to)}`);
        seg.toQ = end;
        fromQ = end;
      }
      t += s.duration;
      return seg;
    });
    this.hold = { q: [...fromQ], qd: [0, 0, 0] };
  }

  /** Index of the segment running now (or −1 when finished / idle). */
  activeSegment() {
    const t = this.data.time;
    return this.segments.findIndex((s) => t >= s.t0 && t < s.t1);
  }

  get trajectoryDone() {
    return !this.segments.length || this.data.time >= this.segments[this.segments.length - 1].t1;
  }

  /** Forward kinematics of the TCP in the arm plane (x, z relative to shoulder, phi). */
  fkTcp([q1, q2, q3]) {
    const { L1, L2, L3, tcpOffset } = ARM;
    const a1 = q1, a2 = q1 + q2, a3 = q1 + q2 + q3;
    return {
      x: L1 * Math.cos(a1) + L2 * Math.cos(a2) + (L3 + tcpOffset) * Math.cos(a3),
      z: L1 * Math.sin(a1) + L2 * Math.sin(a2) + (L3 + tcpOffset) * Math.sin(a3),
      phi: a3,
    };
  }

  sampleDesired(t) {
    for (const seg of this.segments) {
      if (t < seg.t0 || t >= seg.t1) continue;
      const tau = (t - seg.t0) / seg.duration;
      if (seg.kind === 'joint') return this.interpJoint(seg.fromQ, seg.to, tau, seg.duration);
      if (seg.kind === 'line') return this.interpLine(seg, tau);
      if (seg.kind === 'grip') {
        this.gripTarget = seg.closed ? ARM.fingerTravel : 0;
        return { q: seg.fromQ, qd: [0, 0, 0] };
      }
      return { q: seg.fromQ, qd: [0, 0, 0] };
    }
    return this.hold;
  }

  interpJoint(a, b, tau, duration) {
    const s = minJerk(tau);
    const eps = 1e-3;
    const s2 = minJerk(tau + eps / duration);
    return {
      q: a.map((v, i) => v + (b[i] - v) * s),
      qd: a.map((v, i) => ((b[i] - v) * (s2 - s)) / eps),
    };
  }

  interpLine(seg, tau) {
    const at = (tt) => {
      const s = minJerk(tt);
      const f = seg.fromTcp;
      const x = f.x + (seg.to.x - f.x) * s;
      const z = f.z + (seg.to.z - ARM.shoulderZ - f.z) * s;
      const phi = f.phi + wrap(seg.to.phi - f.phi) * s;
      return solveIK(x, z, phi, seg.fromQ) ?? seg.fromQ;
    };
    const eps = 1e-3;
    const q = at(tau);
    const q2 = at(tau + eps / seg.duration);
    return { q, qd: q.map((v, i) => (q2[i] - v) / eps) };
  }

  // ── Control + physics ────────────────────────────────────────────────────
  computeTorques() {
    const { mode, kp, kd } = this.controller;
    const ctrlInfo = CONTROLLERS[mode];
    const { q: qDes, qd: qdDes } = this.sampleDesired(this.data.time);
    const q = this.jointPositions();
    const v = this.jointVelocities();
    const bias = this.data.qfrc_bias; // gravity + Coriolis torques MuJoCo computed this step
    const tau = [0, 0, 0];
    for (let j = 0; j < 3; j++) {
      const s = GAIN_SCALE[j];
      let u = kp * s * (qDes[j] - q[j]);
      if (ctrlInfo.usesKd) u += kd * s * (qdDes[j] - v[j]);
      if (ctrlInfo.gravity) u += bias[this.dadr[j]];
      const lim = ARM.torqueLimit[j];
      tau[j] = Math.max(-lim, Math.min(lim, u));
    }
    return tau;
  }

  stepOnce() {
    const tau = this.computeTorques();
    const ctrl = this.data.ctrl;
    this.ids.armActuators.forEach((a, j) => {
      ctrl[a] = tau[j];
    });
    for (const a of this.ids.gripActuators) ctrl[a] = this.gripTarget;
    this.torque = tau;

    const xfrc = this.data.xfrc_applied;
    const h = this.ids.hand * 6;
    xfrc[h + 2] = this.data.time < this.pushUntil ? -this.pushForce : 0;

    const before = this.data.time;
    this.mj.mj_step(this.model, this.data);
    // MuJoCo silently resets the state if it blows up numerically; surface it instead.
    if (this.data.time < before) this.unstable = true;
  }

  /** Advance by `seconds` of simulated time; `onStep` runs after every step. */
  advance(seconds, onStep) {
    const n = Math.max(1, Math.round(seconds / this.timestep));
    for (let i = 0; i < n; i++) {
      this.stepOnce();
      onStep?.();
    }
  }

  /** Total normal force (N) the two fingers press on the cube with. */
  gripContactForce() {
    if (this.ids.cubeGeom < 0 || this.data.ncon === 0) return 0;
    const buf = this.forceBuf;
    const contacts = this.data.contact;
    let total = 0;
    try {
      for (let i = 0; i < this.data.ncon; i++) {
        const c = contacts.get(i);
        const pair = [c.geom1, c.geom2];
        if (!pair.includes(this.ids.cubeGeom)) continue;
        if (!this.ids.fingers.some((f) => pair.includes(f))) continue;
        this.mj.mj_contactForce(this.model, this.data, i, buf);
        total += Math.abs(buf.GetView()[0]);
      }
    } finally {
      contacts.delete();
    }
    return total;
  }

  cubePosition() {
    if (this.ids.cubeBody < 0) return null;
    const p = this.data.xpos;
    const i = this.ids.cubeBody * 3;
    return [p[i], p[i + 1], p[i + 2]];
  }

  dispose() {
    this.forceBuf.delete();
    this.data.delete();
    this.model.delete();
  }
}
