import { getSubsystemConcept, isSubsystemId } from './subsystemConcepts.js';

export const AVIATION_CONCEPTS = {
  commercial_aircraft: {
    id: 'commercial_aircraft',
    label: 'Commercial Aircraft',
    title: 'Integrated Avionics & FMS',
    category: 'Flight Systems · OT',
    screenLabel: { tag: 'ACFT', module: 'AVIONICS' },
    description:
      'Modern narrow-body aircraft fuse flight management, autopilot, and engine FADEC over ARINC 429 and AFDX buses. ' +
      'The FMS computes 4-D trajectories while redundant inertial references maintain position when GNSS is unavailable.',
    attackDescription:
      'Avionics buses aggregate safety-critical commands. Compromised FMS databases or spoofed ADS-B tracks can introduce ghost traffic ' +
      'and corrupt descent profiles. Inspect FMS and ADS-B sub-components for granular threat scenarios.',
  },
  atc_tower: {
    id: 'atc_tower',
    label: 'Air Traffic Control Tower',
    title: 'Surveillance & Separation',
    category: 'Coordination · Safety',
    screenLabel: { tag: 'ATC', module: 'SEPARATION' },
    description:
      'Tower controllers fuse primary/secondary radar, ADS-B, and MLAT feeds into a single traffic picture. ' +
      'Automation tools propose runway sequences and conflict alerts while humans retain authority for clearance delivery.',
    attackDescription:
      'ATC automation trusts fused surveillance inputs. Spoofed ADS-B targets or poisoned radar tracks can trigger false conflict alerts ' +
      'or mask real incursions until visual acquisition fails.',
  },
  jet_bridge: {
    id: 'jet_bridge',
    label: 'Passenger Jet Bridge',
    title: 'Gate IT/OT Boundary',
    category: 'Security · Architecture',
    screenLabel: { tag: 'GATE', module: 'SEGMENTATION' },
    description:
      'Jet bridges bridge passenger IT (Wi-Fi portals, FIDS displays) with gate OT (HVAC, door interlocks, GPU controllers). ' +
      'Segmentation gateways restrict lateral movement between airline ops VLANs and airport facility networks.',
    attackDescription:
      'Gate systems are pivot points between airline IT and ramp OT. Compromised passenger Wi-Fi captive portals or badge readers ' +
      'can expose GPU controllers and aircraft dataload ports during turnaround windows.',
  },
  fuel_hydrant: {
    id: 'fuel_hydrant',
    label: 'Ramp Fuel Hydrant',
    title: 'Fuel Metering & SCADA',
    category: 'Energy · OT Infrastructure',
    screenLabel: { tag: 'FUEL', module: 'HYDRANT' },
    description:
      'Under-ramp hydrant systems meter Jet-A flow through SCADA-controlled valves with overfill protection and water-slug detection. ' +
      'Truck dispatch tablets authenticate each uplift against flight release paperwork.',
    attackDescription:
      'Fuel SCADA relays prioritize safety interlocks. Spoofed valve-OK telemetry or manipulated flow totals can mask contamination events ' +
      'or deny uplifts during peak bank schedules.',
  },
  baggage_loader: {
    id: 'baggage_loader',
    label: 'Baggage Loader Unit',
    title: 'Ground Handling Automation',
    category: 'Logistics · Edge Devices',
    screenLabel: { tag: 'BHS', module: 'LOADER' },
    description:
      'Belt loaders and ULD tractors receive turn-around tasks from ramp orchestration apps using signed CAN telemetry. ' +
      'Load planners reconcile bag counts with weight-and-balance systems before pushback clearance.',
    attackDescription:
      'Ground loader firmware reports false ready-states while belts remain idle, delaying pushback. Malicious CAN frames can override ' +
      'elevation limits and stress cargo door actuators during bulk loading.',
  },
  ground_radar: {
    id: 'ground_radar',
    label: 'ADS-B Ground Station',
    title: 'Surveillance Broadcast Integrity',
    category: 'Navigation · RF Layer',
    screenLabel: { tag: 'ADS-B', module: 'SURVEIL' },
    description:
      '1090 MHz ADS-B ground receivers ingest Mode S extended squitter frames for surface movement and approach monitoring. ' +
      'Multilateration supplements coverage gaps where line-of-sight is obstructed by terminal structures.',
    attackDescription:
      'ADS-B lacks cryptographic authentication on legacy deployments. Software-defined radios can inject ghost aircraft ' +
      'targets that appear valid to fusion engines until cross-checks with primary radar diverge.',
  },
  maintenance_hangar: {
    id: 'maintenance_hangar',
    label: 'MRO Maintenance Hangar',
    title: 'Supply Chain & Dataload Security',
    category: 'Maintenance · OT Lifecycle',
    screenLabel: { tag: 'MRO', module: 'DATALOAD' },
    description:
      'Hangar bays host avionics dataload ports, borescope rigs, and signed LRU swap workflows. MRO tablets pull approved ' +
      'configuration manifests from airline engineering repositories before components are returned to service.',
    attackDescription:
      'Maintenance laptops bridge enterprise IT and aircraft OT. Malicious dataload images or unverified USB maintenance tools ' +
      'can implant persistent avionics logic without triggering line-maintenance checksum audits.',
  },
  pushback_tug: {
    id: 'pushback_tug',
    label: 'Autonomous Pushback Tug',
    title: 'GNSS-Guided Ramp Robotics',
    category: 'Robotics · Surface Ops',
    screenLabel: { tag: 'TUG', module: 'GNSS' },
    description:
      'Autonomous tugs follow geofenced taxi routes using RTK-GNSS and airport surface movement maps. Fleet managers ' +
      'coordinate pushback windows with ATC ground control and gate allocation systems.',
    attackDescription:
      'GNSS spoofing shifts tug path coordinates relative to stand centerlines, risking wingtip conflicts. Forged fleet-ready ' +
      'telemetry can dispatch tugs before chocks are removed.',
  },
};

export const INTERACTIVE_OBJECT_IDS = Object.keys(AVIATION_CONCEPTS);

export function getConceptById(id, simulationMode = 'OPERATIONAL') {
  const concept = id ? AVIATION_CONCEPTS[id] ?? null : null;
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
