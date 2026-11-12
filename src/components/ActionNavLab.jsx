import { useEffect, useRef, useState, useCallback } from 'react';

/* ── World constants ─────────────────────────────────────────── */
const CW    = 460;
const WORLD = 11.088;
const PX    = CW / WORLD;
const r2c   = (rx, ry) => [rx * PX, CW - ry * PX];
const c2r   = (cx, cy) => [cx / PX, (CW - cy) / PX];

const REACH_DIST = 0.22;
const K_ANG      = 3.2;
const K_LIN      = 1.6;
const MAX_LIN    = 3.2;
const MAX_ANG    = 3.0;
const FEEDBACK_PERIOD = 420; // ms between published feedback messages

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

function drawTrail(ctx, trail) {
  if (trail.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(74,222,128,0.4)';
  ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
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
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.8;
  [0.35, 0.65, 0.9].forEach(f => { ctx.beginPath(); ctx.arc(0, 0, r * f, 0, Math.PI * 2); ctx.stroke(); });
  ctx.beginPath(); ctx.arc(r * 1.1, 0, r * 0.26, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(r * 1.2, 0, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawGoal(ctx, goal, state) {
  if (!goal) return;
  const [cx, cy] = r2c(goal.x, goal.y);
  const color = state === 'executing' ? 'rgba(251,191,36,0.9)'
              : state === 'succeeded' ? 'rgba(74,222,128,0.8)'
              : state === 'canceled' || state === 'canceling' ? 'rgba(248,113,113,0.8)'
              : 'rgba(251,191,36,0.5)';
  ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy);
  ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
  if (state === 'executing') {
    ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(251,191,36,0.25)'; ctx.lineWidth = 1; ctx.stroke();
  }
}

const mkTurtle = () => ({ x: WORLD / 2, y: WORLD / 2, theta: 0, linearVel: 0, angularVel: 0, trail: [{ x: WORLD / 2, y: WORLD / 2 }] });

const STATE_META = {
  idle:      { label: 'IDLE',                 cls: 'text-slate-500' },
  waiting:   { label: 'WAITING FOR ACCEPT',   cls: 'text-sky-400' },
  rejected:  { label: 'GOAL REJECTED',        cls: 'text-red-400' },
  executing: { label: 'EXECUTING',            cls: 'text-yellow-400' },
  canceling: { label: 'CANCELING',            cls: 'text-orange-400' },
  canceled:  { label: 'CANCELED',             cls: 'text-red-400' },
  succeeded: { label: 'SUCCEEDED',            cls: 'text-green-400' },
};

/* ── Component ───────────────────────────────────────────────── */
export default function ActionNavLab() {
  const canvasRef    = useRef(null);
  const tRef         = useRef(mkTurtle());
  const goalRef      = useRef(null);
  const actionRef    = useRef('idle');
  const rafRef       = useRef(null);
  const lastTRef     = useRef(null);
  const fbTimerRef   = useRef(0);
  const startTRef    = useRef(0);

  const [goal,        setGoal]        = useState(null);
  const [actionState, setActionState] = useState('idle');
  const [feedback,    setFeedback]    = useState([]);
  const [result,      setResult]      = useState(null);

  const setBoth = (s) => { actionRef.current = s; setActionState(s); };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const t = tRef.current;
    drawBg(ctx);
    drawTrail(ctx, t.trail);
    drawGoal(ctx, goalRef.current, actionRef.current);
    drawTurtle(ctx, t.x, t.y, t.theta, '#4ade80');

    ctx.fillStyle = 'rgba(1,13,31,0.88)';
    ctx.beginPath();
    ctx.roundRect?.(8, 8, 150, 42, 5) ?? ctx.rect(8, 8, 150, 42);
    ctx.fill();
    ctx.strokeStyle = 'rgba(74,222,128,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect?.(8, 8, 150, 42, 5) ?? ctx.rect(8, 8, 150, 42);
    ctx.stroke();
    ctx.font = '10px monospace';
    ctx.fillStyle = '#475569'; ctx.fillText('linear_x:', 16, 26);
    ctx.fillStyle = t.linearVel !== 0 ? '#4ade80' : '#cbd5e1';
    ctx.fillText(t.linearVel.toFixed(2), 82, 26);
    ctx.fillStyle = '#475569'; ctx.fillText('angular_z:', 16, 41);
    ctx.fillStyle = t.angularVel !== 0 ? '#4ade80' : '#cbd5e1';
    ctx.fillText(t.angularVel.toFixed(2), 82, 41);
  }, []);

  const animate = useCallback((now) => {
    if (lastTRef.current === null) lastTRef.current = now;
    const dt = Math.min((now - lastTRef.current) / 1000, 0.05);
    lastTRef.current = now;

    const t = tRef.current;
    const g = goalRef.current;
    const state = actionRef.current;

    if (state === 'executing' && g) {
      const dx = g.x - t.x, dy = g.y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < REACH_DIST) {
        t.linearVel = 0; t.angularVel = 0;
        setBoth('succeeded');
        setResult({ status: 'SUCCEEDED', message: 'goal reached', elapsed: ((now - startTRef.current) / 1000).toFixed(1) });
      } else {
        const targetH = Math.atan2(dy, dx);
        let err = targetH - t.theta;
        while (err >  Math.PI) err -= 2 * Math.PI;
        while (err < -Math.PI) err += 2 * Math.PI;
        t.angularVel = Math.max(-MAX_ANG, Math.min(MAX_ANG, K_ANG * err));
        t.linearVel  = Math.abs(err) < 0.6 ? Math.min(MAX_LIN, K_LIN * dist) : 0;
        t.theta += t.angularVel * dt;
        const nx = Math.max(0.2, Math.min(WORLD - 0.2, t.x + t.linearVel * Math.cos(t.theta) * dt));
        const ny = Math.max(0.2, Math.min(WORLD - 0.2, t.y + t.linearVel * Math.sin(t.theta) * dt));
        const last = t.trail[t.trail.length - 1];
        if ((nx - last.x) ** 2 + (ny - last.y) ** 2 > 1e-3) t.trail.push({ x: nx, y: ny });
        t.x = nx; t.y = ny;

        if (now - fbTimerRef.current > FEEDBACK_PERIOD) {
          fbTimerRef.current = now;
          const elapsed = (now - startTRef.current) / 1000;
          const eta = t.linearVel > 0.05 ? dist / Math.max(0.3, t.linearVel) : null;
          setFeedback(f => [...f, {
            id: now, distance_remaining: dist, time_elapsed: elapsed,
            eta: eta,
          }].slice(-6));
        }
      }
    } else if (state === 'canceling') {
      t.linearVel = 0; t.angularVel = 0;
      setBoth('canceled');
      setResult({ status: 'CANCELED', message: 'preempted by client', elapsed: ((now - startTRef.current) / 1000).toFixed(1) });
    }

    draw();
    rafRef.current = requestAnimationFrame(animate);
  }, [draw]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  const handleCanvasClick = useCallback((e) => {
    const s = actionRef.current;
    if (s === 'waiting' || s === 'executing' || s === 'canceling') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (CW / rect.width);
    const cy = (e.clientY - rect.top)  * (CW / rect.height);
    const [rx, ry] = c2r(cx, cy);
    if (rx < 0.2 || rx > WORLD - 0.2 || ry < 0.2 || ry > WORLD - 0.2) return;
    const g = { x: rx, y: ry };
    goalRef.current = g;
    setGoal(g);
    setResult(null);
    setBoth('idle');
  }, []);

  const sendGoal = () => {
    const g = goalRef.current;
    if (!g || actionRef.current === 'waiting' || actionRef.current === 'executing') return;
    setBoth('waiting');
    setFeedback([]);
    setResult(null);
    setTimeout(() => {
      const t = tRef.current;
      const dist = Math.hypot(g.x - t.x, g.y - t.y);
      if (dist < REACH_DIST) {
        setBoth('rejected');
        setResult({ status: 'REJECTED', message: 'goal is within tolerance of current pose', elapsed: '0.0' });
        return;
      }
      startTRef.current = performance.now();
      fbTimerRef.current = 0;
      setBoth('executing');
    }, 260 + Math.random() * 180);
  };

  const cancelGoal = () => {
    if (actionRef.current !== 'executing' && actionRef.current !== 'waiting') return;
    setBoth('canceling');
  };

  const clearAll = () => {
    tRef.current = mkTurtle();
    goalRef.current = null;
    lastTRef.current = null;
    setGoal(null);
    setFeedback([]);
    setResult(null);
    setBoth('idle');
  };

  const meta = STATE_META[actionState];
  const canSend   = goal && actionState !== 'waiting' && actionState !== 'executing' && actionState !== 'canceling';
  const canCancel = actionState === 'executing' || actionState === 'waiting';

  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold tracking-widest text-green-400">LAB 06</span>
        </div>
        <h2 className="text-xl font-semibold text-whiteHull">Action Server Lab</h2>
        <p className="mt-1 text-sm text-slate-400">
          Topics stream, services block-and-reply once — <strong>actions</strong> are ROS 2's third
          pattern: a long-running, preemptible goal that streams <em>feedback</em> while it executes
          and finishes with a <em>result</em>. This mirrors Nav2's <code className="text-green-400">NavigateToPose</code> action.
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-5">
        {/* Canvas */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <div className="simulator-panel rounded-xl overflow-hidden cursor-crosshair"
            style={{ width: CW, height: CW, border: '1px solid rgba(74,222,128,0.25)' }}>
            <canvas ref={canvasRef} width={CW} height={CW} className="block" onClick={handleCanvasClick} />
          </div>
          <p className="text-xs text-slate-500 font-mono">
            Click canvas to set a goal pose &nbsp;·&nbsp;
            <span className={meta.cls}>{meta.label}</span>
          </p>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-3 flex-1 min-w-[240px]">

          {/* Action client */}
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-3">
              Action Client · /navigate_to_pose
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={sendGoal} disabled={!canSend}
                className="rounded-lg bg-green-400 py-2 text-sm font-semibold text-slate-950
                           hover:bg-emerald-300 disabled:opacity-40 transition">
                ▶ Send Goal
              </button>
              <button onClick={cancelGoal} disabled={!canCancel}
                className="rounded-lg bg-red-900/60 py-2 text-sm font-semibold text-red-300
                           hover:bg-red-900 disabled:opacity-40 transition">
                ✕ Cancel Goal
              </button>
            </div>
            <button onClick={clearAll}
              className="mt-2 w-full rounded-lg bg-slate-800 py-1.5 text-xs text-slate-400 hover:bg-slate-700 transition">
              Reset
            </button>
            <p className="mt-3 text-[11px] text-slate-500">
              {goal ? `goal: (${goal.x.toFixed(2)}, ${goal.y.toFixed(2)})` : 'no goal set — click the canvas'}
            </p>
          </div>

          {/* Feedback stream */}
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-2">Feedback Stream</h3>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
              {feedback.length === 0 ? (
                <p className="text-xs text-slate-600 italic">No feedback yet</p>
              ) : feedback.slice().reverse().map(f => (
                <div key={f.id} className="rounded-md bg-slate-800/40 px-2 py-1 text-[11px] font-mono text-slate-400">
                  remaining: <span className="text-yellow-400">{f.distance_remaining.toFixed(2)}m</span>
                  {' · '}elapsed: <span className="text-slate-300">{f.time_elapsed.toFixed(1)}s</span>
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-2">Result</h3>
            {!result ? (
              <p className="text-xs text-slate-600 italic">Action has not completed</p>
            ) : (
              <div className="font-mono text-xs space-y-0.5">
                <div><span className="text-slate-500">status: </span>
                  <span className={
                    result.status === 'SUCCEEDED' ? 'text-green-400' :
                    result.status === 'REJECTED'  ? 'text-red-400'   : 'text-orange-400'
                  }>{result.status}</span>
                </div>
                <div><span className="text-slate-500">message: </span><span className="text-slate-300">{result.message}</span></div>
                <div><span className="text-slate-500">elapsed: </span><span className="text-slate-300">{result.elapsed}s</span></div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
