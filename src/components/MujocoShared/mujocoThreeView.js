// Generic three.js viewer for a MuJoCo model.
//
// Builds one mesh per MuJoCo geom (plane, sphere, capsule, cylinder, box),
// using the geom's size and colour from the model, then copies every geom's
// world pose from MjData each frame. MuJoCo is z-up; everything is placed in a
// `world` group rotated so MuJoCo coordinates can be used directly.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const GEOM = { PLANE: 0, SPHERE: 2, CAPSULE: 3, ELLIPSOID: 4, CYLINDER: 5, BOX: 6 };

export const mjToThree = ([x, y, z]) => new THREE.Vector3(x, z, -y);

function geometryFor(type, size) {
  switch (type) {
    case GEOM.PLANE: {
      const w = size[0] > 0 ? size[0] * 2 : 40;
      const h = size[1] > 0 ? size[1] * 2 : 40;
      return new THREE.PlaneGeometry(w, h);
    }
    case GEOM.SPHERE:
      return new THREE.SphereGeometry(size[0], 24, 16);
    case GEOM.ELLIPSOID:
      return new THREE.SphereGeometry(1, 24, 16).scale(size[0], size[1], size[2]);
    case GEOM.CAPSULE:
      // three.js capsules run along y; MuJoCo's run along local z.
      return new THREE.CapsuleGeometry(size[0], size[1] * 2, 8, 20).rotateX(Math.PI / 2);
    case GEOM.CYLINDER:
      return new THREE.CylinderGeometry(size[0], size[0], size[1] * 2, 28).rotateX(Math.PI / 2);
    case GEOM.BOX:
      return new THREE.BoxGeometry(size[0] * 2, size[1] * 2, size[2] * 2);
    default:
      return null; // meshes / height fields are not needed by these labs
  }
}

export class MujocoThreeView {
  /**
   * @param {HTMLElement} container
   * @param {object} model MjModel
   * @param {{ eye?: number[], target?: number[], background?: number }} opts camera in MuJoCo coords
   */
  constructor(container, model, { eye = [1.6, -2.4, 1.6], target = [0.2, 0, 0.8], background = 0x020617 } = {}) {
    this.container = container;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background);
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.02, 100);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;

    this.world = new THREE.Group();
    this.world.rotation.x = -Math.PI / 2;
    this.scene.add(this.world);

    this.scene.add(new THREE.HemisphereLight(0xe2e8f0, 0x0f172a, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(2, 5, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 15 });
    this.scene.add(key);

    this.buildGeoms(model);
    this.setCamera(eye, target);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  buildGeoms(model) {
    const n = model.ngeom;
    const types = model.geom_type;
    const sizes = model.geom_size;
    const rgba = model.geom_rgba;
    this.geomMeshes = [];
    for (let i = 0; i < n; i++) {
      const size = [sizes[i * 3], sizes[i * 3 + 1], sizes[i * 3 + 2]];
      const geometry = geometryFor(types[i], size);
      const alpha = rgba[i * 4 + 3];
      if (!geometry || alpha === 0) {
        this.geomMeshes.push(null);
        continue;
      }
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]),
        roughness: types[i] === GEOM.PLANE ? 0.95 : 0.55,
        metalness: 0.05,
        transparent: alpha < 1,
        opacity: alpha,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.matrixAutoUpdate = false;
      mesh.castShadow = types[i] !== GEOM.PLANE;
      mesh.receiveShadow = true;
      this.world.add(mesh);
      this.geomMeshes.push(mesh);
    }
  }

  /** Copy every geom's world pose out of MjData. */
  sync(data) {
    const pos = data.geom_xpos;
    const mat = data.geom_xmat; // row-major 3×3
    for (let i = 0; i < this.geomMeshes.length; i++) {
      const mesh = this.geomMeshes[i];
      if (!mesh) continue;
      const p = i * 3;
      const r = i * 9;
      mesh.matrix.set(
        mat[r], mat[r + 1], mat[r + 2], pos[p],
        mat[r + 3], mat[r + 4], mat[r + 5], pos[p + 1],
        mat[r + 6], mat[r + 7], mat[r + 8], pos[p + 2],
        0, 0, 0, 1,
      );
      mesh.matrixWorldNeedsUpdate = true;
    }
  }

  /** Recolour a geom (e.g. highlight the cube while held). */
  setGeomColor(index, hex) {
    this.geomMeshes[index]?.material.color.setHex(hex);
  }

  setCamera(eye, target) {
    this.camera.position.copy(mjToThree(eye));
    this.controls.target.copy(mjToThree(target));
    this.controls.update();
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.scene.traverse((obj) => {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      mats.forEach((m) => m.dispose());
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export { THREE };
