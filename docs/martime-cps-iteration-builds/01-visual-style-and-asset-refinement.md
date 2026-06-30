# Visual Style & Asset Refinement
Now, let's replace basic primitive placeholders with beautifully designed, stylized, low-poly procedural assets that resemble a high-tech "Digital Twin" dashboard. Use a sleek, tech-oriented color palette (deep ocean blues, slate grays, neon cyan highlights, and clean industrial oranges/yellows).

## 1. Asset Upgrades (Group Geometries)
Instead of single primitives, construct compound `THREE.Group` objects for our 4 main assets to give them structural detail:
- **Cargo Vessel Hull (`ship_hull`):** Combine a long, flat box for the deck, a pointed wedge/cone for the bow, and stacked smaller colored boxes on the back representing stylized cargo containers.
- **Automated Gantry Crane (`gantry_crane`):** Build a structural frame using thin, tall cylinders or boxes for legs, a long horizontal overhead beam extending over the water, and a small highlighted box hanging beneath it representing the automated trolley.
- **Port Control Tower (`control_tower`):** Create a tall hexagonal or cylindrical pillar topped with a wider, glass-like box (use high roughness/slight transparency) for the observation deck and a small antenna spindle on top.
- **Loading Dock Gate (`dock_gate`):** Create two concrete pillar boxes on either side of an access road, with a bright neon-colored horizontal barrier arm or security scanner mesh between them.

## 2. Materials & Environment Lighting
- **Water Plane:** Add a large horizontal plane underneath the harbor. Use a `MeshStandardMaterial` with a deep blue color, a low roughness setting, and a high metalness setting to give it a sleek, reflective, fluid look.
- **Ground/Dock:** Use a dark slate gray with a slightly rough texture to make the industrial concrete pop.
- **Lighting Setup (Crucial):** 
  - Add a soft `AmbientLight` (light blue tint) for fill light.
  - Add a strong `DirectionalLight` (warm white or soft gold) casting clean shadows from an angle to give the low-poly edges beautiful depth and contrast.
  - Add a subtle `HemisphereLight` (sky blue to ground gray) to mimic realistic outdoor atmospheric scattering.

## 3. Interaction Polish
- Ensure the `MeshStandardMaterial` on the 4 interactive groups responds cleanly to the mouse hover emissive glow (`emissive` property turned up slightly on hover).
- When an object is clicked, smoothly animate the OrbitControls target or camera position slightly toward that object using a simple `requestAnimationFrame` interpolation (lerp) so the transition feels high-end.