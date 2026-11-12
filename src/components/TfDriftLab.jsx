import { useEffect, useRef, useState, useCallback } from 'react';

/* ── World constants ─────────────────────────────────────────── */
const CW    = 460;
const WORLD = 11.088;
const PX    = CW / WORLD;
const r2c   = (rx, ry) => [rx * PX, CW - ry * PX];

const LASER_OFFSET = 0.35; // static base_link → laser translation (x-forward)

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

function drawTrail(ctx, trail, color, dashed) {
  if (trail.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (dashed) ctx.setLineDash([3, 3]);
  const [sx, sy] = r2c(trail[0].x, trail[0].y);
  ctx.moveTo(sx, sy);
  trail.slice(1).forEach(p => { const [tx, ty] = r2c(p.x, p.y); ctx.lineTo(tx, ty); });
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawRobot(ctx, rx, ry, theta, color, ghost) {
  const [cx, cy] = r2c(rx, ry);
  const r = 12;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-theta);
  if (ghost) {
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([2.5, 2.5]);
  } else {
    ctx.shadowColor = color; ctx.shadowBlur = 9;
  }
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = ghost ? 'transparent' : color + 'cc';
  ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = ghost ? 1.3 : 1.6; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.setLineDash([]);
  // heading tick
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.3, 0);
  ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

const mkPose = () => ({ x: WORLD / 2, y: WORLD / 2, theta: 0 });

/* ── D-pad ───────────────────────────────────────────────────── */
function DpadBtn({ label, onPress, onRelease }) {
  return (
    <button
      onPointerDown={onPress} onPointerUp={onRelease}
      onPointerLeave={onRelease} onContextMenu={e => e.preventDefault()}
      className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300
                 select-none transition hover:bg-green-400/30 active:bg-green-400/60 text-sm"
    >
      {label}
    </button>
  );
}

/* ── Frame-tree node / edge (small SVG-ish diagram via divs) ─── */
function FrameNode({ label, color }) {
  return (
    <div className="rounded-lg px-2.5 py-1 text-[11px] font-mono font-semibold"
      style={{ background: color + '22', color, border: `1px solid ${color}66` }}>
      {label}
    </div>
  );
}
function FrameEdge({ text, warn }) {
  return (
    <div className="flex items-center gap-1.5 pl-3">
      <span className="text-slate-600">↓</span>
      <span className={`text-[10px] font-mono ${warn ? 'text-red-400' : 'text-slate-500'}`}>{text}</span>
    </div>
  );
}

/* ── Component ───────────────────────────────────────────────── */
export default function TfDriftLab() {
  const canvasRef  = useRef(null);
  const truthRef   = useRef(mkPose());
  const odomRef    = useRef(mkPose());
  const truthTrail = useRef([{ x: WORLD / 2, y: WORLD / 2 }]);
  const odomTrail  = useRef([{ x: WORLD / 2, y: WORLD / 2 }]);
  const keysRef    = useRef({});
  const rafRef     = useRef(null);
  const lastTRef   = useRef(null);
  const slipRef    = useRef(0.18);
  const syncTRef   = useRef(null);

  const [slip,  setSlip]  = useState(0.18);
  const [error, setError] = useState({ dist: 0, ang: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawBg(ctx);
    drawTrail(ctx, truthTrail.current, 'rgba(74,222,128,0.5)', false);
    drawTrail(ctx, odomTrail.current,  'rgba(56,189,248,0.5)', true);
    drawRobot(ctx, odomRef.current.x, odomRef.current.y, odomRef.current.theta, '#38bdf8', true);
    drawRobot(ctx, truthRef.current.x, truthRef.current.y, truthRef.current.theta, '#4ade80', false);

    ctx.fillStyle = 'rgba(1,13,31,0.88)';
    ctx.beginPath();
    ctx.roundRect?.(8, 8, 168, 42, 5) ?? ctx.rect(8, 8, 168, 42);
    ctx.fill();
    ctx.strokeStyle = 'rgba(74,222,128,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect?.(8, 8, 168, 42, 5) ?? ctx.rect(8, 8, 168, 42);
    ctx.stroke();
    ctx.font = '9px monospace';
    ctx.fillStyle = '#4ade80'; ctx.fillText('● map (ground truth)', 14, 24);
    ctx.fillStyle = '#38bdf8'; ctx.fillText('┄ odom (estimate)', 14, 38);
  }, []);

  const animate = useCallback((now) => {
    if (lastTRef.current === null) lastTRef.current = now;
    const dt = Math.min((now - lastTRef.current) / 1000, 0.05);
    lastTRef.current = now;

    const keys = keysRef.current;
    const lin = (keys['ArrowUp']||keys['w']||keys['W']) ? 2.8 : (keys['ArrowDown']||keys['s']||keys['S']) ? -2.8 : 0;
    const ang = (keys['ArrowLeft']||keys['a']||keys['A']) ? 2.0 : (keys['ArrowRight']||keys['d']||keys['D']) ? -2.0 : 0;

    if (lin !== 0 || ang !== 0) {
      // ground truth — exact kinematics
      const truth = truthRef.current;
      truth.theta += ang * dt;
      truth.x = Math.max(0.2, Math.min(WORLD - 0.2, truth.x + lin * Math.cos(truth.theta) * dt));
      truth.y = Math.max(0.2, Math.min(WORLD - 0.2, truth.y + lin * Math.sin(truth.theta) * dt));
      const lastT = truthTrail.current[truthTrail.current.length - 1];
      if ((truth.x - lastT.x) ** 2 + (truth.y - lastT.y) ** 2 > 1e-3) truthTrail.current.push({ x: truth.x, y: truth.y });

      // odom — same commanded velocity, integrated with wheel-slip noise (drifts from truth)
      const odom = odomRef.current;
      const noise = slipRef.current;
      const linN = lin * (1 + (Math.random() * 2 - 1) * noise);
      const angN = ang * (1 + (Math.random() * 2 - 1) * noise * 1.4);
      odom.theta += angN * dt;
      odom.x += linN * Math.cos(odom.theta) * dt;
      odom.y += linN * Math.sin(odom.theta) * dt;
      const lastO = odomTrail.current[odomTrail.current.length - 1];
      if ((odom.x - lastO.x) ** 2 + (odom.y - lastO.y) ** 2 > 1e-3) odomTrail.current.push({ x: odom.x, y: odom.y });
    }

    if (!syncTRef.current) {
      syncTRef.current = setTimeout(() => {
        syncTRef.current = null;
        const t = truthRef.current, o = odomRef.current;
        let dAng = Math.abs(t.theta - o.theta);
        while (dAng > Math.PI) dAng -= 2 * Math.PI;
        setError({ dist: Math.hypot(t.x - o.x, t.y - o.y), ang: Math.abs(dAng) });
      }, 150);
    }

    draw();
    rafRef.current = requestAnimationFrame(animate);
  }, [draw]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(rafRef.current); if (syncTRef.current) clearTimeout(syncTRef.current); };
  }, [animate]);

  useEffect(() => {
    const on = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      keysRef.current[e.key] = e.type === 'keydown';
    };
    window.addEventListener('keydown', on);
    window.addEventListener('keyup', on);
    return () => { window.removeEventListener('keydown', on); window.removeEventListener('keyup', on); };
  }, []);

  const press      = (k) => () => { keysRef.current[k] = true; };
  const releaseAll = ()  => { ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].forEach(k => keysRef.current[k] = false); };

  const relocalize = () => {
    odomRef.current = { ...truthRef.current };
    odomTrail.current = [{ x: truthRef.current.x, y: truthRef.current.y }];
    setError({ dist: 0, ang: 0 });
  };

  const resetAll = () => {
    truthRef.current = mkPose();
    odomRef.current = mkPose();
    truthTrail.current = [{ x: WORLD / 2, y: WORLD / 2 }];
    odomTrail.current  = [{ x: WORLD / 2, y: WORLD / 2 }];
    lastTRef.current = null;
    setError({ dist: 0, ang: 0 });
  };

  const offsetX = (truthRef.current.x - odomRef.current.x).toFixed(2);
  const offsetY = (truthRef.current.y - odomRef.current.y).toFixed(2);

  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold tracking-widest text-green-400">LAB 07</span>
        </div>
        <h2 className="text-xl font-semibold text-whiteHull">TF Odometry Drift Lab</h2>
        <p className="mt-1 text-sm text-slate-400">
          Why does ROS 2 keep <code className="text-sky-400">map</code>, <code className="text-sky-400">odom</code>,
          and <code className="text-sky-400">base_link</code> as separate TF frames instead of one? Because wheel
          odometry drifts — the <code className="text-sky-400">odom→base_link</code> transform is always smooth but
          slowly wrong, while <code className="text-sky-400">map→odom</code> is the jump a localizer (AMCL, SLAM)
          publishes to correct it.
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-5">
        {/* Canvas */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <div className="simulator-panel rounded-xl overflow-hidden" style={{ width: CW, height: CW, border: '1px solid rgba(74,222,128,0.25)' }}>
            <canvas ref={canvasRef} width={CW} height={CW} className="block" />
          </div>
          <p className="text-xs text-slate-500 font-mono">WASD / ↑↓←→ to drive · click canvas to focus</p>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-3 flex-1 min-w-[240px]">

          {/* Drive */}
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-3">Drive</h3>
            <div className="mx-auto w-fit">
              <div className="grid grid-cols-3 gap-1">
                <div /><DpadBtn label="↑" onPress={press('ArrowUp')} onRelease={releaseAll} /><div />
                <DpadBtn label="←" onPress={press('ArrowLeft')} onRelease={releaseAll} />
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-slate-600 text-xs">●</div>
                <DpadBtn label="→" onPress={press('ArrowRight')} onRelease={releaseAll} />
                <div /><DpadBtn label="↓" onPress={press('ArrowDown')} onRelease={releaseAll} /><div />
              </div>
            </div>
          </div>

          {/* Wheel slip */}
          <div className="simulator-panel rounded-xl p-4">
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>Wheel Slip (odom noise)</span>
              <span className="font-mono text-slate-300">{(slip * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min={0} max={0.5} step={0.02} value={slip}
              onChange={e => { setSlip(+e.target.value); slipRef.current = +e.target.value; }}
              className="w-full accent-sky-400 h-1.5" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={relocalize}
                className="rounded-lg bg-sky-400 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-300 transition">
                📍 Relocalize (AMCL fix)
              </button>
              <button onClick={resetAll}
                className="rounded-lg bg-slate-800 py-2 text-xs text-slate-400 hover:bg-slate-700 transition">
                Reset
              </button>
            </div>
          </div>

          {/* Frame tree */}
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-3">TF Tree</h3>
            <div className="flex flex-col gap-1">
              <FrameNode label="map" color="#4ade80" />
              <FrameEdge text={`t: (${offsetX}, ${offsetY})  ← correction`} warn={error.dist > 0.6} />
              <FrameNode label="odom" color="#38bdf8" />
              <FrameEdge text={`t: (${odomRef.current.x.toFixed(2)}, ${odomRef.current.y.toFixed(2)})  θ: ${odomRef.current.theta.toFixed(2)}`} />
              <FrameNode label="base_link" color="#facc15" />
              <FrameEdge text={`t: (${LASER_OFFSET.toFixed(2)}, 0.00)  static`} />
              <FrameNode label="laser" color="#f472b6" />
            </div>
          </div>

          {/* Error readout */}
          <div className="simulator-panel rounded-xl p-4 font-mono text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-2 font-sans">
              Localization Error
            </h3>
            <div className="space-y-0.5 text-slate-400">
              <div><span className="text-slate-500">position: </span>
                <span className={error.dist > 0.6 ? 'text-red-400' : error.dist > 0.2 ? 'text-yellow-400' : 'text-green-400'}>
                  {error.dist.toFixed(3)} m
                </span>
              </div>
              <div><span className="text-slate-500">heading: </span>
                <span className={error.ang > 0.4 ? 'text-red-400' : 'text-slate-300'}>{error.ang.toFixed(3)} rad</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
