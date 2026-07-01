export const SIMULATION_MODES = {
  OPERATIONAL: 'OPERATIONAL',
  ATTACK: 'ATTACK',
};

export const SUBSYSTEM_IDS = [
  'mesh_hull_sensor',
  'mesh_satellite_uplink',
  'mesh_lidar_scanner',
  'mesh_plc_actuator',
];

export const SUBSYSTEM_CONCEPTS = {
  mesh_hull_sensor: {
    id: 'mesh_hull_sensor',
    parentAsset: 'ship_hull',
    label: 'IoT Strain Gauges',
    showTelemetryChart: true,
    operational: {
      title: 'Sensor Telemetry Stream',
      category: 'Structural Sensing · OT',
      description:
        'Fiber-optic and resistive strain gauges bonded to the hull shell sample micro-deformation at 250 Hz. ' +
        'Edge gateways timestamp, compress, and publish readings to the digital twin bus where fatigue models ' +
        'compare live stress against design S-N curves and trigger maintenance tickets when cumulative damage exceeds thresholds.',
    },
    attack: {
      title: 'Telemetry Spoofing & Sensor Blindness',
      category: 'Threat Vector · Sensor Layer',
      description:
        'An adversary with VLAN access replays historical “healthy” strain packets while physical overload continues, ' +
        'or floods the gateway with forged MQTT frames to desynchronize twin state. Without signed sensor attestation ' +
        'and rate-anomaly detection, operators see green dashboards while micro-cracks propagate undetected.',
    },
  },
  mesh_satellite_uplink: {
    id: 'mesh_satellite_uplink',
    parentAsset: 'ship_hull',
    label: 'Satellite Uplink Array',
    operational: {
      title: 'Edge-to-Cloud Telemetry Path',
      category: 'Connectivity · IT/OT Bridge',
      description:
        'Ku-band and LEO satellite terminals batch-compress hull telemetry when shore LTE is unavailable. ' +
        'Store-and-forward queues on the edge router prioritize safety-critical alarms, while lower-priority analytics ' +
        'sync opportunistically to cloud object storage for fleet-wide benchmarking.',
    },
    attack: {
      title: 'Uplink Interception & Downlink Poisoning',
      category: 'Threat Vector · Communications',
      description:
        'RF jamming can force failover to degraded modes while a rogue ground segment injects malicious ephemeris data. ' +
        'Man-in-the-middle proxies on the IT side may alter fleet analytics feeds, hiding coordinated attacks across ' +
        'multiple vessels until AIS and satellite tracks diverge.',
    },
  },
  mesh_lidar_scanner: {
    id: 'mesh_lidar_scanner',
    parentAsset: 'gantry_crane',
    label: 'LiDAR Vision Scanner',
    operational: {
      title: 'Computer Vision Input Stack',
      category: 'Perception · Edge AI',
      description:
        'Dual 905 nm LiDAR units fused with RGB cameras produce a dense point cloud of container corners and twist-lock ' +
        'geometry. An onboard TensorRT pipeline segments obstacles, estimates spreader alignment error, and feeds ' +
        'closed-loop corrections to the motion planner within 120 ms per gantry cycle.',
    },
    attack: {
      title: 'Adversarial Perception Bypass',
      category: 'Threat Vector · AI/ML',
      description:
        'Crafted retro-reflective patches or synchronized laser interference can shift bounding boxes by centimeters—enough ' +
        'to mis-seat containers without triggering coarse safety limits. Supply-chain compromise of the inference container ' +
        'could swap model weights to ignore human presence zones during night shifts.',
    },
  },
  mesh_plc_actuator: {
    id: 'mesh_plc_actuator',
    parentAsset: 'gantry_crane',
    label: 'PLC Motion Actuator',
    operational: {
      title: 'Industrial Automation Execution',
      category: 'Control · OT Safety',
      description:
        'A SIL-rated PLC receives validated setpoints from the crane SCADA layer and drives VFDs on hoist, trolley, and ' +
        'gantry drives. Hardwired E-stops and torque limits sit below the network stack so no software command can exceed ' +
        'certified load charts without physical relay intervention.',
    },
    attack: {
      title: 'PLC Firmware Tampering & Command Injection',
      category: 'Threat Vector · OT Control',
      description:
        'Stuxnet-class threats target ladder logic uploads via engineering workstations left on the OT VLAN. Unauthorized ' +
        'Modbus write frames can nudge hoist encoders or disable interlocks if authentication is absent. Firmware implants ' +
        'may delay E-stop response by milliseconds—sufficient for dropped loads during peak throughput.',
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
