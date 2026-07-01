import * as THREE from 'three';
import { makePhysicalMaterial } from './pbrMaterials.js';
import { HUMAN_THREAT_ACTORS } from './threatProfiles.js';

const TRUCK_COLORS = [0x00a3e0, 0xf97316, 0xfbbf24, 0x22c55e, 0x6366f1];

const PEDESTRIAN_SPEED = 0.32;
const TRUCK_SPEED = 0.26;
const VESSEL_BOB_FREQ = 0.00042;
const VESSEL_BOB_AMP = 0.035;
const VESSEL_ROLL_FREQ_X = 0.00032;
const VESSEL_ROLL_FREQ_Z = 0.00028;
const VESSEL_ROLL_AMP_X = 0.008;
const VESSEL_ROLL_AMP_Z = 0.005;
const PEDESTRIAN_RADIUS = 0.22;
const TRUCK_RADIUS = 0.55;
const LANE_HALF_WIDTH = 0.45;

function buildDeliveryTruck(color) {
  const group = new THREE.Group();
  group.userData.decorative = true;

  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.45, 0.5),
    makePhysicalMaterial(color, { metalness: 0.35, roughness: 0.55 }),
  );
  cab.position.set(0, 0.28, 0.25);
  cab.castShadow = true;
  group.add(cab);

  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.35, 0.55),
    makePhysicalMaterial(0x334155, { metalness: 0.3, roughness: 0.65 }),
  );
  bed.position.set(0, 0.24, -0.35);
  bed.castShadow = true;
  group.add(bed);

  [[0x0284c7, -0.15], [0xdc2626, 0], [0xeab308, 0.15]].forEach(([boxColor, z], i) => {
    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.28, 0.28),
      makePhysicalMaterial(boxColor, { metalness: 0.25, roughness: 0.6 }),
    );
    cargo.position.set(0, 0.52 + (i % 2) * 0.26, -0.35 + z);
    cargo.castShadow = true;
    group.add(cargo);
  });

  const wheelGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10);
  const wheelMat = makePhysicalMaterial(0x111827, { metalness: 0.2, roughness: 0.85 });
  [[0.28, 0.32], [0.28, -0.32], [-0.28, 0.32], [-0.28, -0.32]].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat.clone());
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.1, z);
    group.add(wheel);
  });

  return group;
}

function buildPedestrian(bodyColor, headColor, roleId = null) {
  const group = new THREE.Group();
  group.userData.decorative = true;
  if (roleId) group.userData.threatRoleId = roleId;

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.13, 0.52, 8),
    makePhysicalMaterial(bodyColor, { metalness: 0.15, roughness: 0.65 }),
  );
  body.position.y = 0.36;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    makePhysicalMaterial(headColor, { metalness: 0.1, roughness: 0.7 }),
  );
  head.position.y = 0.68;
  head.castShadow = true;
  group.add(head);

  return group;
}

function createRadarSweep() {
  const sweep = new THREE.Mesh(
    new THREE.ConeGeometry(2.8, 0.04, 32, 1, true, 0, Math.PI / 3),
    new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  sweep.rotation.x = -Math.PI / 2;
  sweep.userData.decorative = true;
  return sweep;
}

function buildStaticColliders(interactiveGroupMap) {
  const colliders = [];
  const tempBox = new THREE.Box3();

  const assetKeys = [
    'gantry_crane',
    'control_tower',
    'dock_gate',
    'power_substation',
    'ship_hull',
    'straddle_carrier',
    'power_hub',
  ];
  assetKeys.forEach((key) => {
    const group = interactiveGroupMap[key];
    if (!group) return;
    group.updateWorldMatrix(true, true);
    tempBox.setFromObject(group);
    tempBox.min.y = 0;
    tempBox.max.y = Math.max(tempBox.max.y, 2.5);
    const padding = key === 'ship_hull' ? 0.5 : 0.35;
    tempBox.expandByScalar(padding);
    colliders.push({ box: tempBox.clone(), id: key });
  });

  colliders.push({
    box: new THREE.Box3(
      new THREE.Vector3(-16.5, 0, -10.2),
      new THREE.Vector3(16.5, 2, -8.6),
    ),
    id: 'north_barrier',
  });
  colliders.push({
    box: new THREE.Box3(
      new THREE.Vector3(-16.8, 0, -10),
      new THREE.Vector3(-14.8, 2, 4),
    ),
    id: 'west_barrier',
  });
  colliders.push({
    box: new THREE.Box3(
      new THREE.Vector3(14.8, 0, -10),
      new THREE.Vector3(16.8, 2, 4),
    ),
    id: 'east_barrier',
  });

  return colliders;
}

function worldXZ(agent) {
  return agent.axis === 'x'
    ? { x: agent.position, z: agent.laneCoord }
    : { x: agent.laneCoord, z: agent.position };
}

function overlapsCollider(x, z, radius, colliders) {
  for (const { box } of colliders) {
    const closestX = THREE.MathUtils.clamp(x, box.min.x, box.max.x);
    const closestZ = THREE.MathUtils.clamp(z, box.min.z, box.max.z);
    if (Math.hypot(x - closestX, z - closestZ) < radius) {
      return true;
    }
  }
  return false;
}

function applyPedestrianTransform(agent) {
  const { x, z } = worldXZ(agent);
  agent.mesh.position.set(x, 0.06, z);
  const forward = agent.direction > 0;
  if (agent.axis === 'x') {
    const baseRot = agent.max >= agent.min ? 0 : Math.PI;
    agent.mesh.rotation.y = forward ? baseRot : baseRot + Math.PI;
  } else {
    const baseRot = agent.max >= agent.min ? Math.PI / 2 : -Math.PI / 2;
    agent.mesh.rotation.y = forward ? baseRot : baseRot + Math.PI;
  }
}

function applyTruckTransform(agent) {
  const { x, z } = worldXZ(agent);
  agent.mesh.position.set(x, 0, z);
  const forward = agent.direction > 0;
  if (agent.axis === 'x') {
    const baseRot = agent.end >= agent.start ? 0 : Math.PI;
    agent.mesh.rotation.y = forward ? baseRot : baseRot + Math.PI;
  } else {
    const baseRot = agent.end >= agent.start ? Math.PI / 2 : -Math.PI / 2;
    agent.mesh.rotation.y = forward ? baseRot : baseRot + Math.PI;
  }
}

function advanceAlongLane(agent, delta, radius, colliders, clampLane = false) {
  const laneMin = Math.min(agent.start ?? agent.min, agent.end ?? agent.max);
  const laneMax = Math.max(agent.start ?? agent.min, agent.end ?? agent.max);
  const step = agent.speed * delta * agent.direction;
  let nextPos = agent.position + step;

  if (nextPos < laneMin) {
    nextPos = laneMin;
    agent.direction = 1;
  } else if (nextPos > laneMax) {
    nextPos = laneMax;
    agent.direction = -1;
  }

  const probe = { ...agent, position: nextPos };
  const { x, z } = worldXZ(probe);

  if (clampLane) {
    const laneCoord = agent.laneCoord;
    if (agent.axis === 'x' && Math.abs(z - laneCoord) > LANE_HALF_WIDTH) {
      agent.direction *= -1;
      return;
    }
    if (agent.axis === 'z' && Math.abs(x - laneCoord) > LANE_HALF_WIDTH) {
      agent.direction *= -1;
      return;
    }
  }

  if (overlapsCollider(x, z, radius, colliders)) {
    agent.direction *= -1;
    return;
  }

  agent.position = nextPos;
}

export function addSceneLife(scene, interactiveGroupMap) {
  const vesselGroup = interactiveGroupMap.ship_hull;
  const towerGroup = interactiveGroupMap.control_tower;
  const staticColliders = buildStaticColliders(interactiveGroupMap);

  const vesselBase = {
    y: vesselGroup.position.y,
    rotX: vesselGroup.rotation.x,
    rotZ: vesselGroup.rotation.z,
  };

  const truckRoutes = [
    { axis: 'x', start: -14, end: -6, laneCoord: -5.8, speed: TRUCK_SPEED, direction: 1 },
    { axis: 'x', start: 14, end: 6, laneCoord: -4.6, speed: TRUCK_SPEED * 0.92, direction: -1 },
    { axis: 'z', start: -6, end: 4, laneCoord: -11, speed: TRUCK_SPEED * 0.88, direction: 1 },
    { axis: 'z', start: 5, end: -5, laneCoord: 11.5, speed: TRUCK_SPEED * 0.85, direction: -1 },
    { axis: 'x', start: -12, end: -7, laneCoord: 1.2, speed: TRUCK_SPEED * 0.95, direction: 1 },
  ];

  const trucks = truckRoutes.map((route, i) => {
    const truck = buildDeliveryTruck(TRUCK_COLORS[i % TRUCK_COLORS.length]);
    const startPos = route.axis === 'x' ? route.start : route.start;
    truck.position.set(
      route.axis === 'x' ? startPos : route.laneCoord,
      0,
      route.axis === 'z' ? startPos : route.laneCoord,
    );
    scene.add(truck);
    return {
      mesh: truck,
      position: startPos,
      ...route,
    };
  });

  const radarSweep = createRadarSweep();
  radarSweep.position.set(0, 7.2, 0);
  if (towerGroup) {
    towerGroup.add(radarSweep);
  } else {
    scene.add(radarSweep);
  }

  const pedestrianColors = [
    [0x475569, 0xfde68a],
    [0x4b5563, 0xf97316],
    [0x64748b, 0xe2e8f0],
    [0x374151, 0xfbbf24],
    [0x334155, 0xffedd5],
  ];

  const rolePedestrians = HUMAN_THREAT_ACTORS.map((role, i) => {
    const path = PEDESTRIAN_PATHS[i];
    const figure = buildPedestrian(role.bodyColor, role.headColor, role.id);
    const laneCoord = path.axis === 'x' ? path.z : path.x;
    figure.position.set(
      path.axis === 'x' ? path.min : laneCoord,
      0.06,
      path.axis === 'z' ? path.min : laneCoord,
    );
    scene.add(figure);
    return {
      mesh: figure,
      roleId: role.id,
      position: path.min,
      laneCoord,
      direction: 1,
      speed: path.speed * PEDESTRIAN_SPEED,
      ...path,
    };
  });

  const genericPedestrians = PEDESTRIAN_PATHS.slice(HUMAN_THREAT_ACTORS.length).map((path, i) => {
    const [body, head] = pedestrianColors[i % pedestrianColors.length];
    const figure = buildPedestrian(body, head);
    const laneCoord = path.axis === 'x' ? path.z : path.x;
    figure.position.set(
      path.axis === 'x' ? path.min : laneCoord,
      0.06,
      path.axis === 'z' ? path.min : laneCoord,
    );
    scene.add(figure);
    return {
      mesh: figure,
      position: path.min,
      laneCoord,
      direction: 1,
      speed: path.speed * PEDESTRIAN_SPEED,
      ...path,
    };
  });

  const pedestrians = [...rolePedestrians, ...genericPedestrians];

  pedestrians.forEach(applyPedestrianTransform);
  trucks.forEach(applyTruckTransform);

  return {
    update(elapsed, delta) {
      const t = elapsed * 1000;
      const dt = Math.min(delta ?? 0.016, 0.05);

      if (vesselGroup) {
        vesselGroup.position.y = vesselBase.y + Math.sin(t * VESSEL_BOB_FREQ) * VESSEL_BOB_AMP;
        vesselGroup.rotation.x = vesselBase.rotX + Math.sin(t * VESSEL_ROLL_FREQ_X) * VESSEL_ROLL_AMP_X;
        vesselGroup.rotation.z = vesselBase.rotZ + Math.cos(t * VESSEL_ROLL_FREQ_Z) * VESSEL_ROLL_AMP_Z;
      }

      trucks.forEach((truck) => {
        advanceAlongLane(truck, dt, TRUCK_RADIUS, staticColliders, true);
        applyTruckTransform(truck);
      });

      pedestrians.forEach((ped) => {
        advanceAlongLane(ped, dt, PEDESTRIAN_RADIUS, staticColliders, false);
        applyPedestrianTransform(ped);
      });

      radarSweep.rotation.z = elapsed * 1.1;
    },
  };
}

export const ROOT_GROUP_TO_ASSET = {
  vessel_group: 'ship_hull',
  crane_group: 'gantry_crane',
  control_tower_group: 'control_tower',
  dock_gate_group: 'dock_gate',
  substation_group: 'power_substation',
  charging_pad_group: 'charging_pad',
  straddle_carrier_group: 'straddle_carrier',
  power_hub_group: 'power_hub',
};

export const PEDESTRIAN_PATHS = [
  { axis: 'x', min: -13.5, max: -8.5, z: 2.4, speed: 0.45 },
  { axis: 'x', min: 8.5, max: 13.5, z: 2.4, speed: 0.4 },
  { axis: 'z', min: -8, max: 2, x: -15, speed: 0.38 },
  { axis: 'z', min: -8, max: 2, x: 15, speed: 0.42 },
  { axis: 'x', min: -14, max: -6, z: -9, speed: 0.36 },
  { axis: 'z', min: -6, max: 1, x: -10.5, speed: 0.44 },
  { axis: 'x', min: 6, max: 12, z: -9, speed: 0.4 },
  { axis: 'z', min: -5, max: 2, x: 10, speed: 0.37 },
];

export function resolvePickFromHit(hitObject, isSubsystemIdFn) {
  let node = hitObject;
  while (node) {
    if (node.userData?.subsystemId) {
      return { id: node.userData.subsystemId, mesh: hitObject };
    }
    if (isSubsystemIdFn(node.name)) {
      return { id: node.name, mesh: hitObject };
    }
    node = node.parent;
  }

  node = hitObject;
  while (node) {
    if (ROOT_GROUP_TO_ASSET[node.name]) {
      return { id: ROOT_GROUP_TO_ASSET[node.name], mesh: hitObject };
    }
    if (node.userData?.interactiveId && !node.userData?.isSubsystem) {
      return { id: node.userData.interactiveId, mesh: hitObject };
    }
    node = node.parent;
  }

  return { id: null, mesh: null };
}

export function isRaycastPickable(object) {
  if (!object?.isMesh) return false;
  if (object.userData?.decorative) return false;
  if (object.name === 'gradient_sky_dome') return false;

  let node = object;
  while (node) {
    if (node.userData?.interactiveId || node.userData?.subsystemId) return true;
    if (ROOT_GROUP_TO_ASSET[node.name]) return true;
    node = node.parent;
  }
  return false;
}
