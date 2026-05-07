import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

/* ── World constants ─────────────────────────────────────────── */
const CW    = 460;
const WORLD = 11.088;
const PX    = CW / WORLD;
const r2c   = (rx, ry) => [rx * PX, CW - ry * PX];

/* ── Canvas helpers ──────────────────────────────────────────── */
function drawBg(ctx) {
  ctx.fillStyle = '#010d1f';
  ctx.fillRect(0, 0, CW, CW);
  ctx.strokeStyle = 'rgba(74,222,128,0.06)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= WORLD * 2; i++) {
    const p = (i / 2) * PX;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, CW); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(CW, p); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(74,222,128,0.25)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, CW - 1.5, CW - 1.5);
}

function drawTrail(ctx, trail, color) {
  if (trail.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = color + 'cc';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const [sx, sy] = r2c(trail[0].x, trail[0].y);
  ctx.moveTo(sx, sy);
  trail.slice(1).forEach(p => { const [tx, ty] = r2c(p.x, p.y); ctx.lineTo(tx, ty); });
  ctx.stroke();
}

function drawTurtle(ctx, rx, ry, theta, color) {
  const [cx, cy] = r2c(rx, ry);
  const r = 13;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-theta);
  ctx.shadowColor = color; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = color + 'cc'; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.shadowBlur = 0;
  // shell segments
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.8;
  [0.35, 0.65, 0.9].forEach(f => { ctx.beginPath(); ctx.arc(0,0,r*f,0,Math.PI*2); ctx.stroke(); });
  // head
  ctx.beginPath(); ctx.arc(r * 1.1, 0, r * 0.26, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  // direction dot
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(r * 1.2, 0, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* ── Shape definitions ───────────────────────────────────────── */
const SHAPES = [
  { id: 'square',   label: 'Square',   sides: 4, exterior: Math.PI / 2 },
  { id: 'triangle', label: 'Triangle', sides: 3, exterior: (2 * Math.PI) / 3 },
  { id: 'pentagon', label: 'Pentagon', sides: 5, exterior: (2 * Math.PI) / 5 },
  { id: 'hexagon',  label: 'Hexagon',  sides: 6, exterior: Math.PI / 3 },
  { id: 'star',     label: 'Star',     sides: 5, exterior: (4 * Math.PI) / 5 },
  { id: 'circle',   label: 'Circle',   sides: null },
];

function buildCommands(shapeId, size, speed, angSpeed) {
  if (shapeId === 'circle') {
    const omega = speed / Math.max(0.3, size / 2);
    return [{ linear: speed, angular: omega, duration: (2 * Math.PI) / omega }];
  }
  const shape = SHAPES.find(s => s.id === shapeId);
  if (!shape) return [];
  const moveDur = size / speed;
  const turnDur = shape.exterior / angSpeed;
  return Array.from({ length: shape.sides }, () => [
    { linear: speed, angular: 0,        duration: moveDur },
    { linear: 0,     angular: angSpeed, duration: turnDur },
  ]).flat();
}

const mkTurtle = () => ({
  x: WORLD / 2, y: WORLD / 2, theta: 0,
  linearVel: 0, angularVel: 0,
  trail: [{ x: WORLD / 2, y: WORLD / 2 }],
});

/* ── Component ───────────────────────────────────────────────── */
export default function ShapeDrawingLab() {
  const canvasRef   = useRef(null);
  const tRef        = useRef(mkTurtle());
  const cmdQRef     = useRef([]);  // command queue
  const cmdTimerRef = useRef(0);   // time remaining for current cmd
  const rafRef      = useRef(null);
  const lastTRef    = useRef(null);
  const stepRef     = useRef({ current: 0, total: 0 });

  const [shape,    setShape]    = useState('square');
  const [size,     setSize]     = useState(2.5);
  const [speed,    setSpeed]    = useState(2.0);
  const [angSpeed] = useState(2.2);
  const [running,  setRunning]  = useState(false);
  const [cmdVel,   setCmdVel]   = useState({ linear: 0, angular: 0 });
  const [progress, setProgress] = useState({ step: 0, total: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const t = tRef.current;
    drawBg(ctx);
    if (t.trail.length > 1) drawTrail(ctx, t.trail, '#4ade80');
    drawTurtle(ctx, t.x, t.y, t.theta, '#4ade80');

    // HUD
    ctx.fillStyle = 'rgba(1,13,31,0.88)';
    ctx.beginPath();
    ctx.roundRect?.(8, 8, 170, 44, 5) ?? ctx.rect(8, 8, 170, 44);
    ctx.fill();
    ctx.strokeStyle = 'rgba(74,222,128,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect?.(8, 8, 170, 44, 5) ?? ctx.rect(8, 8, 170, 44);
    ctx.stroke();
    ctx.font = '10px monospace'; ctx.fillStyle = '#475569';
    ctx.fillText('linear_x:', 16, 26); ctx.fillText('angular_z:', 16, 42);
    ctx.fillStyle = t.linearVel !== 0 ? '#4ade80' : '#cbd5e1';
    ctx.fillText(t.linearVel.toFixed(3), 88, 26);
    ctx.fillStyle = t.angularVel !== 0 ? '#4ade80' : '#cbd5e1';
    ctx.fillText(t.angularVel.toFixed(3), 88, 42);
  }, []);

  const animate = useCallback((now) => {
    if (lastTRef.current === null) lastTRef.current = now;
    const dt = Math.min((now - lastTRef.current) / 1000, 0.05);
    lastTRef.current = now;

    const t = tRef.current;
    const queue = cmdQRef.current;

    if (queue.length > 0) {
      const cmd = queue[0];
      t.linearVel  = cmd.linear;
      t.angularVel = cmd.angular;

      t.theta += t.angularVel * dt;
      const nx = Math.max(0.3, Math.min(WORLD - 0.3, t.x + t.linearVel * Math.cos(t.theta) * dt));
      const ny = Math.max(0.3, Math.min(WORLD - 0.3, t.y + t.linearVel * Math.sin(t.theta) * dt));
      const last = t.trail[t.trail.length - 1];
      if ((nx - last.x) ** 2 + (ny - last.y) ** 2 > 1e-3) t.trail.push({ x: nx, y: ny });
      t.x = nx; t.y = ny;

      cmdTimerRef.current -= dt;
      if (cmdTimerRef.current <= 0) {
        queue.shift();
        stepRef.current.current++;
        if (queue.length > 0) {
          cmdTimerRef.current = queue[0].duration;
        } else {
          t.linearVel = 0; t.angularVel = 0;
          setRunning(false);
        }
        setCmdVel({ linear: t.linearVel, angular: t.angularVel });
        setProgress({ step: stepRef.current.current, total: stepRef.current.total });
      }
    }

    draw();
    rafRef.current = requestAnimationFrame(animate);
  }, [draw]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  const runShape = () => {
    const cmds = buildCommands(shape, size, speed, angSpeed);
    cmdQRef.current = [...cmds];
    cmdTimerRef.current = cmds[0]?.duration ?? 0;
    stepRef.current = { current: 0, total: cmds.length };
    setProgress({ step: 0, total: cmds.length });
    setRunning(true);
  };

  const stopShape = () => {
    cmdQRef.current = [];
    tRef.current.linearVel = 0;
    tRef.current.angularVel = 0;
    setCmdVel({ linear: 0, angular: 0 });
    setRunning(false);
  };

  const resetTurtle = () => {
    stopShape();
    tRef.current = mkTurtle();
    lastTRef.current = null;
  };

  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold tracking-widest text-green-400">LAB 02</span>
        </div>
        <h2 className="text-xl font-semibold text-whiteHull">Shape Drawing Lab</h2>
        <p className="mt-1 text-sm text-slate-400">
          Program the turtle to autonomously trace geometric shapes by publishing timed
          velocity commands — the core of ROS motion planning.
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-5">
        {/* Canvas */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <div className="simulator-panel rounded-xl overflow-hidden"
            style={{ width: CW, height: CW, border: '1px solid rgba(74,222,128,0.25)' }}>
            <canvas ref={canvasRef} width={CW} height={CW} className="block" />
          </div>
          <p className="text-xs text-slate-500 font-mono">
            Publishing&nbsp;
            <span className="text-green-400">/turtle1/cmd_vel</span>
            &nbsp;·&nbsp;
            <span className={running ? 'text-green-400' : 'text-slate-500'}>
              {running ? `step ${progress.step}/${progress.total}` : 'idle'}
            </span>
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 flex-1 min-w-[220px]">

          {/* Shape selector */}
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-3">Shape</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {SHAPES.map(s => (
                <button key={s.id} onClick={() => { if (!running) setShape(s.id); }}
                  disabled={running}
                  className={`rounded-lg py-2 text-xs font-medium transition ${
                    shape === s.id
                      ? 'bg-green-400/20 ring-1 ring-green-400/60 text-green-300'
                      : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60'
                  } disabled:opacity-40`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-3">Parameters</h3>
            {[
              ['Side Length', size, 0.8, 4.5, 0.1, setSize, 'm'],
              ['Linear Speed', speed, 0.5, 5.0, 0.1, setSpeed, 'm/s'],
            ].map(([label, val, min, max, step, fn, unit]) => (
              <div key={label} className="mb-3 last:mb-0">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>{label}</span>
                  <span className="font-mono text-slate-300">{val.toFixed(1)} <span className="text-slate-500">{unit}</span></span>
                </div>
                <input type="range" min={min} max={max} step={step} value={val}
                  onChange={e => { if (!running) fn(+e.target.value); }}
                  className="w-full accent-green-400 h-1.5" disabled={running} />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-3">Execute</h3>
            <div className="flex flex-col gap-2">
              {!running ? (
                <button onClick={runShape}
                  className="rounded-lg bg-green-400 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300 transition">
                  ▶ Draw {SHAPES.find(s=>s.id===shape)?.label}
                </button>
              ) : (
                <button onClick={stopShape}
                  className="rounded-lg bg-red-900/60 py-2 text-sm font-semibold text-red-300 hover:bg-red-900 transition">
                  ■ Stop
                </button>
              )}
              <button onClick={resetTurtle} disabled={running}
                className="rounded-lg bg-slate-800 py-2 text-sm text-slate-400 hover:bg-slate-700 disabled:opacity-40 transition">
                Reset
              </button>
            </div>
          </div>

          {/* Live cmd_vel */}
          <div className="simulator-panel rounded-xl p-4 font-mono text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-2 font-sans">
              rostopic pub /turtle1/cmd_vel
            </h3>
            <div className="space-y-0.5 text-slate-400">
              <div>linear:</div>
              <div className="pl-3"><span className="text-slate-500">x: </span>
                <span className={tRef.current.linearVel !== 0 ? 'text-green-400' : 'text-slate-300'}>
                  {tRef.current.linearVel.toFixed(4)}
                </span>
              </div>
              <div className="pl-3"><span className="text-slate-500">y: </span><span className="text-slate-300">0.0000</span></div>
              <div>angular:</div>
              <div className="pl-3"><span className="text-slate-500">z: </span>
                <span className={tRef.current.angularVel !== 0 ? 'text-green-400' : 'text-slate-300'}>
                  {tRef.current.angularVel.toFixed(4)}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
