import * as THREE from 'three';
import { makePhysicalMaterial } from './pbrMaterials.js';

const COLORS = {
  tarmac: 0x2d3748,
  concrete: 0x4a5568,
  asphalt: 0x1a202c,
  white: 0xe2e8f0,
  cyan: 0x00e5ff,
  cyanDim: 0x00a3e0,
  orange: 0xf97316,
  yellow: 0xfbbf24,
  fuselage: 0xf1f5f9,
  slateDark: 0x1e293b,
  slateMid: 0x334155,
  slateLight: 0x64748b,
  grass: 0x1a3d2e,
};

const BASE_EMISSIVE = 0x000000;
const HOVER_EMISSIVE = 0x0e7490;
const SELECT_EMISSIVE = 0x00e5ff;

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

function makeMaterial(color, options = {}) {
  return makePhysicalMaterial(color, options);
}

function buildCommercialAircraft() {
  const group = new THREE.Group();
  group.name = 'aircraft_group';
  const subsystemMeshes = [];

  const fuselage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.65, 7.2, 12),
    makeMaterial(COLORS.fuselage, { metalness: 0.55, roughness: 0.35, clearcoat: 0.3 }),
  );
  fuselage.rotation.z = Math.PI / 2;
  fuselage.position.y = 1.1;
  fuselage.castShadow = true;
  group.add(fuselage);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.4, 12),
    makeMaterial(COLORS.fuselage, { metalness: 0.5, roughness: 0.4 }),
  );
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(4.3, 1.1, 0);
  group.add(nose);

  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 1.8, 1.4),
    makeMaterial(COLORS.slateMid, { metalness: 0.45, roughness: 0.5 }),
  );
  tail.position.set(-3.6, 1.8, 0);
  group.add(tail);

  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.08, 5.6),
    makeMaterial(COLORS.slateLight, { metalness: 0.6, roughness: 0.35 }),
  );
  wing.position.set(0.2, 0.95, 0);
  wing.castShadow = true;
  group.add(wing);

  const engineL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.4, 1.2, 10),
    makeMaterial(COLORS.slateDark, { metalness: 0.7, roughness: 0.25 }),
  );
  engineL.rotation.x = Math.PI / 2;
  engineL.position.set(0.5, 0.75, -2.2);
  group.add(engineL);

  const engineR = engineL.clone();
  engineR.position.z = 2.2;
  group.add(engineR);

  const fms = registerSubsystem(
    new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.25, 0.5),
      makeMaterial(COLORS.cyan, { emissive: 0x003344, emissiveIntensity: 0.5, metalness: 0.8 }),
    ),
    'mesh_fms',
    'commercial_aircraft',
    new THREE.Vector3(0, 0, 0),
  );
  fms.position.set(1.2, 1.35, 0.35);
  group.add(fms);
  subsystemMeshes.push(fms);

  const adsb = registerSubsystem(
    new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.15, 0.35),
      makeMaterial(COLORS.orange, { emissive: 0x331100, emissiveIntensity: 0.45, metalness: 0.7 }),
    ),
    'mesh_adsb',
    'commercial_aircraft',
    new THREE.Vector3(0, 0, 0),
  );
  adsb.position.set(-1.5, 1.5, 0);
  group.add(adsb);
  subsystemMeshes.push(adsb);

  const apu = registerSubsystem(
    new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.3),
      makeMaterial(COLORS.yellow, { emissive: 0x443300, emissiveIntensity: 0.35 }),
    ),
    'mesh_apu_controller',
    'commercial_aircraft',
    new THREE.Vector3(0, 0.2, 0),
  );
  apu.position.set(-3.2, 1.0, 0);
  group.add(apu);
  subsystemMeshes.push(apu);

  group.userData.movingParts = { fuselage };
  group.position.set(-4, 0, 2);
  group.rotation.y = Math.PI / 2;
  const tagged = tagInteractive(group, 'commercial_aircraft', new THREE.Vector3(0, 1.4, 0));
  return { ...tagged, subsystemMeshes };
}

function buildAtcTower() {
  const group = new THREE.Group();
  group.name = 'atc_tower_group';
  const subsystemMeshes = [];

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.4, 0.4, 8),
    makeMaterial(COLORS.concrete, { metalness: 0.1, roughness: 0.88 }),
  );
  base.position.y = 0.2;
  group.add(base);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.75, 6.5, 8),
    makeMaterial(COLORS.slateMid, { metalness: 0.35, roughness: 0.55 }),
  );
  shaft.position.y = 3.45;
  shaft.castShadow = true;
  group.add(shaft);

  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 1.2, 2.8),
    makeMaterial(COLORS.cyanDim, {
      metalness: 0.5,
      roughness: 0.2,
      transparent: true,
      opacity: 0.85,
      emissive: 0x001a22,
      emissiveIntensity: 0.2,
    }),
  );
  cab.position.y = 7.2;
  cab.castShadow = true;
  group.add(cab);

  const radarDish = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.08, 0.5),
    makeMaterial(COLORS.cyan, { emissive: 0x00e5ff, emissiveIntensity: 0.4, metalness: 0.8 }),
  );
  radarDish.position.set(0, 7.85, 1.2);
  group.add(radarDish);

  const radarFeed = registerSubsystem(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      makeMaterial(COLORS.cyan, { emissive: 0x00e5ff, emissiveIntensity: 0.55, metalness: 0.85 }),
    ),
    'mesh_radar_feed',
    'atc_tower',
    new THREE.Vector3(0, 0, 0),
  );
  radarFeed.position.set(0, 7.85, 1.2);
  group.add(radarFeed);
  subsystemMeshes.push(radarFeed);

  group.position.set(8, 0, -8);
  const tagged = tagInteractive(group, 'atc_tower', new THREE.Vector3(0, 5, 0));
  return { ...tagged, subsystemMeshes };
}

function buildJetBridge() {
  const group = new THREE.Group();
  group.name = 'jet_bridge_group';

  const tunnel = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 1.4, 1.6),
    makeMaterial(COLORS.white, { metalness: 0.25, roughness: 0.65 }),
  );
  tunnel.position.set(0, 1.6, 0);
  tunnel.castShadow = true;
  group.add(tunnel);

  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.6, 1.4),
    makeMaterial(COLORS.slateLight, { metalness: 0.4, roughness: 0.5 }),
  );
  cab.position.set(2.2, 1.7, 0);
  group.add(cab);

  const column = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.6, 0.5),
    makeMaterial(COLORS.concrete, { metalness: 0.15, roughness: 0.85 }),
  );
  column.position.set(-2, 0.8, 0);
  group.add(column);

  group.position.set(2, 0, 6);
  group.rotation.y = -0.3;
  return tagInteractive(group, 'jet_bridge', new THREE.Vector3(0, 1.5, 0));
}

function buildFuelHydrant() {
  const group = new THREE.Group();
  group.name = 'fuel_hydrant_group';

  const pit = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.15, 0.8),
    makeMaterial(COLORS.asphalt, { metalness: 0.2, roughness: 0.9 }),
  );
  pit.position.y = 0.075;
  group.add(pit);

  const hydrant = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.15, 0.7, 8),
    makeMaterial(COLORS.yellow, { metalness: 0.45, roughness: 0.5, emissive: 0x443300, emissiveIntensity: 0.25 }),
  );
  hydrant.position.y = 0.5;
  group.add(hydrant);

  const hose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6),
    makeMaterial(COLORS.slateDark, { metalness: 0.6 }),
  );
  hose.rotation.z = Math.PI / 2;
  hose.position.set(0.6, 0.35, 0);
  group.add(hose);

  group.position.set(-8, 0, 5);
  return tagInteractive(group, 'fuel_hydrant', new THREE.Vector3(0, 0.6, 0));
}

function buildBaggageLoader() {
  const group = new THREE.Group();
  group.name = 'baggage_loader_group';

  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.35, 0.9),
    makeMaterial(COLORS.orange, { metalness: 0.35, roughness: 0.55 }),
  );
  chassis.position.y = 0.35;
  chassis.castShadow = true;
  group.add(chassis);

  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.12, 0.7),
    makeMaterial(COLORS.slateMid, { metalness: 0.5, roughness: 0.45 }),
  );
  belt.position.set(0.4, 0.75, 0);
  belt.rotation.z = 0.25;
  group.add(belt);

  group.position.set(5, 0, 4);
  return tagInteractive(group, 'baggage_loader', new THREE.Vector3(0, 0.8, 0));
}

function buildGroundRadar() {
  const group = new THREE.Group();
  group.name = 'ground_radar_group';

  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.2, 1.6),
    makeMaterial(COLORS.concrete, { metalness: 0.12, roughness: 0.88 }),
  );
  pad.position.y = 0.1;
  group.add(pad);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8),
    makeMaterial(COLORS.slateLight, { metalness: 0.55 }),
  );
  mast.position.y = 1.3;
  group.add(mast);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    makeMaterial(COLORS.cyan, { emissive: 0x00e5ff, emissiveIntensity: 0.45, metalness: 0.75 }),
  );
  dome.position.y = 2.35;
  dome.userData.adsbDome = true;
  group.add(dome);

  group.position.set(6, 0, -2);
  return tagInteractive(group, 'ground_radar', new THREE.Vector3(0, 1.8, 0));
}

function buildMaintenanceHangar() {
  const group = new THREE.Group();
  group.name = 'hangar_group';

  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(6, 3.5, 4),
    makeMaterial(COLORS.slateDark, { metalness: 0.4, roughness: 0.55 }),
  );
  shell.position.y = 1.75;
  shell.castShadow = true;
  group.add(shell);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 2.8, 0.12),
    makeMaterial(COLORS.slateMid, { metalness: 0.35, roughness: 0.6 }),
  );
  door.position.set(0, 1.4, 2.06);
  group.add(door);

  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    makeMaterial(0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 0.55 }),
  );
  light.position.set(2.5, 2.8, 0);
  group.add(light);

  group.position.set(-10, 0, -3);
  return tagInteractive(group, 'maintenance_hangar', new THREE.Vector3(0, 2, 0));
}

function buildPushbackTug() {
  const group = new THREE.Group();
  group.name = 'pushback_tug_group';

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.5, 0.8),
    makeMaterial(COLORS.yellow, { metalness: 0.35, roughness: 0.55 }),
  );
  body.position.y = 0.35;
  body.castShadow = true;
  group.add(body);

  const towBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.08, 0.08),
    makeMaterial(COLORS.slateLight, { metalness: 0.6 }),
  );
  towBar.position.set(1.0, 0.25, 0);
  group.add(towBar);

  const gps = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    makeMaterial(COLORS.cyan, { emissive: 0x00e5ff, emissiveIntensity: 0.5 }),
  );
  gps.position.set(0, 0.65, 0);
  gps.userData.gpsDome = true;
  group.add(gps);

  group.position.set(-1, 0, 5.5);
  return tagInteractive(group, 'pushback_tug', new THREE.Vector3(0, 0.5, 0));
}

function buildEnvironment(scene) {
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    makeMaterial(COLORS.grass, { metalness: 0.05, roughness: 0.95 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.55;
  grass.receiveShadow = true;
  scene.add(grass);

  const tarmac = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 36),
    makeMaterial(COLORS.tarmac, { metalness: 0.12, roughness: 0.88 }),
  );
  tarmac.rotation.x = -Math.PI / 2;
  tarmac.receiveShadow = true;
  scene.add(tarmac);

  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 8),
    makeMaterial(COLORS.asphalt, { metalness: 0.08, roughness: 0.92 }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, 0.02, -10);
  scene.add(runway);

  const centerline = new THREE.Mesh(
    new THREE.PlaneGeometry(38, 0.15),
    makeMaterial(COLORS.white, { emissive: 0xffffff, emissiveIntensity: 0.15 }),
  );
  centerline.rotation.x = -Math.PI / 2;
  centerline.position.set(0, 0.025, -10);
  scene.add(centerline);

  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(28, 0.2, 18),
    makeMaterial(COLORS.concrete, { metalness: 0.1, roughness: 0.9 }),
  );
  apron.position.set(0, 0.1, 3);
  apron.receiveShadow = true;
  scene.add(apron);

  const grid = new THREE.GridHelper(48, 48, 0x38bdf8, 0x1e293b);
  grid.position.y = 0.018;
  if (Array.isArray(grid.material)) {
    grid.material[0].transparent = true;
    grid.material[0].opacity = 0.22;
    grid.material[1].transparent = true;
    grid.material[1].opacity = 0.08;
  }
  scene.add(grid);

  return { glitchGrids: [{ grid, wobbleScale: 1 }] };
}

export function getFocusPoint(target) {
  const world = new THREE.Vector3();
  const offset = target.userData?.focusOffset ?? new THREE.Vector3(0, 1.5, 0);
  target.updateWorldMatrix(true, false);
  world.copy(offset).applyMatrix4(target.matrixWorld);
  return world;
}

export function buildAirportScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#0f172a', 0.012);

  const { glitchGrids } = buildEnvironment(scene);

  const interactives = [
    buildCommercialAircraft(),
    buildAtcTower(),
    buildJetBridge(),
    buildFuelHydrant(),
    buildBaggageLoader(),
    buildGroundRadar(),
    buildMaintenanceHangar(),
    buildPushbackTug(),
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

export const DEFAULT_CAMERA_POSITION = new THREE.Vector3(14, 12, 16);
export const DEFAULT_CONTROLS_TARGET = new THREE.Vector3(0, 0.8, 0);

const ASSET_VANTAGE = {
  commercial_aircraft: { azimuth: 0.6, elevation: 0.5, distance: 11 },
  atc_tower: { azimuth: -0.8, elevation: 0.52, distance: 13 },
  jet_bridge: { azimuth: 0.2, elevation: 0.48, distance: 10 },
  fuel_hydrant: { azimuth: -0.5, elevation: 0.45, distance: 9 },
  baggage_loader: { azimuth: 0.9, elevation: 0.46, distance: 9.5 },
  ground_radar: { azimuth: -0.3, elevation: 0.47, distance: 10 },
  maintenance_hangar: { azimuth: 0.75, elevation: 0.5, distance: 12 },
  pushback_tug: { azimuth: 0.15, elevation: 0.44, distance: 9 },
};

export function createDefaultCamera(width, height) {
  const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 200);
  camera.position.copy(DEFAULT_CAMERA_POSITION);
  return camera;
}

export function createDefaultLights(scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const hemisphere = new THREE.HemisphereLight(0xbae6fd, 0x334155, 1.8);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xffffff, 3.8);
  sun.position.set(25, 45, 15);
  sun.target.position.set(0, 0.5, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  scene.add(sun);
  scene.add(sun.target);

  const rampGlow = new THREE.PointLight(0x38bdf8, 0.55, 40);
  rampGlow.position.set(0, 5, 2);
  scene.add(rampGlow);

  return { ambient, hemisphere, sun, rampGlow };
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
  desiredCamera.y = Math.max(desiredCamera.y, 5);

  return { desiredTarget, desiredCamera };
}
