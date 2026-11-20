// Encounter scenarios and the simulation loop for the Collision Avoidance lab.
// Every number shown in the lab (closest approach, delay, rule checks) is
// measured from this simulation, not computed from a formula.

import { DEG, KNOT, NM, Ship, bearing } from './shipModel.js';
import { Navigator, classify, cpa } from './colregs.js';

const OWN_SPEED = 14; // knots
const TARGET_COLORS = ['#f87171', '#fbbf24', '#c084fc'];

/**
 * Put a target on a course that meets own ship (which steams north from the
 * origin at OWN_SPEED) after `meetMin` minutes, missing by `missNm` if nobody
 * acts. Positive miss puts the target to own ship's starboard at the meeting.
 */
function target(name, { heading, speedKn, meetMin, missNm = 0.05, type = 'container' }) {
  const meetY = OWN_SPEED * KNOT * meetMin * 60;
  const h = heading * DEG;
  const v = speedKn * KNOT;
  const t = meetMin * 60;
  return {
    name,
    type,
    heading: h,
    speedKn,
    x: missNm * NM - Math.sin(h) * v * t,
    y: meetY - Math.cos(h) * v * t,
  };
}

export const SCENARIOS = {
  'head-on': {
    label: 'Head-on',
    rule: 'Rule 14',
    blurb: 'A ship dead ahead on a reciprocal course. Both should alter to starboard and pass port to port.',
    targets: [target('Target A', { heading: 180, speedKn: 13, meetMin: 14 })],
  },
  'crossing-give-way': {
    label: 'Crossing from starboard',
    rule: 'Rules 15 & 16',
    blurb: 'A ship crossing from your starboard side. You are the give-way vessel: act early and pass astern of her.',
    targets: [target('Target A', { heading: 270, speedKn: 12, meetMin: 16 })],
  },
  'crossing-stand-on': {
    label: 'Crossing from port',
    rule: 'Rule 17',
    blurb: 'A ship crossing from your port side. She should give way; you hold course and speed, and act only if she clearly does not.',
    targets: [target('Target A', { heading: 90, speedKn: 12, meetMin: 16 })],
  },
  overtaking: {
    label: 'Overtaking',
    rule: 'Rule 13',
    blurb: 'A slower ship ahead on the same course. The overtaking ship keeps clear, passing on either side.',
    targets: [target('Target A', { heading: 0, speedKn: 7, meetMin: 22, missNm: 0.02 })],
  },
  multi: {
    label: 'Three ships',
    rule: 'Rules 13–17',
    blurb: 'A crossing ship from starboard, one nearly head-on and one crossing from port. One manoeuvre has to work for all three.',
    targets: [
      target('Target A', { heading: 255, speedKn: 12, meetMin: 13 }),
      target('Target B', { heading: 183, speedKn: 12, meetMin: 21, missNm: -0.1 }),
      target('Target C', { heading: 75, speedKn: 10, meetMin: 27 }),
    ],
  },
};

export const DURATION = 42 * 60; // seconds of simulated time per run
const STEP = 0.5; // physics step (s)
const DECIDE_EVERY = 5; // navigator decision interval (s)
const SAMPLE_EVERY = 10; // trail / chart sampling (s)

export class Encounter {
  /**
   * opts: { scenario, shipType, policy, safeCpaNm, actTcpaMin, planner, targetBehaviour }
   * targetBehaviour: 'hold' (targets keep course and speed) or 'colreg'.
   */
  constructor(opts) {
    this.opts = opts;
    const sc = SCENARIOS[opts.scenario];
    this.own = new Ship({ name: 'Own ship', type: opts.shipType, heading: 0, speedKn: OWN_SPEED, color: '#22d3ee' });
    this.ownStart = { x: 0, y: 0 };
    this.ownGoal = { x: 0, y: OWN_SPEED * KNOT * DURATION * 1.5 };
    this.nav = new Navigator(this.own, this.ownGoal, {
      policy: opts.policy,
      safeCpaNm: opts.safeCpaNm,
      actTcpaMin: opts.actTcpaMin,
      planner: opts.planner,
    });

    this.targets = sc.targets.map((t, i) => {
      const ship = new Ship({ ...t, color: TARGET_COLORS[i] });
      const goal = { x: t.x + Math.sin(t.heading) * 50 * NM, y: t.y + Math.cos(t.heading) * 50 * NM };
      const nav =
        opts.targetBehaviour === 'colreg'
          ? new Navigator(ship, goal, { policy: 'colreg', safeCpaNm: 1, actTcpaMin: 12, planner: 'dynamic' })
          : null;
      return { ship, nav, start: { x: t.x, y: t.y } };
    });

    // Encounter types as they stand at the start, from own ship's view.
    this.initial = this.targets.map(({ ship }) => ({ ...classify(this.own, ship), ...cpa(this.own, ship) }));

    this.time = 0;
    this.nextDecision = 0;
    this.nextSample = 0;
    this.trails = [[], ...this.targets.map(() => [])];
    this.ranges = this.targets.map(() => []); // [time (s), range (m)]
    this.minRange = this.targets.map(() => ({ range: Infinity, time: 0, ownAhead: false }));
    this.collided = null;
    this.maxRudder = 0;
    this.maxCrossTrack = 0;
    this.done = false;
    this._sample();
  }

  get ships() {
    return [this.own, ...this.targets.map((t) => t.ship)];
  }

  _sample() {
    this.ships.forEach((s, i) => this.trails[i].push([s.x, s.y]));
    this.targets.forEach(({ ship }, i) => this.ranges[i].push([this.time, Math.hypot(ship.x - this.own.x, ship.y - this.own.y)]));
  }

  _decide() {
    const ships = this.ships;
    this.nav.decide(ships.slice(1), this.time);
    this.targets.forEach(({ ship, nav }) => {
      if (nav) nav.decide(ships.filter((s) => s !== ship), this.time);
    });
  }

  step(dt) {
    const end = Math.min(this.time + dt, DURATION);
    while (!this.done && this.time < end - 1e-9) {
      if (this.time >= this.nextDecision) {
        this._decide();
        this.nextDecision += DECIDE_EVERY;
      }
      for (const s of this.ships) s.step(STEP);
      this.time += STEP;

      this.maxRudder = Math.max(this.maxRudder, Math.abs(this.own.delta));
      this.maxCrossTrack = Math.max(this.maxCrossTrack, Math.abs(this.own.x));
      this.targets.forEach(({ ship }, i) => {
        const d = Math.hypot(ship.x - this.own.x, ship.y - this.own.y);
        const m = this.minRange[i];
        if (d < m.range) {
          // Did own ship pass ahead of the target? Project own position onto the target's heading.
          const along = (this.own.x - ship.x) * Math.sin(ship.psi) + (this.own.y - ship.y) * Math.cos(ship.psi);
          this.minRange[i] = { range: d, time: this.time, ownAhead: along > 0 };
        }
        if (!this.collided && d < (this.own.length + ship.length) / 2) {
          this.collided = { target: i, time: this.time };
        }
      });

      if (this.time >= this.nextSample) {
        this._sample();
        this.nextSample += SAMPLE_EVERY;
      }
      if (this.collided || this.time >= DURATION) {
        this._sample();
        this.done = true;
      }
    }
  }

  runToEnd() {
    while (!this.done) this.step(60);
    return this;
  }

  /** Delay (s) against sailing straight to the goal at full speed. */
  get delay() {
    const progress = this.own.y - this.ownStart.y;
    return (this.own.u * this.time - progress) / this.own.u;
  }

  /** CPA / TCPA / encounter type for each target right now. */
  situation() {
    return this.targets.map(({ ship }) => ({
      ...cpa(this.own, ship),
      ...classify(this.own, ship),
      bearing: bearing(this.own.x, this.own.y, ship.x, ship.y),
    }));
  }

  /**
   * Outcome per target plus the rule checks a reviewer would make, judged from
   * what actually happened in the run.
   */
  assess() {
    const safe = this.opts.safeCpaNm * NM;
    return this.targets.map(({ ship }, i) => {
      const init = this.initial[i];
      const m = this.minRange[i];
      const act = this.nav.actions.get(ship) ?? null;
      const collided = this.collided?.target === i;
      const outcome = collided ? 'collision' : m.range < safe * 0.5 ? 'close-quarters' : m.range < safe ? 'tight' : 'clear';
      const checks = [];
      const turned = act ? (act.alteration > 0 ? 'starboard' : 'port') : null;
      const needed = init.dcpa < safe;
      // No action for this ship, but own ship's manoeuvre for another one already cleared it.
      const coveredByOther = !act && this.nav.firstAction && m.range >= safe;
      if (coveredByOther && init.role !== 'stand-on') {
        checks.push({ ok: true, text: `Rule ${init.rule}: already clear after the manoeuvre for another ship` });
        return { name: ship.name, color: ship.color, init, minRange: m.range, minTime: m.time, outcome, checks, act };
      }

      if (init.role === 'both') {
        if (turned) checks.push({ ok: turned === 'starboard', text: `Rule 14: altered to ${turned}` });
        else if (needed) checks.push({ ok: false, text: 'Rule 14: took no action on a head-on course' });
      } else if (init.role === 'give-way') {
        if (turned) {
          checks.push({ ok: turned === 'starboard', text: `Rule 15: altered to ${turned}` });
          checks.push({
            ok: Math.abs(act.alteration) >= 30 && act.tcpa >= 6 * 60,
            text: `Rule 16: ${Math.abs(act.alteration)}° alteration with ${(act.tcpa / 60).toFixed(1)} min to CPA (early & substantial: ≥ 30°, ≥ 6 min)`,
          });
        } else if (needed) {
          checks.push({ ok: false, text: 'Rule 16: the give-way vessel took no action' });
        }
        if (needed) checks.push({ ok: !m.ownAhead, text: m.ownAhead ? 'Rule 15: crossed ahead of the stand-on ship' : 'Rule 15: passed astern of the stand-on ship' });
      } else if (init.role === 'stand-on') {
        if (act) {
          const early = act.tcpa > this.nav.standOnTcpa + 10;
          checks.push({
            ok: !early,
            text: early
              ? `Rule 17: stand-on vessel manoeuvred with ${(act.tcpa / 60).toFixed(1)} min to CPA, before the give-way ship had to act`
              : `Rule 17: held course, then acted with ${(act.tcpa / 60).toFixed(1)} min to CPA`,
          });
          if (init.rule === 15) checks.push({ ok: turned === 'starboard', text: `Rule 17(c): altered to ${turned} for a ship on the port side` });
        } else {
          checks.push({ ok: true, text: 'Rule 17: held course and speed' });
        }
      } else if (init.role === 'either-side') {
        checks.push({ ok: m.range >= safe, text: `Rule 13: overtaking ship ${m.range >= safe ? 'kept' : 'did not keep'} clear` });
      }
      return { name: ship.name, color: ship.color, init, minRange: m.range, minTime: m.time, outcome, checks, act };
    });
  }
}
