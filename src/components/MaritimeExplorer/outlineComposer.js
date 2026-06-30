import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import * as THREE from 'three';

const OUTLINE_CYAN = new THREE.Color('#00f3ff');
const OUTLINE_ATTACK = new THREE.Color('#ff3e3e');

export function createOutlineComposer(renderer, scene, camera, width, height) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const outlinePass = new OutlinePass(new THREE.Vector2(width, height), scene, camera);
  outlinePass.edgeStrength = 4.0;
  outlinePass.edgeThickness = 1.5;
  outlinePass.edgeGlow = 0.6;
  outlinePass.visibleEdgeColor.copy(OUTLINE_CYAN);
  outlinePass.hiddenEdgeColor.set('#004455');
  outlinePass.selectedObjects = [];
  composer.addPass(outlinePass);

  return {
    composer,
    outlinePass,
    resize(nextWidth, nextHeight) {
      composer.setSize(nextWidth, nextHeight);
      outlinePass.setSize(nextWidth, nextHeight);
    },
    setOutlineTargets(objects) {
      outlinePass.selectedObjects = objects.filter(Boolean);
    },
    setPulseStrength(strength) {
      outlinePass.edgeStrength = strength ?? 4.0;
      outlinePass.edgeGlow = (strength ?? 4.0) * 0.15;
    },
    updateAttackBlend(attackBlend) {
      outlinePass.visibleEdgeColor.copy(OUTLINE_CYAN).lerp(OUTLINE_ATTACK, attackBlend);
    },
    dispose() {
      composer.dispose();
    },
  };
}
