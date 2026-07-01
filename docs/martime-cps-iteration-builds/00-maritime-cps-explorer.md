# Objective
I want to build a hybrid interactive 3D learning sandbox called "Maritime CPS Explorer" inside my existing repository. The goal is to let users interact with a 3D port/maritime environment using Three.js and click on specific objects to learn about Cyber-Physical Systems (CPS) and Physical AI concepts.

# Context & Architecture
1. This feature must be built inside my existing GitHub Pages repository (`physical-ai`).
2. It should live under a dedicated route/page mapped to the route `/#/maritime`.
3. Organize the codebase cleanly:
   - Create a modular home at `/src/components/MaritimeExplorer/` for the Three.js canvas, raycasting, and 3D logic.
   - Use a dedicated page layout component at `/src/pages/MaritimePage.js` to manage the wrapper and overall UI state.
   - 3D assets (like .gltf/.glb files) will eventually go into `/public/models/maritime/`. For now, use basic Three.js mesh primitives (cubes, cylinders, boxes) as stylized placeholders for objects so the code runs immediately.

# Hybrid Features to Build
The application should feature a 3D Viewport on one side (or full screen) and a clean HTML/CSS Overlay Panel on the other. I want a complete state-driven setup mapping these interactive 3D elements to their specific CPS concepts:

1. Automated Gantry Crane (`gantry_crane`) -> Concept: "Edge AI & Computer Vision" (How autonomous cranes use local computer vision inference to align and stack containers).
2. Cargo Vessel Hull (`ship_hull`) -> Concept: "Digital Twins & Telemetry" (How IoT sensor arrays stream structural fatigue data).
3. Port Control Tower (`control_tower`) -> Concept: "Multi-Agent Orchestration" (How autonomous agents dynamically schedule tugboats and berths to prevent logistics bottlenecks).
4. Loading Dock Gate (`dock_gate`) -> Concept: "Network Segmentation in CPS" (The crucial air-gapped boundary separating physical Operational Technology (OT) from logistics Information Technology (IT)).

# Technical Requirements
- If the project does not have 'three' installed, install it as a dependency.
- Set up a standard Three.js Scene, PerspectiveCamera, WebGLRenderer, and OrbitControls.
- Implement an efficient Raycaster on the canvas. 
- **Hover State:** When a mouse hovers over an interactive mesh, change the cursor style to a pointer and give the object a subtle emissive glow/outline color so the user knows it's clickable.
- **Click/Selection State:** Clicking an object must capture its identifier and update the parent UI state to open a sliding sidebar or modal displaying the corresponding concept's Title, Category, and a detailed educational description.
- Ensure the 3D canvas resizes responsively when the window scales.

Please generate the file structure, implement the core Three.js component with raycasting, create the mock dataset for the 4 concepts, and wire up the page component. Keep the layout clean, modern, and highly readable.