# Objective: Refactor HUD Layout to Prevent 3D Viewport Squishing
Looking at the UI layout, the HTML panels at the bottom and sides are taking up too much block space and compressing the Three.js canvas into a tiny horizontal strip. We need to refactor the CSS to ensure a true full-bleed 3D viewport with a floating HUD design.

## 1. True Full-Screen Canvas Styling
- Ensure the Three.js canvas container wrapper is styled with:
  ```css
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1;

```

* Trigger a resize event check on initialization to ensure the renderer fills this true `100vw/100vh` space cleanly without stretching.

## 2. Convert Dashboard Panels into Floating HUD Elements

* Convert the large bottom layout into a modular, toggleable, or collapsible dock.
* Style the main container holding the 'THREAT ACTORS', 'PORT ASSETS', and 'SUB-COMPONENTS' panels with:
```css
position: absolute;
bottom: 20px;
left: 50%;
transform: translateX(-50%);
width: 95%;
max-height: 30vh; /* Cap the height so it never smothers the screen */
overflow-y: auto; /* Allow scrolling inside the dashboard if text overflows */
z-index: 10;
pointer-events: none; /* Let clicks pass through empty spaces to the canvas */

```


* Ensure the individual inner cards inside this dashboard restore `pointer-events: auto;`.

## 3. Right-Side Active Incident Panel Optimization

* The 'ACTIVE INCIDENT // REACTIVE PLAYBOOK' card on the right looks great but should remain pinned to the side without shifting other elements. Style it with:
```css
position: absolute;
top: 100px;
right: 20px;
width: 350px;
max-height: 70vh;
z-index: 10;

```



## 4. Add a Collapse/Minimize Toggle for the Bottom Dashboard

* To give the user maximum visibility when interacting with the 3D scene, add a small, minimal "Minimize Panel" or "Hide HUD" arrow button right above the bottom dashboard.
* When clicked, smoothly slide the bottom panel down off the screen (`transform: translate(-50%, 90%)`), leaving only a small tab visible to pull it back up.

```

```