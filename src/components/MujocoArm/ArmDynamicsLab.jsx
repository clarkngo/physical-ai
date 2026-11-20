import { useCallback, useRef, useState } from 'react';
import { useMujocoScene } from '../MujocoShared/useMujocoScene.js';
import { THREE } from '../MujocoShared/mujocoThreeView.js';
import { ARM } from './armScene.js';
import { ArmSim, CONTROLLERS, GAIN_SCALE } from './armSim.js';
import { Chip, JOINT_COLORS, JOINT_LABELS, LabHeader, Slider, ViewOverlay } from './ui.jsx';

const DEG = Math.PI / 180;
const CHART_SECONDS = 6;
const CHART_HZ = 50;
const CHART_RANGE = 20; // ± degrees shown

const POSES = {
  reach: { label: 'Reach out', q: [0, 0, 0] },
  upright: { label: 'Upright', q: [90, 0, 0] },
  fold: { label: 'Fold', q: [120, -135, 60] },
  wave: { label: 'Elbow up', q: [45, 60, -30] },
};

/** Translucent copy of the arm showing where the controller is trying to go. */
class GhostArm {
  constructor(world) {
    this.group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.28, depthWrite: false });
    this.links = [0.05, 0.042, 0.034].map((r) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 16), material);
      this.group.add(m);
      return m;
    });
    world.add(this.group);
  }

  update([q1, q2, q3]) {
    const { L1, L2, L3, shoulderZ } = ARM;
    const pts = [[0, 0, shoulderZ]];
    let a = 0;
    [[q1, L1], [q2, L2], [q3, L3]].forEach(([q, L]) => {
      a += q;
      const [x, , z] = pts[pts.length - 1];
      pts.push([x + L * Math.cos(a), 0, z + L * Math.sin(a)]);
    });
    const up = new THREE.Vector3(0, 1, 0);
    this.links.forEach((mesh, i) => {
      const p0 = new THREE.Vector3(...pts[i]);
      const p1 = new THREE.Vector3(...pts[i + 1]);
      const dir = p1.clone().sub(p0);
      mesh.position.copy(p0).addScaledVector(dir, 0.5);
      mesh.scale.set(1, dir.length(), 1);
      mesh.quaternion.setFromUnitVectors(up, dir.normalize());
    });
  }
}

function drawChart(canvas, history) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(148,163,184,0.15)';
  ctx.lineWidth = 1;
  for (const v of [-CHART_RANGE, -10, 0, 10, CHART_RANGE]) {
    const y = h / 2 - (v / CHART_RANGE) * (h / 2 - 6);
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.6)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(`${v > 0 ? '+' : ''}${v}°`, 2, y + 3);
  }
  const n = CHART_SECONDS * CHART_HZ;
  for (let j = 0; j < 3; j++) {
    ctx.strokeStyle = JOINT_COLORS[j];
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    history.forEach((errs, i) => {
      const x = 30 + ((i + n - history.length) / n) * (w - 30);
      const v = Math.max(-CHART_RANGE, Math.min(CHART_RANGE, errs[j]));
      const y = h / 2 - (v / CHART_RANGE) * (h / 2 - 6);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}

export default function ArmDynamicsLab() {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const ghostRef = useRef(null);
  const historyRef = useRef([]);
  const nextSampleRef = useRef(0);
  const nextUiRef = useRef(0);

  const [mode, setMode] = useState('pd');
  const [kp, setKp] = useState(400);
  const [kd, setKd] = useState(40);
  const [payload, setPayload] = useState(0);
  const [target, setTarget] = useState([90, 0, 0]);
  const [smooth, setSmooth] = useState(false);
  const [live, setLive] = useState(null);

  const onFrame = useCallback((dt, sim, view) => {
    if (!ghostRef.current) ghostRef.current = new GhostArm(view.world);
    const payloadMesh = view.geomMeshes[sim.ids.payloadGeom];
    if (payloadMesh) payloadMesh.visible = sim.model.body_mass[sim.ids.payload] > 0.01;
    sim.advance(dt);
    const des = sim.desired().q;
    ghostRef.current.update(des);

    if (sim.time >= nextSampleRef.current) {
      nextSampleRef.current = sim.time + 1 / CHART_HZ;
      const q = sim.jointPositions();
      const hist = historyRef.current;
      hist.push(q.map((v, j) => (des[j] - v) / DEG));
      if (hist.length > CHART_SECONDS * CHART_HZ) hist.shift();
      if (chartRef.current) drawChart(chartRef.current, hist);
    }
    if (sim.time >= nextUiRef.current) {
      nextUiRef.current = sim.time + 0.12;
      const q = sim.jointPositions();
      setLive({ q, des, torque: [...sim.torque], unstable: sim.unstable });
    }
  }, []);

  const { status, error, simRef } = useMujocoScene(
    containerRef,
    (mujoco) => {
      const sim = new ArmSim(mujoco, { withPayload: true });
      sim.controller = { mode: 'pd', kp: 400, kd: 40 };
      return sim;
    },
    { eye: [0.3, -3.1, 1.35], target: [0.3, 0, 1.0] },
    onFrame,
  );

  const ready = status === 'ready';

  const applyController = (patch) => {
    const next = { mode, kp, kd, ...patch };
    if (simRef.current) simRef.current.controller = next;
    if ('mode' in patch) setMode(patch.mode);
    if ('kp' in patch) setKp(patch.kp);
    if ('kd' in patch) setKd(patch.kd);
  };

  const goTo = (deg, useSmooth = smooth) => {
    setTarget(deg);
    const sim = simRef.current;
    if (!sim) return;
    const q = deg.map((v) => v * DEG);
    if (useSmooth) sim.runSegments([{ kind: 'joint', to: q, duration: 1.2 }]);
    else sim.stepTo(q);
  };

  const changePayload = (kg) => {
    setPayload(kg);
    simRef.current?.setPayloadMass(kg);
  };

  const reset = () => {
    const sim = simRef.current;
    if (!sim) return;
    sim.reset([Math.PI / 2, 0, 0]);
    sim.setPayloadMass(payload);
    historyRef.current = [];
    setTarget([90, 0, 0]);
  };

  const ctrl = CONTROLLERS[mode];
  const errors = live ? live.q.map((v, j) => (live.des[j] - v) / DEG) : [0, 0, 0];

  return (
    <div className="simulator-panel space-y-5 rounded-2xl p-6">
      <LabHeader num="04" title="Joint Control & Gravity">
        The same 3-joint arm, but now each joint is a torque motor with limits, and the arm has mass. The
        controller has to fight gravity to hold a pose. Compare P, PD and PD with gravity compensation, add a
        payload, and push the hand to see how the arm recovers. The blue ghost is the setpoint.
      </LabHeader>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <div className="relative aspect-[16/10] min-h-[280px] w-full overflow-hidden rounded-xl" style={{ border: '1px solid rgba(251,146,60,0.25)' }}>
            <div ref={containerRef} className="absolute inset-0" />
            <ViewOverlay status={status} error={error} />
          </div>
          <div className="rounded-xl" style={{ border: '1px solid rgba(251,146,60,0.15)' }}>
            <div className="flex items-center justify-between px-3 pt-2 text-[11px]">
              <span className="font-bold uppercase tracking-widest text-orange-400">Tracking error (setpoint − actual)</span>
              <span className="flex gap-3">
                {JOINT_LABELS.map((l, j) => (
                  <span key={l} style={{ color: JOINT_COLORS[j] }}>{l}</span>
                ))}
              </span>
            </div>
            <canvas ref={chartRef} width={640} height={140} className="block h-[140px] w-full" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="simulator-panel space-y-3 rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400">Controller</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CONTROLLERS).map(([key, c]) => (
                <Chip key={key} active={mode === key} disabled={!ready} onClick={() => applyController({ mode: key })}>
                  {c.label}
                </Chip>
              ))}
            </div>
            <Slider label="Kp (stiffness)" unit="N·m/rad" min={50} max={1500} step={10} value={kp} disabled={!ready}
              onChange={(v) => applyController({ kp: v })} />
            <Slider label="Kd (damping)" unit="N·m·s/rad" min={0} max={150} step={1} value={kd} disabled={!ready || !ctrl.usesKd}
              onChange={(v) => applyController({ kd: v })} />
            <p className="text-[11px] text-slate-500">
              Gains shown are for q1; q2 and q3 use ×{GAIN_SCALE[1]} and ×{GAIN_SCALE[2]}.
            </p>
            <Slider label="Payload at the hand" unit="kg" min={0} max={3} step={0.1} value={payload} disabled={!ready}
              onChange={changePayload} />
          </div>

          <div className="simulator-panel space-y-3 rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400">Setpoint</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(POSES).map(([key, p]) => (
                <Chip key={key} disabled={!ready} onClick={() => goTo(p.q)}>{p.label}</Chip>
              ))}
            </div>
            {JOINT_LABELS.map((label, j) => (
              <Slider key={label} label={label} unit="°" step={1} value={target[j]} disabled={!ready}
                min={Math.round(ARM.jointRange[j][0] / DEG)} max={Math.round(ARM.jointRange[j][1] / DEG)}
                onChange={(v) => goTo(target.map((t, k) => (k === j ? v : t)))} />
            ))}
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} className="accent-orange-500" />
              Smooth trajectory (1.2 s) instead of a step
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => simRef.current?.push(80, 0.15)} disabled={!ready}
                className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-orange-400 disabled:opacity-40">
                Push hand ↓
              </button>
              <button onClick={reset} disabled={!ready}
                className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700 disabled:opacity-40">
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {JOINT_LABELS.map((label, j) => {
          const tau = live?.torque[j] ?? 0;
          const lim = ARM.torqueLimit[j];
          const pct = Math.min(Math.abs(tau) / lim, 1);
          const saturated = pct > 0.995;
          return (
            <div key={label} className="rounded-xl bg-slate-900/70 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold" style={{ color: JOINT_COLORS[j] }}>{label}</span>
                <span className={`font-mono text-xs ${Math.abs(errors[j]) > 1 ? 'text-amber-300' : 'text-slate-300'}`}>
                  error {errors[j] >= 0 ? '+' : ''}{errors[j].toFixed(2)}°
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full ${saturated ? 'bg-red-500' : 'bg-orange-500'}`} style={{ width: `${pct * 100}%` }} />
              </div>
              <p className="mt-1 font-mono text-[11px] text-slate-400">
                torque {tau.toFixed(1)} / {lim} N·m{saturated && <span className="text-red-400"> · saturated</span>}
              </p>
            </div>
          );
        })}
      </div>

      <div className="simulator-panel rounded-xl p-4 text-xs leading-relaxed text-slate-400">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-orange-400">Things to try</h3>
        <ul className="list-disc space-y-1 pl-4">
          <li><span className="text-slate-200">Reach out with PD.</span> The arm sags a few degrees: a PD controller only pushes back when there is error, so gravity wins a little.</li>
          <li><span className="text-slate-200">Switch to PD + gravity comp.</span> The controller adds the torque MuJoCo computes for gravity and Coriolis (<code className="text-orange-300">qfrc_bias</code>) as feed-forward, and the error goes to zero.</li>
          <li><span className="text-slate-200">Try P only.</span> With no damping, a step makes the arm overshoot and ring.</li>
          <li><span className="text-slate-200">Add a 3 kg payload and raise Kp.</span> Watch the torque bars: q1 hits its 120 N·m limit (saturates) and the arm can&apos;t follow fast steps.</li>
        </ul>
      </div>
      {live?.unstable && (
        <p className="text-xs text-red-300">The simulation went unstable and was reset. Try lower gains.</p>
      )}
    </div>
  );
}
