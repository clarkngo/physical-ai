import * as THREE from 'three';
import { getFocusPoint } from './buildAirportScene.js';
import { AVIATION_CONCEPTS } from './aviationConcepts.js';

const LABEL_OFFSET = new THREE.Vector3(0, 2.8, 0);
const FADE_NEAR = 7;
const FADE_FAR = 26;

export function createScreenLabelElements(container) {
  const elements = {};
  Object.values(AVIATION_CONCEPTS).forEach(({ id, screenLabel }) => {
    const el = document.createElement('div');
    el.className = 'aviation-screen-label';
    el.dataset.assetId = id;
    el.innerHTML = `
      <span class="aviation-screen-label__tag">${screenLabel.tag}</span>
      <span class="aviation-screen-label__sep"> // </span>
      <span class="aviation-screen-label__module">${screenLabel.module}</span>
    `;
    el.style.opacity = '0';
    container.appendChild(el);
    elements[id] = el;
  });
  return elements;
}

export function updateScreenLabels({
  camera, width, height, labelElements, interactiveGroupMap, selectedId, hoveredId,
}) {
  if (!width || !height) return;
  const projected = new THREE.Vector3();
  const labelWorld = new THREE.Vector3();
  Object.entries(labelElements).forEach(([id, el]) => {
    const group = interactiveGroupMap[id];
    if (!group) { el.style.opacity = '0'; return; }
    labelWorld.copy(getFocusPoint(group)).add(LABEL_OFFSET);
    const distance = camera.position.distanceTo(labelWorld);
    projected.copy(labelWorld).project(camera);
    if (projected.z > 1 || projected.x < -1.05 || projected.x > 1.05 || projected.y < -1.05 || projected.y > 1.05) {
      el.style.opacity = '0';
      return;
    }
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;
    const distanceFade = THREE.MathUtils.clamp(1 - (distance - FADE_NEAR) / (FADE_FAR - FADE_NEAR), 0, 1);
    const isSelected = selectedId === id;
    const isHovered = hoveredId === id;
    const opacity = distanceFade * (isSelected ? 1 : isHovered ? 0.88 : 0.72);
    el.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
    el.style.opacity = String(opacity);
    el.classList.toggle('aviation-screen-label--selected', isSelected);
    el.classList.toggle('aviation-screen-label--hovered', isHovered && !isSelected);
  });
}

export function disposeScreenLabelElements(labelElements, container) {
  Object.values(labelElements).forEach((el) => {
    if (container.contains(el)) container.removeChild(el);
  });
}
