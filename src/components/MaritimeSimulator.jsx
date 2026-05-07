import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import aisRoutes from '../data/aisRoutes.json';

const scenarioParams = {
  normal: { weather: 0.25, traffic: 0.35, baselineFuel: 94, baselineHours: 10.8 },
  congestion: { weather: 0.35, traffic: 0.78, baselineFuel: 101, baselineHours: 12.6 },
  storm: { weather: 0.82, traffic: 0.5, baselineFuel: 112, baselineHours: 14.2 },
};

// zAmplitude: peak deviation in Z at mid-route (positive = toward viewer, negative = away)
// laneOffset:  constant Z shift so start/end points sit in separate lanes
function createRoutingPath(points, zAmplitude, laneOffset = 0) {
  const n = points.length;
  return points.map((_, idx) => {
    const t = idx / (n - 1);              // 0 → 1 along the route
    const x = idx * 2.2 - 3.3;
    const z = zAmplitude * Math.sin(t * Math.PI) + laneOffset;
    return new THREE.Vector3(x, 0.4, z);
  });
}

function buildAnalytics({ scenario, algorithm, weatherPenalty, trafficPenalty, speedKnots, fuelCost }) {
  const base = scenarioParams[scenario];
  const algoFactor = algorithm === 'energy' ? 0.78 : algorithm === 'safety' ? 0.85 : 0.81;
  const weather = weatherPenalty / 100;
  const traffic = trafficPenalty / 100;

  const baselineFuel = base.baselineFuel + weather * 18 + traffic * 12;
  const aiFuel = baselineFuel * algoFactor;

  const baselineHours = base.baselineHours + weather * 2.4 + traffic * 1.5;
  const aiHours = Math.max(8.2, baselineHours * (algorithm === 'safety' ? 1.02 : 0.93) - speedKnots / 120);

  const baselineRisk = Math.min(96, 34 + weather * 42 + traffic * 35);
  const aiRisk = Math.max(8, baselineRisk * (algorithm === 'safety' ? 0.6 : 0.74));

  const emissionsSaved = Math.max(0, (baselineFuel - aiFuel) * 3.206);
  const costSaved = Math.max(0, (baselineFuel - aiFuel) * fuelCost);
  const confidence = Math.round(78 + (1 - weather) * 9 + (1 - traffic) * 8);

  return { baselineFuel, aiFuel, baselineHours, aiHours, baselineRisk, aiRisk, emissionsSaved, costSaved, confidence };
}

export default function MaritimeSimulator() {
  const mountRef = useRef(null);
  const [isRunning, setIsRunning] = useState(true);
  const [scenario, setScenario] = useState('normal');
  const [algorithm, setAlgorithm] = useState('balanced');
  const [weatherPenalty, setWeatherPenalty] = useState(35);
  const [trafficPenalty, setTrafficPenalty] = useState(40);
  const [speedKnots, setSpeedKnots] = useState(18);
  const [fuelCost, setFuelCost] = useState(760);
  const [simTick, setSimTick] = useState(0);

  const analytics = useMemo(
    () => buildAnalytics({ scenario, algorithm, weatherPenalty, trafficPenalty, speedKnots, fuelCost }),
    [scenario, algorithm, weatherPenalty, trafficPenalty, speedKnots, fuelCost],
  );

  const comparativeSeries = useMemo(
    () =>
      Array.from({ length: 7 }, (_, idx) => {
        const baseline = analytics.baselineFuel + idx * (2.3 + weatherPenalty / 140);
        const optimized = analytics.aiFuel + idx * (1.35 + trafficPenalty / 190);
        return { baseline, optimized, step: idx + 1 };
      }),
    [analytics.baselineFuel, analytics.aiFuel, weatherPenalty, trafficPenalty],
  );

  useEffect(() => {
    if (!mountRef.current) return undefined;

    // ── Scene setup ────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#00080f');
    scene.fog = new THREE.FogExp2(0x00080f, 0.014);

    const W = mountRef.current.clientWidth;
    const H = 420;
    const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 1000);
    camera.position.set(0, 2.5, 4.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.target.set(0, 0.4, 0);

    // ── Lighting ───────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x1a3a5c, 1.4));

    const sun = new THREE.DirectionalLight(0x4ab8ff, 1.6);
    sun.position.set(6, 12, 5);
    scene.add(sun);

    // Moving point lights that travel with each ship
    const aiLight       = new THREE.PointLight(0x00a3e0, 2.5, 6);
    const baselineLight = new THREE.PointLight(0xf97316, 2.0, 5);
    scene.add(aiLight);
    scene.add(baselineLight);

    // ── Ocean ──────────────────────────────────────────────────────────────
    // Solid dark base layer
    const seaBase = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 22),
      new THREE.MeshPhongMaterial({ color: 0x001428, shininess: 40 }),
    );
    seaBase.rotation.x = -Math.PI / 2;
    seaBase.position.y = -0.05;
    scene.add(seaBase);

    // Animated wireframe wave grid on top
    const waterGeo = new THREE.PlaneGeometry(40, 22, 80, 80);
    const waterMat = new THREE.MeshPhongMaterial({
      color: 0x0066aa,
      shininess: 120,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    scene.add(water);

    // Cache original XZ positions to avoid drift when animating Y
    const wPos = waterGeo.attributes.position;
    const wBaseY = new Float32Array(wPos.count);
    for (let i = 0; i < wPos.count; i++) wBaseY[i] = 0;

    // ── Ship geometry ──────────────────────────────────────────────────────
    function makeShip(hullColor, bowColor) {
      const group = new THREE.Group();
      // Hull
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.52, 2.0),
        new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.3, metalness: 0.4 }),
      );
      group.add(hull);
      // Bow cone
      const bow = new THREE.Mesh(
        new THREE.ConeGeometry(0.38, 0.9, 4),
        new THREE.MeshStandardMaterial({ color: bowColor, roughness: 0.25, metalness: 0.5 }),
      );
      bow.rotation.x = Math.PI / 2;
      bow.position.z = 1.35;
      group.add(bow);
      // Bridge superstructure
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.38, 0.5),
        new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.5 }),
      );
      bridge.position.set(0, 0.42, -0.4);
      group.add(bridge);
      return group;
    }

    const aiShipGroup       = makeShip(0xd0e8ff, 0x00a3e0);
    const baselineShipGroup = makeShip(0x4a2000, 0xf97316);
    aiShipGroup.position.y       = 0.4;
    baselineShipGroup.position.y = 0.4;
    scene.add(aiShipGroup);
    scene.add(baselineShipGroup);

    // ── Route paths ────────────────────────────────────────────────────────
    // AI: tighter arc toward +Z (efficient route)
    const aiAmplitude = algorithm === 'safety' ? 0.9 : algorithm === 'energy' ? 0.45 : 0.65;
    // Baseline: wider arc toward −Z (suboptimal, more detour)
    const baselineAmplitude = -(1.4 + trafficPenalty / 110);
    // Both paths share the same start/end point (same ship, two possible routes)
    const aiPathPoints       = createRoutingPath(aisRoutes, aiAmplitude,       0);
    const baselinePathPoints = createRoutingPath(aisRoutes, baselineAmplitude, 0);

    const aiLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(aiPathPoints),
      new THREE.LineBasicMaterial({ color: 0x00a3e0, linewidth: 1 }),
    );
    scene.add(aiLine);

    const baselineLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(baselinePathPoints),
      new THREE.LineDashedMaterial({ color: 0xf97316, dashSize: 0.28, gapSize: 0.2 }),
    );
    baselineLine.computeLineDistances();
    scene.add(baselineLine);

    // ── Wake trails ────────────────────────────────────────────────────────
    const WAKE_LEN = 32;

    function makeWakeTrail(color) {
      const buf  = new Float32Array(WAKE_LEN * 3);
      const attr = new THREE.BufferAttribute(buf, 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', attr);
      geo.setDrawRange(0, WAKE_LEN);
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        linewidth: 1,
      });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      return { buf, attr, geo, mat };
    }

    const aiWake       = makeWakeTrail(0x00a3e0);
    const baselineWake = makeWakeTrail(0xf97316);

    function shiftWake(wake, pos) {
      // Shift history back one slot and insert current position at front
      for (let i = WAKE_LEN - 1; i > 0; i--) {
        wake.buf[i * 3]     = wake.buf[(i - 1) * 3];
        wake.buf[i * 3 + 1] = wake.buf[(i - 1) * 3 + 1];
        wake.buf[i * 3 + 2] = wake.buf[(i - 1) * 3 + 2];
      }
      wake.buf[0] = pos.x;
      wake.buf[1] = 0.08;
      wake.buf[2] = pos.z;
      wake.attr.needsUpdate = true;
    }

    // ── Sonar pulse rings (emanate from AI ship) ───────────────────────────
    const SONAR_COUNT = 3;
    const sonarRings = Array.from({ length: SONAR_COUNT }, (_, i) => {
      const geo = new THREE.RingGeometry(0.05, 0.12, 36);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00a3e0,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.08;
      scene.add(mesh);
      return { mesh, mat, phase: i / SONAR_COUNT };
    });

    // ── Animation loop ─────────────────────────────────────────────────────
    let frame = 0;
    let rafId;

    const animate = () => {
      if (isRunning) frame += 0.004;

      // -- Animated ocean waves (gentle swells) --
      for (let i = 0; i < wPos.count; i++) {
        const x = wPos.getX(i);
        const z = wPos.getZ(i);
        const y = Math.sin(x * 0.55 + frame * 0.9) * 0.10
                + Math.cos(z * 0.70 + frame * 0.7) * 0.07
                + Math.sin((x - z) * 0.35 + frame * 1.1) * 0.04;
        wPos.setY(i, y);
      }
      wPos.needsUpdate = true;
      waterMat.opacity = 0.38 + Math.sin(frame * 1.2) * 0.05;

      // -- Helper: get yaw angle from path tangent so ships face where they travel --
      const getHeading = (pts, seg) => {
        const from = pts[Math.max(0, seg - 1)];
        const to   = pts[Math.min(seg + 1, pts.length - 1)];
        return Math.atan2(to.x - from.x, to.z - from.z);
      };

      // -- AI ship position: forward-only loop (0 → 1, then reset) --
      const LOOP = 4.5; // frame-units per traversal (~19 s at 60 fps)
      const t    = (frame % LOOP) / LOOP;
      const aiSeg  = Math.min(Math.floor(t * (aiPathPoints.length - 1)), aiPathPoints.length - 2);
      const aiLocT = t * (aiPathPoints.length - 1) - aiSeg;
      aiShipGroup.position.lerpVectors(aiPathPoints[aiSeg], aiPathPoints[aiSeg + 1], aiLocT);
      aiShipGroup.position.y = 0.4 + Math.sin(frame * 2.2) * 0.025;
      aiShipGroup.rotation.y = getHeading(aiPathPoints, aiSeg);
      aiShipGroup.rotation.z = Math.sin(frame * 1.8) * 0.022;

      // -- Baseline ship: same loop, same departure time --
      const laggedT  = t;
      const baseSeg  = Math.min(Math.floor(laggedT * (baselinePathPoints.length - 1)), baselinePathPoints.length - 2);
      const baseLocT = laggedT * (baselinePathPoints.length - 1) - baseSeg;
      baselineShipGroup.position.lerpVectors(baselinePathPoints[baseSeg], baselinePathPoints[baseSeg + 1], baseLocT);
      baselineShipGroup.position.y = 0.4 + Math.sin(frame * 2.0) * 0.025;
      baselineShipGroup.rotation.y = getHeading(baselinePathPoints, baseSeg);
      baselineShipGroup.rotation.z = Math.sin(frame * 1.6) * 0.022;

      // -- Point lights follow ships --
      aiLight.position.copy(aiShipGroup.position).setY(1.2);
      baselineLight.position.copy(baselineShipGroup.position).setY(1.0);

      // -- Wake trails --
      shiftWake(aiWake, aiShipGroup.position);
      shiftWake(baselineWake, baselineShipGroup.position);

      // -- Sonar pulses expand from AI ship --
      sonarRings.forEach(({ mesh, mat, phase }) => {
        const progress = ((frame * 0.42 + phase) % 1.0);
        const scale    = 0.4 + progress * 7;
        mat.opacity = 0.6 * Math.max(0, 1 - progress);
        mesh.scale.set(scale, scale, scale);
        mesh.position.x = aiShipGroup.position.x;
        mesh.position.z = aiShipGroup.position.z;
      });

      controls.update();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    animate();

    // ── Resize handler ─────────────────────────────────────────────────────
    const onResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      renderer.setSize(w, 420);
      camera.aspect = w / 420;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    const timer = setInterval(() => {
      if (isRunning) setSimTick((prev) => (prev + 1) % 999);
    }, 1200);

    return () => {
      clearInterval(timer);
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [isRunning, scenario, algorithm, trafficPenalty]);

  return (
    <section className="simulator-panel space-y-5 rounded-3xl p-6 md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-whiteHull md:text-3xl">Route Optimization Lab</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">
            Analyze how AI-generated trajectory adjustments affect fuel consumption relative to a conventional route.
          </p>
        </div>
        <div className="rounded-xl border border-pacificCyan/30 bg-deepSea/50 px-3 py-2 text-xs text-slate-200">
          <span className="font-semibold text-pacificCyan">Model confidence:</span> {analytics.confidence}%
        </div>
      </div>

      <div className="glass-card flex flex-wrap items-center gap-2 rounded-2xl p-3 text-xs text-slate-200">
        <span className="font-semibold uppercase tracking-wide text-pacificCyan">Scenario</span>
        {[
          ['normal', 'Standard Transit'],
          ['congestion', 'Harbor Congestion'],
          ['storm', 'Adverse Weather'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setScenario(id)}
            className={`rounded-full px-3 py-1.5 transition ${
              scenario === id ? 'bg-pacificCyan text-slate-950' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIsRunning((prev) => !prev)}
          className="ml-auto rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-900 transition hover:bg-white"
        >
          {isRunning ? 'Pause Simulation' : 'Run Simulation'}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="glass-card rounded-2xl p-3 text-xs text-slate-300">
          Optimization Profile
          <select
            value={algorithm}
            onChange={(event) => setAlgorithm(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-slate-100"
          >
            <option value="balanced">Balanced Objective</option>
            <option value="energy">Fuel-Minimization Priority</option>
            <option value="safety">Safety-Margin Priority</option>
          </select>
        </label>
        <label className="glass-card rounded-2xl p-3 text-xs text-slate-300">
          Weather Severity: <span className="text-pacificCyan">{weatherPenalty}%</span>
          <input
            type="range"
            min="10"
            max="95"
            step="1"
            value={weatherPenalty}
            onChange={(event) => setWeatherPenalty(Number(event.target.value))}
            className="mt-2 w-full"
          />
        </label>
        <label className="glass-card rounded-2xl p-3 text-xs text-slate-300">
          Traffic Density: <span className="text-pacificCyan">{trafficPenalty}%</span>
          <input
            type="range"
            min="10"
            max="95"
            step="1"
            value={trafficPenalty}
            onChange={(event) => setTrafficPenalty(Number(event.target.value))}
            className="mt-2 w-full"
          />
        </label>
        <label className="glass-card rounded-2xl p-3 text-xs text-slate-300">
          Vessel Speed: <span className="text-pacificCyan">{speedKnots} kn</span>
          <input
            type="range"
            min="10"
            max="28"
            step="1"
            value={speedKnots}
            onChange={(event) => setSpeedKnots(Number(event.target.value))}
            className="mt-2 w-full"
          />
        </label>
      </div>

      <div ref={mountRef} className="overflow-hidden rounded-3xl border border-pacificCyan/40 bg-slate-950" />
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span>Drag to orbit · scroll to zoom</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm bg-blue-200/80" />
          AI-optimised route
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm bg-orange-500/80" />
          Baseline route
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full border border-pacificCyan/60" />
          Sonar pulse
        </span>
        <span className="ml-auto tabular-nums text-slate-500">tick {simTick}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="metric-card rounded-2xl p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Optimized Fuel</p>
          <p className="text-lg font-semibold text-pacificCyan">{analytics.aiFuel.toFixed(1)} t</p>
        </div>
        <div className="metric-card rounded-2xl p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Baseline Fuel</p>
          <p className="text-lg font-semibold text-orange-400">{analytics.baselineFuel.toFixed(1)} t</p>
        </div>
        <div className="metric-card rounded-2xl p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">ETA Improvement</p>
          <p className="text-lg font-semibold text-pacificCyan">{(analytics.baselineHours - analytics.aiHours).toFixed(2)} h</p>
        </div>
        <div className="metric-card rounded-2xl p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Risk Reduction</p>
          <p className="text-lg font-semibold text-pacificCyan">{(analytics.baselineRisk - analytics.aiRisk).toFixed(1)} pts</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-sm text-slate-300">Comparative Segment Fuel (t)</p>
          <div className="mt-4 space-y-2.5">
            {comparativeSeries.map((row) => (
              <div key={row.step} className="text-xs text-slate-200">
                <div className="mb-1 flex justify-between">
                  <span>Segment {row.step}</span>
                  <span>
                    AI {row.optimized.toFixed(1)} | Baseline {row.baseline.toFixed(1)}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-cyan-300 to-pacificCyan"
                    style={{ width: `${Math.min(98, (row.optimized / row.baseline) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <label className="block text-xs text-slate-300">
            Fuel Cost Assumption (USD/t)
            <input
              type="number"
              min="400"
              max="1400"
              value={fuelCost}
              onChange={(event) => setFuelCost(Number(event.target.value))}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-slate-100"
            />
          </label>
          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200">
            <p>
              Estimated CO2 avoided: <span className="font-semibold text-pacificCyan">{analytics.emissionsSaved.toFixed(1)} t</span>
            </p>
            <p className="mt-1">
              Estimated fuel cost reduction: <span className="font-semibold text-pacificCyan">${analytics.costSaved.toFixed(0)}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
