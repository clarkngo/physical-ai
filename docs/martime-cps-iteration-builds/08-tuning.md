# Objective: Phase 8 Integration (Selection Audio, Velocity Tuning & Collision Logic)
Please update the Three.js project to add an audio feedback trigger on object selection, reduce the movement speed of environmental assets for a realistic scale, and implement basic boundary collision mapping.

## 1. Selection Sound Effect
- Integrate a crisp, short, high-tech audio feedback sound (e.g., a modern UI blip, synth click, or sonar ping) that fires immediately whenever a user clicks a valid interactive asset.
- Use a lightweight, open-source audio asset link, or generate a fast procedural sound effect using the browser's native **Web Audio API** (OscillatorNode) so it plays instantly with zero loading lag.

## 2. Velocity Dampening (Slower, Grounded Realism)
- Locate the animation values in the `requestAnimationFrame` render loop.
- Significantly scale down the speed multipliers:
  - Reduce the pedestrian walking velocity so they stroll naturally instead of rushing.
  - Slow down the autonomous logistical trucks and the vessel's vertical ocean-bobbing frequency so the heavy machinery conveys a true sense of immense mass and industrial scale.

## 3. Object Boundary & Collision Awareness
- Implement simple bounding box collision tracking (`THREE.Box3`) or basic 2D radius distance checking (`Math.hypot`) between moving objects and static structures.
- **Pedestrian Collisions:** If a wandering human's coordinate overlaps with the bounding area of the Crane base, the Control Tower, or a static dock barrier, trigger an event to invert their walking direction vector instantly.
- **Logistics Truck Corridors:** Ensure the moving trucks are strictly clamped to their designated driveway coordinates, stopping or reversing if they encounter an unexpected obstacle in their lane path.