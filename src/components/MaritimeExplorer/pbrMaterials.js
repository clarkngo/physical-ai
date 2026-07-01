import * as THREE from 'three';

export function createHazardStripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  for (let i = -128; i < 256; i += 32) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 16, 0);
    ctx.lineTo(i + 48, 128);
    ctx.lineTo(i + 32, 128);
    ctx.closePath();
  }
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makePhysicalMaterial(color, options = {}) {
  const {
    metalness = 0.35,
    roughness = 0.45,
    transparent = false,
    opacity = 1,
    transmission = 0,
    ior = 1.5,
    thickness = 0.5,
    clearcoat = 0,
    clearcoatRoughness = 0.1,
    emissive = 0x000000,
    emissiveIntensity = 0.85,
    map = null,
  } = options;

  return new THREE.MeshPhysicalMaterial({
    color,
    metalness,
    roughness,
    transparent,
    opacity,
    transmission,
    ior,
    thickness,
    clearcoat,
    clearcoatRoughness,
    emissive,
    emissiveIntensity,
    map,
    envMapIntensity: 1.15,
  });
}

export function makeHazardJointMaterial(stripeTexture, repeatX = 3, repeatY = 1) {
  const map = stripeTexture.clone();
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  map.needsUpdate = true;

  return makePhysicalMaterial(0xffffff, {
    map,
    metalness: 0.4,
    roughness: 0.48,
  });
}
