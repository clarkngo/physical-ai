export const SIMULATION_MODES = {
  OPERATIONAL: 'OPERATIONAL',
  ATTACK: 'ATTACK',
};

export const SUBSYSTEM_IDS = [
  'mesh_fms',
  'mesh_adsb',
  'mesh_radar_feed',
  'mesh_apu_controller',
];

export const SUBSYSTEM_CONCEPTS = {
  mesh_fms: {
    id: 'mesh_fms',
    parentAsset: 'commercial_aircraft',
    label: 'Flight Management System',
    showTelemetryChart: true,
    operational: {
      title: '4-D Trajectory Computation',
      category: 'Navigation · Avionics',
      description:
        'The FMS ingests nav databases, performance models, and ATC clearances to compute vertical profiles and LNAV/VNAV paths. ' +
        'Dual independent units cross-compare waypoint sequences before engaging autopilot modes.',
    },
    attack: {
      title: 'Waypoint Injection & Database Tampering',
      category: 'Threat Vector · Navigation',
      description:
        'Malicious nav database updates can insert offset waypoints near terrain-critical segments. Without signed database ' +
        'manifests and out-of-band clearance cross-checks, crews may fly modified paths while CDU displays remain plausible.',
    },
  },
  mesh_adsb: {
    id: 'mesh_adsb',
    parentAsset: 'commercial_aircraft',
    label: 'ADS-B Out Transponder',
    operational: {
      title: 'Surveillance Broadcast Transmitter',
      category: 'RF · Cooperative Surveillance',
      description:
        'Mode S transponders emit position, velocity, and identity at 1090 MHz for ground and airborne receivers. ' +
        'Extended squitter frames integrate with TCAS and surface movement maps for separation assurance.',
    },
    attack: {
      title: 'Ghost Target & Identity Spoofing',
      category: 'Threat Vector · RF Spoofing',
      description:
        'SDR-based transmitters can forge ICAO addresses and positions without a physical aircraft present. Fusion engines ' +
        'that overweight ADS-B over primary radar may clear traffic against phantom targets.',
    },
  },
  mesh_radar_feed: {
    id: 'mesh_radar_feed',
    parentAsset: 'atc_tower',
    label: 'Radar Surveillance Feed',
    operational: {
      title: 'Primary/Secondary Radar Fusion',
      category: 'ATC · Sensor Fusion',
      description:
        'Tower automation ingests SSR replies and primary skin paints, de-duplicating tracks before presenting controllers ' +
        'with conflict probes and arrival sequencing advisories.',
    },
    attack: {
      title: 'Track Poisoning & Replay Attacks',
      category: 'Threat Vector · Surveillance',
      description:
        'Replayed radar packets or injected track updates can desynchronize the traffic picture across sectors, ' +
        'causing unnecessary go-arounds or masking real runway incursions.',
    },
  },
  mesh_apu_controller: {
    id: 'mesh_apu_controller',
    parentAsset: 'commercial_aircraft',
    label: 'APU Controller Unit',
    operational: {
      title: 'Auxiliary Power Management',
      category: 'Power · Engine Systems',
      description:
        'The APU controller manages bleed air, electrical bus ties, and start sequences while the main engines are offline. ' +
        'Health monitoring publishes vibration and EGT trends to airline maintenance operations centers.',
    },
    attack: {
      title: 'Firmware Implant & Start Interlock Bypass',
      category: 'Threat Vector · Embedded Control',
      description:
        'Compromised APU controller firmware can delay fire-detection annunciation or permit start attempts with open ' +
        'doors, creating ramp hazards during single-engine taxi procedures.',
    },
  },
};

export function isSubsystemId(id) {
  return id != null && id in SUBSYSTEM_CONCEPTS;
}

export function getParentAssetId(id) {
  if (isSubsystemId(id)) return SUBSYSTEM_CONCEPTS[id].parentAsset;
  return id;
}

export function getSubsystemConcept(id, mode = SIMULATION_MODES.OPERATIONAL) {
  const entry = SUBSYSTEM_CONCEPTS[id];
  if (!entry) return null;
  const payload = mode === SIMULATION_MODES.ATTACK ? entry.attack : entry.operational;
  return {
    id: entry.id,
    parentAsset: entry.parentAsset,
    label: entry.label,
    title: payload.title,
    category: payload.category,
    description: payload.description,
    isSubsystem: true,
    showTelemetryChart: entry.showTelemetryChart ?? false,
    simulationMode: mode,
  };
}
