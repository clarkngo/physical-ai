// Volleyball ball-flight simulation on top of MuJoCo.
//
// Pure JS (no DOM, no three.js) so it runs the same in the browser and in Node.
// MuJoCo does the physics: gravity, air drag + Magnus lift, and contacts with
// the floor, net and antennae. This class adds the referee logic for the
// "ball in / ball out" rule (FIVB Rules 8.3, 8.4) and records a ground-truth
// trajectory sampled like a high-speed camera.

import { BALL, COURT, VOLLEYBALL_XML } from './volleyballScene.js';

export const SAMPLE_HZ = 240; // ground-truth sampling rate (like a 240 fps camera)
const SETTLE_TIME = 1.2;      // keep simulating the bounce briefly after landing
const CLOSE_CALL = 0.05;      // landings within 5 cm of a line are flagged

// Presets give where the ball is struck, how hard, with how much topspin, and
// where the server is aiming. The launch angle is solved by aim() below.
export const PRESETS = {
  float: { label: 'Float serve', x: -10.5, y: 0.5, z: 2.6, speed: 19, spinRps: 0, target: { x: 6.5, y: -1.8 } },
  jump:  { label: 'Jump serve',  x: -10.0, y: -1.0, z: 3.3, speed: 26, spinRps: 6, target: { x: 7.6, y: 2.2 } },
  spike: { label: 'Spike',       x: -1.2, y: 1.5, z: 3.25, speed: 24, spinRps: 5, target: { x: 4.5, y: -2.6 } },
  line:  { label: 'Line-call test', x: -10.0, y: 2.0, z: 3.2, speed: 21, spinRps: 5, target: { x: 9.02, y: 3.1 } },
};

/** Signed distance from point (x, y) to the court half on x > 0: + inside, − outside. */
export function lineMargin(x, y) {
  const dx = Math.max(0 - x, x - COURT.halfLength, 0);
  const dy = Math.max(Math.abs(y) - COURT.halfWidth, 0);
  if (dx > 0 || dy > 0) return -Math.hypot(dx, dy);
  return Math.min(x, COURT.halfLength - x, COURT.halfWidth - Math.abs(y));
}

/**
 * Random serve: a realistic contact point, speed and spin, aimed at a target
 * scattered around the far court so the batch mixes clear ins, clear outs,
 * close line calls and the odd net fault.
 */
export function randomServe(rng = Math.random) {
  const lerp = (a, b) => a + (b - a) * rng();
  const jump = rng() < 0.55;
  return {
    x: lerp(-11, -9.3),
    y: lerp(-4.2, 4.2),
    z: jump ? lerp(3.0, 3.4) : lerp(2.4, 2.8),
    speed: jump ? lerp(19, 26) : lerp(13, 18),
    spinRps: jump ? lerp(3, 8) : lerp(-0.3, 0.3),
    target: { x: lerp(4.5, 10.0), y: lerp(-5.3, 5.3) },
  };
}

export class VolleyballSim {
  constructor(mujoco) {
    this.mj = mujoco;
    this.model = mujoco.MjModel.from_xml_string(VOLLEYBALL_XML);
    this.data = new mujoco.MjData(this.model);

    const geomId = (name) => mujoco.mj_name2id(this.model, mujoco.mjtObj.mjOBJ_GEOM.value, name);
    this.geom = {
      floor: geomId('floor'),
      net: geomId('net'),
      ball: geomId('ball'),
      antennae: [geomId('antenna_left'), geomId('antenna_right')],
      posts: [geomId('post_left'), geomId('post_right')],
    };
    this.opt = this.model.opt; // live reference into the model's options
    this.timestep = this.opt.timestep;
    this.reset();
  }

  reset() {
    this.mj.mj_resetData(this.model, this.data);
    this.mj.mj_forward(this.model, this.data);
    this.launched = false;
    this.done = false;
    this.samples = [];
    this.events = [];
    this.result = null;
    this.fault = null;
    this.crossing = null;
    this.netTouched = false;
    this.landTime = null;
    this.nextSampleT = 0;
  }

  /** Place the ball at the contact point and give it velocity and spin. */
  launch({ x, y, z, speed, elevationDeg, azimuthDeg, spinRps }) {
    this.reset();
    const el = (elevationDeg * Math.PI) / 180;
    const az = (azimuthDeg * Math.PI) / 180;
    const vx = speed * Math.cos(el) * Math.cos(az);
    const vy = speed * Math.cos(el) * Math.sin(az);
    const vz = speed * Math.sin(el);

    // Topspin axis is perpendicular to the horizontal direction of travel, so the
    // top of the ball rotates forward. Free-joint angular velocity is in the body
    // frame, which equals the world frame with the identity quaternion set here.
    const w = spinRps * 2 * Math.PI;
    const wx = -w * Math.sin(az);
    const wy = w * Math.cos(az);

    const qpos = this.data.qpos;
    const qvel = this.data.qvel;
    qpos.set([x, y, z, 1, 0, 0, 0]);
    qvel.set([vx, vy, vz, wx, wy, 0]);
    this.mj.mj_forward(this.model, this.data);

    this.launched = true;
    this.launchParams = { x, y, z, speed, elevationDeg, azimuthDeg, spinRps };
    this.launchVelocity = [vx, vy, vz];
    this.recordSample();
    return this;
  }

  /**
   * Solve for the launch angle that lands the ball on `target`.
   * Air drag and Magnus lift make this non-ballistic, so we bisect on the
   * elevation using MuJoCo itself as the forward model (contacts disabled so
   * the net does not interfere with the search; the real run includes it).
   * Azimuth points straight at the target: drag and topspin act in the
   * vertical plane of travel, so they do not curve the ball sideways.
   */
  aim({ x, y, z, speed, spinRps, target }) {
    const azimuthDeg = (Math.atan2(target.y - y, target.x - x) * 180) / Math.PI;
    const want = Math.hypot(target.x - x, target.y - y);
    const range = (elevationDeg) => {
      const p = this.predictLanding({ x, y, z, speed, spinRps, azimuthDeg, elevationDeg });
      return p ? Math.hypot(p.x - x, p.y - y) : 0;
    };

    let lo = -35;
    let hi = 40;
    let reachable = true;
    if (range(hi) < want) {
      reachable = false;
      lo = hi;
    } else if (range(lo) > want) {
      reachable = false;
      hi = lo;
    } else {
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        if (range(mid) < want) lo = mid;
        else hi = mid;
      }
    }
    this.reset();
    return { x, y, z, speed, spinRps, azimuthDeg, elevationDeg: (lo + hi) / 2, target, reachable };
  }

  /** Where the ball would first reach the floor, ignoring all contacts. */
  predictLanding(params) {
    const mj = this.mj;
    const saved = this.opt.disableflags;
    this.opt.disableflags = saved | mj.mjtDisableBit.mjDSBL_CONTACT.value;
    try {
      this.launch(params);
      const q = this.data.qpos;
      let px = q[0], py = q[1], pz = q[2];
      while (this.data.time < 6) {
        mj.mj_step(this.model, this.data);
        if (q[2] <= BALL.radius) {
          const f = (pz - BALL.radius) / (pz - q[2]);
          return { x: px + f * (q[0] - px), y: py + f * (q[1] - py) };
        }
        px = q[0]; py = q[1]; pz = q[2];
      }
      return null;
    } finally {
      this.opt.disableflags = saved;
    }
  }

  get time() {
    return this.data.time;
  }

  /** Ball position [x, y, z] (copied out of WASM memory). */
  ballPosition() {
    const q = this.data.qpos;
    return [q[0], q[1], q[2]];
  }

  /** Ball orientation as a quaternion [w, x, y, z]. */
  ballQuaternion() {
    const q = this.data.qpos;
    return [q[3], q[4], q[5], q[6]];
  }

  recordSample() {
    const q = this.data.qpos;
    const v = this.data.qvel;
    this.samples.push({
      t: this.data.time,
      x: q[0], y: q[1], z: q[2],
      vx: v[0], vy: v[1], vz: v[2],
    });
    this.nextSampleT = this.data.time + 1 / SAMPLE_HZ;
  }

  /** Advance the physics by `seconds` of simulated time. Returns new events. */
  advance(seconds) {
    if (!this.launched || this.done) return [];
    const before = this.events.length;
    const steps = Math.max(1, Math.round(seconds / this.timestep));
    for (let i = 0; i < steps && !this.done; i++) this.stepOnce();
    return this.events.slice(before);
  }

  /** Simulate until the rally outcome is decided and the bounce settles. */
  runToEnd(maxTime = 8) {
    while (!this.done && this.data.time < maxTime) this.stepOnce();
    if (!this.done) this.finish();
    return this.result;
  }

  stepOnce() {
    const prevX = this.data.qpos[0];
    const prevY = this.data.qpos[1];
    const prevZ = this.data.qpos[2];

    this.mj.mj_step(this.model, this.data);

    const q = this.data.qpos;
    if (this.data.time + 1e-9 >= this.nextSampleT) this.recordSample();

    // Net plane crossing: Rule 8.4.4/8.4.5 — the ball must cross inside the
    // crossing space (between the antennae, above the net).
    if (!this.crossing && prevX < 0 && q[0] >= 0) {
      const f = (0 - prevX) / (q[0] - prevX);
      const y = prevY + f * (q[1] - prevY);
      const z = prevZ + f * (q[2] - prevZ);
      this.crossing = { y, z, t: this.data.time };
      if (Math.abs(y) > COURT.halfWidth) {
        this.addFault('Crossed the net outside the antennae', 'Rule 8.4.4');
      } else if (z < COURT.netHeight - COURT.netBand) {
        this.addFault('Passed under the net', 'Rule 8.4.5');
      } else {
        this.addEvent('cross', `Crossed the net at ${(z - COURT.netHeight + BALL.radius).toFixed(2)} m clearance`);
      }
    }

    if (this.landTime === null && this.data.ncon > 0) this.checkContacts();

    if (this.landTime !== null && this.data.time - this.landTime >= SETTLE_TIME) {
      this.done = true;
    }
  }

  checkContacts() {
    const contacts = this.data.contact;
    try {
      const n = this.data.ncon;
      for (let i = 0; i < n; i++) {
        const c = contacts.get(i);
        const other = c.geom1 === this.geom.ball ? c.geom2 : c.geom2 === this.geom.ball ? c.geom1 : -1;
        if (other < 0) continue;
        const pos = c.pos;
        const p = [pos[0], pos[1], pos[2]];

        if (other === this.geom.floor) {
          this.land(p);
          return;
        }
        if (other === this.geom.net && !this.netTouched) {
          this.netTouched = true;
          this.addEvent('net', 'Ball touched the net (legal on a serve if it still crosses)');
        }
        if (this.geom.antennae.includes(other)) {
          this.addFault('Touched the antenna', 'Rule 8.4.3');
        }
        if (this.geom.posts.includes(other)) {
          this.addFault('Touched a net post', 'Rule 8.4.2');
        }
      }
    } finally {
      contacts.delete();
    }
  }

  addEvent(type, text) {
    this.events.push({ type, text, t: this.data.time });
  }

  addFault(text, rule) {
    if (this.fault) return;
    this.fault = { text, rule };
    this.addEvent('fault', `${text} (${rule})`);
  }

  land([x, y]) {
    this.landTime = this.data.time;
    const margin = lineMargin(x, y);
    const v = this.data.qvel;
    const impactSpeed = Math.hypot(v[0], v[1], v[2]);
    this.addEvent('land', `Floor contact at (${x.toFixed(3)}, ${y.toFixed(3)}) m`);

    let call;
    let reason;
    let rule;
    if (this.fault) {
      call = 'OUT';
      reason = this.fault.text;
      rule = this.fault.rule;
    } else if (x < 0) {
      call = 'FAULT';
      reason = 'Landed on the serving side — did not cross the net';
      rule = 'Rule 8.4';
    } else if (margin >= 0) {
      call = 'IN';
      reason = 'Contact point is on the court or touching a boundary line';
      rule = 'Rule 8.3';
    } else {
      call = 'OUT';
      reason = 'Contact point is completely outside the boundary lines';
      rule = 'Rule 8.4.1';
    }

    this.result = {
      call,
      reason,
      rule,
      point: call === 'IN' ? 'Team A (serving)' : 'Team B (receiving)',
      landing: { x, y, t: this.data.time },
      margin,
      closeCall: Math.abs(margin) < CLOSE_CALL && x > 0 && !this.fault,
      impactSpeed,
      flightTime: this.data.time,
      netTouched: this.netTouched,
      crossing: this.crossing,
    };
  }

  finish() {
    this.done = true;
    if (!this.result) {
      this.result = {
        call: 'NO LANDING',
        reason: 'Ball did not reach the floor within the time limit',
        rule: '',
        point: '',
        landing: null,
        margin: null,
        closeCall: false,
        impactSpeed: null,
        flightTime: this.data.time,
        netTouched: this.netTouched,
        crossing: this.crossing,
      };
    }
  }

  /** Ground-truth trajectory as CSV (one row per 1/SAMPLE_HZ s). */
  toCSV() {
    const header = 't,x,y,z,vx,vy,vz';
    const rows = this.samples.map((s) =>
      [s.t, s.x, s.y, s.z, s.vx, s.vy, s.vz].map((n) => n.toFixed(5)).join(','),
    );
    return [header, ...rows].join('\n');
  }

  dispose() {
    this.opt.delete();
    this.data.delete();
    this.model.delete();
  }
}
