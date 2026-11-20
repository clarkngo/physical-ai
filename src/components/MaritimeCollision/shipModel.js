// Ship manoeuvring model for the Collision Avoidance lab.
//
// Each ship turns with the first-order Nomoto model, the standard simple model
// of how a ship's yaw rate answers its rudder:
//
//     T · dr/dt + r = K · δ
//
// r is the rate of turn, δ the rudder angle. K (how hard the ship turns) and
// T (how long it takes to respond) scale with speed U and length L through the
// dimensionless K' and T':  K = K' · U / L,  T = T' · L / U.
// The steering gear has a maximum angle and a maximum rate, and a heading
// autopilot (PD on heading error, damped by r) chooses the rudder.
//
// Units: metres, seconds and radians inside; nautical miles, knots, minutes
// and degrees at the edges. x points east, y north, heading is clockwise from
// north (a compass course).

export const NM = 1852; // metres
export const KNOT = NM / 3600; // m/s
export const DEG = Math.PI / 180;

export const SHIP_TYPES = {
  ferry: {
    label: 'Fast ferry',
    note: '120 m, twin rudders, answers the helm quickly',
    length: 120,
    kPrime: 0.9,
    tPrime: 1.2,
  },
  container: {
    label: 'Container ship',
    note: '250 m, typical merchant ship handling',
    length: 250,
    kPrime: 0.6,
    tPrime: 1.8,
  },
  tanker: {
    label: 'Laden tanker',
    note: '330 m, very slow to start and stop a turn',
    length: 330,
    kPrime: 0.35,
    tPrime: 3.2,
  },
};

export const RUDDER_MAX = 35 * DEG; // hard over
export const RUDDER_RATE = 2.5 * DEG; // per second (SOLAS: 35° to 30° the other side in 28 s)

/** Wrap an angle to (-π, π]. */
export function wrapPi(a) {
  let x = (a + Math.PI) % (2 * Math.PI);
  if (x < 0) x += 2 * Math.PI;
  return x - Math.PI;
}

/** Wrap an angle to [0, 2π). */
export function wrap2Pi(a) {
  const x = a % (2 * Math.PI);
  return x < 0 ? x + 2 * Math.PI : x;
}

/** Compass bearing (rad) from point a to point b. */
export function bearing(ax, ay, bx, by) {
  return wrap2Pi(Math.atan2(bx - ax, by - ay));
}

export class Ship {
  constructor({ name, type = 'container', x = 0, y = 0, heading = 0, speedKn = 14, color = '#f87171' }) {
    this.name = name;
    this.type = type;
    this.color = color;
    const t = SHIP_TYPES[type];
    this.length = t.length;
    this.kPrime = t.kPrime;
    this.tPrime = t.tPrime;
    this.x = x;
    this.y = y;
    this.psi = heading; // heading (rad)
    this.r = 0; // rate of turn (rad/s)
    this.delta = 0; // rudder angle (rad), positive = starboard
    this.u = speedKn * KNOT; // speed through water (m/s), held constant
    this.headingCmd = heading; // autopilot set course
    this._tuneAutopilot();
  }

  /** Nomoto gain K (1/s) and time constant T (s) at the current speed. */
  get K() {
    return (this.kPrime * this.u) / this.length;
  }

  get T() {
    return (this.tPrime * this.length) / this.u;
  }

  get vx() {
    return this.u * Math.sin(this.psi);
  }

  get vy() {
    return this.u * Math.cos(this.psi);
  }

  // Pole placement for the linear closed loop  T ψ'' + (1 + K kd) ψ' + K kp ψ = K kp ψref:
  // natural frequency 2/T, damping 0.8 (about 2° overshoot at most). Large
  // turns saturate the rudder, so the ship's own K and T set how fast it turns:
  // a 30° alteration takes ~40 s for the ferry, ~2 min for the container ship
  // and ~4.5 min for the tanker.
  _tuneAutopilot() {
    const { K, T } = this;
    const wn = 2 / T;
    const zeta = 0.8;
    this.kp = (T * wn * wn) / K;
    this.kd = (2 * zeta * wn * T - 1) / K;
  }

  step(dt) {
    const err = wrapPi(this.headingCmd - this.psi);
    const cmd = Math.max(-RUDDER_MAX, Math.min(RUDDER_MAX, this.kp * err - this.kd * this.r));
    const maxMove = RUDDER_RATE * dt;
    this.delta += Math.max(-maxMove, Math.min(maxMove, cmd - this.delta));

    // Nomoto first-order yaw dynamics (semi-implicit Euler).
    this.r += (dt * (this.K * this.delta - this.r)) / this.T;
    this.psi = wrap2Pi(this.psi + this.r * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  clone() {
    const c = Object.create(Ship.prototype);
    Object.assign(c, this);
    return c;
  }

  /** Steady turning radius (m) with the rudder hard over. */
  get turningRadius() {
    return this.u / (this.K * RUDDER_MAX);
  }
}
