# Phase 4: Industrial Asset Shading & Native Fullscreen Module
Let's elevate the scene's visual polish to standard industrial twin parity and implement a responsive fullscreen toggle interface.

## 1. Advanced Material Shader Properties
Upgrade our procedural shapes from basic materials to premium PBR (Physically Based Rendering) surfaces:
- Switch standard meshes to `THREE.MeshPhysicalMaterial` where appropriate.
- Give the **Vessel Hull** high reflectivity (`metalness: 0.85`, `roughness: 0.15`).
- Give the **Control Tower Glass** realistic transparency physics (`transmission: 0.6`, `opacity: 1`, `transparent: true`, `roughness: 0.1`).
- Dynamically generate a small canvas texture containing black-and-yellow hazard stripes and apply it as a repeatable map on the base structural joints of the **Gantry Crane**.

## 2. Sky Gradient & Ambient Reflections
- Create a procedural gradient sky background using a large sphere or hemisphere setup inside the scene, transitioning from deep sunset purple to horizon slate blue. 
- Ensure this environmental gradient is mapped into the scene's `.environment` properties so the reflective metal hulls pick up realistic ambient color tones.

## 3. Fullscreen API Integration
- Implement a modern, minimal Fullscreen Button overlaying the top-right corner of the viewport.
- Configure the click handler to call `.requestFullscreen()` on the outer layout wrapper element (enclosing both the 3D Canvas and the educational overlay panels).
- Safely wire up the element's event listeners so that when a user triggers or exits fullscreen, the camera's `.aspect` ratio matrix updates immediately and the `renderer.setSize()` matches the container's fresh browser boundaries flawlessly.