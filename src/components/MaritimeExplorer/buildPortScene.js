import * as THREE from 'three';
import {
  createHazardStripeTexture,
  makeHazardJointMaterial,
  makePhysicalMaterial,
} from './pbrMaterials.js';

// Digital-twin palette
const COLORS = {
  oceanDeep: 0x001a33,
  oceanMid: 0x003d66,
  slateDark: 0x1e293b,
  slateMid: 0x334155,
  slateLight: 0x475569,
  hull: 0x293548,
  concrete: 0x3d4f63,
  cyan: 0x00e5ff,
  cyanDim: 0x00a3e0,
  orange: 0xf97316,
  yellow: 0xfbbf24,
  gold: 0xeab308,
  white: 0xe2e8f0,
};

const BASE_EMISSIVE = 0x000000;
const HOVER_EMISSIVE = 0x0e7490;
const SELECT_EMISSIVE = 0x00e5ff;

function makeMaterial(color, options = {}) {
  return makePhysicalMaterial(color, options);
}

function collectMeshes(group) {
  const meshes = [];
  group.traverse((child) => {
    if (child.isMesh) meshes.push(child);
  });
  return meshes;
}

function tagInteractive(group, id, focusOffset = new THREE.Vector3(0, 1.8, 0)) {
  group.userData.interactiveId = id;
  group.userData.focusOffset = focusOffset;
  const meshes = collectMeshes(group);
  meshes.forEach((mesh) => {
    if (!mesh.userData.subsystemId) {
      mesh.userData.interactiveId = id;
    }
    if (mesh.material?.emissive) {
      mesh.userData.baseEmissive = BASE_EMISSIVE;
      mesh.userData.baseEmissiveIntensity = mesh.material.emissiveIntensity ?? 0.85;
    }
  });
  return { id, group, meshes, focusOffset };
}

function registerSubsystem(mesh, subsystemId, assetId, focusOffset) {
  mesh.name = subsystemId;
  mesh.userData.subsystemId = subsystemId;
  mesh.userData.interactiveId = assetId;
  mesh.userData.isSubsystem = true;
  if (focusOffset) mesh.userData.focusOffset = focusOffset;
  return mesh;
}

function addTrussMember(group, from, to, radius, material) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length < 0.01) return;

  const member = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 6), material);
  member.position.copy(start).add(end).multiplyScalar(0.5);
  member.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  member.castShadow = true;
  group.add(member);
}

function buildTrussLeg(group, x, z, paintMat) {
  const height = 5.2;
  const main = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, height, 6), paintMat.clone());
  main.position.set(x, height / 2, z);
  main.castShadow = true;
  group.add(main);

  for (let tier = 0; tier < 4; tier += 1) {
    const y = 0.9 + tier * 1.15;
    addTrussMember(group, [x - 0.28, y, z], [x + 0.28, y + 0.9, z], 0.045, paintMat);
    addTrussMember(group, [x + 0.28, y, z], [x - 0.28, y + 0.9, z], 0.045, paintMat);
  }
}

function buildGantryCrane() {
  const group = new THREE.Group();
  group.name = 'crane_group';
  const subsystemMeshes = [];
  const hazardStripeTexture = createHazardStripeTexture();
  const paintMat = makeMaterial(COLORS.yellow, { metalness: 0.35, roughness: 0.7 });
  const beamMat = makeMaterial(COLORS.gold, { metalness: 0.45, roughness: 0.7, clearcoat: 0.15 });

  [[-2.6, -1.8], [2.6, -1.8], [-2.6, 1.2], [2.6, 1.2]].forEach(([x, z]) => {
    buildTrussLeg(group, x, z, paintMat);

    const jointCollar = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.28, 0.42),
      makeHazardJointMaterial(hazardStripeTexture),
    );
    jointCollar.position.set(x, 0.22, z);
    jointCollar.castShadow = true;
    group.add(jointCollar);
  });

  const crossBeam = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 0.28, 0.28),
    makeHazardJointMaterial(hazardStripeTexture),
  );
  crossBeam.position.set(0, 5.2, -0.3);
  crossBeam.castShadow = true;
  group.add(crossBeam);

  for (let i = -2.8; i <= 2.8; i += 0.7) {
    addTrussMember(group, [i, 5.05, -0.3], [i, 5.35, -0.3], 0.035, paintMat);
  }

  const overheadBeam = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.48, 0.62), beamMat.clone());
  overheadBeam.position.set(0.6, 5.05, 2.2);
  overheadBeam.castShadow = true;
  group.add(overheadBeam);

  for (let i = -3; i <= 3.2; i += 0.65) {
    addTrussMember(group, [i, 5.32, 2.2], [i, 5.32, 2.55], 0.03, paintMat);
  }

  const rail = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.1, 0.16), makeMaterial(COLORS.slateLight, { roughness: 0.7 }));
  rail.position.set(0.6, 5.38, 2.2);
  group.add(rail);

  const lidarScanner = registerSubsystem(
    new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.35, 0.55),
      makeMaterial(COLORS.cyan, {
        metalness: 0.85,
        roughness: 0.12,
        emissive: 0x004455,
        emissiveIntensity: 0.55,
      }),
    ),
    'mesh_lidar_scanner',
    'gantry_crane',
    new THREE.Vector3(0, 0, 0),
  );
  lidarScanner.position.set(1.4, 4.92, 2.2);
  lidarScanner.castShadow = true;
  group.add(lidarScanner);
  subsystemMeshes.push(lidarScanner);

  const lidarLens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.08, 8),
    makeMaterial(COLORS.cyan, { emissive: 0x00e5ff, emissiveIntensity: 0.7, metalness: 0.9 }),
  );
  lidarLens.rotation.x = Math.PI / 2;
  lidarLens.position.set(1.4, 4.92, 2.48);
  group.add(lidarLens);

  const trolley = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.65, 0.85),
    makeMaterial(COLORS.slateLight, { metalness: 0.55, roughness: 0.35 }),
  );
  trolley.position.set(1.4, 4.55, 2.2);
  trolley.castShadow = true;
  group.add(trolley);

  const cableMat = makeMaterial(COLORS.slateLight, { metalness: 0.8, roughness: 0.25 });
  const cables = [];
  [-0.25, 0.25].forEach((x) => {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6), cableMat.clone());
    cable.position.set(1.4 + x, 3.85, 2.2);
    group.add(cable);
    cables.push(cable);
  });

  const spreader = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.55), makeMaterial(COLORS.white, { metalness: 0.6 }));
  spreader.position.set(1.4, 3.15, 2.2);
  group.add(spreader);

  group.userData.movingParts = { trolley, spreader, cables };

  const plcActuator = registerSubsystem(
    new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.75, 0.45),
      makeMaterial(COLORS.orange, {
        metalness: 0.5,
        roughness: 0.35,
        emissive: 0x331100,
        emissiveIntensity: 0.35,
      }),
    ),
    'mesh_plc_actuator',
    'gantry_crane',
    new THREE.Vector3(0, 0.4, 0),
  );
  plcActuator.position.set(-2.6, 0.38, -1.8);
  plcActuator.castShadow = true;
  group.add(plcActuator);
  subsystemMeshes.push(plcActuator);

  const containerColors = [COLORS.cyanDim, COLORS.orange, COLORS.cyanDim];
  containerColors.forEach((color, i) => {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.85, 0.85),
      makeMaterial(color, { metalness: 0.4, roughness: 0.5 }),
    );
    box.position.set(-1.5 + i * 0.15, 0.425, 0.8 - i * 0.1);
    box.castShadow = true;
    group.add(box);
  });

  group.position.set(-5, 0, -2);
  const tagged = tagInteractive(group, 'gantry_crane', new THREE.Vector3(0, 3.2, 1.5));
  return { ...tagged, subsystemMeshes };
}

function buildShipHull() {
  const group = new THREE.Group();
  group.name = 'vessel_group';
  const subsystemMeshes = [];
  const hullShellMat = makeMaterial(COLORS.hull, {
    metalness: 0.9,
    roughness: 0.15,
    clearcoat: 0.45,
    clearcoatRoughness: 0.06,
  });
  const hullInnerMat = makeMaterial(COLORS.slateMid, { metalness: 0.88, roughness: 0.18 });

  const outerHull = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.15, 2.5), hullShellMat.clone());
  outerHull.position.set(-0.3, 0.58, 0);
  outerHull.castShadow = true;
  group.add(outerHull);

  const innerHull = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.85, 2.1), hullInnerMat.clone());
  innerHull.position.set(-0.3, 0.72, 0);
  innerHull.castShadow = true;
  group.add(innerHull);

  const bow = new THREE.Mesh(
    new THREE.ConeGeometry(1.18, 2.45, 4),
    makeMaterial(COLORS.slateMid, { metalness: 0.9, roughness: 0.15, clearcoat: 0.35 }),
  );
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(4.2, 0.48, 0);
  bow.castShadow = true;
  group.add(bow);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(7.0, 0.14, 2.05),
    makeMaterial(COLORS.slateLight, { metalness: 0.55, roughness: 0.35 }),
  );
  deck.position.set(-0.5, 1.18, 0);
  deck.castShadow = true;
  group.add(deck);

  const keel = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.12, 0.35), makeMaterial(COLORS.slateDark, { metalness: 0.75 }));
  keel.position.set(-0.3, 0.12, 0);
  group.add(keel);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.07, 2.52), makeMaterial(COLORS.orange, { metalness: 0.35, roughness: 0.4 }));
  stripe.position.set(-0.3, 0.98, 0);
  group.add(stripe);

  const containerColors = [
    COLORS.cyanDim, COLORS.orange, COLORS.yellow, 0xdc2626,
    COLORS.cyanDim, COLORS.orange, COLORS.yellow, 0x2563eb,
    COLORS.cyanDim, COLORS.orange, COLORS.yellow, 0xdc2626,
  ];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const color = containerColors[row * 4 + col];
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.62, 0.72),
        makeMaterial(color, { metalness: 0.4, roughness: 0.55 }),
      );
      box.position.set(
        -3.05 + col * 0.78,
        1.48 + row * 0.66,
        -0.55 + (row % 2) * 0.38,
      );
      box.castShadow = true;
      group.add(box);
    }
  }

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.8, 0.95), makeMaterial(COLORS.slateDark, { metalness: 0.55, roughness: 0.35 }));
  bridge.position.set(-2.2, 1.62, 0.55);
  bridge.castShadow = true;
  group.add(bridge);

  const radarDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    makePhysicalMaterial(0xc8f0ff, {
      metalness: 0.05,
      roughness: 0.08,
      transmission: 0.72,
      opacity: 1,
      transparent: true,
      ior: 1.46,
      thickness: 0.55,
    }),
  );
  radarDome.position.set(-2.2, 2.05, 0.55);
  group.add(radarDome);

  const radarRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.025, 8, 24),
    makeMaterial(COLORS.cyanDim, { metalness: 0.85, roughness: 0.15, emissive: 0x003344, emissiveIntensity: 0.35 }),
  );
  radarRing.rotation.x = Math.PI / 2;
  radarRing.position.set(-2.2, 2.05, 0.55);
  group.add(radarRing);

  const hullSensor = registerSubsystem(
    new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.22, 1.4),
      makeMaterial(COLORS.cyan, {
        metalness: 0.85,
        roughness: 0.15,
        emissive: 0x004455,
        emissiveIntensity: 0.55,
      }),
    ),
    'mesh_hull_sensor',
    'ship_hull',
    new THREE.Vector3(0, 0, 0),
  );
  hullSensor.position.set(-0.2, 1.05, 1.22);
  hullSensor.castShadow = true;
  group.add(hullSensor);
  subsystemMeshes.push(hullSensor);

  [-0.5, 0, 0.5].forEach((z, i) => {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6),
      makeMaterial(COLORS.cyanDim, { emissive: 0x00e5ff, emissiveIntensity: 0.45 }),
    );
    pad.position.set(-0.2 + i * 0.15, 1.18, 1.22 + z * 0.25);
    group.add(pad);
  });

  const satelliteUplink = registerSubsystem(
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.12, 0.18, 8),
      makeMaterial(COLORS.slateLight, { metalness: 0.7, roughness: 0.25 }),
    ),
    'mesh_satellite_uplink',
    'ship_hull',
    new THREE.Vector3(0, 0.5, 0),
  );
  satelliteUplink.position.set(-2.2, 2.05, 0.55);
  satelliteUplink.castShadow = true;
  group.add(satelliteUplink);
  subsystemMeshes.push(satelliteUplink);

  const dish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.28, 0.12, 8),
    makeMaterial(COLORS.cyanDim, { emissive: 0x003344, emissiveIntensity: 0.5, metalness: 0.8 }),
  );
  dish.position.set(-2.2, 2.22, 0.55);
  group.add(dish);

  group.position.set(0, 0.08, 9.2);
  group.rotation.y = Math.PI;
  const tagged = tagInteractive(group, 'ship_hull', new THREE.Vector3(0, 1.6, 0));
  return { ...tagged, subsystemMeshes };
}

function buildControlTower() {
  const group = new THREE.Group();
  group.name = 'control_tower_group';

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.25, 0.4, 6),
    makeMaterial(COLORS.concrete, { metalness: 0.15, roughness: 0.85 }),
  );
  base.position.y = 0.2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.7, 5.8, 6),
    makeMaterial(COLORS.slateMid, { metalness: 0.35, roughness: 0.6 }),
  );
  shaft.position.y = 3.2;
  shaft.castShadow = true;
  group.add(shaft);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.95, 2.6),
    makePhysicalMaterial(0xb8ecff, {
      metalness: 0.05,
      roughness: 0.1,
      transmission: 0.6,
      opacity: 1,
      transparent: true,
      ior: 1.48,
      thickness: 0.85,
      emissive: 0x001a22,
      emissiveIntensity: 0.15,
    }),
  );
  deck.position.y = 6.35;
  deck.castShadow = true;
  group.add(deck);

  const frameGeo = new THREE.BoxGeometry(2.72, 1.05, 2.72);
  const frameEdges = new THREE.EdgesGeometry(frameGeo);
  const frameWire = new THREE.LineSegments(
    frameEdges,
    new THREE.LineBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.55 }),
  );
  frameWire.position.y = 6.35;
  group.add(frameWire);

  const antennaBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 0.25, 6),
    makeMaterial(COLORS.slateLight, { metalness: 0.6 }),
  );
  antennaBase.position.y = 6.95;
  group.add(antennaBase);

  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.4, 6),
    makeMaterial(COLORS.orange, { metalness: 0.7, roughness: 0.25 }),
  );
  antenna.position.y = 7.75;
  group.add(antenna);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    makeMaterial(COLORS.cyan, { emissive: 0x00e5ff, emissiveIntensity: 0.6, metalness: 0.5 }),
  );
  beacon.position.y = 8.55;
  group.add(beacon);

  const radar = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.06, 0.22),
    makeMaterial(COLORS.cyanDim, { metalness: 0.7, emissive: 0x003344, emissiveIntensity: 0.35 }),
  );
  radar.position.set(0, 6.85, 1.15);
  group.add(radar);

  group.position.set(0, 0, -6);
  return tagInteractive(group, 'control_tower', new THREE.Vector3(0, 4.5, 0));
}

function buildDockGate() {
  const group = new THREE.Group();
  group.name = 'dock_gate_group';
  const pillarMat = makeMaterial(COLORS.concrete, { metalness: 0.1, roughness: 0.88 });

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 4.2),
    makeMaterial(0x1a2332, { metalness: 0.05, roughness: 0.95 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.02;
  road.receiveShadow = true;
  group.add(road);

  const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.2, 0.55), pillarMat.clone());
  leftPillar.position.set(-1.85, 1.6, 0);
  leftPillar.castShadow = true;
  group.add(leftPillar);

  const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.2, 0.55), pillarMat.clone());
  rightPillar.position.set(1.85, 1.6, 0);
  rightPillar.castShadow = true;
  group.add(rightPillar);

  const capMat = makeMaterial(COLORS.slateLight, { metalness: 0.35, roughness: 0.55 });
  [-1.85, 1.85].forEach((x) => {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.7), capMat.clone());
    cap.position.set(x, 3.25, 0);
    group.add(cap);
  });

  const scannerHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.45, 0.45),
    makeMaterial(COLORS.slateDark, { metalness: 0.55 }),
  );
  scannerHousing.position.set(-1.85, 2.6, 0.35);
  group.add(scannerHousing);

  const scannerBeam = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.06, 0.06),
    makeMaterial(COLORS.cyan, {
      metalness: 0.85,
      roughness: 0.15,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.95,
    }),
  );
  scannerBeam.position.set(0, 2.35, 0);
  group.add(scannerBeam);

  const barrierPivot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8), capMat.clone());
  barrierPivot.position.set(-1.85, 2.1, 0);
  group.add(barrierPivot);

  const barrierArm = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.14, 0.14),
    makeMaterial(COLORS.orange, {
      metalness: 0.4,
      roughness: 0.35,
      emissive: 0x662200,
      emissiveIntensity: 0.45,
    }),
  );
  barrierArm.position.set(0, 2.1, 0);
  group.add(barrierArm);

  const stripeMat = makeMaterial(COLORS.yellow, { emissive: 0x443300, emissiveIntensity: 0.35 });
  for (let i = 0; i < 5; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.15, 0.16), stripeMat.clone());
    stripe.position.set(-1.4 + i * 0.7, 2.1, 0);
    group.add(stripe);
  }

  const otMarker = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.8),
    makeMaterial(0x0d9488, { transparent: true, opacity: 0.18, roughness: 0.9 }),
  );
  otMarker.rotation.x = -Math.PI / 2;
  otMarker.position.set(-3.2, 0.03, 0);
  group.add(otMarker);

  const itMarker = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.8),
    makeMaterial(0x2563eb, { transparent: true, opacity: 0.18, roughness: 0.9 }),
  );
  itMarker.rotation.x = -Math.PI / 2;
  itMarker.position.set(3.2, 0.03, 0);
  group.add(itMarker);

  group.position.set(5.8, 0, -0.8);
  return tagInteractive(group, 'dock_gate', new THREE.Vector3(0, 1.8, 0));
}

function buildPowerSubstation() {
  const group = new THREE.Group();
  group.name = 'substation_group';

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.25, 1.4),
    makeMaterial(COLORS.concrete, { metalness: 0.15, roughness: 0.85 }),
  );
  base.position.y = 0.125;
  base.castShadow = true;
  group.add(base);

  const cabinet = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.6, 1.0),
    makeMaterial(COLORS.slateMid, { metalness: 0.55, roughness: 0.4 }),
  );
  cabinet.position.y = 1.05;
  cabinet.castShadow = true;
  group.add(cabinet);

  const transformer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.4, 0.9, 6),
    makeMaterial(COLORS.yellow, { metalness: 0.45, roughness: 0.55 }),
  );
  transformer.position.set(0.55, 1.1, 0);
  transformer.castShadow = true;
  group.add(transformer);

  const warningSign = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.35, 0.04),
    makeMaterial(COLORS.orange, { emissive: 0x331100, emissiveIntensity: 0.35 }),
  );
  warningSign.position.set(-0.55, 1.4, 0.52);
  group.add(warningSign);

  [[0x00e5ff, -0.3], [0x00e5ff, 0], [0x00e5ff, 0.3]].forEach(([color, x], i) => {
    const indicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      makeMaterial(color, { emissive: 0x00e5ff, emissiveIntensity: 0.6, metalness: 0.8 }),
    );
    indicator.position.set(x, 1.75, 0.52);
    group.add(indicator);
  });

  group.position.set(-2.5, 0, -4.2);
  return tagInteractive(group, 'power_substation', new THREE.Vector3(0, 1.4, 0));
}

function buildChargingPad() {
  const group = new THREE.Group();
  group.name = 'charging_pad_group';

  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.08, 1.6),
    makeMaterial(0x374151, { metalness: 0.65, roughness: 0.35 }),
  );
  pad.position.y = 0.04;
  pad.receiveShadow = true;
  group.add(pad);

  const coil = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.06, 8, 24),
    makeMaterial(COLORS.cyanDim, { metalness: 0.85, roughness: 0.2, emissive: 0x003344, emissiveIntensity: 0.45 }),
  );
  coil.rotation.x = Math.PI / 2;
  coil.position.y = 0.1;
  group.add(coil);

  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.5, 0.25),
    makeMaterial(COLORS.cyan, { emissive: 0x00e5ff, emissiveIntensity: 0.35, metalness: 0.7 }),
  );
  marker.position.set(-0.75, 0.25, 0.75);
  marker.castShadow = true;
  group.add(marker);

  const statusLight = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.12, 8),
    makeMaterial(0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 0.55 }),
  );
  statusLight.position.set(0.65, 0.14, -0.65);
  group.add(statusLight);

  group.position.set(-10.5, 0, 1.8);
  return tagInteractive(group, 'charging_pad', new THREE.Vector3(0, 0.6, 0));
}

function buildStraddleCarrier() {
  const group = new THREE.Group();
  group.name = 'straddle_carrier_group';

  const legMat = makeMaterial(COLORS.yellow, { metalness: 0.4, roughness: 0.55 });
  [[-1.1, -0.55], [1.1, -0.55], [-1.1, 0.55], [1.1, 0.55]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.8, 0.28), legMat.clone());
    leg.position.set(x, 0.9, z);
    leg.castShadow = true;
    group.add(leg);
  });

  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.35, 1.6),
    makeMaterial(COLORS.slateMid, { metalness: 0.55, roughness: 0.4 }),
  );
  beam.position.y = 1.95;
  beam.castShadow = true;
  group.add(beam);

  const container = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.75, 0.85),
    makeMaterial(COLORS.cyanDim, { metalness: 0.35, roughness: 0.5 }),
  );
  container.position.set(0, 1.15, 0);
  container.castShadow = true;
  group.add(container);

  const gpsDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 8),
    makeMaterial(COLORS.cyan, { emissive: 0x003344, emissiveIntensity: 0.5, metalness: 0.8 }),
  );
  gpsDome.name = 'gps_dome';
  gpsDome.userData.gpsDome = true;
  gpsDome.position.set(0, 2.25, 0);
  group.add(gpsDome);

  group.position.set(9, 0, 4.5);
  return tagInteractive(group, 'straddle_carrier', new THREE.Vector3(0, 1.6, 0));
}

function buildPowerHub() {
  const group = new THREE.Group();
  group.name = 'power_hub_group';

  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.2, 2.0),
    makeMaterial(COLORS.concrete, { metalness: 0.12, roughness: 0.88 }),
  );
  pad.position.y = 0.1;
  pad.receiveShadow = true;
  group.add(pad);

  const cabinet = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 2.2, 1.2),
    makeMaterial(COLORS.slateDark, { metalness: 0.5, roughness: 0.45 }),
  );
  cabinet.position.y = 1.3;
  cabinet.castShadow = true;
  group.add(cabinet);

  const busBars = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 1.4, 1.0),
    makeMaterial(COLORS.gold, { metalness: 0.75, roughness: 0.25 }),
  );
  busBars.position.set(0.55, 1.35, 0);
  group.add(busBars);

  [[0x22c55e, -0.4], [0x00e5ff, 0], [0xfbbf24, 0.4]].forEach(([color, y], i) => {
    const indicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      makeMaterial(color, { emissive: color, emissiveIntensity: 0.55, metalness: 0.7 }),
    );
    indicator.position.set(0.92, 1.8 + y * 0.01, 0.35);
    group.add(indicator);
  });

  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6),
    makeMaterial(COLORS.slateLight, { metalness: 0.6 }),
  );
  antenna.position.set(-0.6, 2.6, 0);
  group.add(antenna);

  group.position.set(2.5, 0, 4.8);
  return tagInteractive(group, 'power_hub', new THREE.Vector3(0, 1.5, 0));
}

function buildEnvironment(scene) {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    makeMaterial(0x0b1d3a, {
      metalness: 0.85,
      roughness: 0.15,
    }),
  );
  water.name = 'harbor_water';
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.5;
  water.receiveShadow = true;
  scene.add(water);

  const dock = new THREE.Mesh(
    new THREE.PlaneGeometry(32, 20),
    makeMaterial(COLORS.slateDark, { metalness: 0.08, roughness: 0.92 }),
  );
  dock.rotation.x = -Math.PI / 2;
  dock.receiveShadow = true;
  scene.add(dock);

  const quay = new THREE.Mesh(
    new THREE.BoxGeometry(32, 0.35, 8),
    makeMaterial(COLORS.concrete, { metalness: 0.12, roughness: 0.88 }),
  );
  quay.position.set(0, 0.175, -4);
  quay.receiveShadow = true;
  quay.castShadow = true;
  scene.add(quay);

  const walkwayMat = makeMaterial(0x9ca3af, { metalness: 0.12, roughness: 0.82 });
  [
    { size: [32, 0.06, 1.4], pos: [0, 0.04, -9.2] },
    { size: [1.4, 0.06, 16], pos: [-15.2, 0.04, -1.5] },
    { size: [1.4, 0.06, 16], pos: [15.2, 0.04, -1.5] },
    { size: [22, 0.06, 1.4], pos: [-9, 0.04, 2.4] },
    { size: [14, 0.06, 1.4], pos: [10, 0.04, 2.4] },
  ].forEach(({ size, pos }) => {
    const walkway = new THREE.Mesh(new THREE.BoxGeometry(...size), walkwayMat.clone());
    walkway.position.set(...pos);
    walkway.receiveShadow = true;
    walkway.castShadow = true;
    scene.add(walkway);
  });

  const grid = new THREE.GridHelper(48, 48, 0x00f3ff, 0x1f2937);
  grid.position.y = 0.018;
  if (Array.isArray(grid.material)) {
    grid.material[0].transparent = true;
    grid.material[0].opacity = 0.28;
    grid.material[1].transparent = true;
    grid.material[1].opacity = 0.1;
  } else {
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
  }
  scene.add(grid);

  const fineGrid = new THREE.GridHelper(48, 96, 0x1f2937, 0x1f2937);
  fineGrid.position.y = 0.012;
  if (Array.isArray(fineGrid.material)) {
    fineGrid.material.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.06;
    });
  } else {
    fineGrid.material.transparent = true;
    fineGrid.material.opacity = 0.06;
  }
  scene.add(fineGrid);

  const bollardMat = makeMaterial(COLORS.slateLight, { metalness: 0.55, roughness: 0.45 });
  [[-8, 1.5], [8, 1.5], [-4, 2.5], [4, 2.5]].forEach(([x, z]) => {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.45, 6), bollardMat.clone());
    bollard.position.set(x, 0.225, z);
    bollard.castShadow = true;
    scene.add(bollard);
  });

  return {
    glitchGrids: [
      { grid, wobbleScale: 1 },
      { grid: fineGrid, wobbleScale: 0.65 },
    ],
  };
}

export function setObjectHighlight(meshes, state) {
  const emissive =
    state === 'selected' ? SELECT_EMISSIVE : state === 'hover' ? HOVER_EMISSIVE : BASE_EMISSIVE;
  const intensity = state === 'none' ? 0 : state === 'hover' ? 0.42 : 0.72;

  meshes.forEach((mesh) => {
    if (!mesh.material?.emissive) return;
    mesh.material.emissive.setHex(emissive);
    mesh.material.emissiveIntensity = intensity;
  });
}

export function getFocusPoint(target) {
  const world = new THREE.Vector3();
  const offset = target.userData?.focusOffset ?? new THREE.Vector3(0, 1.5, 0);
  target.updateWorldMatrix(true, false);
  world.copy(offset).applyMatrix4(target.matrixWorld);
  return world;
}

export function buildPortScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#0d1117', 0.015);

  const { glitchGrids } = buildEnvironment(scene);

  const interactives = [
    buildGantryCrane(),
    buildShipHull(),
    buildControlTower(),
    buildDockGate(),
    buildPowerSubstation(),
    buildChargingPad(),
    buildStraddleCarrier(),
    buildPowerHub(),
  ];

  interactives.forEach(({ group }) => scene.add(group));

  const allSubsystemMeshes = interactives.flatMap((entry) => entry.subsystemMeshes ?? []);

  return {
    scene,
    interactives,
    glitchGrids,
    interactiveMeshMap: Object.fromEntries(interactives.map(({ id, meshes }) => [id, meshes])),
    interactiveGroupMap: Object.fromEntries(interactives.map(({ id, group }) => [id, group])),
    subsystemMeshMap: Object.fromEntries(allSubsystemMeshes.map((mesh) => [mesh.name, mesh])),
    allPickMeshes: interactives.flatMap(({ meshes }) => meshes),
  };
}

export const DEFAULT_CAMERA_POSITION = new THREE.Vector3(16, 13, 18);
export const DEFAULT_CONTROLS_TARGET = new THREE.Vector3(0, 0.6, -0.5);

const ASSET_VANTAGE = {
  gantry_crane: { azimuth: 0.75, elevation: 0.52, distance: 12 },
  ship_hull: { azimuth: -0.4, elevation: 0.48, distance: 12 },
  control_tower: { azimuth: 0.15, elevation: 0.55, distance: 11.5 },
  dock_gate: { azimuth: 1.1, elevation: 0.5, distance: 10 },
  power_substation: { azimuth: 0.35, elevation: 0.48, distance: 9.5 },
  charging_pad: { azimuth: -0.85, elevation: 0.46, distance: 9 },
  straddle_carrier: { azimuth: -1.0, elevation: 0.5, distance: 10.5 },
  power_hub: { azimuth: 0.5, elevation: 0.47, distance: 10 },
};

export function createDefaultCamera(width, height) {
  const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 200);
  camera.position.copy(DEFAULT_CAMERA_POSITION);
  return camera;
}

export function createDefaultLights(scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x444444, 2.0);
  scene.add(hemisphere);

  const portKey = new THREE.DirectionalLight(0xffffff, 4.2);
  portKey.position.set(30, 50, 20);
  portKey.target.position.set(0, 0.5, 0);
  portKey.castShadow = true;
  portKey.shadow.mapSize.set(4096, 4096);
  portKey.shadow.camera.near = 2;
  portKey.shadow.camera.far = 80;
  portKey.shadow.camera.left = -24;
  portKey.shadow.camera.right = 24;
  portKey.shadow.camera.top = 24;
  portKey.shadow.camera.bottom = -24;
  portKey.shadow.bias = -0.0003;
  portKey.shadow.normalBias = 0.015;
  scene.add(portKey);
  scene.add(portKey.target);

  const fill = new THREE.DirectionalLight(0xb8dcff, 0.85);
  fill.position.set(-12, 18, -10);
  scene.add(fill);

  const harborGlow = new THREE.PointLight(0x00e5ff, 0.65, 40);
  harborGlow.position.set(0, 6, 2);
  scene.add(harborGlow);

  return { ambient, hemisphere, portKey, fill, harborGlow };
}

export function computeFocusCameraState(
  focusTarget,
  camera,
  currentTarget,
  { focusDistance = 7.2, assetId = null } = {},
) {
  const focus = getFocusPoint(focusTarget);
  const preset = ASSET_VANTAGE[assetId] ?? {
    azimuth: 0.7,
    elevation: 0.5,
    distance: focusDistance,
  };

  const dir = new THREE.Vector3(
    Math.cos(preset.azimuth) * Math.cos(preset.elevation),
    Math.sin(preset.elevation),
    Math.sin(preset.azimuth) * Math.cos(preset.elevation),
  ).normalize();

  const desiredTarget = focus.clone();
  const desiredCamera = focus.clone().add(dir.multiplyScalar(preset.distance));
  desiredCamera.y = Math.max(desiredCamera.y, 5.2);

  return { desiredTarget, desiredCamera };
}
