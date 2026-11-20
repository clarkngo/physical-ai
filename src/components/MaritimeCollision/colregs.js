// Collision-risk geometry and a simplified reading of the COLREGs.
//
// CPA/TCPA come from the actual relative motion of two ships. Encounter roles
// follow Rules 13–15; what a ship does about it follows Rules 8, 16 and 17.
// The rules are written for seafarers, not machines ("in ample time", "large
// enough to be readily apparent"), so every threshold here is a stated choice,
// not the rule itself.

import { DEG, KNOT, NM, wrapPi, wrap2Pi, bearing } from './shipModel.js';

/**
 * Closest point of approach if both ships hold course and speed.
 * Returns { dcpa (m), tcpa (s), range (m), closing (relative speed, m/s) }. A negative tcpa means the
 * closest point is already behind us (the ships are drawing apart).
 */
export function cpa(a, b) {
  const px = b.x - a.x;
  const py = b.y - a.y;
  const vx = b.vx - a.vx;
  const vy = b.vy - a.vy;
  const v2 = vx * vx + vy * vy;
  const range = Math.hypot(px, py);
  const closing = Math.sqrt(v2); // relative speed (m/s)
  if (v2 < 1e-9) return { dcpa: range, tcpa: Infinity, range, closing };
  const tcpa = -(px * vx + py * vy) / v2;
  const dcpa = Math.hypot(px + vx * tcpa, py + vy * tcpa);
  return { dcpa, tcpa, range, closing };
}

/** Bearing of `other` relative to `ship`'s heading, in [0, 360) degrees. */
export function relativeBearingDeg(ship, other) {
  return wrap2Pi(bearing(ship.x, ship.y, other.x, other.y) - ship.psi) / DEG;
}

// 22.5° abaft the beam: the edge of a vessel's stern light arc (Rule 13).
const ABAFT = 112.5;
const HEAD_ON_SECTOR = 10; // ± degrees either side of the bow for Rule 14

/**
 * The encounter as `ship` sees `other`.
 * Returns { rule, role, label } where role is 'give-way', 'stand-on',
 * 'both' (head-on: both alter to starboard) or 'either-side' (overtaking:
 * give way, passing on either side).
 */
export function classify(ship, other) {
  const brg = relativeBearingDeg(ship, other); // where the other ship is from us
  const aspect = relativeBearingDeg(other, ship); // where we are from the other ship
  const fromBow = brg > 180 ? 360 - brg : brg;
  const aspectFromBow = aspect > 180 ? 360 - aspect : aspect;

  // Rule 13: we approach from more than 22.5° abaft its beam and are faster.
  if (aspect > ABAFT && aspect < 360 - ABAFT && ship.u > other.u) {
    return { rule: 13, role: 'either-side', label: 'Overtaking (we overtake)' };
  }
  if (brg > ABAFT && brg < 360 - ABAFT && other.u > ship.u) {
    return { rule: 13, role: 'stand-on', label: 'Being overtaken' };
  }
  // Rule 14: each sees the other ahead or nearly ahead.
  if (fromBow < HEAD_ON_SECTOR && aspectFromBow < HEAD_ON_SECTOR) {
    return { rule: 14, role: 'both', label: 'Head-on' };
  }
  // Rule 15: the ship with the other on her starboard side keeps out of the way.
  if (brg < 180) return { rule: 15, role: 'give-way', label: 'Crossing, target to starboard' };
  return { rule: 15, role: 'stand-on', label: 'Crossing, target to port' };
}

export const ROLE_TEXT = {
  'give-way': 'Give way',
  'stand-on': 'Stand on',
  both: 'Both alter to starboard',
  'either-side': 'Keep clear, either side',
};

/**
 * Predict own ship's track for `horizon` seconds after setting the autopilot
 * to `course`, and return the closest distance to each other ship (assumed to
 * hold course and speed). `model`:
 *   'dynamic'  — run the Nomoto model forward, so turning lag is included;
 *   'instant'  — assume the ship is already on the new course (a common
 *                planning shortcut that ignores how ships actually turn).
 */
export function predictMinRanges(ship, others, course, horizon, model = 'dynamic', dt = 5) {
  const mins = others.map(() => Infinity);
  let own;
  if (model === 'dynamic') {
    own = ship.clone();
    own.headingCmd = course;
  } else {
    own = { x: ship.x, y: ship.y, vx: ship.u * Math.sin(course), vy: ship.u * Math.cos(course) };
  }
  for (let t = 0; t <= horizon; t += dt) {
    for (let i = 0; i < others.length; i++) {
      const o = others[i];
      const d = Math.hypot(o.x + o.vx * t - own.x, o.y + o.vy * t - own.y);
      if (d < mins[i]) mins[i] = d;
    }
    if (model === 'dynamic') {
      // Integrate in 1 s substeps so the rudder and yaw dynamics stay accurate.
      for (let s = 0; s < dt; s++) own.step(1);
    } else {
      own.x += own.vx * dt;
      own.y += own.vy * dt;
    }
  }
  return mins;
}

// Plan for 5% more than the safe CPA, so prediction error does not eat the margin.
const MARGIN = 1.05;

export const POLICIES = {
  colreg: {
    label: 'COLREG rule-based',
    note: 'Give-way vessel alters to starboard, at least 30°, in good time. Stand-on vessel holds course until the other clearly is not acting.',
  },
  detour: {
    label: 'Smallest detour',
    note: 'Treats every threat the same and picks the smallest turn either way that clears it. Safe on paper, but ignores who should give way.',
  },
  hold: {
    label: 'Hold course',
    note: 'No avoiding action at all: the baseline.',
  },
};

/**
 * A navigator that steers one ship towards a goal and avoids the others.
 * Call decide() every few seconds of simulated time.
 */
export class Navigator {
  constructor(ship, goal, { policy = 'colreg', safeCpaNm = 1, actTcpaMin = 12, planner = 'dynamic' } = {}) {
    this.ship = ship;
    this.goal = goal; // { x, y } in metres
    this.policy = policy;
    this.safe = safeCpaNm * NM;
    this.actTcpa = actTcpaMin * 60;
    this.standOnTcpa = Math.max(4 * 60, this.actTcpa / 2);
    this.planner = planner;
    this.horizon = Math.max(25 * 60, this.actTcpa * 1.6);
    this.alteration = 0; // degrees relative to the course to the goal, + = starboard
    this.mode = 'transit';
    this.engaged = new Set(); // ships we are manoeuvring for
    this.firstAction = null; // { time, alteration, tcpa }
    this.actions = new Map(); // other ship -> first action taken for it { time, alteration, tcpa }
  }

  courseToGoal() {
    return bearing(this.ship.x, this.ship.y, this.goal.x, this.goal.y);
  }

  /** Evaluate a list of alterations (deg) and return the first that clears all `others`. */
  _search(others, candidates) {
    const base = this.courseToGoal();
    let best = null;
    for (const alt of candidates) {
      const mins = predictMinRanges(this.ship, others, wrap2Pi(base + alt * DEG), this.horizon, this.planner);
      const worst = Math.min(...mins);
      if (worst >= this.safe * MARGIN) return { alt, worst, clear: true };
      if (!best || worst > best.worst) best = { alt, worst, clear: false };
    }
    return best;
  }

  _candidates(roles) {
    const stbd = [];
    const either = [];
    for (let a = 5; a <= 90; a += 5) {
      stbd.push(a);
      either.push(a, -a);
    }
    if (this.policy === 'detour') return either;
    // Rule 8: an alteration "large enough to be readily apparent" — 30° is the
    // usual seamanship figure. Overtaking (Rule 13) allows either side.
    const big = (list) => list.filter((a) => Math.abs(a) >= 30);
    return roles.every((r) => r === 'either-side') ? big(either) : big(stbd);
  }

  _engage(threat, time) {
    this.engaged.add(threat.o);
    if (!this.actions.has(threat.o)) {
      this.actions.set(threat.o, { time, alteration: this.alteration, tcpa: threat.tcpa });
    }
  }

  decide(others, time) {
    const ship = this.ship;
    if (this.policy === 'hold') {
      ship.headingCmd = this.courseToGoal();
      return;
    }

    const assessed = others.map((o) => ({ o, ...cpa(ship, o), ...classify(ship, o) }));
    // A threat: CPA inside the safe distance, and either close in time or, for
    // a slow-closing ship (under 8 kn relative, e.g. when overtaking), already
    // within three safe distances — by TCPA alone it would be far too close.
    const threats = assessed.filter(
      (a) =>
        a.dcpa < this.safe &&
        a.tcpa > 0 &&
        (a.tcpa < this.actTcpa || (a.closing < 8 * KNOT && a.range < 3 * this.safe)),
    );

    // Already manoeuvring: hold the alteration until every engaged ship is past
    // and the course back to the goal is clear, escalating if it stops working.
    if (this.alteration !== 0) {
      const engaged = assessed.filter((a) => this.engaged.has(a.o));
      const passed = engaged.every((a) => a.tcpa <= 0);
      const back = predictMinRanges(ship, others, this.courseToGoal(), this.horizon, this.planner);
      if (passed && Math.min(...back) >= this.safe * MARGIN) {
        this.alteration = 0;
        this.mode = 'resume';
        this.engaged.clear();
      } else {
        const current = predictMinRanges(
          ship, others, wrap2Pi(this.courseToGoal() + this.alteration * DEG), this.horizon, this.planner,
        );
        if (Math.min(...current) < this.safe && threats.length) {
          const sign = Math.sign(this.alteration);
          const more = this._candidates(threats.map((t) => t.role)).filter(
            (a) => Math.sign(a) === sign && Math.abs(a) > Math.abs(this.alteration),
          );
          const pick = this._search(others, more);
          if (pick) this.alteration = pick.alt;
          threats.forEach((t) => this._engage(t, time));
        }
      }
    } else if (threats.length) {
      let acting = threats;
      if (this.policy === 'colreg') {
        // Rule 17: the stand-on ship keeps course and speed, and only acts once
        // the give-way ship is evidently not doing so and the risk is close.
        acting = threats.filter((t) => t.role !== 'stand-on' || t.tcpa < this.standOnTcpa);
      }
      if (acting.length) {
        const pick = this._search(others, this._candidates(acting.map((t) => t.role)));
        if (pick) {
          this.alteration = pick.alt;
          this.mode = acting.some((t) => t.role === 'stand-on') ? 'stand-on-acts' : 'give-way';
          acting.forEach((t) => this._engage(t, time));
          if (!this.firstAction) {
            this.firstAction = { time, alteration: pick.alt, tcpa: Math.min(...acting.map((t) => t.tcpa)) };
          }
        }
      } else {
        this.mode = 'stand-on';
      }
    } else {
      const settled = Math.abs(wrapPi(this.courseToGoal() - ship.psi)) < 3 * DEG;
      this.mode = this.mode === 'resume' && !settled ? 'resume' : 'transit';
    }

    ship.headingCmd = wrap2Pi(this.courseToGoal() + this.alteration * DEG);
  }
}

export { wrapPi };
