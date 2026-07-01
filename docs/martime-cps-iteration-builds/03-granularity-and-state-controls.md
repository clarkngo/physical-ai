# Phase 3: Operational Granularity and System Threat States
Now that the core scene looks great, let's upgrade the interactive logic to support deep conceptual granularity and an alternative "Cyber Attack Simulation" state.

## 1. Hierarchical Mesh Breakdown (Sub-components)
Modify the asset creation code so that the main interactive objects are composite groups containing explicitly named sub-meshes. We want the raycaster to detect specific subsystems:
- `vessel_group` should contain:
  - `mesh_hull_sensor`: Represents IoT Strain Gauges (Concept: Sensor Telemetry).
  - `mesh_satellite_uplink`: Represents Edge-to-Cloud paths.
- `crane_group` should contain:
  - `mesh_lidar_scanner`: Represents Computer Vision inputs.
  - `mesh_plc_actuator`: Represents industrial automation execution.

Update the raycasting logic so that `intersects[0].object.name` checks for these specific sub-components and updates the educational overlay with a highly granular technical breakdown.

## 2. Implementation of "Cyber Attack Mode" State
- Create a global UI/state variable called `simulationMode` (values: 'OPERATIONAL' | 'ATTACK').
- When the mode switches to 'ATTACK':
  - Transition the scene's ambient light color smoothly to a warning hue (e.g., deep amber or low-intensity red).
  - Inject a subtle, random fragment shader distortion or a positions-array wobble into the `THREE.GridHelper` to visually simulate a "system glitch".
- Update the conceptual dataset: when in 'ATTACK' mode, clicking the sub-components displays threat vectors instead of normal operational data (e.g., clicking `mesh_plc_actuator` explains PLC firmware tampering and unauthorized command injection).

## 3. UI Chart Mockup Connection
- In the React/HTML overlay layout, when `mesh_hull_sensor` is selected, render a real-time animated SVG line graph or canvas chart mimicking streaming telemetry data to give the sandbox a true operational dashboard feel.