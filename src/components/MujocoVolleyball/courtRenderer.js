// three.js view of the MuJoCo volleyball scene.
//
// MuJoCo only computes physics; this file draws it. Everything lives inside a
// `world` group rotated so that MuJoCo's z-up coordinates can be used as-is.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BALL, COURT } from './volleyballScene.js';

const MAX_TRAIL = 4000;
const MAX_DOTS = 400;

const CALL_COLORS = {
  IN: 0x4ade80,
  OUT: 0xf87171,
  FAULT: 0xfbbf24,
  'NO LANDING': 0x94a3b8,
};

// Camera positions in MuJoCo coordinates: [eye, lookAt].
export const CAMERA_VIEWS = {
  broadcast: { label: 'Broadcast', eye: [-18, -7.5, 6.5], target: [2, 0, 0.8] },
  lineJudge: { label: 'Line judge', eye: [10.4, -6.6, 1.7], target: [9, 3, 0] },
  receiver: { label: 'Receiver', eye: [14, 2.5, 3.2], target: [-2, 0, 2] },
  top: { label: 'Top-down', eye: [0, -0.01, 26], target: [0, 0, 0] },
};

const mjToThree = ([x, y, z]) => new THREE.Vector3(x, z, -y);

function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  const colors = ['#facc15', '#1d4ed8', '#f8fafc', '#facc15', '#1d4ed8', '#f8fafc'];
  colors.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect((i * c.width) / colors.length, 0, c.width / colors.length + 1, c.height);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function netTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(15,23,42,0.95)';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(95, 10); // 10 cm mesh
  return tex;
}

export class CourtRenderer {
  constructor(container, { onPickTarget } = {}) {
    this.container = container;
    this.onPickTarget = onPickTarget;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020617);
    this.scene.fog = new THREE.Fog(0x020617, 40, 80);

    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 200);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 60;

    this.world = new THREE.Group();
    this.world.rotation.x = -Math.PI / 2; // MuJoCo z-up → three.js y-up
    this.scene.add(this.world);

    this.buildLights();
    this.buildCourt();
    this.buildNet();
    this.buildBall();
    this.buildOverlays();
    this.setView('broadcast');

    this.raycaster = new THREE.Raycaster();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.downAt = null;
    this.onPointerDown = (e) => {
      this.downAt = [e.clientX, e.clientY];
    };
    this.onPointerUp = (e) => {
      if (!this.downAt) return;
      const moved = Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]);
      this.downAt = null;
      if (moved < 5) this.pick(e);
    };
    renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    renderer.domElement.addEventListener('pointerup', this.onPointerUp);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-8, 22, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 60 });
    this.scene.add(sun);
  }

  addBox(size, pos, color, opts = {}) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts }),
    );
    mesh.position.set(...pos);
    this.world.add(mesh);
    return mesh;
  }

  buildCourt() {
    const { halfLength: L, halfWidth: W, lineWidth: lw, attackLine } = COURT;

    // Free zone and playing court.
    const freeZone = this.addBox([34, 22, 0.02], [0, 0, -0.011], 0x1e3a8a);
    freeZone.receiveShadow = true;
    const court = this.addBox([2 * L, 2 * W, 0.02], [0, 0, -0.009], 0xd9622b);
    court.receiveShadow = true;

    // Lines sit inside the court dimensions (FIVB Rule 1.3.2).
    const line = (size, pos) => {
      const m = this.addBox([...size, 0.004], [...pos, 0.002], 0xf8fafc, { roughness: 0.6 });
      m.receiveShadow = true;
    };
    line([2 * L, lw], [0, W - lw / 2]);
    line([2 * L, lw], [0, -W + lw / 2]);
    line([lw, 2 * W], [L - lw / 2, 0]);
    line([lw, 2 * W], [-L + lw / 2, 0]);
    line([lw, 2 * W], [0, 0]); // centre line
    line([lw, 2 * W], [attackLine, 0]);
    line([lw, 2 * W], [-attackLine, 0]);
  }

  buildNet() {
    const { netHeight, netBand, netHalfLength, postY, halfWidth, antennaHeight } = COURT;
    const net = new THREE.Mesh(
      new THREE.PlaneGeometry(2 * netHalfLength, netBand),
      new THREE.MeshStandardMaterial({
        map: netTexture(),
        transparent: true,
        alphaTest: 0.2,
        side: THREE.DoubleSide,
        color: 0x0f172a,
      }),
    );
    // Stand the plane up (x→width, z→height), then turn it to run along y.
    net.rotation.set(Math.PI / 2, 0, Math.PI / 2, 'ZYX');
    net.position.set(0, 0, netHeight - netBand / 2);
    this.world.add(net);
    this.addBox([0.02, 2 * netHalfLength, 0.07], [0, 0, netHeight - 0.035], 0xf8fafc);
    this.addBox([0.02, 2 * netHalfLength, 0.05], [0, 0, netHeight - netBand + 0.025], 0xf8fafc);

    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2.5, 16),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.4, roughness: 0.4 }),
      );
      post.rotation.x = Math.PI / 2;
      post.position.set(0, s * postY, 1.25);
      post.castShadow = true;
      this.world.add(post);

      // Antenna: 1.8 m rod in 10 cm red/white bands.
      const total = netBand + antennaHeight;
      const base = netHeight - netBand;
      for (let i = 0; i < total / 0.1; i++) {
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.006, 0.006, 0.1, 8),
          new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf8fafc : 0xdc2626 }),
        );
        seg.rotation.x = Math.PI / 2;
        seg.position.set(0, s * halfWidth, base + 0.05 + i * 0.1);
        this.world.add(seg);
      }
    }
  }

  buildBall() {
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL.radius, 32, 20),
      new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.55 }),
    );
    this.ball.castShadow = true;
    this.world.add(this.ball);
  }

  buildOverlays() {
    // Ball trail.
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL * 3), 3));
    trailGeo.setDrawRange(0, 0);
    this.trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 }),
    );
    this.trail.frustumCulled = false;
    this.world.add(this.trail);
    this.trailCount = 0;

    // Aim target: a cyan crosshair ring on the floor.
    this.targetMarker = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.28, 40),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9 }),
    );
    this.targetMarker.add(ring);
    for (const r of [0, Math.PI / 2]) {
      const bar = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.025),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
      );
      bar.rotation.z = r;
      this.targetMarker.add(bar);
    }
    this.targetMarker.position.z = 0.01;
    this.world.add(this.targetMarker);

    // Landing mark: ball-sized disc where the ball first touched the floor.
    this.landingMarker = new THREE.Mesh(
      new THREE.CircleGeometry(0.06, 32),
      new THREE.MeshBasicMaterial({ color: 0x4ade80 }),
    );
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.13, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }),
    );
    this.landingMarker.add(halo);
    this.landingMarker.position.z = 0.012;
    this.landingMarker.visible = false;
    this.world.add(this.landingMarker);

    // Batch landing dots.
    this.dots = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.07, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      MAX_DOTS,
    );
    this.dots.count = 0;
    this.dots.frustumCulled = false;
    this.world.add(this.dots);
  }

  setView(name) {
    const v = CAMERA_VIEWS[name] ?? CAMERA_VIEWS.broadcast;
    this.camera.position.copy(mjToThree(v.eye));
    this.controls.target.copy(mjToThree(v.target));
    this.controls.update();
  }

  setTarget(target) {
    this.targetMarker.visible = Boolean(target);
    if (target) this.targetMarker.position.set(target.x, target.y, 0.01);
  }

  setBall(pos, quat) {
    this.ball.position.set(pos[0], pos[1], pos[2]);
    if (quat) this.ball.quaternion.set(quat[1], quat[2], quat[3], quat[0]);
  }

  clearTrail() {
    this.trailCount = 0;
    this.trail.geometry.setDrawRange(0, 0);
    this.landingMarker.visible = false;
  }

  pushTrail(pos) {
    if (this.trailCount >= MAX_TRAIL) return;
    const attr = this.trail.geometry.attributes.position;
    attr.setXYZ(this.trailCount, pos[0], pos[1], pos[2]);
    this.trailCount += 1;
    attr.needsUpdate = true;
    this.trail.geometry.setDrawRange(0, this.trailCount);
  }

  showLanding(result) {
    if (!result?.landing) return;
    this.landingMarker.position.set(result.landing.x, result.landing.y, 0.012);
    this.landingMarker.material.color.setHex(CALL_COLORS[result.call] ?? 0xffffff);
    this.landingMarker.visible = true;
  }

  setDots(results) {
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    const list = results.filter((r) => r.landing).slice(-MAX_DOTS);
    list.forEach((r, i) => {
      m.makeTranslation(r.landing.x, r.landing.y, 0.008);
      this.dots.setMatrixAt(i, m);
      this.dots.setColorAt(i, color.setHex(CALL_COLORS[r.call] ?? 0xffffff));
    });
    this.dots.count = list.length;
    this.dots.instanceMatrix.needsUpdate = true;
    if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
  }

  pick(e) {
    if (!this.onPickTarget) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.floorPlane, hit)) {
      this.onPickTarget({ x: hit.x, y: -hit.z }); // three.js → MuJoCo coordinates
    }
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
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.controls.dispose();
    this.scene.traverse((obj) => {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      mats.forEach((mat) => {
        mat.map?.dispose();
        mat.dispose();
      });
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
