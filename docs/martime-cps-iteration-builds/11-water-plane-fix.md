# Objective: Phase 10 Integration (Audio Tuning, Attack Reselection, and Water Plane Fix)
Please refactor the Three.js maritime project to establish a calming audio profile, implement an interactive attack scenario switcher, and fix the missing harbor water rendering.

## 1. Calming Port Audio Mix & Mute Controls
- **Audio Mix Adjustment:** Replace any high-intensity mechanical port noise loops with a prominent, loopable **Calming Waters / Ocean Waves Lapping** background track (`volume: 0.4`).
- **Background Layering:** Keep industrial port machinery noises (cranes, trucks) at a heavily dampened, distant background layer (`volume: 0.05`) so it feels like an expansive, peaceful coastal harbor.
- **Mute Toggle UI:** Ensure the HUD speaker icon allows the user to cleanly suspend/resume the global audio context (`audioContext.suspend()` / `resume()`) or set gain nodes to 0, dynamically updating the icon.

## 2. Grounding the Harbor: Visible Water Plane (Fixing the Black Void)
- The harbor floor currently looks like a solid black void. Create an explicit, large horizontal plane (`THREE.PlaneGeometry(2000, 2000)`) to represent the harbor water.
- **Positioning:** Orient it flat on the X-axis (`rotation.x = -Math.PI / 2`) and position it slightly below your concrete dock meshes (`position.y = -0.5`).
- **PBR Material properties:** Use `THREE.MeshStandardMaterial` or `THREE.MeshPhysicalMaterial` configured to catch light reflections and neon glows:
  ```javascript
  waterMaterial.color.set('#0b1d3a'); // Deep oceanic midnight blue
  waterMaterial.roughness = 0.15;     // Smooth surface for specular highlights
  waterMaterial.metalness = 0.85;     // Metallic sheen to bounce light grid lines

```

* Make sure this plane is added directly to the core scene (`scene.add(water)`) so it populates cleanly beneath your ship hull, docks, and moving vessels.

## 3. Attack Scenario Reselection Engine & Reset Logic

* Add a dropdown selector or a "Change Scenario" button to the Active Incident HUD panel when `simulationMode === 'ATTACK'`.
* Provide at least two distinct selectable scenario paths:
1. **Scenario A:** Ransomware / Command Injection on Gantry Crane PLCs
2. **Scenario B:** GPS Spoofing on Automated Straddle Carriers


* **Dynamic Re-targeting:** Selecting a new scenario must instantly switch the HUD alerts, reset the reactive playbook checklist checkboxes back to uncompleted (`false`), and shift the Three.js `OutlinePass` target array to highlight the newly targeted machine asset.
* **State Clearing:** If a user toggles back to `OPS` mode or switches scenarios, completely clear the simulation state:
* Reset any ongoing 3D animation overrides (restore default background path velocities if a machine was halted/locked out).
* Clear the resolved steps array so the interactive playbook can be re-played cleanly from step 1.

