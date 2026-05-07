import { useEffect, useRef, useState, useCallback } from 'react';

/* ── World constants ────────────────────────────────────────── */
const CW    = 540;           // canvas pixel size (square)
const WORLD = 11.088;        // ROS turtlesim world (meters)
const PX    = CW / WORLD;    // pixels per meter ≈ 48.7

/* ── Coordinate helpers ─────────────────────────────────────── */
// ROS: +x right, +y up, θ=0→+x, CCW positive
// Canvas: +x right, +y down
const r2c = (rx, ry) => [rx * PX, CW - ry * PX];

/* ── Palette ────────────────────────────────────────────────── */
const SHELL_COLORS = ['#00a3e0', '#f472b6', '#4ade80', '#fb923c', '#a78bfa', '#facc15'];
const PEN_SWATCHES  = ['#00a3e0', '#f472b6', '#4ade80', '#fb923c', '#a78bfa', '#facc15', '#ffffff'];

/* ── Helpers ─────────────────────────────────────────────────── */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h,     x, y + h - r,     r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y,         x + r, y,         r);
  ctx.closePath();
}

/* ── Background ─────────────────────────────────────────────── */
function drawBg(ctx) {
  ctx.fillStyle = '#010d1f';
  ctx.fillRect(0, 0, CW, CW);

  // Minor grid (0.5m)
  ctx.strokeStyle = 'rgba(0,163,224,0.05)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= WORLD * 2; i++) {
    const p = (i / 2) * PX;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, CW); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(CW, p); ctx.stroke();
  }

  // Major grid (1m)
  ctx.strokeStyle = 'rgba(0,163,224,0.13)';
  ctx.lineWidth = 0.75;
  for (let i = 0; i <= WORLD; i++) {
    const p = i * PX;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, CW); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(CW, p); ctx.stroke();
  }

  // Border
  ctx.strokeStyle = 'rgba(0,163,224,0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, CW - 1.5, CW - 1.5);

  // Axis labels
  ctx.fillStyle = 'rgba(100,116,139,0.5)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  for (let i = 1; i <= 11; i++) {
    ctx.fillText(i, i * PX, CW - 3);
    ctx.textAlign = 'right';
    ctx.fillText(i, 12, CW - i * PX + 3);
    ctx.textAlign = 'center';
  }
}

/* ── Trail ───────────────────────────────────────────────────── */
function drawTrail(ctx, trail, color, width) {
  if (trail.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = color + 'bb';
  ctx.lineWidth   = width;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  const [sx, sy] = r2c(trail[0].x, trail[0].y);
  ctx.moveTo(sx, sy);
  for (let i = 1; i < trail.length; i++) {
    const [tx, ty] = r2c(trail[i].x, trail[i].y);
    ctx.lineTo(tx, ty);
  }
  ctx.stroke();
}

/* ── Turtle ──────────────────────────────────────────────────── */
function drawTurtle(ctx, rx, ry, theta, color, isActive) {
  const [cx, cy] = r2c(rx, ry);
  const r = 14;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-theta); // ROS CCW → canvas CW

  if (isActive) { ctx.shadowColor = color; ctx.shadowBlur = 14; }

  // Legs
  const legDefs = [[r * 0.55, r * 0.8, 0.4], [-r * 0.55, r * 0.8, -0.4],
                   [r * 0.55, -r * 0.8, -0.4], [-r * 0.55, -r * 0.8, 0.4]];
  ctx.fillStyle = color + 'bb';
  legDefs.forEach(([lx, ly, angle]) => {
    ctx.save();
    ctx.translate(lx, ly); ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.15, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Tail
  ctx.beginPath();
  ctx.ellipse(-r * 1.12, 0, r * 0.09, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fillStyle = color + 'bb';
  ctx.fill();

  // Body
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();

  // Shell — concentric + pentagon segments
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 0.8;
  [0.34, 0.62, 0.88].forEach(f => {
    ctx.beginPath(); ctx.arc(0, 0, r * f, 0, Math.PI * 2); ctx.stroke();
  });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
  }

  // Head
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(r * 1.12, 0, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();

  // Eyes
  ctx.fillStyle = '#0f172a';
  [[r * 1.22, -r * 0.1], [r * 1.22, r * 0.1]].forEach(([ex, ey]) => {
    ctx.beginPath(); ctx.arc(ex, ey, 2.2, 0, Math.PI * 2); ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  [[r * 1.25, -r * 0.15], [r * 1.25, r * 0.05]].forEach(([ex, ey]) => {
    ctx.beginPath(); ctx.arc(ex, ey, 0.7, 0, Math.PI * 2); ctx.fill();
  });

  ctx.restore();
}

/* ── Turtle factory ──────────────────────────────────────────── */
const mkTurtle = (name, x, y, theta, colorIdx) => ({
  name, x, y, theta, colorIdx,
  linearVel: 0, angularVel: 0,
  penDown: true, penColor: SHELL_COLORS[colorIdx], penWidth: 2.5,
  trail: [{ x, y }],
});

/* ── D-pad button ────────────────────────────────────────────── */
function DpadBtn({ label, onPress, onRelease }) {
  return (
    <button
      onPointerDown={onPress} onPointerUp={onRelease}
      onPointerLeave={onRelease} onContextMenu={e => e.preventDefault()}
      className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-slate-300
                 select-none transition hover:bg-pacificCyan/30 active:bg-pacificCyan/60 text-base"
    >
      {label}
    </button>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export default function TurtleSimulator({ onUpdate }) {
  const canvasRef  = useRef(null);
  const turtlesRef = useRef([mkTurtle('turtle1', WORLD / 2, WORLD / 2, 0, 0)]);
  const keysRef    = useRef({});
  const rafRef     = useRef(null);
  const lastTRef   = useRef(null);
  const speedRef   = useRef(3.5);
  const angSRef    = useRef(2.2);
  const activeRef  = useRef('turtle1');
  const syncTRef   = useRef(null); // throttle timer for React state

  const [activeId,     setActiveId]     = useState('turtle1');
  const [turtleNames,  setTurtleNames]  = useState(['turtle1']);
  const [speed,        setSpeed]        = useState(3.5);
  const [angSpd,       setAngSpd]       = useState(2.2);
  const [penDown,      setPenDown]      = useState(true);
  const [penColor,     setPenColor]     = useState(SHELL_COLORS[0]);
  const [pose,         setPose]         = useState({ x: WORLD/2, y: WORLD/2, theta: 0, lv: 0, av: 0 });

  /* ── Draw ───────────────────────────────────────────────────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    drawBg(ctx);

    turtlesRef.current.forEach(t => {
      if (t.penDown && t.trail.length > 1) drawTrail(ctx, t.trail, t.penColor, t.penWidth);
    });
    turtlesRef.current.forEach(t => {
      drawTurtle(ctx, t.x, t.y, t.theta, SHELL_COLORS[t.colorIdx], t.name === activeRef.current);
    });

    // HUD
    const a = turtlesRef.current.find(t => t.name === activeRef.current);
    if (a) {
      ctx.fillStyle = 'rgba(1,13,31,0.9)';
      roundRect(ctx, 8, 8, 174, 72, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(0,163,224,0.38)'; ctx.lineWidth = 1;
      roundRect(ctx, 8, 8, 174, 72, 6); ctx.stroke();

      ctx.font = '10px monospace';
      const labels = ['x:', 'y:', 'θ:', 'vel:'];
      const vals   = [
        a.x.toFixed(4), a.y.toFixed(4), a.theta.toFixed(4) + ' rad',
        `${a.linearVel.toFixed(1)} m/s  ${a.angularVel.toFixed(1)} r/s`,
      ];
      labels.forEach((lbl, i) => {
        ctx.fillStyle = '#475569'; ctx.fillText(lbl, 16, 26 + i * 15);
        ctx.fillStyle = i === 3 && (a.linearVel !== 0 || a.angularVel !== 0) ? '#00a3e0' : '#cbd5e1';
        ctx.fillText(vals[i], 40, 26 + i * 15);
      });
    }
  }, []);

  /* ── Anim loop ──────────────────────────────────────────────── */
  const animate = useCallback((now) => {
    if (lastTRef.current === null) lastTRef.current = now;
    const dt = Math.min((now - lastTRef.current) / 1000, 0.05);
    lastTRef.current = now;

    const keys = keysRef.current;
    const a    = turtlesRef.current.find(t => t.name === activeRef.current);

    if (a) {
      const lin = (keys['ArrowUp']   || keys['w'] || keys['W']) ? speedRef.current
                : (keys['ArrowDown'] || keys['s'] || keys['S']) ? -speedRef.current : 0;
      const ang = (keys['ArrowLeft'] || keys['a'] || keys['A']) ? angSRef.current
                : (keys['ArrowRight']|| keys['d'] || keys['D']) ? -angSRef.current : 0;

      a.linearVel  = lin;
      a.angularVel = ang;

      if (lin !== 0 || ang !== 0) {
        a.theta += ang * dt;
        const nx = Math.max(0, Math.min(WORLD, a.x + lin * Math.cos(a.theta) * dt));
        const ny = Math.max(0, Math.min(WORLD, a.y + lin * Math.sin(a.theta) * dt));

        if (a.penDown) {
          const last = a.trail[a.trail.length - 1];
          if ((nx - last.x) ** 2 + (ny - last.y) ** 2 > 2e-3) a.trail.push({ x: nx, y: ny });
        }
        a.x = nx; a.y = ny;

        if (!syncTRef.current) {
          syncTRef.current = setTimeout(() => {
            syncTRef.current = null;
            setPose({ x: a.x, y: a.y, theta: a.theta, lv: a.linearVel, av: a.angularVel });
            onUpdate?.({ name: a.name, x: a.x, y: a.y, theta: a.theta, linearVel: a.linearVel, angularVel: a.angularVel });
          }, 80);
        }
      }
    }

    draw();
    rafRef.current = requestAnimationFrame(animate);
  }, [draw, onUpdate]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (syncTRef.current) clearTimeout(syncTRef.current);
    };
  }, [animate]);

  /* ── Keyboard ───────────────────────────────────────────────── */
  useEffect(() => {
    const on = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      keysRef.current[e.key] = e.type === 'keydown';
    };
    window.addEventListener('keydown', on);
    window.addEventListener('keyup',   on);
    return () => { window.removeEventListener('keydown', on); window.removeEventListener('keyup', on); };
  }, []);

  /* ── Commands ───────────────────────────────────────────────── */
  const spawnTurtle = () => {
    const idx   = turtlesRef.current.length;
    if (idx >= SHELL_COLORS.length) return;
    const name  = `turtle${idx + 1}`;
    const angle = (idx / SHELL_COLORS.length) * Math.PI * 2;
    turtlesRef.current.push(mkTurtle(name, WORLD / 2 + 3 * Math.cos(angle), WORLD / 2 + 3 * Math.sin(angle), angle + Math.PI, idx));
    setTurtleNames(turtlesRef.current.map(t => t.name));
    activeRef.current = name; setActiveId(name);
    setPenDown(true); setPenColor(SHELL_COLORS[idx]);
  };

  const clearTrails = () => turtlesRef.current.forEach(t => { t.trail = [{ x: t.x, y: t.y }]; });

  const resetSim = () => {
    turtlesRef.current = [mkTurtle('turtle1', WORLD / 2, WORLD / 2, 0, 0)];
    setTurtleNames(['turtle1']); activeRef.current = 'turtle1'; setActiveId('turtle1');
    setPenDown(true); setPenColor(SHELL_COLORS[0]); lastTRef.current = null;
  };

  const togglePen = () => {
    const t = turtlesRef.current.find(t => t.name === activeRef.current);
    if (t) { t.penDown = !t.penDown; setPenDown(t.penDown); }
  };

  const selectTurtle = (name) => {
    activeRef.current = name; setActiveId(name);
    const t = turtlesRef.current.find(t => t.name === name);
    if (t) { setPenDown(t.penDown); setPenColor(t.penColor); }
  };

  const setPenColorForActive = (c) => {
    const t = turtlesRef.current.find(t => t.name === activeRef.current);
    if (t) { t.penColor = c; setPenColor(c); }
  };

  /* D-pad */
  const press      = (k) => () => { keysRef.current[k] = true; };
  const releaseAll = ()  => { ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].forEach(k => keysRef.current[k] = false); };

  /* ── JSX ─────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col xl:flex-row gap-5">

      {/* Canvas */}
      <div className="flex-shrink-0 flex flex-col items-center gap-2">
        <div className="simulator-panel rounded-xl overflow-hidden" style={{ width: CW, height: CW }}>
          <canvas ref={canvasRef} width={CW} height={CW} className="block cursor-crosshair" />
        </div>
        <p className="text-xs text-slate-500 font-mono">WASD / ↑↓←→ to drive · click canvas to focus</p>
      </div>

      {/* Sidebar */}
      <div className="flex flex-col gap-3 flex-1" style={{ minWidth: 260 }}>

        {/* Turtle list */}
        <div className="simulator-panel rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-pacificCyan">Active Turtles</h3>
            <div className="flex gap-1">
              {[['+ Spawn', spawnTurtle, turtleNames.length >= SHELL_COLORS.length],
                ['Clear',  clearTrails, false],
                ['Reset',  resetSim,    false]].map(([lbl, fn, dis]) => (
                <button key={lbl} onClick={fn} disabled={dis}
                  className="rounded-md bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition">
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {turtleNames.map((name, i) => (
              <button key={name} onClick={() => selectTurtle(name)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition ${
                  activeId === name ? 'bg-pacificCyan/15 ring-1 ring-pacificCyan/50' : 'hover:bg-slate-800/60'
                }`}>
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: SHELL_COLORS[i] }} />
                <span className="font-mono text-slate-200 text-xs">/turtlesim/{name}</span>
                {activeId === name && <span className="ml-auto text-[10px] text-pacificCyan font-bold">ACTIVE</span>}
              </button>
            ))}
          </div>
        </div>

        {/* D-pad */}
        <div className="simulator-panel rounded-xl p-4">
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-pacificCyan">
            Teleop &nbsp;<span className="text-slate-500 normal-case font-normal">/turtle1/cmd_vel</span>
          </h3>
          <div className="mx-auto w-fit">
            <div className="grid grid-cols-3 gap-1.5">
              <div />
              <DpadBtn label="↑" onPress={press('ArrowUp')}    onRelease={releaseAll} />
              <div />
              <DpadBtn label="←" onPress={press('ArrowLeft')}  onRelease={releaseAll} />
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-slate-600 text-xs select-none">●</div>
              <DpadBtn label="→" onPress={press('ArrowRight')} onRelease={releaseAll} />
              <div />
              <DpadBtn label="↓" onPress={press('ArrowDown')}  onRelease={releaseAll} />
              <div />
            </div>
          </div>
        </div>

        {/* Velocity */}
        <div className="simulator-panel rounded-xl p-4">
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-pacificCyan">Velocity</h3>
          {[['Linear', speed, 0.5, 7, 0.1, (v) => { setSpeed(v); speedRef.current = v; }, 'm/s'],
            ['Angular', angSpd, 0.3, 5, 0.1, (v) => { setAngSpd(v); angSRef.current = v; }, 'rad/s']
          ].map(([label, val, min, max, step, fn, unit]) => (
            <div key={label} className="mb-2.5 last:mb-0">
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>{label}</span>
                <span className="font-mono text-slate-300">{val.toFixed(1)} <span className="text-slate-500">{unit}</span></span>
              </div>
              <input type="range" min={min} max={max} step={step} value={val}
                onChange={e => fn(+e.target.value)} className="w-full accent-pacificCyan h-1.5" />
            </div>
          ))}
        </div>

        {/* Pen */}
        <div className="simulator-panel rounded-xl p-4">
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-pacificCyan">Pen</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={togglePen}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                penDown ? 'bg-pacificCyan text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
              {penDown ? '✒ Down' : '✏ Up'}
            </button>
            <div className="flex gap-1.5">
              {PEN_SWATCHES.map(c => (
                <button key={c} onClick={() => setPenColorForActive(c)}
                  className="h-5 w-5 rounded-full transition ring-offset-1 ring-offset-slate-900"
                  style={{ background: c, ring: penColor === c ? '2px solid white' : undefined,
                           outline: penColor === c ? `2px solid ${c}` : '2px solid transparent', outlineOffset: 2 }} />
              ))}
            </div>
          </div>
        </div>

        {/* Pose readout */}
        <div className="simulator-panel rounded-xl p-4">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-pacificCyan">
            /turtle1/pose
          </h3>
          <div className="space-y-0.5 font-mono text-xs">
            {[['x',               pose.x.toFixed(4)],
              ['y',               pose.y.toFixed(4)],
              ['theta',           pose.theta.toFixed(4)],
              ['linear_velocity', pose.lv.toFixed(4)],
              ['angular_velocity',pose.av.toFixed(4)]].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-slate-500 w-36">{k}:</span>
                <span className={`${k.includes('velocity') && +v !== 0 ? 'text-pacificCyan' : 'text-slate-300'}`}>{v}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
