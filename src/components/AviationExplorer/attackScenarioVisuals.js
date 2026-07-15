import * as THREE from 'three';
import { ADSB_GHOST_SCENARIO, FMS_INJECTION_SCENARIO } from './attackScenario.js';

export function createAttackScenarioVisuals(scene, interactiveGroupMap) {
  const radarGroup = interactiveGroupMap.ground_radar;
  const aircraftGroup = interactiveGroupMap.commercial_aircraft;

  const ghostTargets = [];
  if (radarGroup) {
    for (let i = 0; i < 4; i += 1) {
      const ghost = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.35, 16),
        new THREE.MeshBasicMaterial({
          color: 0xff3e3e,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
        }),
      );
      ghost.rotation.x = -Math.PI / 2;
      ghost.position.y = 0.05;
      ghost.userData.decorative = true;
      radarGroup.add(ghost);
      ghostTargets.push(ghost);
    }
  }

  let adsbDome = null;
  radarGroup?.traverse((child) => {
    if (child.userData?.adsbDome) adsbDome = child;
  });

  const fmsIndicator = aircraftGroup?.children.find((c) => c.name === 'mesh_fms');

  function resetAll() {
    ghostTargets.forEach((g) => { g.material.opacity = 0; });
    if (adsbDome?.material?.emissive) {
      adsbDome.material.emissive.setHex(0x00e5ff);
      adsbDome.material.emissiveIntensity = 0.45;
    }
    if (fmsIndicator?.material?.emissive) {
      fmsIndicator.material.emissive.setHex(0x003344);
      fmsIndicator.material.emissiveIntensity = 0.5;
    }
  }

  return {
    resetAllVisuals: resetAll,
    update(elapsed, incidentSteps, activeScenarioId, simulationMode) {
      if (simulationMode !== 'ATTACK') {
        resetAll();
        return;
      }

      if (activeScenarioId === FMS_INJECTION_SCENARIO.id) {
        ghostTargets.forEach((g) => { g.material.opacity = 0; });
        const isolated = incidentSteps.isolate_bus;
        const restored = incidentSteps.restore_db;
        const manual = incidentSteps.manual_nav;
        if (fmsIndicator?.material?.emissive) {
          if (manual) {
            fmsIndicator.material.emissive.setHex(0x22c55e);
            fmsIndicator.material.emissiveIntensity = 0.65;
          } else if (restored) {
            fmsIndicator.material.emissive.setHex(0xfbbf24);
            fmsIndicator.material.emissiveIntensity = 0.55;
          } else if (isolated) {
            fmsIndicator.material.emissive.setHex(0xf97316);
            fmsIndicator.material.emissiveIntensity = 0.5;
          } else {
            fmsIndicator.material.emissive.setHex(0xff3e3e);
            fmsIndicator.material.emissiveIntensity = 0.75 + Math.sin(elapsed * 5) * 0.2;
          }
        }
        return;
      }

      const primary = incidentSteps.radar_primary;
      const mlat = incidentSteps.mlat_verify;
      const hold = incidentSteps.hold_traffic;

      if (adsbDome?.material?.emissive) {
        if (hold) {
          adsbDome.material.emissive.setHex(0x22c55e);
          adsbDome.material.emissiveIntensity = 0.6;
        } else if (mlat) {
          adsbDome.material.emissive.setHex(0xfbbf24);
          adsbDome.material.emissiveIntensity = 0.55;
        } else if (primary) {
          adsbDome.material.emissive.setHex(0x38bdf8);
          adsbDome.material.emissiveIntensity = 0.5;
        } else {
          adsbDome.material.emissive.setHex(0xff3e3e);
          adsbDome.material.emissiveIntensity = 0.8 + Math.sin(elapsed * 6) * 0.15;
        }
      }

      ghostTargets.forEach((ghost, i) => {
        if (hold || mlat) {
          ghost.material.opacity = 0;
          return;
        }
        ghost.material.opacity = primary ? 0.15 : 0.45 + Math.sin(elapsed * 4 + i) * 0.15;
        ghost.material.color.setHex(primary ? 0xfbbf24 : 0xff3e3e);
        ghost.position.set(
          Math.sin(elapsed * 0.8 + i * 1.5) * (primary ? 0.5 : 1.2),
          0.05,
          Math.cos(elapsed * 0.6 + i) * (primary ? 0.5 : 1.2),
        );
      });
    },
    getOutlinePulse(elapsed, attackActive) {
      if (!attackActive) return null;
      return 0.55 + Math.sin(elapsed * 5) * 0.45;
    },
  };
}
