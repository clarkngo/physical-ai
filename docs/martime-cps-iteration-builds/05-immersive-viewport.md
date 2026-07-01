# Phase 5: Immersive Viewport, PBR Asset Refinement, and Post-Processing Outlines
Let's maximize the user experience by prioritizing the 3D space, heavily detailing the procedural assets, and moving to an advanced post-processing selection system.

## 1. Full-Bleed Immersive Viewport Layout
- Refactor the page CSS so the 3D Canvas element takes up 100% of the parent container's width and height.
- Change the educational data UI into a sleek, floating HUD overlay positioned on top of the canvas (e.g., a left or bottom slide-in drawer). 
- Give this overlay a high-tech floating frosted-glass design (`background: rgba(13, 17, 23, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1);`).

## 2. PBR Material & Asset Fidelity Upgrades
- Swap materials out for `THREE.MeshPhysicalMaterial` to capture premium realistic reflections.
- **Vessel Upgrade:** Build a multi-layered hull. Apply a high `metalness` (0.9) to the main ship body. Stack individual rows of distinct cargo box groups with alternating industrial colors, and place a transparent, glass-like radar dome near the rear tower.
- **Crane Upgrade:** Construct intricate truss structures. Instead of single blocks, use networks of thin structural girders (thin cylinder meshes or nested boxes) and apply an aggressive `roughness: 0.7` to mimic weatherproof industrial paint.
- Add an explicit `THREE.DirectionalLight` helper targeting the center of the port to generate clean, sharp directional cast-shadows (`renderer.shadowMap.enabled = true`) across the docks.

## 3. Advanced Silhouette Outline Highlight Setup
- Implement post-processing via `EffectComposer`, `RenderPass`, and `OutlinePass`.
- Import the required addons from `three/addons/postprocessing/OutlinePass.js`.
- Remove the old manual emissive-color hover changes from the raycaster logic.
- Instead, configure the selection loop:
  - When an asset is hovered, assign it to `outlinePass.selectedObjects = [hoveredObject];`.
  - Customize the outline configuration for a clean sci-fi neon styling:
    - `outlinePass.edgeStrength = 4.0;`
    - `outlinePass.edgeThickness = 1.5;`
    - `outlinePass.visibleEdgeColor.set('#00f3ff');` // Cyan glow for normal ops
  - If `simulationMode === 'ATTACK'`, dynamically shift the `visibleEdgeColor` to a warning amber or neon red (`#ff3e3e`).
- Ensure the `composer.render()` method correctly updates inside the core animation update loop.# Phase 5: Immersive Viewport, PBR Asset Refinement, and Post-Processing Outlines
Let's maximize the user experience by prioritizing the 3D space, heavily detailing the procedural assets, and moving to an advanced post-processing selection system.

## 1. Full-Bleed Immersive Viewport Layout
- Refactor the page CSS so the 3D Canvas element takes up 100% of the parent container's width and height.
- Change the educational data UI into a sleek, floating HUD overlay positioned on top of the canvas (e.g., a left or bottom slide-in drawer). 
- Give this overlay a high-tech floating frosted-glass design (`background: rgba(13, 17, 23, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1);`).

## 2. PBR Material & Asset Fidelity Upgrades
- Swap materials out for `THREE.MeshPhysicalMaterial` to capture premium realistic reflections.
- **Vessel Upgrade:** Build a multi-layered hull. Apply a high `metalness` (0.9) to the main ship body. Stack individual rows of distinct cargo box groups with alternating industrial colors, and place a transparent, glass-like radar dome near the rear tower.
- **Crane Upgrade:** Construct intricate truss structures. Instead of single blocks, use networks of thin structural girders (thin cylinder meshes or nested boxes) and apply an aggressive `roughness: 0.7` to mimic weatherproof industrial paint.
- Add an explicit `THREE.DirectionalLight` helper targeting the center of the port to generate clean, sharp directional cast-shadows (`renderer.shadowMap.enabled = true`) across the docks.

## 3. Advanced Silhouette Outline Highlight Setup
- Implement post-processing via `EffectComposer`, `RenderPass`, and `OutlinePass`.
- Import the required addons from `three/addons/postprocessing/OutlinePass.js`.
- Remove the old manual emissive-color hover changes from the raycaster logic.
- Instead, configure the selection loop:
  - When an asset is hovered, assign it to `outlinePass.selectedObjects = [hoveredObject];`.
  - Customize the outline configuration for a clean sci-fi neon styling:
    - `outlinePass.edgeStrength = 4.0;`
    - `outlinePass.edgeThickness = 1.5;`
    - `outlinePass.visibleEdgeColor.set('#00f3ff');` // Cyan glow for normal ops
  - If `simulationMode === 'ATTACK'`, dynamically shift the `visibleEdgeColor` to a warning amber or neon red (`#ff3e3e`).
- Ensure the `composer.render()` method correctly updates inside the core animation update loop.