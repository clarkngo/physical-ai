export const ADSB_GHOST_SCENARIO = {
  id: 'adsb_ghost',
  title: 'ADS-B Ghost Aircraft Injection',
  targetAsset: 'ground_radar',
  alert: 'CRITICAL: Spoofed ADS-B Targets Detected on Approach Corridor.',
  resolvedMessage: 'Incident mitigated — surveillance fusion restored to trusted radar primacy.',
  mitigationSteps: [
    {
      id: 'radar_primary',
      label: 'Elevate Primary Radar Authority',
      detail: 'Re-weight fusion to prioritize primary radar tracks over unauthenticated ADS-B.',
    },
    {
      id: 'mlat_verify',
      label: 'Cross-Check MLAT Ground Network',
      detail: 'Validate suspicious targets against multilateration receivers and surface cameras.',
    },
    {
      id: 'hold_traffic',
      label: 'Issue Holding Instructions',
      detail: 'Suspend automated sequencing until ghost tracks are cleared from the traffic picture.',
    },
  ],
  hardeningStrategies: [
    {
      title: 'Authenticated Surveillance',
      detail: 'Deploy 1090ES authentication (e.g., ADS-B v2 with signing) where available on airport infrastructure.',
    },
    {
      title: 'Sensor Fusion Diversity',
      detail: 'Require agreement across primary radar, MLAT, and ADS-B before auto-conflict probes activate.',
    },
    {
      title: 'Anomaly Detection',
      detail: 'Monitor for impossible turn rates, duplicate ICAO addresses, and ground-speed mismatches.',
    },
  ],
};

export const FMS_INJECTION_SCENARIO = {
  id: 'fms_injection',
  title: 'FMS Waypoint Manipulation',
  targetAsset: 'commercial_aircraft',
  alert: 'CRITICAL: Unauthorized Navigation Database Modification Detected.',
  resolvedMessage: 'Incident mitigated — FMS restored to signed nav database baseline.',
  mitigationSteps: [
    {
      id: 'isolate_bus',
      label: 'Isolate Avionics Dataload Bus',
      detail: 'Disconnect maintenance dataload ports and block unverified ARINC/AFDX traffic.',
    },
    {
      id: 'restore_db',
      label: 'Reload Signed Nav Database',
      detail: 'Flash known-good FMS database image from airline engineering vault.',
    },
    {
      id: 'manual_nav',
      label: 'Engage Manual Navigation Review',
      detail: 'Require crew waypoint verification before LNAV engagement.',
    },
  ],
  hardeningStrategies: [
    {
      title: 'Signed Nav Data',
      detail: 'Enforce cryptographic signatures on all FMS navigation database updates.',
    },
    {
      title: 'Dual-Unit Cross-Compare',
      detail: 'Alert on any divergence between independent FMS computed paths.',
    },
    {
      title: 'Maintenance Port Controls',
      detail: 'Physical port locks and authenticated dataload sessions for all MRO tooling.',
    },
  ],
};

export const ATTACK_SCENARIOS = [ADSB_GHOST_SCENARIO, FMS_INJECTION_SCENARIO];

export const DEFAULT_ATTACK_SCENARIO_ID = ADSB_GHOST_SCENARIO.id;

export function getScenarioById(scenarioId) {
  return ATTACK_SCENARIOS.find(({ id }) => id === scenarioId) ?? ADSB_GHOST_SCENARIO;
}

export function getInitialIncidentSteps(scenario = ADSB_GHOST_SCENARIO) {
  return Object.fromEntries(scenario.mitigationSteps.map(({ id }) => [id, false]));
}

export const INITIAL_INCIDENT_STEPS = getInitialIncidentSteps(ADSB_GHOST_SCENARIO);

export function isIncidentResolved(steps, scenario = ADSB_GHOST_SCENARIO) {
  return scenario.mitigationSteps.every(({ id }) => steps[id]);
}
