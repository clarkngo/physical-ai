import * as THREE from 'three';
import { makePhysicalMaterial } from './pbrMaterials.js';
import { HUMAN_THREAT_ACTORS } from './threatProfiles.js';

const CART_SPEED = 0.28;
const PEDESTRIAN_SPEED = 0.3;

function buildBaggageCart() {
  const group = new THREE.Group();
  group.userData.decorative = true;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.35, 0.55),
    makePhysicalMaterial(0xf97316, { metalness: 0.3, roughness: 0.6 }),
  );
  body.position.y = 0.25;
  body.castShadow = true;
  group.add(body);
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
    new THREE.ConeGeometry(3.2, 0.04, 32, 1, true, 0, Math.PI / 3),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  sweep.rotation.x = -Math.PI / 2;
  sweep.userData.decorative = true;
  return sweep;
}

export const ROOT_GROUP_TO_ASSET = {
  aircraft_group: 'commercial_aircraft',
  atc_tower_group: 'atc_tower',
  jet_bridge_group: 'jet_bridge',
  fuel_hydrant_group: 'fuel_hydrant',
  baggage_loader_group: 'baggage_loader',
  ground_radar_group: 'ground_radar',
  hangar_group: 'maintenance_hangar',
  pushback_tug_group: 'pushback_tug',
};

export const PEDESTRIAN_PATHS = [
  { axis: 'x', min: -8, max: -3, z: 4, speed: 0.4 },
  { axis: 'x', min: 3, max: 8, z: 3, speed: 0.38 },
  { axis: 'z', min: 0, max: 6, x: -6, speed: 0.36 },
  { axis: 'z', min: 1, max: 7, x: 4, speed: 0.42 },
  { axis: 'x', min: -12, max: -7, z: -2, speed: 0.35 },
];

function buildStaticColliders(interactiveGroupMap) {
  const colliders = [];
  const tempBox = new THREE.Box3();
  Object.keys(interactiveGroupMap).forEach((key) => {
    const group = interactiveGroupMap[key];
    if (!group) return;
    group.updateWorldMatrix(true, true);
    tempBox.setFromObject(group);
    tempBox.min.y = 0;
    tempBox.max.y = Math.max(tempBox.max.y, 2.5);
    tempBox.expandByScalar(key === 'commercial_aircraft' ? 0.6 : 0.35);
    colliders.push({ box: tempBox.clone(), id: key });
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
    if (Math.hypot(x - closestX, z - closestZ) < radius) return true;
  }
  return false;
}

function advanceAlongLane(agent, delta, radius, colliders) {
  const laneMin = Math.min(agent.min, agent.max);
  const laneMax = Math.max(agent.min, agent.max);
  const step = agent.speed * delta * agent.direction;
  let nextPos = agent.position + step;
  if (nextPos < laneMin) { nextPos = laneMin; agent.direction = 1; }
  else if (nextPos > laneMax) { nextPos = laneMax; agent.direction = -1; }
  const probe = { ...agent, position: nextPos };
  const { x, z } = worldXZ(probe);
  if (overlapsCollider(x, z, radius, colliders)) {
    agent.direction *= -1;
    return;
  }
  agent.position = nextPos;
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

export function addSceneLife(scene, interactiveGroupMap) {
  const aircraftGroup = interactiveGroupMap.commercial_aircraft;
  const towerGroup = interactiveGroupMap.atc_tower;
  const staticColliders = buildStaticColliders(interactiveGroupMap);

  const aircraftBase = {
    y: aircraftGroup?.position.y ?? 0,
    rotZ: aircraftGroup?.rotation.z ?? 0,
  };

  const cartRoutes = [
    { axis: 'x', min: -10, max: -4, laneCoord: 1.5, speed: CART_SPEED, direction: 1 },
    { axis: 'z', min: 2, max: 8, laneCoord: 7, speed: CART_SPEED * 0.9, direction: -1 },
    { axis: 'x', min: 4, max: 10, laneCoord: 2.5, speed: CART_SPEED * 0.85, direction: -1 },
  ];

  const carts = cartRoutes.map((route) => {
    const cart = buildBaggageCart();
    cart.position.set(
      route.axis === 'x' ? route.min : route.laneCoord,
      0,
      route.axis === 'z' ? route.min : route.laneCoord,
    );
    scene.add(cart);
    return { mesh: cart, position: route.min, laneCoord: route.laneCoord, ...route };
  });

  const radarSweep = createRadarSweep();
  radarSweep.position.set(0, 7.85, 1.2);
  if (towerGroup) towerGroup.add(radarSweep);
  else scene.add(radarSweep);

  const rolePedestrians = HUMAN_THREAT_ACTORS.map((role, i) => {
    const path = PEDESTRIAN_PATHS[i];
    const figure = buildPedestrian(role.bodyColor, role.headColor, role.id);
    const laneCoord = path.axis === 'x' ? path.z : path.x;
    figure.position.set(path.axis === 'x' ? path.min : laneCoord, 0.06, path.axis === 'z' ? path.min : laneCoord);
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

  const genericPedestrians = PEDESTRIAN_PATHS.slice(HUMAN_THREAT_ACTORS.length).map((path) => {
    const figure = buildPedestrian(0x475569, 0xfde68a);
    const laneCoord = path.axis === 'x' ? path.z : path.x;
    figure.position.set(path.axis === 'x' ? path.min : laneCoord, 0.06, path.axis === 'z' ? path.min : laneCoord);
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

  return {
    update(elapsed, delta) {
      const t = elapsed * 1000;
      const dt = Math.min(delta ?? 0.016, 0.05);

      if (aircraftGroup) {
        aircraftGroup.position.y = aircraftBase.y + Math.sin(t * 0.0004) * 0.02;
        aircraftGroup.rotation.z = aircraftBase.rotZ + Math.sin(t * 0.0003) * 0.004;
      }

      carts.forEach((cart) => {
        advanceAlongLane(cart, dt, 0.45, staticColliders);
        const { x, z } = worldXZ(cart);
        cart.mesh.position.set(x, 0, z);
      });

      pedestrians.forEach((ped) => {
        advanceAlongLane(ped, dt, 0.22, staticColliders);
        applyPedestrianTransform(ped);
      });

      radarSweep.rotation.z = elapsed * 1.0;
    },
  };
}

export function resolvePickFromHit(hitObject, isSubsystemIdFn) {
  let node = hitObject;
  while (node) {
    if (node.userData?.subsystemId) return { id: node.userData.subsystemId, mesh: hitObject };
    if (isSubsystemIdFn(node.name)) return { id: node.name, mesh: hitObject };
    node = node.parent;
  }
  node = hitObject;
  while (node) {
    if (ROOT_GROUP_TO_ASSET[node.name]) return { id: ROOT_GROUP_TO_ASSET[node.name], mesh: hitObject };
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
