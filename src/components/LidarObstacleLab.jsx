import { useEffect, useRef, useState, useCallback } from 'react';

/* ── World constants ─────────────────────────────────────────── */
const CW    = 460;
const WORLD = 11.088;
const PX    = CW / WORLD;
const r2c   = (rx, ry) => [rx * PX, CW - ry * PX];
const c2r   = (cx, cy) => [cx / PX, (CW - cy) / PX];

/* ── LaserScan params (sensor_msgs/LaserScan) ────────────────── */
const NUM_RAYS   = 36;
const ANGLE_INC  = (2 * Math.PI) / NUM_RAYS;
const RANGE_MIN  = 0.12;
const RANGE_MAX  = 5.0;
const TURTLE_R   = 0.3;
const MAX_OBSTACLES = 8;

/* ── Reactive controller params ──────────────────────────────── */
const AVOID_DIST  = 1.8;            // begin slowing / steering
const STOP_DIST   = 0.7;            // hard turn-in-place threshold
const FRONT_CONE  = Math.PI / 3;    // ±60° considered "ahead"
const AUTO_SPEED  = 2.2;
const AUTO_TURN   = 2.6;

const DEFAULT_OBSTACLES = [
  { x: 2.2, y: 8.5, r: 0.6 },
  { x: 8.6, y: 8.0, r: 0.5 },
  { x: 3.0, y: 3.0, r: 0.55 },
  { x: 8.8, y: 3.4, r: 0.65 },
  { x: 5.544, y: 1.7, r: 0.45 },
];

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

function drawObstacles(ctx, obstacles) {
  obstacles.forEach(ob => {
    const [cx, cy] = r2c(ob.x, ob.y);
    const r = ob.r * PX;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251,113,133,0.18)'; ctx.fill();
    ctx.strokeStyle = 'rgba(251,113,133,0.65)'; ctx.lineWidth = 1.5; ctx.stroke();
  });
}

function drawScan(ctx, ox, oy, ranges, heading) {
  const [sx, sy] = r2c(ox, oy);
  for (let i = 0; i < ranges.length; i++) {
    const angle = heading + i * ANGLE_INC;
    const range = ranges[i];
    const [hx, hy] = r2c(ox + range * Math.cos(angle), oy + range * Math.sin(angle));
    const t = Math.min(1, range / RANGE_MAX);
    // close → red, far → green
    const g = Math.round(80 + t * 140);
    const rr = Math.round(240 - t * 160);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(hx, hy);
    ctx.strokeStyle = `rgba(${rr},${g},110,${range < RANGE_MAX ? 0.5 : 0.12})`;
    ctx.lineWidth = range < RANGE_MAX ? 1 : 0.6;
    ctx.stroke();
    if (range < RANGE_MAX) {
      ctx.beginPath(); ctx.arc(hx, hy, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rr},${g},110,0.8)`; ctx.fill();
    }
  }
}

function drawTurtle(ctx, rx, ry, theta, color, flash) {
  const [cx, cy] = r2c(rx, ry);
  const r = 13;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-theta);
  ctx.shadowColor = flash ? '#ef4444' : color; ctx.shadowBlur = flash ? 18 : 10;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = (flash ? '#ef4444' : color) + 'cc'; ctx.fill();
  ctx.strokeStyle = flash ? '#ef4444' : color; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.8;
  [0.35, 0.65, 0.9].forEach(f => { ctx.beginPath(); ctx.arc(0, 0, r * f, 0, Math.PI * 2); ctx.stroke(); });
  ctx.beginPath(); ctx.arc(r * 1.1, 0, r * 0.26, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(r * 1.2, 0, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* ── Geometry: ray vs world-box + circles ────────────────────── */
function castRay(ox, oy, angle, obstacles) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let best = RANGE_MAX;

  if (dx > 1e-9)       { const t = (WORLD - ox) / dx; if (t > 0) { const y = oy + dy * t; if (y >= 0 && y <= WORLD) best = Math.min(best, t); } }
  else if (dx < -1e-9) { const t = (0 - ox) / dx;     if (t > 0) { const y = oy + dy * t; if (y >= 0 && y <= WORLD) best = Math.min(best, t); } }
  if (dy > 1e-9)       { const t = (WORLD - oy) / dy; if (t > 0) { const x = ox + dx * t; if (x >= 0 && x <= WORLD) best = Math.min(best, t); } }
  else if (dy < -1e-9) { const t = (0 - oy) / dy;     if (t > 0) { const x = ox + dx * t; if (x >= 0 && x <= WORLD) best = Math.min(best, t); } }

  obstacles.forEach(ob => {
    const fx = ob.x - ox, fy = ob.y - oy;
    const b = -2 * (dx * fx + dy * fy);
    const c = fx * fx + fy * fy - ob.r * ob.r;
    const disc = b * b - 4 * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const t1 = (-b - sq) / 2, t2 = (-b + sq) / 2;
      const t = t1 > 1e-3 ? t1 : (t2 > 1e-3 ? t2 : Infinity);
      if (t > 0 && t < best) best = t;
    }
  });
  return Math.max(RANGE_MIN, Math.min(RANGE_MAX, best));
}

function scanAt(ox, oy, heading, obstacles) {
  const ranges = new Array(NUM_RAYS);
  for (let i = 0; i < NUM_RAYS; i++) ranges[i] = castRay(ox, oy, heading + i * ANGLE_INC, obstacles);
  return ranges;
}

const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

const mkTurtle = () => ({ x: WORLD / 2, y: WORLD / 2, theta: 0, linearVel: 0, angularVel: 0 });

/* ── D-pad button (manual mode) ──────────────────────────────── */
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

/* ── Component ───────────────────────────────────────────────── */
export default function LidarObstacleLab() {
  const canvasRef   = useRef(null);
  const tRef        = useRef(mkTurtle());
  const obstaclesRef= useRef(DEFAULT_OBSTACLES.map(o => ({ ...o })));
  const keysRef     = useRef({});
  const rafRef      = useRef(null);
  const lastTRef    = useRef(null);
  const modeRef     = useRef('auto');
  const syncTRef    = useRef(null);
  const flashRef    = useRef(0);
  const bumpsRef    = useRef(0);

  const [mode,       setMode]       = useState('auto'); // 'manual' | 'auto'
  const [obstacles,  setObstacles]  = useState(obstaclesRef.current);
  const [status,     setStatus]     = useState('scanning');
  const [scanInfo,   setScanInfo]   = useState({ ranges: new Array(NUM_RAYS).fill(RANGE_MAX), minIdx: 0 });
  const [bumps,      setBumps]      = useState(0);

  const draw = useCallback((ranges) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const t = tRef.current;
    drawBg(ctx);
    drawScan(ctx, t.x, t.y, ranges, t.theta);
    drawObstacles(ctx, obstaclesRef.current);
    drawTurtle(ctx, t.x, t.y, t.theta, '#4ade80', performance.now() - flashRef.current < 180);

    // HUD
    ctx.fillStyle = 'rgba(1,13,31,0.88)';
    ctx.beginPath();
    ctx.roundRect?.(8, 8, 182, 58, 5) ?? ctx.rect(8, 8, 182, 58);
    ctx.fill();
    ctx.strokeStyle = 'rgba(74,222,128,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect?.(8, 8, 182, 58, 5) ?? ctx.rect(8, 8, 182, 58);
    ctx.stroke();
    ctx.font = '10px monospace';
    const minR = Math.min(...ranges);
    ctx.fillStyle = '#475569'; ctx.fillText('range_min:', 16, 26);
    ctx.fillStyle = minR < STOP_DIST ? '#ef4444' : minR < AVOID_DIST ? '#fbbf24' : '#4ade80';
    ctx.fillText(`${minR.toFixed(2)} m`, 102, 26);
    ctx.fillStyle = '#475569'; ctx.fillText('linear_x:', 16, 41);
    ctx.fillStyle = t.linearVel !== 0 ? '#4ade80' : '#cbd5e1';
    ctx.fillText(t.linearVel.toFixed(2), 102, 41);
    ctx.fillStyle = '#475569'; ctx.fillText('angular_z:', 16, 56);
    ctx.fillStyle = t.angularVel !== 0 ? '#4ade80' : '#cbd5e1';
    ctx.fillText(t.angularVel.toFixed(2), 102, 56);
  }, []);

  const animate = useCallback((now) => {
    if (lastTRef.current === null) lastTRef.current = now;
    const dt = Math.min((now - lastTRef.current) / 1000, 0.05);
    lastTRef.current = now;

    const t = tRef.current;
    const obstacles = obstaclesRef.current;
    const ranges = scanAt(t.x, t.y, t.theta, obstacles);

    if (modeRef.current === 'manual') {
      const keys = keysRef.current;
      t.linearVel  = (keys['ArrowUp']||keys['w']||keys['W']) ? 3.0 : (keys['ArrowDown']||keys['s']||keys['S']) ? -3.0 : 0;
      t.angularVel = (keys['ArrowLeft']||keys['a']||keys['A']) ? 2.2 : (keys['ArrowRight']||keys['d']||keys['D']) ? -2.2 : 0;
      setStatus('manual');
    } else {
      // Reactive avoidance over the front cone
      let minFront = Infinity, minFrontRel = 0;
      let leftSum = 0, leftN = 0, rightSum = 0, rightN = 0;
      for (let i = 0; i < NUM_RAYS; i++) {
        const rel = norm(i * ANGLE_INC);
        if (Math.abs(rel) <= FRONT_CONE) {
          if (ranges[i] < minFront) { minFront = ranges[i]; minFrontRel = rel; }
        }
        if (rel > 0) { leftSum += ranges[i]; leftN++; } else { rightSum += ranges[i]; rightN++; }
      }
      const leftClear  = leftN  ? leftSum / leftN   : RANGE_MAX;
      const rightClear = rightN ? rightSum / rightN : RANGE_MAX;
      const turnTowardClearer = leftClear > rightClear ? 1 : -1;

      if (minFront < STOP_DIST) {
        t.angularVel = turnTowardClearer * AUTO_TURN;
        t.linearVel  = minFront < STOP_DIST * 0.55 ? -0.5 : 0;
        setStatus('turning');
      } else if (minFront < AVOID_DIST) {
        const urgency = 1 - (minFront - STOP_DIST) / (AVOID_DIST - STOP_DIST);
        t.angularVel = turnTowardClearer * AUTO_TURN * 0.55 * urgency;
        t.linearVel  = AUTO_SPEED * (1 - 0.7 * urgency);
        setStatus('steering');
      } else {
        t.angularVel = 0;
        t.linearVel  = AUTO_SPEED;
        setStatus('clear');
      }
    }

    t.theta = norm(t.theta + t.angularVel * dt);
    let nx = Math.max(TURTLE_R, Math.min(WORLD - TURTLE_R, t.x + t.linearVel * Math.cos(t.theta) * dt));
    let ny = Math.max(TURTLE_R, Math.min(WORLD - TURTLE_R, t.y + t.linearVel * Math.sin(t.theta) * dt));

    // Simple collision resolve: push back out of any overlapping obstacle
    obstacles.forEach(ob => {
      const dx = nx - ob.x, dy = ny - ob.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = ob.r + TURTLE_R;
      if (dist < minDist && dist > 1e-6) {
        const push = minDist - dist;
        nx += (dx / dist) * push;
        ny += (dy / dist) * push;
        if (now - flashRef.current > 300) {
          flashRef.current = now;
          bumpsRef.current += 1;
          setBumps(bumpsRef.current);
        }
      }
    });
    t.x = nx; t.y = ny;

    draw(ranges);

    if (!syncTRef.current) {
      syncTRef.current = setTimeout(() => {
        syncTRef.current = null;
        setScanInfo({ ranges, minIdx: ranges.indexOf(Math.min(...ranges)) });
      }, 120);
    }

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

  const setModeAndClear = (m) => { modeRef.current = m; setMode(m); };

  const randomizeObstacles = () => {
    const n = 5 + Math.floor(Math.random() * 3);
    const next = [];
    let guard = 0;
    while (next.length < n && guard < 400) {
      guard++;
      const x = 1 + Math.random() * (WORLD - 2);
      const y = 1 + Math.random() * (WORLD - 2);
      const r = 0.4 + Math.random() * 0.4;
      if (Math.hypot(x - WORLD / 2, y - WORLD / 2) < 1.6 + r) continue;
      if (next.some(o => Math.hypot(x - o.x, y - o.y) < o.r + r + 0.3)) continue;
      next.push({ x, y, r });
    }
    obstaclesRef.current = next;
    setObstacles(next);
  };

  const clearObstacles = () => { obstaclesRef.current = []; setObstacles([]); };

  const resetWorld = () => {
    tRef.current = mkTurtle();
    obstaclesRef.current = DEFAULT_OBSTACLES.map(o => ({ ...o }));
    setObstacles(obstaclesRef.current);
    lastTRef.current = null;
    bumpsRef.current = 0; setBumps(0);
  };

  const handleCanvasClick = useCallback((e) => {
    if (obstaclesRef.current.length >= MAX_OBSTACLES) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (CW / rect.width);
    const cy = (e.clientY - rect.top)  * (CW / rect.height);
    const [rx, ry] = c2r(cx, cy);
    if (rx < 0.5 || rx > WORLD - 0.5 || ry < 0.5 || ry > WORLD - 0.5) return;
    if (Math.hypot(rx - tRef.current.x, ry - tRef.current.y) < 1.0) return;
    const next = [...obstaclesRef.current, { x: rx, y: ry, r: 0.5 }];
    obstaclesRef.current = next;
    setObstacles(next);
  }, []);

  const statusLabel = {
    manual:   'manual drive',
    clear:    'path clear → cruising',
    steering: 'obstacle ahead → steering',
    turning:  'too close → turning in place',
    scanning: 'scanning',
  }[status];

  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold tracking-widest text-green-400">LAB 04</span>
        </div>
        <h2 className="text-xl font-semibold text-whiteHull">LiDAR Obstacle Avoidance Lab</h2>
        <p className="mt-1 text-sm text-slate-400">
          A simulated 360° <code className="text-green-400">sensor_msgs/LaserScan</code> feeds a reactive
          controller that steers the turtle around obstacles — the perceive-and-react loop behind ROS 2
          Nav2's local costmap and the classic TurtleBot3 obstacle-avoidance demo.
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-5">
        {/* Canvas */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <div className="simulator-panel rounded-xl overflow-hidden cursor-crosshair"
            style={{ width: CW, height: CW, border: '1px solid rgba(74,222,128,0.25)' }}>
            <canvas ref={canvasRef} width={CW} height={CW} className="block" onClick={handleCanvasClick} />
          </div>
          <p className="text-xs text-slate-500 font-mono text-center">
            Click canvas to drop an obstacle &nbsp;·&nbsp;
            <span className={status === 'turning' ? 'text-red-400' : status === 'steering' ? 'text-yellow-400' : 'text-green-400'}>
              {statusLabel}
            </span>
          </p>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-3 flex-1 min-w-[220px]">

          {/* Mode */}
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-3">Control Mode</h3>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setModeAndClear('auto')}
                className={`rounded-lg py-2 text-xs font-semibold transition ${
                  mode === 'auto' ? 'bg-green-400 text-slate-950' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60'
                }`}>
                🤖 Autonomous
              </button>
              <button onClick={() => setModeAndClear('manual')}
                className={`rounded-lg py-2 text-xs font-semibold transition ${
                  mode === 'manual' ? 'bg-green-400 text-slate-950' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60'
                }`}>
                🕹 Manual
              </button>
            </div>
            {mode === 'manual' && (
              <div className="mt-3 mx-auto w-fit">
                <div className="grid grid-cols-3 gap-1">
                  <div /><DpadBtn label="↑" onPress={press('ArrowUp')} onRelease={releaseAll} /><div />
                  <DpadBtn label="←" onPress={press('ArrowLeft')} onRelease={releaseAll} />
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-slate-600 text-xs">●</div>
                  <DpadBtn label="→" onPress={press('ArrowRight')} onRelease={releaseAll} />
                  <div /><DpadBtn label="↓" onPress={press('ArrowDown')} onRelease={releaseAll} /><div />
                </div>
              </div>
            )}
          </div>

          {/* Obstacles */}
          <div className="simulator-panel rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400">Obstacles</h3>
              <span className="text-[11px] text-slate-500 font-mono">{obstacles.length}/{MAX_OBSTACLES}</span>
            </div>
            <div className="flex gap-1.5">
              <button onClick={randomizeObstacles}
                className="flex-1 rounded-md bg-slate-800 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-700 transition">
                🎲 Randomize
              </button>
              <button onClick={clearObstacles}
                className="flex-1 rounded-md bg-slate-800 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-700 transition">
                Clear
              </button>
              <button onClick={resetWorld}
                className="flex-1 rounded-md bg-slate-800 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-700 transition">
                Reset
              </button>
            </div>
          </div>

          {/* LaserScan readout */}
          <div className="simulator-panel rounded-xl p-4 font-mono text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-2 font-sans">
              /scan · sensor_msgs/LaserScan
            </h3>
            <div className="space-y-0.5 text-slate-400">
              <div><span className="text-slate-500">angle_increment: </span><span className="text-slate-300">{ANGLE_INC.toFixed(3)} rad</span></div>
              <div><span className="text-slate-500">range_min/max: </span><span className="text-slate-300">{RANGE_MIN} / {RANGE_MAX} m</span></div>
              <div><span className="text-slate-500">ranges.length: </span><span className="text-slate-300">{NUM_RAYS}</span></div>
              <div className="pt-1 border-t border-slate-800 mt-1">
                <span className="text-slate-500">closest[{scanInfo.minIdx}]: </span>
                <span className="text-green-400">{scanInfo.ranges[scanInfo.minIdx]?.toFixed(3)} m</span>
              </div>
              <div><span className="text-slate-500">bumps: </span><span className={bumps ? 'text-red-400' : 'text-slate-300'}>{bumps}</span></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
