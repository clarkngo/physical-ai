import { useEffect, useRef, useState } from 'react';
import { DEG, NM, SHIP_TYPES, Ship } from './shipModel.js';
import { POLICIES, ROLE_TEXT } from './colregs.js';
import { DURATION, Encounter, SCENARIOS } from './encounterSim.js';
import { drawEncounter } from './encounterView.js';

const MODE_TEXT = {
  transit: 'On passage',
  'give-way': 'Avoiding: altered course',
  'stand-on': 'Standing on (Rule 17)',
  'stand-on-acts': 'Stand-on ship now acting',
  resume: 'Returning to course',
};

const OUTCOME = {
  clear: { label: 'Clear', tone: 'text-green-300 border-green-400/40 bg-green-500/10' },
  tight: { label: 'Inside safe CPA', tone: 'text-amber-300 border-amber-300/40 bg-amber-400/10' },
  'close-quarters': { label: 'Close quarters', tone: 'text-orange-300 border-orange-400/40 bg-orange-500/10' },
  collision: { label: 'Collision', tone: 'text-red-300 border-red-400/40 bg-red-500/10' },
};

const TIME_SCALES = { 30: '30×', 60: '60×', 120: '120×' };
const BEHAVIOURS = { hold: 'Hold course', colreg: 'Follow COLREGs' };

function Chip({ active, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-xs transition disabled:opacity-40 ${
        active ? 'bg-pacificCyan text-slate-950' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function Slider({ label, value, min, max, step, unit, onChange, disabled, digits = 1 }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-400">{Number(value).toFixed(digits)} {unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-pacificCyan disabled:opacity-40"
      />
    </label>
  );
}

function Stat({ label, value, tone = 'text-slate-200' }) {
  return (
    <div className="rounded-xl bg-slate-900/70 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-0.5 font-mono text-sm ${tone}`}>{value}</p>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-slate-300">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const fmtDeg = (rad) => `${String(Math.round(((rad / DEG) % 360 + 360) % 360)).padStart(3, '0')}°`;
const fmtMin = (s) => `${(s / 60).toFixed(1)} min`;

function snapshot(enc) {
  const own = enc.own;
  return {
    time: enc.time,
    heading: own.psi,
    ordered: own.headingCmd,
    rudder: own.delta,
    rot: own.r,
    mode: enc.nav.mode,
    delay: enc.delay,
    situation: enc.situation(),
    ranges: enc.ranges.map((r) => r.slice()),
    done: enc.done,
  };
}

function RangeChart({ ranges, colors, names, safeNm }) {
  const W = 600;
  const H = 150;
  const pad = { l: 34, r: 10, t: 10, b: 22 };
  const maxNm = 5;
  const x = (t) => pad.l + (t / DURATION) * (W - pad.l - pad.r);
  const y = (m) => pad.t + (1 - Math.min(m / NM, maxNm) / maxNm) * (H - pad.t - pad.b);
  return (
    <div className="rounded-xl bg-slate-900/70 p-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-widest text-slate-500">Range to each target (measured)</p>
        <div className="flex gap-3 text-[11px]">
          {names.map((n, i) => (
            <span key={n} style={{ color: colors[i] }}>{n}</span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Range to each target over time">
        {[0, 1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v * NM)} y2={y(v * NM)} stroke="rgba(148,163,184,0.12)" />
            <text x={pad.l - 6} y={y(v * NM) + 3} fontSize="10" fill="#64748b" textAnchor="end">{v}</text>
          </g>
        ))}
        {Array.from({ length: DURATION / 360 + 1 }, (_, k) => k * 6).map((m) => (
          <text key={m} x={x(m * 60)} y={H - 6} fontSize="10" fill="#64748b" textAnchor="middle">{m}m</text>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(safeNm * NM)} y2={y(safeNm * NM)} stroke="#22d3ee" strokeDasharray="5 4" opacity="0.7" />
        <text x={W - pad.r} y={y(safeNm * NM) - 4} fontSize="10" fill="#22d3ee" textAnchor="end">safe CPA</text>
        {ranges.map((series, i) => (
          <polyline
            key={names[i]}
            fill="none"
            stroke={colors[i]}
            strokeWidth="1.8"
            points={series.map(([t, r]) => `${x(t).toFixed(1)},${y(r).toFixed(1)}`).join(' ')}
          />
        ))}
      </svg>
    </div>
  );
}

export default function CollisionAvoidanceLab() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const encRef = useRef(null);
  const runningRef = useRef(false);
  const timeScaleRef = useRef(60);
  const nextUiRef = useRef(0);

  const [scenario, setScenario] = useState('crossing-give-way');
  const [shipType, setShipType] = useState('container');
  const [policy, setPolicy] = useState('colreg');
  const [targetBehaviour, setTargetBehaviour] = useState('hold');
  const [safeCpaNm, setSafeCpaNm] = useState(1);
  const [actTcpaMin, setActTcpaMin] = useState(12);
  const [timeScale, setTimeScale] = useState(60);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState(null);
  const [result, setResult] = useState(null);

  timeScaleRef.current = timeScale;

  const build = () =>
    new Encounter({ scenario, shipType, policy, safeCpaNm, actTcpaMin, planner: 'dynamic', targetBehaviour });

  // A fresh, not-yet-running encounter whenever the setup changes.
  useEffect(() => {
    if (runningRef.current) return;
    const enc = build();
    encRef.current = enc;
    setLive(snapshot(enc));
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, shipType, policy, targetBehaviour, safeCpaNm, actTcpaMin]);

  // Animation loop; pauses while the plot is off-screen.
  useEffect(() => {
    let raf = 0;
    let visible = true;
    let last = performance.now();
    const observer = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    observer.observe(wrapRef.current);

    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const enc = encRef.current;
      if (visible && enc && canvasRef.current) {
        if (runningRef.current) {
          enc.step(dt * timeScaleRef.current);
          if (enc.done) {
            runningRef.current = false;
            setRunning(false);
            setLive(snapshot(enc));
            setResult({
              targets: enc.assess(),
              delay: enc.delay,
              crossTrack: enc.maxCrossTrack,
              maxRudder: enc.maxRudder,
              collided: !!enc.collided,
              time: enc.time,
            });
          } else if (now >= nextUiRef.current) {
            nextUiRef.current = now + 120;
            setLive(snapshot(enc));
          }
        }
        drawEncounter(canvasRef.current, enc);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  const run = () => {
    const enc = build();
    encRef.current = enc;
    setResult(null);
    setLive(snapshot(enc));
    runningRef.current = true;
    setRunning(true);
  };

  const reset = () => {
    runningRef.current = false;
    setRunning(false);
    const enc = build();
    encRef.current = enc;
    setLive(snapshot(enc));
    setResult(null);
  };

  const sc = SCENARIOS[scenario];
  const enc = encRef.current;
  const targetColors = enc ? enc.targets.map((t) => t.ship.color) : [];
  const targetNames = enc ? enc.targets.map((t) => t.ship.name) : [];
  // Roles are fixed when risk first exists; they do not flip as own ship turns.
  const initial = enc ? enc.initial : [];
  const type = SHIP_TYPES[shipType];

  return (
    <section className="simulator-panel space-y-5 rounded-3xl p-6">
      <div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-widest text-pacificCyan">LAB 03</span>
          <span className="rounded-md bg-pacificCyan/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-pacificCyan">
            Ship dynamics · COLREGs
          </span>
        </div>
        <h2 className="mt-0.5 text-2xl font-semibold text-whiteHull">Collision Avoidance Lab</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-300">
          Own ship steers with a real turning model, so a tanker answers the helm far more slowly than a ferry.
          A navigator works out the closest point of approach (CPA) to every ship, decides who must give way
          under the collision regulations, and alters course. All the numbers below are measured from the run.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div ref={wrapRef} className="relative aspect-[13/11.5] max-h-[78vh] w-full overflow-hidden rounded-2xl border border-pacificCyan/25">
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-pacificCyan/30 bg-slate-950/70 px-2.5 py-1 text-xs text-pacificCyan">
              {sc.label} · {sc.rule}
            </div>
            {live && (
              <div className="pointer-events-none absolute right-3 top-8 rounded-lg bg-slate-950/70 px-2.5 py-1 font-mono text-xs text-slate-300">
                t = {fmtMin(live.time)}
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            North up, 1 nm grid. Lines ahead of each ship show where it will be in 6 minutes on its present course; the
            dashed circle is the safe CPA. Ship icons are not to scale.
          </p>

          {live && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Heading / ordered" value={`${fmtDeg(live.heading)} / ${fmtDeg(live.ordered)}`} />
              <Stat label="Rudder" value={`${Math.abs(live.rudder / DEG).toFixed(0)}° ${live.rudder > 0.01 ? 'stbd' : live.rudder < -0.01 ? 'port' : ''}`} />
              <Stat label="Rate of turn" value={`${(live.rot / DEG * 60).toFixed(0)}°/min`} />
              <Stat label="Navigator" value={MODE_TEXT[live.mode] ?? live.mode} tone="text-pacificCyan" />
            </div>
          )}

          {live && (
            <div className="overflow-x-auto rounded-xl bg-slate-900/70">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Target</th>
                    <th className="px-3 py-2 font-medium">Range</th>
                    <th className="px-3 py-2 font-medium">Bearing</th>
                    <th className="px-3 py-2 font-medium">CPA</th>
                    <th className="px-3 py-2 font-medium">TCPA</th>
                    <th className="px-3 py-2 font-medium">Encounter (at first sighting)</th>
                    <th className="px-3 py-2 font-medium">Own ship</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-slate-300">
                  {live.situation.map((s, i) => (
                    <tr key={targetNames[i]} className="border-t border-slate-800">
                      <td className="px-3 py-1.5" style={{ color: targetColors[i] }}>{targetNames[i]}</td>
                      <td className="px-3 py-1.5">{(s.range / NM).toFixed(2)} nm</td>
                      <td className="px-3 py-1.5">{fmtDeg(s.bearing)}</td>
                      <td className={`px-3 py-1.5 ${s.tcpa > 0 && s.dcpa < safeCpaNm * NM ? 'text-red-300' : ''}`}>
                        {(s.dcpa / NM).toFixed(2)} nm
                      </td>
                      <td className="px-3 py-1.5">{s.tcpa > 0 ? fmtMin(s.tcpa) : 'passed'}</td>
                      <td className="px-3 py-1.5 font-sans">{initial[i].label} <span className="text-slate-500">(R{initial[i].rule})</span></td>
                      <td className="px-3 py-1.5 font-sans">{ROLE_TEXT[initial[i].role]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {live && <RangeChart ranges={live.ranges} colors={targetColors} names={targetNames} safeNm={safeCpaNm} />}
        </div>

        <div className="space-y-4">
          <div className="simulator-panel space-y-4 rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-pacificCyan">Encounter</h3>
            <Group title="Scenario">
              {Object.entries(SCENARIOS).map(([id, s]) => (
                <Chip key={id} active={scenario === id} disabled={running} onClick={() => setScenario(id)}>{s.label}</Chip>
              ))}
            </Group>
            <p className="text-xs leading-relaxed text-slate-400">{sc.blurb}</p>
            <Group title="Other ships">
              {Object.entries(BEHAVIOURS).map(([id, label]) => (
                <Chip key={id} active={targetBehaviour === id} disabled={running} onClick={() => setTargetBehaviour(id)}>{label}</Chip>
              ))}
            </Group>
          </div>

          <div className="simulator-panel space-y-4 rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-pacificCyan">Own ship</h3>
            <Group title="Hull">
              {Object.entries(SHIP_TYPES).map(([id, t]) => (
                <Chip key={id} active={shipType === id} disabled={running} onClick={() => setShipType(id)}>{t.label}</Chip>
              ))}
            </Group>
            <p className="text-xs text-slate-400">
              {type.note}. Turning circle ≈ {((2 * new Ship({ type: shipType }).turningRadius) / NM).toFixed(2)} nm across at 14 kn, rudder hard over.
            </p>
            <Group title="Navigator policy">
              {Object.entries(POLICIES).map(([id, p]) => (
                <Chip key={id} active={policy === id} disabled={running} onClick={() => setPolicy(id)}>{p.label}</Chip>
              ))}
            </Group>
            <p className="text-xs leading-relaxed text-slate-400">{POLICIES[policy].note}</p>
            <Slider label="Safe CPA" unit="nm" min={0.5} max={2} step={0.1} value={safeCpaNm} disabled={running} onChange={setSafeCpaNm} />
            <Slider label="Act when TCPA below" unit="min" min={4} max={20} step={1} value={actTcpaMin} disabled={running} onChange={setActTcpaMin} digits={0} />
            <Group title="Playback speed">
              {Object.entries(TIME_SCALES).map(([v, label]) => (
                <Chip key={v} active={timeScale === Number(v)} onClick={() => setTimeScale(Number(v))}>{label}</Chip>
              ))}
            </Group>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={run} disabled={running}
                className="rounded-xl bg-pacificCyan px-3 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-40">
                {running ? 'Running…' : 'Run encounter'}
              </button>
              <button type="button" onClick={reset}
                className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700">
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Time lost" value={fmtMin(result.delay)} />
            <Stat label="Max off track" value={`${(result.crossTrack / NM).toFixed(2)} nm`} />
            <Stat label="Max rudder" value={`${(result.maxRudder / DEG).toFixed(0)}°`} />
            <Stat label="Run" value={result.collided ? `stopped at ${fmtMin(result.time)}` : fmtMin(result.time)} tone={result.collided ? 'text-red-300' : 'text-slate-200'} />
          </div>
          {result.targets.map((t) => (
            <div key={t.name} className={`rounded-xl border px-4 py-3 text-sm ${OUTCOME[t.outcome].tone}`}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold" style={{ color: t.color }}>{t.name}</span>
                <span className="font-semibold">{OUTCOME[t.outcome].label}</span>
                <span className="text-slate-300">
                  · closest {(t.minRange / NM).toFixed(2)} nm at {fmtMin(t.minTime)}
                  {!result.collided && t.minTime >= result.time - 15 && ' (still closing when the run ended)'} · started as {t.init.label.toLowerCase()} (Rule {t.init.rule}), CPA {(t.init.dcpa / NM).toFixed(2)} nm if nobody acted
                </span>
              </div>
              {t.checks.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs">
                  {t.checks.map((c) => (
                    <li key={c.text} className={c.ok ? 'text-green-300' : 'text-red-300'}>
                      {c.ok ? '✓' : '✗'} <span className="text-slate-300">{c.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="simulator-panel rounded-xl p-4 text-xs leading-relaxed text-slate-400">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-pacificCyan">What&apos;s going on</h3>
        <ul className="list-disc space-y-1 pl-4">
          <li><span className="text-slate-200">Turning:</span> each ship follows the Nomoto model T·ṙ + r = K·δ, with the rudder limited to 35° and 2.5°/s. A 30° alteration takes about 40 s in the ferry, 2 minutes in the container ship and 4½ minutes in the tanker.</li>
          <li><span className="text-slate-200">CPA and TCPA:</span> computed from the two ships&apos; actual relative motion, as a radar (ARPA) does. A threat is a CPA inside the safe distance, closer in time than the action threshold.</li>
          <li><span className="text-slate-200">Who acts:</span> head-on (Rule 14) both turn to starboard; crossing (Rule 15) the ship with the other on her starboard side gives way and passes astern; overtaking (Rule 13) the faster ship keeps clear on either side; the stand-on ship (Rule 17) holds course until the other is clearly not acting.</li>
          <li><span className="text-slate-200">Choosing the alteration:</span> the navigator runs the turning model forward for each candidate course and takes the smallest one that clears every ship. The COLREG policy only tries starboard turns of 30° or more, so the change is &quot;readily apparent&quot; (Rule 8).</li>
          <li><span className="text-slate-200">Try:</span> act at 4 minutes with the ferry, then the tanker. Or put the tanker in &quot;Crossing from port&quot; with other ships holding course: waiting the full Rule 17 time is too late for a ship that turns this slowly.</li>
          <li><span className="text-slate-200">Simplified:</span> constant speed (no slowing down), no wind, current or shallow water, perfect sensing of the other ships, and fixed thresholds where the rules say &quot;ample time&quot; or &quot;close quarters&quot;.</li>
        </ul>
      </div>
    </section>
  );
}
