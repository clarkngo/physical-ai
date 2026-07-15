import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  buildAirportScene,
  computeFocusCameraState,
  createDefaultCamera,
  createDefaultLights,
  DEFAULT_CONTROLS_TARGET,
} from './buildAirportScene.js';
import { captureGridBasePositions, updateGridGlitch } from './gridGlitch.js';
import { createOutlineComposer } from './outlineComposer.js';
import {
  createScreenLabelElements,
  disposeScreenLabelElements,
  updateScreenLabels,
} from './screenLabels.js';
import { createRampAmbientAudio } from './rampAmbientAudio.js';
import { playSelectionBlip } from './selectionAudio.js';
import { setupSceneEnvironment } from './sceneEnvironment.js';
import { createAttackScenarioVisuals } from './attackScenarioVisuals.js';
import { isIncidentResolved, getScenarioById } from './attackScenario.js';
import {
  addSceneLife,
  isRaycastPickable,
  resolvePickFromHit,
} from './sceneLife.js';
import { getParentAssetId, isSubsystemId, SIMULATION_MODES } from './subsystemConcepts.js';

const FOCUS_LERP = 0.048;
const CAMERA_LERP = 0.042;
const AMBIENT_ATTACK = new THREE.Color(0xb45309);
const HEMI_SKY_OPERATIONAL = new THREE.Color(0xffffff);
const HEMI_SKY_ATTACK = new THREE.Color(0xf97316);
const HEMI_GROUND_OPERATIONAL = new THREE.Color(0x444444);
const HEMI_GROUND_ATTACK = new THREE.Color(0x662222);

function meshesForKey(key, interactiveMeshMap, subsystemMeshMap) {
  if (!key) return [];
  if (isSubsystemId(key)) {
    const mesh = subsystemMeshMap[key];
    return mesh ? [mesh] : [];
  }
  const assetMeshes = interactiveMeshMap[key] ?? [];
  return assetMeshes.filter((mesh) => !mesh.userData?.subsystemId);
}

export default function AviationScene({
  selectedId,
  simulationMode = SIMULATION_MODES.OPERATIONAL,
  activeScenarioId,
  incidentSteps = {},
  onSelect,
  onHoverChange,
}) {
  const mountRef = useRef(null);
  const labelsLayerRef = useRef(null);
  const meshMapRef = useRef(null);
  const subsystemMapRef = useRef(null);
  const sceneApiRef = useRef(null);
  const stateRef = useRef({
    selectedId,
    hoveredId: null,
    hoveredMesh: null,
    simulationMode,
    incidentSteps,
    activeScenarioId,
  });
  const callbacksRef = useRef({ onSelect, onHoverChange });

  callbacksRef.current = { onSelect, onHoverChange };
  stateRef.current.selectedId = selectedId;
  stateRef.current.simulationMode = simulationMode;
  stateRef.current.incidentSteps = incidentSteps;
  stateRef.current.activeScenarioId = activeScenarioId;

  useEffect(() => {
    if (!mountRef.current || !labelsLayerRef.current) return undefined;

    const mount = mountRef.current;
    const labelsLayer = labelsLayerRef.current;
    const {
      scene,
      interactiveMeshMap,
      interactiveGroupMap,
      subsystemMeshMap,
      glitchGrids,
    } = buildAirportScene();

    meshMapRef.current = interactiveMeshMap;
    subsystemMapRef.current = subsystemMeshMap;

    const lights = createDefaultLights(scene);

    const width = mount.clientWidth || 640;
    const height = mount.clientHeight || 480;
    const camera = createDefaultCamera(width, height);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const environment = setupSceneEnvironment(scene, renderer);
    const sceneLife = addSceneLife(scene, interactiveGroupMap);
    const rampAudio = createRampAmbientAudio();
    const attackVisuals = createAttackScenarioVisuals(scene, interactiveGroupMap);
    const outline = createOutlineComposer(renderer, scene, camera, width, height);
    const labelElements = createScreenLabelElements(labelsLayer);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 6;
    controls.maxDistance = 28;
    controls.target.copy(DEFAULT_CONTROLS_TARGET);

    const focusAnim = {
      active: false,
      desiredTarget: new THREE.Vector3(),
      desiredCamera: new THREE.Vector3(),
    };

    const gridsWithBase = glitchGrids.map(({ grid, wobbleScale }) => ({
      grid,
      wobbleScale,
      basePositions: captureGridBasePositions(grid),
    }));

    let attackBlend = simulationMode === SIMULATION_MODES.ATTACK ? 1 : 0;
    const clock = new THREE.Clock();

    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const raycaster = new THREE.Raycaster();

    function updateOutlineTargets() {
      const attackActive = stateRef.current.simulationMode === SIMULATION_MODES.ATTACK;
      const scenario = getScenarioById(stateRef.current.activeScenarioId);
      const resolved = isIncidentResolved(stateRef.current.incidentSteps, scenario);

      if (attackActive && !resolved) {
        const targetMeshes = (interactiveMeshMap[scenario.targetAsset] ?? []).filter(
          (mesh) => !mesh.userData?.subsystemId,
        );
        outline.setOutlineTargets(targetMeshes);
        return;
      }

      const selectedMeshes = meshesForKey(
        stateRef.current.selectedId,
        interactiveMeshMap,
        subsystemMeshMap,
      );

      if (selectedMeshes.length) {
        outline.setOutlineTargets(selectedMeshes);
        return;
      }

      if (stateRef.current.hoveredMesh) {
        outline.setOutlineTargets([stateRef.current.hoveredMesh]);
        return;
      }

      outline.setOutlineTargets([]);
    }

    function focusOnSelection(selectionKey) {
      if (!selectionKey) {
        focusAnim.active = false;
        return;
      }

      const parentAsset = getParentAssetId(selectionKey) ?? selectionKey;
      const focusTarget =
        subsystemMeshMap[selectionKey] ?? interactiveGroupMap[parentAsset] ?? interactiveGroupMap[selectionKey];

      if (!focusTarget) {
        focusAnim.active = false;
        return;
      }

      const { desiredTarget, desiredCamera } = computeFocusCameraState(
        focusTarget,
        camera,
        controls.target,
        {
          focusDistance: isSubsystemId(selectionKey) ? 5.8 : 6.8,
          assetId: parentAsset,
        },
      );
      focusAnim.desiredTarget.copy(desiredTarget);
      focusAnim.desiredCamera.copy(desiredCamera);
      focusAnim.active = true;
    }

    sceneApiRef.current = { focusOnSelection, updateOutlineTargets };

    function pickInteractive(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(scene.children, true);

      for (const hit of hits) {
        if (!isRaycastPickable(hit.object)) continue;
        const resolved = resolvePickFromHit(hit.object, isSubsystemId);
        if (resolved.id) return resolved;
      }

      return { id: null, mesh: null };
    }

    function setHovered(nextId, nextMesh) {
      if (stateRef.current.hoveredId === nextId && stateRef.current.hoveredMesh === nextMesh) return;
      stateRef.current.hoveredId = nextId;
      stateRef.current.hoveredMesh = nextMesh;
      updateOutlineTargets();
      callbacksRef.current.onHoverChange?.(nextId);
      renderer.domElement.style.cursor = nextId ? 'pointer' : 'default';
    }

    function onPointerMove(event) {
      const { id, mesh } = pickInteractive(event.clientX, event.clientY);
      setHovered(id, mesh);
    }

    function onPointerLeave() {
      setHovered(null, null);
    }

    function onClick(event) {
      const { id } = pickInteractive(event.clientX, event.clientY);
      const ctx = rampAudio.getContext();
      if (id) {
        playSelectionBlip(ctx);
      }
      callbacksRef.current.onSelect?.(id);
      updateOutlineTargets();
      if (id) focusOnSelection(id);
    }

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('click', onClick);

    updateOutlineTargets();

    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      const targetAttack = stateRef.current.simulationMode === SIMULATION_MODES.ATTACK ? 1 : 0;
      attackBlend = THREE.MathUtils.lerp(attackBlend, targetAttack, 0.035);

      lights.ambient.color.copy(new THREE.Color(0xffffff)).lerp(AMBIENT_ATTACK, attackBlend);
      lights.hemisphere.color.copy(HEMI_SKY_OPERATIONAL).lerp(HEMI_SKY_ATTACK, attackBlend);
      lights.hemisphere.groundColor.copy(HEMI_GROUND_OPERATIONAL).lerp(HEMI_GROUND_ATTACK, attackBlend);
      lights.rampGlow.intensity = THREE.MathUtils.lerp(0.65, 0.3, attackBlend);

      updateGridGlitch(gridsWithBase, elapsed, attackBlend);
      sceneLife.update(elapsed, clock.getDelta());

      const attackActive = stateRef.current.simulationMode === SIMULATION_MODES.ATTACK;
      const scenario = getScenarioById(stateRef.current.activeScenarioId);
      const incidentResolved = isIncidentResolved(stateRef.current.incidentSteps, scenario);
      attackVisuals.update(
        elapsed,
        stateRef.current.incidentSteps,
        stateRef.current.activeScenarioId,
        stateRef.current.simulationMode,
      );

      if (attackActive && !incidentResolved) {
        const pulse = attackVisuals.getOutlinePulse(elapsed, true);
        outline.setPulseStrength(4 + pulse * 5);
        outline.updateAttackBlend(1);
      } else {
        outline.setPulseStrength(4);
        outline.updateAttackBlend(attackBlend);
      }

      if (focusAnim.active) {
        controls.target.lerp(focusAnim.desiredTarget, FOCUS_LERP);
        camera.position.lerp(focusAnim.desiredCamera, CAMERA_LERP);

        const targetDone = controls.target.distanceTo(focusAnim.desiredTarget) < 0.06;
        const cameraDone = camera.position.distanceTo(focusAnim.desiredCamera) < 0.06;
        if (targetDone && cameraDone) focusAnim.active = false;
      }

      controls.update();

      updateScreenLabels({
        camera,
        width: mount.clientWidth,
        height: mount.clientHeight,
        labelElements,
        interactiveGroupMap,
        selectedId: getParentAssetId(stateRef.current.selectedId) ?? stateRef.current.selectedId,
        hoveredId: getParentAssetId(stateRef.current.hoveredId) ?? stateRef.current.hoveredId,
      });

      outline.composer.render();
    };
    animate();

    function syncRendererSize() {
      const nextWidth = mount.clientWidth;
      const nextHeight = mount.clientHeight;
      if (!nextWidth || !nextHeight) return;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
      outline.resize(nextWidth, nextHeight);
    }

    const resizeObserver = new ResizeObserver(syncRendererSize);
    resizeObserver.observe(mount);

    const onExplorerResize = () => syncRendererSize();
    window.addEventListener('aviation-explorer-resize', onExplorerResize);
    document.addEventListener('fullscreenchange', onExplorerResize);

    requestAnimationFrame(() => {
      syncRendererSize();
      window.dispatchEvent(new Event('aviation-explorer-resize'));
    });

    return () => {
      meshMapRef.current = null;
      subsystemMapRef.current = null;
      sceneApiRef.current = null;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('aviation-explorer-resize', onExplorerResize);
      document.removeEventListener('fullscreenchange', onExplorerResize);
      environment.dispose();
      rampAudio.dispose();
      outline.dispose();
      disposeScreenLabelElements(labelElements, labelsLayer);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('click', onClick);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      scene.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose());
          } else {
            child.material?.dispose();
          }
        }
        if (child.isLineSegments) {
          child.geometry?.dispose();
          child.material?.dispose();
        }
      });
    };
  }, []);

  useEffect(() => {
    if (selectedId) {
      sceneApiRef.current?.focusOnSelection(selectedId);
    }
    sceneApiRef.current?.updateOutlineTargets?.();
  }, [selectedId, simulationMode, incidentSteps, activeScenarioId]);

  return (
    <div className="aviation-viewport-layer overflow-hidden bg-[#0d1117]">
      <div ref={mountRef} className="h-full w-full" aria-label="Interactive 3D airport environment" />
      <div ref={labelsLayerRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
    </div>
  );
}
