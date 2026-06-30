# Objective: Phase 6 Integration (Layout Bugfixes, Lighting Calibration & Ambient Animations)
Please update the existing Three.js Maritime project to fix current interface bugs, optimize the lighting model, and inject procedural background assets to make the harbor feel alive.

## 1. UI Pointer-Events Layer Fix
- Refactor the HUD overlay container layout CSS/styles to use `pointer-events: none;`.
- Ensure all interactive inner elements (the Fullscreen Button, OPS/ATTACK toggles, and close buttons) are explicitly styled with `pointer-events: auto;`. This allows the click events to pass completely through the empty UI space into the 3D canvas behind it.

## 2. Recursive Raycasting Fix (Satellite Click Issue)
- In the selection event handler, update the raycaster array to read recursively: `raycaster.intersectObjects(scene.children, true)`.
- When an object is clicked, if it is a deeply nested sub-mesh (such as the satellite dish or an individual cargo box container), implement a `while` loop to traverse upward through its parent chain (`while (obj.parent) { ... }`) until it reaches its primary root group identifier (e.g., resolving back to the `vessel_group` or `crane_group`). This ensures smaller nested meshes are reliably clickable.

## 3. Brighten Environment & Calibrate Exposure
- Update the WebGLRenderer settings to use proper tone mapping:
  ```javascript
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
Adjust the scene lights to eliminate the dark, dim appearance:

Add or upgrade a THREE.HemisphereLight(0xffffff, 0x444444, 2.0) to cleanly lift the baseline shadows.

Set the primary shadow-casting DirectionalLight intensity to 4.0 or higher, and place it at an elevated angle (e.g., position.set(30, 50, 20)) to illuminate the assets clearly.

4. Inject Environmental "Life" (Procedural Background Assets)
Create a helper function that generates decorative, non-interactive meshes to populate the surrounding ecosystem:

Dockside Logistics: Spawn 3 to 5 small multi-colored box groupings representing autonomous delivery trucks moving along the pier edges. In the main requestAnimationFrame loop, update their positions on a looping linear path.

Ocean Buoyancy: In the render loop, apply a gentle vertical wave offset and slight tilt (Math.sin(Date.now() * 0.0015) * 0.06) to the primary ship group so it realistically bobs on the water plane.

Active Infrastructure: Add an animated sweeping spotlight cone primitive acting as a radar sweep on the control tower or a harbor lighthouse to give the scene constant active energy.