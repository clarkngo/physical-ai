import { useEffect, useRef, useState, useCallback } from 'react';

/* ── World constants ─────────────────────────────────────────── */
const CW    = 460;
const WORLD = 11.088;
const PX    = CW / WORLD;
const r2c   = (rx, ry) => [rx * PX, CW - ry * PX];
const c2r   = (cx, cy) => [cx / PX, (CW - cy) / PX];

const REACH_DIST   = 0.25;  // metres — waypoint considered reached
const K_ANG        = 3.2;   // angular gain
const K_LIN        = 1.8;   // linear gain
const MAX_LIN      = 3.5;
const MAX_ANG      = 3.0;
const MAX_WAYPOINTS = 8;

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
  [0.35, 0.65, 0.9].forEach(f => { ctx.beginPath(); ctx.arc(0,0,r*f,0,Math.PI*2); ctx.stroke(); });
  ctx.beginPath(); ctx.arc(r * 1.1, 0, r * 0.26, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(r * 1.2, 0, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawTrail(ctx, trail) {
  if (trail.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(74,222,128,0.45)';
  ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const [sx, sy] = r2c(trail[0].x, trail[0].y);
  ctx.moveTo(sx, sy);
  trail.slice(1).forEach(p => { const [tx, ty] = r2c(p.x, p.y); ctx.lineTo(tx, ty); });
  ctx.stroke();
}

function drawWaypoints(ctx, waypoints, currentIdx) {
  // Planned path line
  if (waypoints.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(251,191,36,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    waypoints.forEach((wp, i) => {
      const [cx, cy] = r2c(wp.x, wp.y);
      if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  waypoints.forEach((wp, i) => {
    const [cx, cy] = r2c(wp.x, wp.y);
    const reached = i < currentIdx;
    const active  = i === currentIdx;

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, active ? 14 : 10, 0, Math.PI * 2);
    ctx.strokeStyle = reached ? 'rgba(74,222,128,0.4)'
                    : active  ? 'rgba(251,191,36,0.9)'
                    :            'rgba(251,191,36,0.4)';
    ctx.lineWidth = active ? 2 : 1.5;
    ctx.stroke();

    if (active) {
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(251,191,36,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Fill
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = reached ? 'rgba(74,222,128,0.3)'
                  : active  ? 'rgba(251,191,36,0.3)'
                  :            'rgba(251,191,36,0.12)';
    ctx.fill();

    // Number
    ctx.fillStyle = reached ? '#4ade80' : active ? '#fbbf24' : 'rgba(251,191,36,0.6)';
    ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
    ctx.fillText(reached ? '✓' : `${i + 1}`, cx, cy + 3.5);

    // Coords
    ctx.font = '7px monospace'; ctx.fillStyle = 'rgba(148,163,184,0.4)';
    ctx.fillText(`(${wp.x.toFixed(1)},${wp.y.toFixed(1)})`, cx, cy + 22);
  });
  ctx.textAlign = 'start';
}

const mkTurtle = () => ({
  x: 2.0, y: 2.0, theta: 0,
  linearVel: 0, angularVel: 0,
  trail: [{ x: 2.0, y: 2.0 }],
});

/* ── Component ───────────────────────────────────────────────── */
export default function WaypointNavLab() {
  const canvasRef  = useRef(null);
  const tRef       = useRef(mkTurtle());
  const wpsRef     = useRef([]);
  const navIdxRef  = useRef(0);
  const rafRef     = useRef(null);
  const lastTRef   = useRef(null);

  const [waypoints,  setWaypoints]  = useState([]);
  const [navState,   setNavState]   = useState('idle'); // idle | navigating | done
  const [navIdx,     setNavIdx]     = useState(0);
  const [distToNext, setDistToNext] = useState(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const t = tRef.current;
    drawBg(ctx);
    drawTrail(ctx, t.trail);
    drawWaypoints(ctx, wpsRef.current, navIdxRef.current);
    drawTurtle(ctx, t.x, t.y, t.theta, '#4ade80');

    // HUD
    ctx.fillStyle = 'rgba(1,13,31,0.88)';
    ctx.beginPath();
    ctx.roundRect?.(8, 8, 170, 58, 5) ?? ctx.rect(8, 8, 170, 58);
    ctx.fill();
    ctx.strokeStyle = 'rgba(74,222,128,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect?.(8, 8, 170, 58, 5) ?? ctx.rect(8, 8, 170, 58);
    ctx.stroke();
    ctx.font = '10px monospace';
    ctx.fillStyle = '#475569'; ctx.fillText('pose.x:', 16, 26);
    ctx.fillStyle = '#cbd5e1'; ctx.fillText(t.x.toFixed(3), 72, 26);
    ctx.fillStyle = '#475569'; ctx.fillText('pose.y:', 16, 41);
    ctx.fillStyle = '#cbd5e1'; ctx.fillText(t.y.toFixed(3), 72, 41);
    ctx.fillStyle = '#475569'; ctx.fillText('theta:', 16, 56);
    ctx.fillStyle = '#cbd5e1'; ctx.fillText(t.theta.toFixed(3), 72, 56);
  }, []);

  const animate = useCallback((now) => {
    if (lastTRef.current === null) lastTRef.current = now;
    const dt = Math.min((now - lastTRef.current) / 1000, 0.05);
    lastTRef.current = now;

    const t    = tRef.current;
    const wps  = wpsRef.current;
    const idx  = navIdxRef.current;

    if (navIdxRef.current < wps.length && wps.length > 0) {
      const wp = wps[idx];
      const dx = wp.x - t.x, dy = wp.y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < REACH_DIST) {
        navIdxRef.current++;
        setNavIdx(navIdxRef.current);
        if (navIdxRef.current >= wps.length) {
          t.linearVel = 0; t.angularVel = 0;
          setNavState('done');
        }
      } else {
        const targetH = Math.atan2(dy, dx);
        let err = targetH - t.theta;
        while (err >  Math.PI) err -= 2 * Math.PI;
        while (err < -Math.PI) err += 2 * Math.PI;

        t.angularVel = Math.max(-MAX_ANG, Math.min(MAX_ANG, K_ANG * err));
        t.linearVel  = Math.abs(err) < 0.6
          ? Math.min(MAX_LIN, K_LIN * dist) : 0;

        t.theta += t.angularVel * dt;
        const nx = Math.max(0.2, Math.min(WORLD - 0.2, t.x + t.linearVel * Math.cos(t.theta) * dt));
        const ny = Math.max(0.2, Math.min(WORLD - 0.2, t.y + t.linearVel * Math.sin(t.theta) * dt));
        const last = t.trail[t.trail.length - 1];
        if ((nx - last.x) ** 2 + (ny - last.y) ** 2 > 1e-3) t.trail.push({ x: nx, y: ny });
        t.x = nx; t.y = ny;
        setDistToNext(dist);
      }
    }

    draw();
    rafRef.current = requestAnimationFrame(animate);
  }, [draw]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  // Canvas click → add waypoint
  const handleCanvasClick = useCallback((e) => {
    if (navState === 'navigating') return;
    if (wpsRef.current.length >= MAX_WAYPOINTS) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const scaleY = CW / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top)  * scaleY;
    const [rx, ry] = c2r(cx, cy);
    if (rx < 0.1 || rx > WORLD - 0.1 || ry < 0.1 || ry > WORLD - 0.1) return;
    const newWp = { x: rx, y: ry };
    wpsRef.current = [...wpsRef.current, newWp];
    setWaypoints([...wpsRef.current]);
  }, [navState]);

  const startNav = () => {
    if (wpsRef.current.length === 0) return;
    navIdxRef.current = 0;
    setNavIdx(0);
    setNavState('navigating');
    setDistToNext(null);
  };

  const clearAll = () => {
    wpsRef.current = [];
    navIdxRef.current = 0;
    tRef.current = mkTurtle();
    lastTRef.current = null;
    setWaypoints([]);
    setNavIdx(0);
    setNavState('idle');
    setDistToNext(null);
  };

  const removeWaypoint = (i) => {
    if (navState === 'navigating') return;
    wpsRef.current = wpsRef.current.filter((_, idx) => idx !== i);
    setWaypoints([...wpsRef.current]);
  };

  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold tracking-widest text-green-400">LAB 03</span>
        </div>
        <h2 className="text-xl font-semibold text-whiteHull">Waypoint Navigation Lab</h2>
        <p className="mt-1 text-sm text-slate-400">
          Click the canvas to place waypoints. The turtle uses a proportional controller
          to navigate each goal — the same feedback loop used in real ROS Nav2 stacks.
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-5">
        {/* Canvas */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <div className="simulator-panel rounded-xl overflow-hidden cursor-crosshair"
            style={{ width: CW, height: CW, border: '1px solid rgba(74,222,128,0.25)' }}>
            <canvas ref={canvasRef} width={CW} height={CW} className="block"
              onClick={handleCanvasClick} />
          </div>
          <p className="text-xs text-slate-500 font-mono">
            Click canvas to place waypoints &nbsp;·&nbsp;
            <span className={
              navState === 'navigating' ? 'text-green-400' :
              navState === 'done'       ? 'text-emerald-400' : 'text-slate-500'
            }>
              {navState === 'navigating' ? `navigating → WP ${navIdx + 1}/${waypoints.length}`
               : navState === 'done'     ? 'all waypoints reached ✓'
               :                          'idle'}
            </span>
          </p>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-3 flex-1 min-w-[220px]">

          {/* Controls */}
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-3">Navigation</h3>
            <div className="flex flex-col gap-2">
              <button onClick={startNav}
                disabled={waypoints.length === 0 || navState === 'navigating'}
                className="rounded-lg bg-green-400 py-2 text-sm font-semibold text-slate-950
                           hover:bg-emerald-300 disabled:opacity-40 transition">
                ▶ Start Navigation
              </button>
              <button onClick={clearAll}
                className="rounded-lg bg-slate-800 py-2 text-sm text-slate-400
                           hover:bg-slate-700 transition">
                Clear All
              </button>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              {waypoints.length === 0
                ? 'Click the canvas to add up to 8 waypoints'
                : `${waypoints.length} / ${MAX_WAYPOINTS} waypoints placed`}
            </p>
          </div>

          {/* Waypoint list */}
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-2">Waypoints</h3>
            {waypoints.length === 0 ? (
              <p className="text-xs text-slate-600 italic">None placed yet</p>
            ) : (
              <div className="flex flex-col gap-1">
                {waypoints.map((wp, i) => {
                  const reached = i < navIdx;
                  const active  = i === navIdx && navState === 'navigating';
                  return (
                    <div key={i}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                        active  ? 'bg-yellow-500/15 ring-1 ring-yellow-500/40' :
                        reached ? 'opacity-50' : 'bg-slate-800/40'
                      }`}>
                      <span className={`font-bold w-5 text-center ${
                        reached ? 'text-green-400' : active ? 'text-yellow-400' : 'text-slate-500'
                      }`}>
                        {reached ? '✓' : i + 1}
                      </span>
                      <span className="font-mono text-slate-300 flex-1">
                        ({wp.x.toFixed(2)}, {wp.y.toFixed(2)})
                      </span>
                      {active && distToNext !== null && (
                        <span className="text-yellow-400 font-mono">{distToNext.toFixed(2)}m</span>
                      )}
                      {navState !== 'navigating' && (
                        <button onClick={() => removeWaypoint(i)}
                          className="text-slate-600 hover:text-red-400 transition text-xs ml-1">✕</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Controller info */}
          <div className="simulator-panel rounded-xl p-4 font-mono text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-2 font-sans">
              P-Controller
            </h3>
            <div className="space-y-0.5 text-slate-400">
              <div><span className="text-slate-500">K_angular: </span><span className="text-slate-300">{K_ANG.toFixed(1)}</span></div>
              <div><span className="text-slate-500">K_linear:  </span><span className="text-slate-300">{K_LIN.toFixed(1)}</span></div>
              <div><span className="text-slate-500">reach_dist: </span><span className="text-slate-300">{REACH_DIST} m</span></div>
              <div className="pt-1 border-t border-slate-800 mt-1">
                <span className="text-slate-500">linear_vel: </span>
                <span className={tRef.current.linearVel > 0 ? 'text-green-400' : 'text-slate-300'}>
                  {tRef.current.linearVel.toFixed(3)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">angular_vel: </span>
                <span className={tRef.current.angularVel !== 0 ? 'text-green-400' : 'text-slate-300'}>
                  {tRef.current.angularVel.toFixed(3)}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
