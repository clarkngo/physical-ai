import { getSubsystemConcept, isSubsystemId } from './subsystemConcepts.js';

export const MARITIME_CONCEPTS = {
  gantry_crane: {
    id: 'gantry_crane',
    label: 'Automated Gantry Crane',
    title: 'Edge AI & Computer Vision',
    category: 'Perception & Inference',
    screenLabel: { tag: 'CRANE', module: 'EDGE AI' },
    description:
      'Autonomous gantry cranes run real-time computer vision pipelines directly on edge GPUs mounted in the crane cabin. ' +
      'Cameras and LiDAR estimate container pose, twist-lock alignment, and stack geometry without round-tripping imagery to the cloud. ' +
      'Local inference keeps cycle times under a few seconds even when harbor networks are congested, while deterministic safety interlocks ' +
      'halt motion if confidence drops below operational thresholds.',
    attackDescription:
      'Crane OT networks are high-value targets: compromised vision stacks or PLC write access can disrupt container throughput across an entire berth. ' +
      'Click the LiDAR scanner or PLC actuator sub-components to inspect specific attack surfaces.',
  },
  ship_hull: {
    id: 'ship_hull',
    label: 'Cargo Vessel Hull',
    title: 'Digital Twins & Telemetry',
    category: 'Modeling & Sensing',
    screenLabel: { tag: 'VESSEL', module: 'TELEMETRY' },
    description:
      'Modern hulls embed strain gauges, accelerometers, and corrosion probes that stream structural health data into a living digital twin. ' +
      'Physics-informed models fuse sensor telemetry with CFD and finite-element simulations to predict fatigue hotspots before they become failures. ' +
      'Fleet operators compare twin forecasts against class-society limits to schedule dry-dock maintenance instead of reacting to unexpected cracks.',
    attackDescription:
      'Hull telemetry feeds are trust anchors for fleet safety analytics. Spoofed strain data or hijacked satellite uplinks can mask structural distress ' +
      'while dashboards remain nominal. Drill into hull sensors or the uplink array for granular threat scenarios.',
  },
  control_tower: {
    id: 'control_tower',
    label: 'Port Control Tower',
    title: 'Multi-Agent Orchestration',
    category: 'Coordination & Planning',
    screenLabel: { tag: 'TOWER', module: 'ORCHESTRATION' },
    description:
      'Port control systems treat tugs, pilots, berth assignments, and yard cranes as cooperative agents in a shared scheduling graph. ' +
      'Each agent publishes constraints—draft limits, crane availability, tidal windows—and a central orchestrator resolves conflicts with ' +
      'mixed-integer optimization and reinforcement-learned heuristics. The result is fewer idle berths, shorter anchorage queues, and smoother hand-offs between maritime and landside logistics.',
    attackDescription:
      'Orchestration APIs aggregate privileges across the port. Forged berth-release messages or poisoned agent constraint feeds can cascade into berth collisions and tug misallocation across the harbor graph.',
  },
  dock_gate: {
    id: 'dock_gate',
    label: 'Loading Dock Gate',
    title: 'Network Segmentation in CPS',
    category: 'Security & Architecture',
    screenLabel: { tag: 'GATE', module: 'SEGMENTATION' },
    description:
      'The dock gate marks a deliberate air-gapped boundary between Operational Technology (OT)—PLCs, RTGs, and safety PLCs—and ' +
      'Information Technology (IT) systems such as ERP, billing, and cloud analytics. Unidirectional gateways and protocol breakers let ' +
      'telemetry flow outward for planning while blocking lateral movement that could pivot from a compromised laptop into crane motion control.',
    attackDescription:
      'Segmentation failures at the gate enable classic IT-to-OT pivot paths. Compromised ERP credentials or spoofed badge systems can open logical paths to crane VLANs despite physical air-gap intent.',
  },
  power_substation: {
    id: 'power_substation',
    label: 'Power Substation Unit',
    title: 'Industrial Grid Security',
    category: 'Energy · OT Infrastructure',
    screenLabel: { tag: 'GRID', module: 'SUBSTATION' },
    description:
      'Harbor substations step down high-voltage shore power into crane, reefer, and lighting feeders. SCADA relays monitor phase balance, ' +
      'breaker status, and harmonic distortion while load-shedding logic prioritizes safety circuits during peak berth demand.',
    attackDescription:
      'Load-shedding attacks manipulate relay timing or spoof breaker-OK telemetry to force unplanned outages during peak container moves. ' +
      'Coordinated grid exploits can isolate RTG clusters while leaving IT networks online—maximizing operational chaos.',
  },
  charging_pad: {
    id: 'charging_pad',
    label: 'AGV Charging Pad',
    title: 'Supply Chain & Battery Telemetry',
    category: 'Logistics · Edge Devices',
    screenLabel: { tag: 'AGV', module: 'CHARGING' },
    description:
      'Automated guided vehicles queue on inductive charging pads between haul cycles. Pad controllers negotiate charge rates with fleet ' +
      'management software using signed CAN frames and report state-of-charge to yard orchestrators for berth timing.',
    attackDescription:
      'Battery spoofing exploits report false 100% SOC while cells are depleted, causing AGVs to stall mid-route and block lane traffic. ' +
      'Malicious pad firmware can overcharge packs or deny authentication to delay entire container transfer windows.',
  },
  straddle_carrier: {
    id: 'straddle_carrier',
    label: 'Automated Straddle Carrier',
    title: 'Yard Positioning & GNSS',
    category: 'Logistics · Heavy Equipment',
    screenLabel: { tag: 'YARD', module: 'GNSS' },
    description:
      'Straddle carriers lift and reposition forty-foot containers using RTK-GNSS and yard laser grids. Onboard fusion filters reconcile ' +
      'wheel odometry with beacon triangulation to maintain sub-meter slot accuracy during peak throughput.',
    attackDescription:
      'GPS spoofing injects false easting/northing offsets into navigation feeds, causing slot misalignment and container stack collisions. ' +
      'Coordinated spoofing during night shifts can cascade into crane queue deadlocks across the yard.',
  },
  power_hub: {
    id: 'power_hub',
    label: 'Smart Power Grid Hub',
    title: 'Industrial Energy Orchestration',
    category: 'Energy · Smart Grid',
    screenLabel: { tag: 'GRID', module: 'POWER HUB' },
    description:
      'The smart power hub aggregates breaker telemetry, harmonic sensors, and load forecasts to balance reefer clusters, crane feeders, ' +
      'and EV charging banks. IEC 61850 GOOSE messages coordinate protective relays across the berth microgrid.',
    attackDescription:
      'Firmware tampering replaces relay logic with unauthorized industrial protocol commands, overloading transformers during peak crane demand. ' +
      'Unsigned image flashes can bypass SCADA visibility while breakers remain logically closed.',
  },
};

export const INTERACTIVE_OBJECT_IDS = Object.keys(MARITIME_CONCEPTS);

export function getConceptById(id, simulationMode = 'OPERATIONAL') {
  const concept = id ? MARITIME_CONCEPTS[id] ?? null : null;
  if (!concept) return null;
  if (simulationMode === 'ATTACK' && concept.attackDescription) {
    return {
      ...concept,
      category: `${concept.category} · Threat Overview`,
      description: concept.attackDescription,
      simulationMode,
    };
  }
  return { ...concept, simulationMode };
}

export function getConceptForSelection(selectionId, simulationMode = 'OPERATIONAL') {
  if (!selectionId) return null;
  if (isSubsystemId(selectionId)) {
    return getSubsystemConcept(selectionId, simulationMode);
  }
  return getConceptById(selectionId, simulationMode);
}
