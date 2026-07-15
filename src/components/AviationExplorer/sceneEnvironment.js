import * as THREE from 'three';

export function createGradientSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#0c4a6e');
  gradient.addColorStop(0.35, '#1e3a5f');
  gradient.addColorStop(0.7, '#334155');
  gradient.addColorStop(1, '#475569');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function setupSceneEnvironment(scene, renderer) {
  const skyTexture = createGradientSkyTexture();
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(140, 64, 32),
    new THREE.MeshBasicMaterial({
      map: skyTexture,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    }),
  );
  skyDome.name = 'gradient_sky_dome';
  skyDome.renderOrder = -1000;
  scene.add(skyDome);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const environmentTarget = pmremGenerator.fromEquirectangular(skyTexture);
  scene.environment = environmentTarget.texture;
  scene.background = null;

  return {
    skyTexture,
    skyDome,
    pmremGenerator,
    environmentTarget,
    dispose() {
      skyTexture.dispose();
      environmentTarget.dispose();
      pmremGenerator.dispose();
      skyDome.geometry.dispose();
      skyDome.material.dispose();
      scene.remove(skyDome);
      scene.environment = null;
    },
  };
}
