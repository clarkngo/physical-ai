import { useCallback, useRef, useState } from 'react';
import { useMujocoScene } from '../MujocoShared/useMujocoScene.js';
import { ArmSim } from './armSim.js';
import { GraspMonitor, buildPickPlace, requiredGripForce } from './pickPlaceTask.js';
import { Chip, LabHeader, Slider, Stat, ViewOverlay } from './ui.jsx';

const STATUS = {
  idle: { label: 'Ready', tone: 'text-slate-300 border-slate-500/40 bg-slate-700/20', color: 0xfbbf24 },
  resting: { label: 'On the pick table', tone: 'text-slate-300 border-slate-500/40 bg-slate-700/20', color: 0xfbbf24 },
  held: { label: 'Held', tone: 'text-green-300 border-green-400/40 bg-green-500/10', color: 0x4ade80 },
  slipping: { label: 'Slipping', tone: 'text-amber-300 border-amber-300/40 bg-amber-400/10', color: 0xf59e0b },
  dropped: { label: 'Dropped', tone: 'text-red-300 border-red-400/40 bg-red-500/10', color: 0xf87171 },
  missed: { label: 'Missed the target', tone: 'text-red-300 border-red-400/40 bg-red-500/10', color: 0xf87171 },
  placed: { label: 'Placed ✓', tone: 'text-green-300 border-green-400/40 bg-green-500/10', color: 0x4ade80 },
};

const SPEEDS = { 0.4: 'Fast', 0.7: 'Brisk', 1: 'Normal', 1.5: 'Slow' };

export default function PhysicalPickPlaceLab() {
  const containerRef = useRef(null);
  const monitorRef = useRef(null);
  const segmentsRef = useRef([]);
  const runningRef = useRef(false);
  const finishAtRef = useRef(null);
  const nextUiRef = useRef(0);

  const [grip, setGrip] = useState(15);
  const [mass, setMass] = useState(0.3);
  const [mu, setMu] = useState(0.8);
  const [pace, setPace] = useState(1);
  const [gravityComp, setGravityComp] = useState(true);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState({ step: -1, status: 'idle', force: 0, slip: 0, trackErr: 0 });
  const [result, setResult] = useState(null);

  const onFrame = useCallback((dt, sim, view) => {
    if (!runningRef.current) {
      sim.advance(dt); // keep the physics alive (cube settles, arm holds)
      return;
    }
    const mon = monitorRef.current;
    let worst = 0;
    sim.advance(dt, () => {
      const d = sim.desired().q;
      const q = sim.jointPositions();
      worst = Math.max(worst, ...d.map((v, i) => Math.abs(v - q[i])));
    });
    mon.update();
    mon.trackErr = Math.max(mon.trackErr ?? 0, worst);
    view.setGeomColor(sim.ids.cubeGeom, STATUS[mon.status]?.color ?? 0xfbbf24);

    if (sim.trajectoryDone && finishAtRef.current === null) finishAtRef.current = sim.time + 0.5;
    const finished = finishAtRef.current !== null && sim.time >= finishAtRef.current;

    if (finished || sim.unstable) {
      runningRef.current = false;
      const status = sim.unstable ? 'missed' : mon.finish();
      view.setGeomColor(sim.ids.cubeGeom, STATUS[status].color);
      setResult({
        status,
        unstable: sim.unstable,
        slip: mon.maxSlip,
        trackErr: mon.trackErr,
        placementError: mon.placementError,
      });
      setLive((l) => ({ ...l, step: -1, status }));
      setRunning(false);
    } else if (sim.time >= nextUiRef.current) {
      nextUiRef.current = sim.time + 0.1;
      setLive({
        step: sim.activeSegment(),
        status: mon.status,
        force: mon.gripForce,
        slip: mon.maxSlip,
        trackErr: mon.trackErr,
      });
    }
  }, []);

  const { status, error, simRef, viewRef } = useMujocoScene(
    containerRef,
    (mujoco) => new ArmSim(mujoco, { withTask: true }),
    { eye: [0.55, -2.1, 1.35], target: [0.45, 0, 0.75] },
    onFrame,
  );

  const ready = status === 'ready';
  const segments = buildPickPlace(pace);

  const reset = () => {
    const sim = simRef.current;
    if (!sim) return;
    runningRef.current = false;
    sim.reset();
    viewRef.current?.setGeomColor(sim.ids.cubeGeom, STATUS.idle.color);
    setRunning(false);
    setResult(null);
    setLive({ step: -1, status: 'idle', force: 0, slip: 0, trackErr: 0 });
  };

  const run = () => {
    const sim = simRef.current;
    if (!sim) return;
    sim.reset();
    sim.setGripForce(grip);
    sim.setCubeMass(mass);
    sim.setCubeFriction(mu);
    sim.controller = { mode: gravityComp ? 'pdg' : 'pd', kp: 400, kd: 40 };
    sim.mj.mj_forward(sim.model, sim.data);
    segmentsRef.current = buildPickPlace(pace);
    sim.runSegments(segmentsRef.current);
    monitorRef.current = new GraspMonitor(sim);
    finishAtRef.current = null;
    nextUiRef.current = 0;
    setResult(null);
    runningRef.current = true;
    setRunning(true);
  };

  const needed = requiredGripForce(mass, mu);
  const shownStatus = STATUS[live.status] ?? STATUS.idle;

  return (
    <div className="simulator-panel space-y-5 rounded-2xl p-6">
      <LabHeader num="05" title="Physical Pick & Place">
        The Lab 03 cycle, but nothing is scripted to stick. The fingers squeeze the cube with a set force, and
        only friction holds it: each finger contact can resist up to μ × squeeze before the cube slides. Change
        the grip, mass, friction and speed, and see when the grasp fails.
      </LabHeader>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <div className="relative aspect-[16/10] min-h-[280px] w-full overflow-hidden rounded-xl" style={{ border: '1px solid rgba(251,146,60,0.25)' }}>
            <div ref={containerRef} className="absolute inset-0" />
            <ViewOverlay status={status} error={error} />
            <div className={`pointer-events-none absolute left-3 top-3 rounded-lg border px-2.5 py-1 text-xs font-semibold ${shownStatus.tone}`}>
              Cube: {shownStatus.label}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Squeeze (both fingers)" value={`${live.force.toFixed(1)} N`} />
            <Stat label="Needed per finger" value={`${needed.toFixed(1)} N`} tone={grip < needed ? 'text-red-300' : 'text-slate-200'} />
            <Stat label="Slip in grip" value={`${(live.slip * 100).toFixed(1)} cm`} tone={live.slip > 0.015 ? 'text-amber-300' : 'text-slate-200'} />
            <Stat label="Max tracking error" value={`${((live.trackErr * 180) / Math.PI).toFixed(1)}°`} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="simulator-panel space-y-3 rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400">Grasp physics</h3>
            <Slider label="Grip force per finger" unit="N" min={1} max={40} step={0.5} value={grip} disabled={running} onChange={setGrip} />
            <Slider label="Cube mass" unit="kg" min={0.1} max={2} step={0.05} value={mass} disabled={running} onChange={setMass} />
            <Slider label="Friction coefficient μ" unit="" min={0.1} max={1.2} step={0.05} value={mu} disabled={running} onChange={setMu} />
            <div>
              <p className="mb-1.5 text-xs text-slate-300">Motion speed</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SPEEDS).map(([p, label]) => (
                  <Chip key={p} active={pace === Number(p)} disabled={running} onClick={() => setPace(Number(p))}>{label}</Chip>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={gravityComp} disabled={running} onChange={(e) => setGravityComp(e.target.checked)} className="accent-orange-500" />
              Gravity compensation (see Lab 04)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={run} disabled={!ready || running}
                className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-orange-400 disabled:opacity-40">
                {running ? 'Running…' : 'Run cycle'}
              </button>
              <button onClick={reset} disabled={!ready}
                className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700 disabled:opacity-40">
                Reset
              </button>
            </div>
          </div>

          <div className="simulator-panel rounded-xl p-4">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-orange-400">Sequence</h3>
            <ol className="space-y-1 text-xs">
              {segments.map((s, i) => (
                <li key={s.label} className={`flex items-center gap-2 ${live.step === i ? 'text-orange-300' : 'text-slate-500'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${live.step === i ? 'bg-orange-400' : 'bg-slate-700'}`} />
                  {s.label}
                  <span className="ml-auto font-mono text-[10px] text-slate-600">{s.duration.toFixed(1)}s</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {result && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${STATUS[result.status].tone}`}>
          <span className="font-semibold">{STATUS[result.status].label}</span>
          {result.unstable && <span> · the simulation became unstable and stopped.</span>}
          {result.status === 'placed' && result.placementError !== null && (
            <span className="text-slate-300"> · {(result.placementError * 100).toFixed(1)} cm from the target centre, slipped {(result.slip * 100).toFixed(1)} cm in the grip.</span>
          )}
          {result.status !== 'placed' && !result.unstable && (
            <span className="text-slate-300">
              {' '}· {grip < needed
                ? `${grip.toFixed(1)} N per finger is below the ${needed.toFixed(1)} N needed just to hold ${mass.toFixed(2)} kg at μ = ${mu.toFixed(2)}.`
                : 'The squeeze can hold the cube at rest, but not while it is accelerated. Try more grip or a slower motion.'}
            </span>
          )}
        </div>
      )}

      <div className="simulator-panel rounded-xl p-4 text-xs leading-relaxed text-slate-400">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-orange-400">What&apos;s going on</h3>
        <ul className="list-disc space-y-1 pl-4">
          <li><span className="text-slate-200">Holding force:</span> two finger contacts can carry 2 · μ · F, which must be at least m · g. That gives the &quot;needed per finger&quot; figure.</li>
          <li><span className="text-slate-200">Moving costs grip:</span> lifting and stopping accelerate the cube, so a grip that holds it at rest can still slip on a fast cycle.</li>
          <li><span className="text-slate-200">Motion:</span> the gripper moves along straight lines (inverse kinematics solved every step), and the arm tracks them with the PD controller from Lab 04.</li>
          <li><span className="text-slate-200">Fingers:</span> position servos whose force is capped at the grip setting, so they squeeze with exactly that force once they touch the cube.</li>
        </ul>
      </div>
    </div>
  );
}
