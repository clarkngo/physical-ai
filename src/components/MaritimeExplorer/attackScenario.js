export const CRANE_RANSOMWARE_SCENARIO = {
  id: 'crane_ransomware',
  title: 'Ransomware / Command Injection on Gantry Crane PLCs',
  targetAsset: 'gantry_crane',
  alert: 'CRITICAL: Unauthorized PLC Trajectory Manipulation Detected.',
  resolvedMessage: 'Incident mitigated — crane returned to safe state.',
  mitigationSteps: [
    {
      id: 'isolate',
      label: 'Isolate Network Traffic',
      detail: 'Cut off the IT-to-OT network bridge and stop malicious packet injection.',
    },
    {
      id: 'firmware',
      label: 'Deploy Backup Firmware Images',
      detail: 'Restore known-good PLC controller configuration from signed image store.',
    },
    {
      id: 'failsafe',
      label: 'Fail-to-Safe Actuation',
      detail: 'Engage emergency mechanical brakes and halt crane motion immediately.',
    },
  ],
  hardeningStrategies: [
    {
      title: 'Network Segmentation',
      detail:
        'Implement a Zero-Trust industrial DMZ between logistics databases and physical fieldbus control networks.',
    },
    {
      title: 'Cryptographic Authentication',
      detail:
        'Enforce signed firmware verification validation algorithms directly at the hardware layer for all PLCs and RTUs.',
    },
    {
      title: 'Continuous Monitoring',
      detail:
        'Deploy an Industrial IDS to flag anomalous protocol behaviors (unexpected Modbus/TCP or EtherNet/IP write functions).',
    },
  ],
};

export const GPS_SPOOFING_SCENARIO = {
  id: 'gps_spoofing',
  title: 'GPS Spoofing on Automated Straddle Carriers',
  targetAsset: 'straddle_carrier',
  alert: 'CRITICAL: GNSS Coordinate Spoofing Detected — Yard Position Drift Active.',
  resolvedMessage: 'Incident mitigated — straddle carriers returned to verified grid positions.',
  mitigationSteps: [
    {
      id: 'anti_spoof',
      label: 'Enable GNSS Anti-Spoofing Filter',
      detail: 'Activate multi-constellation cross-check and reject anomalous ephemeris updates.',
    },
    {
      id: 'lidar_fallback',
      label: 'Switch to Lidar Yard Grid',
      detail: 'Fall back to fixed yard laser beacons for sub-meter slot positioning.',
    },
    {
      id: 'halt_carriers',
      label: 'Halt Straddle Carrier Fleet',
      detail: 'Issue fleet-wide stop commands and lock containers in place until positions validate.',
    },
  ],
  hardeningStrategies: [
    {
      title: 'Multi-Sensor Fusion',
      detail:
        'Cross-validate GNSS fixes with wheel odometry, UWB yard beacons, and IMU dead-reckoning before actuation.',
    },
    {
      title: 'Signed Navigation Feeds',
      detail:
        'Require authenticated RTCM corrections and reject unsigned or replayed differential GPS messages.',
    },
    {
      title: 'Geofenced Motion Limits',
      detail:
        'Enforce hard geofence boundaries so spoofed coordinates cannot drive carriers outside verified lane corridors.',
    },
  ],
};

export const ATTACK_SCENARIOS = [CRANE_RANSOMWARE_SCENARIO, GPS_SPOOFING_SCENARIO];

export const DEFAULT_ATTACK_SCENARIO_ID = CRANE_RANSOMWARE_SCENARIO.id;

export function getScenarioById(scenarioId) {
  return ATTACK_SCENARIOS.find(({ id }) => id === scenarioId) ?? CRANE_RANSOMWARE_SCENARIO;
}

export function getInitialIncidentSteps(scenario = CRANE_RANSOMWARE_SCENARIO) {
  return Object.fromEntries(scenario.mitigationSteps.map(({ id }) => [id, false]));
}

export const INITIAL_INCIDENT_STEPS = getInitialIncidentSteps(CRANE_RANSOMWARE_SCENARIO);

export function isIncidentResolved(steps, scenario = CRANE_RANSOMWARE_SCENARIO) {
  return scenario.mitigationSteps.every(({ id }) => steps[id]);
}
