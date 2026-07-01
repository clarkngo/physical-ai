import * as THREE from 'three';
import { CRANE_RANSOMWARE_SCENARIO, GPS_SPOOFING_SCENARIO } from './attackScenario.js';

export function createAttackScenarioVisuals(scene, interactiveGroupMap) {
  const craneGroup = interactiveGroupMap.gantry_crane;
  const dockGateGroup = interactiveGroupMap.dock_gate;
  const straddleGroup = interactiveGroupMap.straddle_carrier;

  const bridgeGroup = new THREE.Group();
  bridgeGroup.name = 'it_ot_bridge_group';

  const bridgeLine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 6.2, 8),
    new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.75,
    }),
  );
  bridgeLine.rotation.z = Math.PI / 2;
  bridgeLine.position.set(0, 1.55, 0);
  bridgeGroup.add(bridgeLine);

  const bridgeGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 6.2, 8),
    new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.18,
    }),
  );
  bridgeGlow.rotation.z = Math.PI / 2;
  bridgeGlow.position.set(0, 1.55, 0);
  bridgeGroup.add(bridgeGlow);

  const packets = [];
  for (let i = 0; i < 5; i += 1) {
    const packet = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff3e3e,
        transparent: true,
        opacity: 0.95,
      }),
    );
    packet.userData.phase = i * 0.2;
    bridgeGroup.add(packet);
    packets.push(packet);
  }

  if (dockGateGroup) {
    bridgeGroup.position.copy(dockGateGroup.position);
    dockGateGroup.add(bridgeGroup);
  } else {
    bridgeGroup.position.set(5.8, 0, -0.8);
    scene.add(bridgeGroup);
  }

  const movingParts = craneGroup?.userData?.movingParts ?? null;
  const trolleyBaseY = movingParts?.trolley?.position.y ?? 4.55;
  const trolleyBaseX = movingParts?.trolley?.position.x ?? 1.4;
  const spreaderBaseY = movingParts?.spreader?.position.y ?? 3.15;
  const spreaderBaseX = movingParts?.spreader?.position.x ?? 1.4;

  const brakeIndicators = [];
  if (craneGroup) {
    [[-2.6, -1.8], [2.6, -1.8]].forEach(([x, z]) => {
      const brake = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.12, 0.35),
        new THREE.MeshBasicMaterial({
          color: 0x22c55e,
          transparent: true,
          opacity: 0,
        }),
      );
      brake.position.set(x, 0.5, z);
      brake.userData.decorative = true;
      craneGroup.add(brake);
      brakeIndicators.push(brake);
    });
  }

  const straddleBase = straddleGroup
    ? { x: straddleGroup.position.x, z: straddleGroup.position.z }
    : { x: 9, z: 4.5 };
  let gpsDome = null;
  if (straddleGroup) {
    straddleGroup.traverse((child) => {
      if (child.userData?.gpsDome) {
        gpsDome = child;
      }
    });
  }

  const spoofMarkers = [];
  if (straddleGroup) {
    for (let i = 0; i < 4; i += 1) {
      const marker = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.22, 16),
        new THREE.MeshBasicMaterial({
          color: 0xff3e3e,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
        }),
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = 0.05;
      marker.userData.decorative = true;
      straddleGroup.add(marker);
      spoofMarkers.push(marker);
    }
  }

  function resetCraneMotion() {
    if (movingParts?.trolley) {
      movingParts.trolley.position.y = trolleyBaseY;
      movingParts.trolley.position.x = trolleyBaseX;
    }
    if (movingParts?.spreader) {
      movingParts.spreader.position.y = spreaderBaseY;
      movingParts.spreader.position.x = spreaderBaseX;
    }
    brakeIndicators.forEach((brake) => {
      brake.material.opacity = 0;
    });
  }

  function resetStraddleMotion() {
    if (straddleGroup) {
      straddleGroup.position.x = straddleBase.x;
      straddleGroup.position.z = straddleBase.z;
      straddleGroup.rotation.y = 0;
    }
    if (gpsDome?.material?.emissive) {
      gpsDome.material.emissive.setHex(0x003344);
      gpsDome.material.emissiveIntensity = 0.5;
    }
    spoofMarkers.forEach((marker) => {
      marker.material.opacity = 0;
    });
  }

  function resetBridge() {
    bridgeGroup.visible = false;
    packets.forEach((packet) => {
      packet.visible = false;
    });
    bridgeLine.material.color.setHex(0x00e5ff);
    bridgeLine.material.opacity = 0.75;
    bridgeGlow.material.opacity = 0.18;
  }

  function resetAllVisuals() {
    resetCraneMotion();
    resetStraddleMotion();
    resetBridge();
  }

  function updateCraneScenario(elapsed, incidentSteps) {
    bridgeGroup.visible = true;
    const isolated = incidentSteps.isolate;
    const firmwareRestored = incidentSteps.firmware;
    const failsafeEngaged = incidentSteps.failsafe;

    bridgeLine.material.color.setHex(isolated ? 0x334155 : 0x00e5ff);
    bridgeLine.material.opacity = isolated ? 0.25 : 0.75;
    bridgeGlow.material.opacity = isolated ? 0.05 : 0.18;

    packets.forEach((packet, i) => {
      if (isolated) {
        packet.visible = false;
        return;
      }
      packet.visible = true;
      const phase = (elapsed * 0.55 + packet.userData.phase) % 1;
      packet.position.set(-3.1 + phase * 6.2, 1.55 + Math.sin(elapsed * 4 + i) * 0.06, 0);
      packet.material.color.setHex(firmwareRestored ? 0x22c55e : 0xff3e3e);
    });

    if (movingParts?.trolley && movingParts?.spreader) {
      if (failsafeEngaged) {
        movingParts.trolley.position.y = THREE.MathUtils.lerp(
          movingParts.trolley.position.y,
          trolleyBaseY,
          0.08,
        );
        movingParts.spreader.position.y = THREE.MathUtils.lerp(
          movingParts.spreader.position.y,
          spreaderBaseY,
          0.08,
        );
      } else {
        const swing = Math.sin(elapsed * 0.35) * 0.45;
        movingParts.trolley.position.y = trolleyBaseY + swing * 0.15;
        movingParts.spreader.position.y = spreaderBaseY + swing;
        movingParts.trolley.position.x = trolleyBaseX + Math.sin(elapsed * 0.22) * 0.35;
        movingParts.spreader.position.x = movingParts.trolley.position.x;
      }
    }

    brakeIndicators.forEach((brake) => {
      brake.material.opacity = failsafeEngaged
        ? 0.85 + Math.sin(elapsed * 6) * 0.1
        : 0;
      brake.material.color.setHex(failsafeEngaged ? 0xef4444 : 0x22c55e);
    });
  }

  function updateGpsScenario(elapsed, incidentSteps) {
    bridgeGroup.visible = false;
    packets.forEach((packet) => {
      packet.visible = false;
    });

    if (!straddleGroup) return;

    const antiSpoof = incidentSteps.anti_spoof;
    const lidarFallback = incidentSteps.lidar_fallback;
    const halted = incidentSteps.halt_carriers;

    if (gpsDome?.material?.emissive) {
      if (halted) {
        gpsDome.material.emissive.setHex(0x22c55e);
        gpsDome.material.emissiveIntensity = 0.65;
      } else if (antiSpoof) {
        gpsDome.material.emissive.setHex(0xfbbf24);
        gpsDome.material.emissiveIntensity = 0.55 + Math.sin(elapsed * 4) * 0.15;
      } else {
        gpsDome.material.emissive.setHex(0xff3e3e);
        gpsDome.material.emissiveIntensity = 0.75 + Math.sin(elapsed * 6) * 0.2;
      }
    }

    spoofMarkers.forEach((marker, i) => {
      if (halted || lidarFallback) {
        marker.material.opacity = 0;
        return;
      }
      marker.material.opacity = 0.35 + Math.sin(elapsed * 3 + i) * 0.15;
      marker.material.color.setHex(antiSpoof ? 0xfbbf24 : 0xff3e3e);
      const drift = antiSpoof ? 0.4 : 1.2;
      marker.position.set(
        Math.sin(elapsed * 0.9 + i * 1.4) * drift,
        0.05,
        Math.cos(elapsed * 0.7 + i * 1.1) * drift,
      );
    });

    if (halted) {
      straddleGroup.position.x = THREE.MathUtils.lerp(straddleGroup.position.x, straddleBase.x, 0.1);
      straddleGroup.position.z = THREE.MathUtils.lerp(straddleGroup.position.z, straddleBase.z, 0.1);
      straddleGroup.rotation.y = THREE.MathUtils.lerp(straddleGroup.rotation.y, 0, 0.1);
    } else if (lidarFallback) {
      const wobble = Math.sin(elapsed * 0.5) * 0.08;
      straddleGroup.position.x = straddleBase.x + wobble;
      straddleGroup.position.z = straddleBase.z + wobble * 0.5;
    } else {
      const driftScale = antiSpoof ? 0.25 : 0.85;
      straddleGroup.position.x = straddleBase.x + Math.sin(elapsed * 0.45) * driftScale;
      straddleGroup.position.z = straddleBase.z + Math.cos(elapsed * 0.38) * driftScale;
      straddleGroup.rotation.y = Math.sin(elapsed * 0.3) * (antiSpoof ? 0.05 : 0.18);
    }
  }

  return {
    bridgeGroup,
    packets,
    brakeIndicators,
    resetAllVisuals,
    update(elapsed, incidentSteps, activeScenarioId, simulationMode) {
      if (simulationMode !== 'ATTACK') {
        resetAllVisuals();
        return;
      }

      if (activeScenarioId === GPS_SPOOFING_SCENARIO.id) {
        resetCraneMotion();
        resetBridge();
        updateGpsScenario(elapsed, incidentSteps);
        return;
      }

      resetStraddleMotion();
      updateCraneScenario(elapsed, incidentSteps);
    },
    getOutlinePulse(elapsed, attackActive) {
      if (!attackActive) return null;
      return 0.55 + Math.sin(elapsed * 5) * 0.45;
    },
  };
}
