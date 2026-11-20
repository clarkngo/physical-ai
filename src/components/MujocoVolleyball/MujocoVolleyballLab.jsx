import { useCallback, useEffect, useRef, useState } from 'react';
import { getMujoco } from '../MujocoShared/mujocoLoader.js';
import { CourtRenderer, CAMERA_VIEWS } from './courtRenderer.js';
import { PRESETS, SAMPLE_HZ, VolleyballSim, randomServe } from './volleyballSim.js';
import { BALL, COURT } from './volleyballScene.js';

const ACCENT = '#facc15';
const BATCH_SIZE = 60;

const CALL_STYLE = {
  IN: 'text-green-400 border-green-400/40 bg-green-500/10',
  OUT: 'text-red-400 border-red-400/40 bg-red-500/10',
  FAULT: 'text-amber-300 border-amber-300/40 bg-amber-400/10',
  'NO LANDING': 'text-slate-300 border-slate-500/40 bg-slate-700/20',
};

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function shotFromPreset(key) {
  const { label, ...shot } = PRESETS[key];
  return { ...shot, target: { ...shot.target } };
}

const fmtCm = (m) => `${m >= 0 ? '+' : '−'}${Math.abs(m * 100).toFixed(1)} cm`;

function Slider({ label, value, min, max, step, unit, onChange, disabled }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-400">
          {Number(value).toFixed(step < 1 ? 2 : 0)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-yellow-400 disabled:opacity-40"
      />
    </label>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-900/70 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-slate-200">{value}</p>
    </div>
  );
}

export default function MujocoVolleyballLab() {
  const viewRef = useRef(null);
  const simRef = useRef(null);
  const rendererRef = useRef(null);
  const runningRef = useRef(false);
  const playbackRef = useRef(1);
  const landingShownRef = useRef(false);
  const batchCancelRef = useRef(false);

  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [presetKey, setPresetKey] = useState('jump');
  const [shot, setShot] = useState(() => shotFromPreset('jump'));
  const [view, setView] = useState('broadcast');
  const [slowMo, setSlowMo] = useState(false);
  const [running, setRunning] = useState(false);
  const [aimInfo, setAimInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [events, setEvents] = useState([]);
  const [csv, setCsv] = useState('');
  const [batch, setBatch] = useState({ running: false, results: [] });

  // ── Load MuJoCo (WASM) and build the three.js view ─────────────────────
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const renderer = new CourtRenderer(viewRef.current, {
      onPickTarget: (t) => {
        if (runningRef.current) return;
        const target = {
          x: Math.max(-12, Math.min(12, t.x)),
          y: Math.max(-8, Math.min(8, t.y)),
        };
        setShot((s) => ({ ...s, target }));
      },
    });
    rendererRef.current = renderer;

    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const sim = simRef.current;
      if (sim && runningRef.current) {
        const newEvents = sim.advance(dt * playbackRef.current);
        const pos = sim.ballPosition();
        renderer.setBall(pos, sim.ballQuaternion());
        renderer.pushTrail(pos);
        if (newEvents.length) setEvents((ev) => [...ev, ...newEvents]);
        if (sim.result && !landingShownRef.current) {
          landingShownRef.current = true;
          renderer.showLanding(sim.result);
          setResult(sim.result);
        }
        if (sim.done) {
          runningRef.current = false;
          sim.finish();
          if (!landingShownRef.current) setResult(sim.result);
          setCsv(sim.toCSV());
          setRunning(false);
        }
      }
      renderer.render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    getMujoco()
      .then((mujoco) => {
        if (cancelled) return;
        simRef.current = new VolleyballSim(mujoco);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(String(err?.message ?? err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
      batchCancelRef.current = true;
      runningRef.current = false;
      cancelAnimationFrame(raf);
      simRef.current?.dispose();
      simRef.current = null;
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Keep the 3D view in sync with the controls.
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || runningRef.current) return;
    r.setTarget(shot.target);
    r.setBall([shot.x, shot.y, shot.z]);
  }, [shot]);

  useEffect(() => {
    rendererRef.current?.setView(view);
  }, [view]);

  useEffect(() => {
    playbackRef.current = slowMo ? 0.2 : 1;
  }, [slowMo]);

  const busy = status !== 'ready' || running || batch.running;

  const choosePreset = (key) => {
    setPresetKey(key);
    setShot(shotFromPreset(key));
    setAimInfo(null);
  };

  const update = (patch) => {
    setPresetKey(null);
    setShot((s) => ({ ...s, ...patch }));
  };

  const serve = useCallback(
    (params) => {
      const sim = simRef.current;
      const renderer = rendererRef.current;
      if (!sim || !renderer) return;
      const aimed = sim.aim(params);
      sim.launch(aimed);
      setAimInfo(aimed);
      setResult(null);
      setEvents([]);
      setCsv('');
      landingShownRef.current = false;
      renderer.clearTrail();
      renderer.setTarget(params.target);
      renderer.setBall(sim.ballPosition(), sim.ballQuaternion());
      runningRef.current = true;
      setRunning(true);
    },
    [],
  );

  const randomize = () => {
    const s = randomServe();
    setPresetKey(null);
    setShot(s);
    serve(s);
  };

  const runBatch = () => {
    const sim = simRef.current;
    if (!sim) return;
    batchCancelRef.current = false;
    const results = [];
    setBatch({ running: true, results });
    rendererRef.current?.clearTrail();
    rendererRef.current?.setDots([]);
    const chunk = () => {
      if (batchCancelRef.current) return;
      for (let i = 0; i < 3 && results.length < BATCH_SIZE; i++) {
        const aimed = sim.aim(randomServe());
        sim.launch(aimed);
        const r = sim.runToEnd();
        results.push({ ...r, params: aimed });
      }
      rendererRef.current?.setDots(results);
      const done = results.length >= BATCH_SIZE;
      setBatch({ running: !done, results: [...results] });
      if (!done) setTimeout(chunk, 0);
    };
    setTimeout(chunk, 0);
  };

  const clearBatch = () => {
    setBatch({ running: false, results: [] });
    rendererRef.current?.setDots([]);
  };

  const batchCSV = () => {
    const header =
      'idx,x0,y0,z0,speed_mps,spin_rps,elevation_deg,azimuth_deg,target_x,target_y,land_x,land_y,call,rule,margin_m,close_call';
    const rows = batch.results.map((r, i) => {
      const p = r.params;
      return [
        i, p.x, p.y, p.z, p.speed, p.spinRps, p.elevationDeg, p.azimuthDeg, p.target.x, p.target.y,
        r.landing?.x ?? '', r.landing?.y ?? '', r.call, r.rule, r.margin ?? '', r.closeCall,
      ]
        .map((v) => (typeof v === 'number' ? v.toFixed(4) : v))
        .join(',');
    });
    download('volleyball-batch-landings.csv', [header, ...rows].join('\n'));
  };

  const counts = batch.results.reduce(
    (acc, r) => {
      acc[r.call] = (acc[r.call] ?? 0) + 1;
      if (r.closeCall) acc.close += 1;
      return acc;
    },
    { close: 0 },
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="simulator-panel relative overflow-hidden rounded-3xl p-7">
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-yellow-400/10 blur-3xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
          MuJoCo · WebAssembly · Proof of concept
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-whiteHull">
          Volleyball Line-Call Sandbox
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
          DeepMind&apos;s MuJoCo physics engine running in your browser. It simulates a serve with gravity,
          air drag, topspin (Magnus lift), and ball contact with the floor, net and antennae. A referee
          module then applies the <span className="text-whiteHull">ball in / ball out</span> rule (FIVB
          Rules 8.3–8.4) to the exact floor-contact point. Each rally exports a {SAMPLE_HZ} Hz
          ground-truth trajectory for testing a vision-based line-call detector.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* 3D view */}
        <div className="glass-card flex flex-col overflow-hidden rounded-2xl">
          <div className="relative aspect-video min-h-[300px] w-full flex-1 lg:aspect-auto">
            <div ref={viewRef} className="absolute inset-0" />
            {status !== 'ready' && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 p-6 text-center text-sm">
                {status === 'loading' ? (
                  <span className="text-slate-300">Loading MuJoCo WebAssembly (~11 MB, first visit only)…</span>
                ) : (
                  <span className="text-red-300">Could not load MuJoCo: {error}</span>
                )}
              </div>
            )}
            <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-slate-950/70 px-2 py-1 text-[11px] text-slate-400">
              Click the court to aim · drag to orbit · scroll to zoom
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/70 px-3 py-2">
            {Object.entries(CAMERA_VIEWS).map(([key, v]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`rounded-lg px-3 py-1 text-xs transition ${
                  view === key ? 'bg-yellow-400 text-slate-900' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {v.label}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={slowMo} onChange={(e) => setSlowMo(e.target.checked)} className="accent-yellow-400" />
              Slow motion (0.2×)
            </label>
          </div>
        </div>

        {/* Controls */}
        <div className="glass-card space-y-4 rounded-2xl p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
              Shot
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => choosePreset(key)}
                  disabled={busy}
                  className={`rounded-lg px-2 py-1.5 text-xs transition disabled:opacity-40 ${
                    presetKey === key ? 'bg-yellow-400 text-slate-900' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Slider label="Ball speed" unit="m/s" min={8} max={32} step={0.5} value={shot.speed} disabled={busy}
              onChange={(speed) => update({ speed })} />
            <Slider label="Topspin" unit="rev/s" min={-4} max={10} step={0.5} value={shot.spinRps} disabled={busy}
              onChange={(spinRps) => update({ spinRps })} />
            <Slider label="Contact height" unit="m" min={1.8} max={3.6} step={0.05} value={shot.z} disabled={busy}
              onChange={(z) => update({ z })} />
            <Slider label="Server position (across court)" unit="m" min={-4.4} max={4.4} step={0.1} value={shot.y}
              disabled={busy} onChange={(y) => update({ y })} />
            <Slider label="Aim X (along court)" unit="m" min={-2} max={12} step={0.01} value={shot.target.x}
              disabled={busy} onChange={(x) => update({ target: { ...shot.target, x } })} />
            <Slider label="Aim Y (across court)" unit="m" min={-7} max={7} step={0.01} value={shot.target.y}
              disabled={busy} onChange={(y) => update({ target: { ...shot.target, y } })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => serve(shot)} disabled={busy}
              className="rounded-xl bg-yellow-400 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-300 disabled:opacity-40">
              {running ? 'In flight…' : 'Hit'}
            </button>
            <button onClick={randomize} disabled={busy}
              className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700 disabled:opacity-40">
              Random serve
            </button>
          </div>
          {aimInfo && (
            <p className="text-[11px] leading-relaxed text-slate-400">
              Solved launch: {aimInfo.elevationDeg.toFixed(1)}° elevation, {aimInfo.azimuthDeg.toFixed(1)}° azimuth
              {!aimInfo.reachable && <span className="text-amber-300"> — target out of range at this speed</span>}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Line call */}
        <div className="glass-card rounded-2xl p-5 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
            Line call
          </p>
          {result ? (
            <div className="mt-3 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-xl border px-4 py-1.5 text-2xl font-bold tracking-wide ${CALL_STYLE[result.call]}`}>
                  {result.call}
                </span>
                {result.closeCall && (
                  <span className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300">
                    Close call — within 5 cm of the line
                  </span>
                )}
                <span className="text-sm text-slate-300">
                  {result.reason}
                  {result.rule && <span className="text-slate-500"> · {result.rule}</span>}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Point to" value={result.point || '—'} />
                <Stat label="Landing (x, y)"
                  value={result.landing ? `${result.landing.x.toFixed(3)}, ${result.landing.y.toFixed(3)} m` : '—'} />
                <Stat label="Margin to line" value={result.margin != null && result.landing?.x > 0 ? fmtCm(result.margin) : '—'} />
                <Stat label="Impact speed" value={result.impactSpeed ? `${result.impactSpeed.toFixed(1)} m/s` : '—'} />
                <Stat label="Flight time" value={`${result.flightTime.toFixed(3)} s`} />
                <Stat label="Net clearance"
                  value={result.crossing ? `${(result.crossing.z - COURT.netHeight - BALL.radius).toFixed(2)} m` : '—'} />
                <Stat label="Net touch" value={result.netTouched ? 'Yes' : 'No'} />
                <Stat label="Frames @ 240 fps" value={Math.round(result.flightTime * SAMPLE_HZ)} />
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Margin is the signed distance from the floor-contact point to the outer edge of the nearest
                boundary line: positive is in, negative is out. Lines belong to the court, so touching the
                line counts as in. At a 60 fps camera the ball moves about {result.impactSpeed ? (result.impactSpeed / 60 * 100).toFixed(0) : '–'} cm
                between frames at impact, which is why a detector must interpolate the bounce from the trajectory.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              {running ? 'Ball in flight…' : 'Pick a shot and press Hit. Try “Line-call test” for a ball that lands 2 cm past the end line.'}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => download('volleyball-trajectory-240hz.csv', csv)} disabled={!csv}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-700 disabled:opacity-40">
              Download trajectory CSV ({SAMPLE_HZ} Hz ground truth)
            </button>
          </div>
        </div>

        {/* Event log */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
            Physics events
          </p>
          <ul className="mt-3 space-y-1.5 font-mono text-[11px]">
            {events.length === 0 && <li className="text-slate-500">No events yet.</li>}
            {events.map((e, i) => (
              <li key={i} className={e.type === 'fault' ? 'text-red-300' : e.type === 'land' ? 'text-green-300' : 'text-slate-300'}>
                <span className="text-slate-500">{e.t.toFixed(3)}s</span> {e.text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Batch */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
              Synthetic dataset
            </p>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Simulate {BATCH_SIZE} random serves aimed around the far court. Landing points are plotted on
              the court (green in, red out, amber fault). The CSV is a labelled set for scoring a line-call
              detector.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={runBatch} disabled={busy}
              className="rounded-xl bg-yellow-400 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-300 disabled:opacity-40">
              {batch.running ? `Simulating ${batch.results.length}/${BATCH_SIZE}…` : `Run ${BATCH_SIZE} serves`}
            </button>
            <button onClick={batchCSV} disabled={batch.running || batch.results.length === 0}
              className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700 disabled:opacity-40">
              CSV
            </button>
            <button onClick={clearBatch} disabled={batch.running || batch.results.length === 0}
              className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700 disabled:opacity-40">
              Clear
            </button>
          </div>
        </div>
        {batch.results.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Serves" value={batch.results.length} />
            <Stat label="In" value={counts.IN ?? 0} />
            <Stat label="Out" value={counts.OUT ?? 0} />
            <Stat label="Fault (net / short)" value={counts.FAULT ?? 0} />
            <Stat label="Close calls (<5 cm)" value={counts.close} />
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="glass-card rounded-2xl p-5 text-sm leading-relaxed text-slate-300">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
          How this works
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>
            <span className="text-whiteHull">Physics:</span> the official <code className="text-yellow-200">@mujoco/mujoco</code>{' '}
            WebAssembly build (single-threaded, so it runs on static hosting like GitHub Pages). The court is
            an MJCF scene: an 18 × 9 m floor, a 2.43 m net, posts and antennae, and a 270 g, 21 cm ball.
          </li>
          <li>
            <span className="text-whiteHull">Aerodynamics:</span> MuJoCo&apos;s ellipsoid fluid model gives
            quadratic drag (Cd ≈ 0.4) and Magnus lift, so topspin makes the ball dip. Bounce stiffness is
            tuned to a restitution of about 0.75.
          </li>
          <li>
            <span className="text-whiteHull">Aiming:</span> drag makes the flight non-ballistic, so the launch
            angle is solved by bisection, using MuJoCo itself as the forward model.
          </li>
          <li>
            <span className="text-whiteHull">Referee:</span> the first ball–floor contact from MuJoCo&apos;s
            contact list is the landing point. It is checked against the court boundary (lines count as in),
            along with net-plane crossing outside the antennae and antenna contact.
          </li>
          <li>
            <span className="text-whiteHull">Rendering:</span> three.js reads the ball pose from MuJoCo each
            frame. The camera views match where a line-call camera could be mounted.
          </li>
        </ul>
      </div>
    </div>
  );
}
