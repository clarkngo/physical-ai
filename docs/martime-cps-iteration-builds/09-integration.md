# Objective: Phase 9 Integration (Audio Controls, Camera Clearance, Threat Actors & Incident Workflows)
Please refactor and upgrade the Maritime CPS Explorer to enhance the camera layout, add detailed threat metrics for diverse humans/machines, and build a full interactive attack scenario simulation with defensive response layers.

## 1. Sound Mixing & Mute Controls
- **Audio Mix Adjustment:** Lower the global master volume of the port machinery ambient loop to a subtle background layer (`0.15` or `0.2`). Layer in a gentle, rolling ocean water lapping sound loop at a slightly higher priority (`0.3`) to establish a cleaner maritime atmosphere.
- **Mute Toggle UI:** Add a clean speaker icon button to the floating HUD overlay. Clicking it toggles global audio muting (`audioContext.suspend()` / `resume()`, or setting gain nodes to `0`). Ensure the icon state visually updates to reflect muted/unmuted statuses.

## 2. Unobstructed Viewport (Camera Rig Clearance)
- **Obstruction Fix:** The default camera placement is currently blocked by background port assets. Adjust the initial `camera.position` and the `OrbitControls.target` coordinates to place the viewpoint at an elevated, slightly angled perspective (e.g., looking down from a 45-degree angle).
- **Intelligent Focus:** Ensure that when a specific asset is selected, the camera smoothly glides (`lerp`) to an unobstructed vantage point looking *past* surrounding decorative clutter.

## 3. Human Roles, Machines, and Vector Threat Mapping
Expand your entities inside the Three.js scene and map them to explicit security threat profiles within your dataset:
- **Diverse Human Roles (Vary their procedural torso colors):**
  - **Port Operator (Blue):** Threat Vector -> *Social Engineering / Credential Theft.* (Compromised HMI terminal access).
  - **Third-Party Technician (Orange):** Threat Vector -> *Malicious USB / Insider Threat.* (Direct physical access to PLC cabinets during maintenance).
  - **Security Guard (Black):** Threat Vector -> *Physical Breach.* (Bypassed access control gates or tailgating).
- **New Machines:**
  - **Automated Straddle Carrier (`straddle_carrier`):** Threat Vector -> *GPS Spoofing.* (Manipulating coordinate feeds to cause physical yard collisions).
  - **Smart Power Grid Hub (`power_hub`):** Threat Vector -> *Firmware Tampering.* (Overloading local transformers via unauthorized industrial protocol commands).

## 4. Interactive Attack Scenario & Mitigation Dashboard
Implement a structured, step-by-step incident response engine inside the HUD when `simulationMode === 'ATTACK'`. Choose a flagship scenario (e.g., **"Ransomware/Command Injection on Gantry Crane PLCs"**):

### A. Active Attack Phase (Visual & Functional Changes)
- When the attack is triggered, the affected machine (e.g., the Crane) flashes a warning outline.
- The HUD locks down and displays an alert: **"CRITICAL: Unauthorized PLC Trajectory Manipulation Detected."**

### B. Reactive Mitigation Steps (Interactive Playbook)
Provide a step-by-step clickable checklist in the HUD that the user must execute to resolve the active crisis:
1. **Isolate Network Traffic:** (Clicking this cuts off the IT-to-OT network bridge mesh visually, stopping the malicious data stream packet animation).
2. **Deploy Backup Firmware Images:** (Refreshes the compromised PLC controller configuration state).
3. **Fail-to-Safe Actuation:** (Engages emergency mechanical brakes on the 3D crane model, bringing its moving components to a controlled halt).

### C. Proactive Defense Strategies (Hardening Checklist)
Once mitigated, display a "System Hardening" overview outlining how to prevent the exploit proactively:
- **Network Segmentation:** Implement a Zero-Trust industrial DMZ between logistics databases and physical fieldbus control networks.
- **Cryptographic Authentication:** Enforce signed firmware verification validation algorithms directly at the hardware layer for all PLCs and RTUs.
- **Continuous Monitoring:** Deploy an Industrial IDS (Intrusion Detection System) to flag anomalous protocol behaviors (like unexpected Modbus/TCP or EtherNet/IP write functions).