# Objective: Phase 7 Integration (Controls, Ambient Audio, Pedestrians & Environment Expansion)
Please update the current Three.js Maritime project to implement keyboard shortcuts, expand the landscape assets (water, pavements, new sub-components), add wandering humans, and integrate ambient audio layers.

## 1. Spacebar Mode Toggle
- Add a global window keyboard event listener for the `'Space'` key.
- When pressed, intercept the event (`event.preventDefault()`) and toggle the `simulationMode` state between `'OPERATIONAL'` and `'ATTACK'`. Ensure the UI buttons and the Three.js post-processing outline colors mirror this toggle instantly.

## 2. Advanced Landscape Detail (Pavements, Water & New Components)
- **Pavements/Walkways:** Add light gray rectangular thin panels (`THREE.BoxGeometry`) along the edges of the dark concrete dock meshes to establish distinct pedestrian walkways and safety zones.
- **Upgraded Water:** Ensure the water plane underneath the harbor uses a low roughness (0.15) and high metalness (0.8) to bounce back the newly brightened scene lighting.
- **More Interactive Components:** Expand the clickable asset tree:
  - Add a **Power Substation Unit (`substation_group`)** near the crane base (Concept: *Industrial Grid Security / Load Shedding Attacks*).
  - Add an **Automated Guided Vehicle (AGV) Charging Pad (`charging_pad_group`)** on the pavement surface (Concept: *Supply Chain Delays / Battery Spoofing Exploits*).

## 3. Animated Pedestrians (Humans Walking)
- Create a procedural helper function to spawn 5 to 8 stylized, low-poly human figures (constructed cleanly by grouping a tiny vertical capsule or cylinder for the body and a small sphere for the head).
- Distribute them across the new pavement zones.
- In the render loop, animate their positions so they wander along linear paths. If they hit the edge of a pavement boundary, have them smoothly reverse direction.

## 4. Port Ambient Audio Integration
- Implement a standard HTML5 `Audio` instance or use Three.js `THREE.AudioListener` / `THREE.Audio` to loop a subtle, low-volume ambient track representing port activity (e.g., low mechanical hums, ocean lapping, distant machinery echo).
- *Requirement:* Configure the audio context to start playing safely upon the user's first click anywhere on the viewport canvas to comply with modern browser autoplay policies.