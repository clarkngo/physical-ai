// Pick-and-place cycle for the MuJoCo arm, with a grasp monitor.
//
// Same waypoint sequence as the 2D Pick & Place lab, but the arm has to
// physically follow it with motor torques, and the cube stays in the gripper
// only while friction from the finger squeeze can hold its weight plus the
// inertial load from accelerating it.

import { ARM, TASK } from './armScene.js';
import { solveIK } from './armSim.js';

const DOWN = -Math.PI / 2;
const graspZ = TASK.tableTop + TASK.cubeHalf + 0.02; // fingertips stay clear of the table
const aboveZ = TASK.tableTop + 0.24;
const GRAVITY = 9.81;

function jointsAt(x, z) {
  const q = solveIK(x, z - ARM.shoulderZ, DOWN);
  if (!q) throw new Error(`Waypoint out of reach: (${x}, ${z})`);
  return q;
}

/** Segments for one full cycle. `pace` scales every duration (smaller = faster). */
export function buildPickPlace(pace = 1) {
  const { pickX, placeX } = TASK;
  const d = (s) => s * pace;
  return [
    { kind: 'joint', to: jointsAt(pickX, aboveZ), duration: d(1.6), label: 'Approach pick' },
    { kind: 'line', to: { x: pickX, z: graspZ, phi: DOWN }, duration: d(1.0), label: 'Descend to pick' },
    { kind: 'grip', closed: true, duration: 0.6, label: 'Close gripper' },
    { kind: 'line', to: { x: pickX, z: aboveZ, phi: DOWN }, duration: d(0.9), label: 'Lift object' },
    { kind: 'line', to: { x: placeX, z: aboveZ, phi: DOWN }, duration: d(1.2), label: 'Move to place' },
    { kind: 'line', to: { x: placeX, z: graspZ + 0.003, phi: DOWN }, duration: d(1.0), label: 'Descend to place' },
    { kind: 'grip', closed: false, duration: 0.5, label: 'Open gripper' },
    { kind: 'line', to: { x: placeX, z: aboveZ, phi: DOWN }, duration: d(0.8), label: 'Retract' },
    { kind: 'joint', to: [Math.PI / 2, 0, 0], duration: d(1.4), label: 'Return home' },
  ];
}

/**
 * Tracks what the cube is doing during a cycle.
 * status: 'resting' → 'held' → ('slipping' | 'dropped') … → 'placed' | 'missed'
 */
export class GraspMonitor {
  constructor(sim) {
    this.sim = sim;
    this.status = 'resting';
    this.maxSlip = 0;
    this.offset = null;
    this.gripForce = 0;
  }

  update() {
    const sim = this.sim;
    const cube = sim.cubePosition();
    const tcp = sim.tcp();
    this.gripForce = sim.gripContactForce();
    const held = this.gripForce > 0.5;

    if (cube[2] < TASK.tableTop - 0.1) {
      if (this.status !== 'placed') this.status = 'dropped';
      return;
    }
    if (held && (this.status === 'resting' || this.status === 'held' || this.status === 'slipping')) {
      // Slip = how far the cube has slid down the fingers since they closed.
      if (this.offset === null) this.offset = cube[2] - tcp[2];
      const slip = this.offset - (cube[2] - tcp[2]);
      this.maxSlip = Math.max(this.maxSlip, slip);
      this.status = slip > 0.015 ? 'slipping' : 'held';
    }
  }

  /** Call once the cycle ends to decide whether the cube made it. */
  finish() {
    const cube = this.sim.cubePosition();
    const onPlace =
      Math.abs(cube[0] - TASK.placeX) < 0.1 &&
      Math.abs(cube[2] - (TASK.tableTop + TASK.cubeHalf)) < 0.02;
    if (onPlace) this.status = 'placed';
    else if (this.status !== 'dropped') this.status = 'missed';
    this.placementError = onPlace ? Math.abs(cube[0] - TASK.placeX) : null;
    return this.status;
  }
}

/**
 * Minimum squeeze per finger (N) to hold the cube still against gravity.
 * Two friction contacts share the load: 2 · μ · F ≥ m · g.
 * Accelerating the cube needs more, which is why fast motions slip.
 */
export function requiredGripForce(massKg, mu) {
  return (massKg * GRAVITY) / (2 * mu);
}
