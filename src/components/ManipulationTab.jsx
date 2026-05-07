import { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

/* ══════════════════════════════════════════════════════════════
   Constants & kinematics
   ══════════════════════════════════════════════════════════════ */
const CW = 460;          // canvas size (square)
const CX = CW / 2;       // pivot centre x
const CY = CW * 0.72;    // pivot centre y (lower-centre)

// Link lengths (px)
const L1 = 110;   // shoulder → elbow
const L2 = 85;    // elbow → wrist
const L3 = 55;    // wrist → end-effector

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// Forward kinematics — returns { elbow, wrist, ee }
function fk(q1, q2, q3) {
  // q1=base, q2=shoulder (relative), q3=elbow (relative)
  const a1 = q1;
  const a2 = q1 + q2;
  const a3 = q1 + q2 + q3;
  const elbow = { x: CX + L1 * Math.cos(a1), y: CY - L1 * Math.sin(a1) };
  const wrist  = { x: elbow.x + L2 * Math.cos(a2), y: elbow.y - L2 * Math.sin(a2) };
  const ee     = { x: wrist.x  + L3 * Math.cos(a3), y: wrist.y  - L3 * Math.sin(a3) };
  return { elbow, wrist, ee };
}

// 3-DOF geometric IK  (planar, joint 1 = base angle in canvas coords)
// Returns [q1,q2,q3] or null
function ik(tx, ty, endAngle = null) {
  // work in arm-local coords: origin at pivot
  const dx = tx - CX;
  const dy = CY - ty;   // y flipped for screen
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Wrist position: if endAngle provided, back off L3
  let wx = tx, wy = ty;
  if (endAngle !== null) {
    wx = tx - L3 * Math.cos(endAngle);
    wy = ty + L3 * Math.sin(endAngle);   // screen y
  }
  const wdx = wx - CX;
  const wdy = CY - wy;
  const r2 = wdx * wdx + wdy * wdy;
  const r  = Math.sqrt(r2);

  if (r > L1 + L2 || r < Math.abs(L1 - L2)) return null;  // unreachable

  // Two-link IK for shoulder+elbow reaching the wrist
  const cosQ2 = (r2 - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  const q2 = -Math.acos(Math.max(-1, Math.min(1, cosQ2)));  // elbow-down

  const alpha = Math.atan2(wdy, wdx);
  const beta  = Math.atan2(L2 * Math.sin(-q2), L1 + L2 * Math.cos(-q2));
  const q1    = alpha - beta;
  const a2    = q1 + q2;

  const q3 = endAngle !== null ? (endAngle - (q1 + q2)) : -q2 * 0.5;

  return [q1, q2, q3];
}

/* ══════════════════════════════════════════════════════════════
   Canvas drawing helpers
   ══════════════════════════════════════════════════════════════ */
function drawGrid(ctx) {
  ctx.fillStyle = '#010d1f';
  ctx.fillRect(0, 0, CW, CW);
  ctx.strokeStyle = 'rgba(251,146,60,0.07)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= CW; i += 23) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CW); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CW, i); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(251,146,60,0.22)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, CW - 1.5, CW - 1.5);
}

function drawWorkspaceArc(ctx) {
  const maxR = L1 + L2 + L3;
  const minR = Math.max(0, L1 - L2 - L3);
  ctx.save();
  ctx.strokeStyle = 'rgba(251,146,60,0.10)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  [minR, maxR].forEach(r => {
    if (r <= 0) return;
    ctx.beginPath();
    ctx.arc(CX, CY, r, -Math.PI, 0);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.restore();
}

function drawArm(ctx, q1, q2, q3, color = '#f97316', highlight = false) {
  const { elbow, wrist, ee } = fk(q1, q2, q3);
  const base = { x: CX, y: CY };
  const links = [
    [base, elbow, L1],
    [elbow, wrist, L2],
    [wrist, ee, L3],
  ];

  // Shadow / glow
  if (highlight) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
  }

  links.forEach(([a, b, len], i) => {
    const alpha = i === 0 ? 'ff' : i === 1 ? 'cc' : '99';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color + alpha;
    ctx.lineWidth = i === 0 ? 8 : i === 1 ? 6 : 4;
    ctx.lineCap = 'round';
    ctx.stroke();
  });

  if (highlight) ctx.restore();

  // Joints
  [base, elbow, wrist].forEach((pt, i) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, i === 0 ? 10 : 7, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Base mount
  ctx.beginPath();
  ctx.moveTo(CX - 18, CY + 1);
  ctx.lineTo(CX + 18, CY + 1);
  ctx.strokeStyle = color + '88';
  ctx.lineWidth = 3;
  ctx.stroke();

  // End-effector gripper
  const gripAngle = q1 + q2 + q3;
  const perp = { x: Math.sin(gripAngle) * 7, y: Math.cos(gripAngle) * 7 };
  ctx.beginPath();
  ctx.moveTo(ee.x + perp.x, ee.y + perp.y);
  ctx.lineTo(ee.x + Math.cos(gripAngle) * 10, ee.y - Math.sin(gripAngle) * 10);
  ctx.lineTo(ee.x - perp.x, ee.y - perp.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.stroke();

  return { base, elbow, wrist, ee };
}

function drawTarget(ctx, tx, ty, color = '#fbbf24') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2);
  ctx.fillStyle = color + 'cc'; ctx.fill();
  // crosshair
  [[0, -18, 0, -6], [0, 18, 0, 6], [-18, 0, -6, 0], [18, 0, 6, 0]].forEach(([dx1, dy1, dx2, dy2]) => {
    ctx.beginPath();
    ctx.moveTo(tx + dx1, ty + dy1);
    ctx.lineTo(tx + dx2, ty + dy2);
    ctx.stroke();
  });
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════════
   LAB 01 — Forward Kinematics
   ══════════════════════════════════════════════════════════════ */
function FKLab() {
  const canvasRef = useRef(null);
  const [q, setQ] = useState([60 * DEG, -40 * DEG, -30 * DEG]);

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawGrid(ctx);
    drawWorkspaceArc(ctx);
    const { ee } = drawArm(ctx, q[0], q[1], q[2], '#f97316', true);

    // HUD
    const { elbow, wrist } = fk(q[0], q[1], q[2]);
    ctx.fillStyle = 'rgba(1,13,31,0.9)';
    ctx.beginPath();
    ctx.roundRect?.(8, 8, 182, 72, 5) ?? ctx.rect(8, 8, 182, 72);
    ctx.fill();
    ctx.strokeStyle = 'rgba(251,146,60,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect?.(8, 8, 182, 72, 5) ?? ctx.rect(8, 8, 182, 72);
    ctx.stroke();
    ctx.font = '10px monospace';
    const rows = [
      ['ee.x', ee.x.toFixed(1)],
      ['ee.y', ee.y.toFixed(1)],
      ['q1',   (q[0] * RAD).toFixed(1) + '°'],
      ['q2',   (q[1] * RAD).toFixed(1) + '°'],
      ['q3',   (q[2] * RAD).toFixed(1) + '°'],
    ];
    rows.forEach(([label, val], i) => {
      ctx.fillStyle = '#475569'; ctx.fillText(label + ':', 16, 26 + i * 14);
      ctx.fillStyle = '#f97316'; ctx.fillText(val, 70, 26 + i * 14);
    });
  }, [q]);

  useEffect(() => { redraw(); }, [redraw]);

  const labels = ['q1 (base)', 'q2 (shoulder)', 'q3 (elbow)'];
  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      <div>
        <span className="text-xs font-bold tracking-widest text-orange-400">LAB 01</span>
        <h2 className="text-xl font-semibold text-whiteHull mt-0.5">Forward Kinematics</h2>
        <p className="mt-1 text-sm text-slate-400">
          Drag the joint sliders to control each angle. The arm updates in real time,
          showing how joint space maps to Cartesian end-effector position.
        </p>
      </div>
      <div className="flex flex-col xl:flex-row gap-5">
        <div className="flex-shrink-0">
          <div className="rounded-xl overflow-hidden" style={{ width: CW, height: CW, border: '1px solid rgba(251,146,60,0.25)' }}>
            <canvas ref={canvasRef} width={CW} height={CW} className="block" />
          </div>
        </div>
        <div className="flex flex-col gap-3 flex-1 min-w-[220px]">
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-4">Joint Angles</h3>
            {q.map((angle, i) => (
              <div key={i} className="mb-4 last:mb-0">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>{labels[i]}</span>
                  <span className="font-mono text-orange-300">{(angle * RAD).toFixed(1)}°</span>
                </div>
                <input type="range"
                  min={i === 0 ? 0 : -150} max={i === 0 ? 180 : 150}
                  step={1} value={angle * RAD}
                  onChange={e => {
                    const nq = [...q];
                    nq[i] = +e.target.value * DEG;
                    setQ(nq);
                  }}
                  className="w-full h-1.5 accent-orange-400" />
              </div>
            ))}
          </div>
          <div className="simulator-panel rounded-xl p-4 font-mono text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-2 font-sans">
              Joint State
            </h3>
            {(() => {
              const { elbow, wrist, ee } = fk(q[0], q[1], q[2]);
              return (
                <div className="space-y-0.5 text-slate-400">
                  <div><span className="text-slate-500">base:   </span><span className="text-orange-300">{(q[0]*RAD).toFixed(2)}°</span></div>
                  <div><span className="text-slate-500">shoulder:</span><span className="text-orange-300">{(q[1]*RAD).toFixed(2)}°</span></div>
                  <div><span className="text-slate-500">elbow:  </span><span className="text-orange-300">{(q[2]*RAD).toFixed(2)}°</span></div>
                  <div className="pt-1 border-t border-slate-800 mt-1">
                    <span className="text-slate-500">ee_x: </span><span className="text-slate-300">{ee.x.toFixed(1)} px</span>
                  </div>
                  <div><span className="text-slate-500">ee_y: </span><span className="text-slate-300">{ee.y.toFixed(1)} px</span></div>
                </div>
              );
            })()}
          </div>
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-2">Link Lengths</h3>
            <div className="text-xs font-mono text-slate-400 space-y-0.5">
              <div><span className="text-slate-500">L1 (upper): </span><span className="text-slate-300">{L1} px</span></div>
              <div><span className="text-slate-500">L2 (fore):  </span><span className="text-slate-300">{L2} px</span></div>
              <div><span className="text-slate-500">L3 (wrist): </span><span className="text-slate-300">{L3} px</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LAB 02 — Inverse Kinematics
   ══════════════════════════════════════════════════════════════ */
function IKLab() {
  const canvasRef  = useRef(null);
  const qRef       = useRef([60 * DEG, -40 * DEG, -30 * DEG]);
  const targetRef  = useRef(null);
  const rafRef     = useRef(null);
  const lastTRef   = useRef(null);
  const [ikStatus, setIkStatus] = useState('Click the canvas to set a target');
  const [liveQ, setLiveQ] = useState([...qRef.current]);

  const animateTo = useCallback((tq) => {
    const step = (now) => {
      if (!lastTRef.current) lastTRef.current = now;
      const dt = Math.min((now - lastTRef.current) / 1000, 0.05);
      lastTRef.current = now;
      let done = true;
      qRef.current = qRef.current.map((angle, i) => {
        const diff = tq[i] - angle;
        const speed = 4.0;
        if (Math.abs(diff) < 0.01) return tq[i];
        done = false;
        return angle + Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
      });
      setLiveQ([...qRef.current]);

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        drawGrid(ctx);
        drawWorkspaceArc(ctx);
        if (targetRef.current) drawTarget(ctx, targetRef.current.x, targetRef.current.y);
        drawArm(ctx, qRef.current[0], qRef.current[1], qRef.current[2], '#f97316', true);
      }
      if (!done) rafRef.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(rafRef.current);
    lastTRef.current = null;
    rafRef.current = requestAnimationFrame(step);
  }, []);

  // Initial draw
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawGrid(ctx);
    drawWorkspaceArc(ctx);
    drawArm(ctx, qRef.current[0], qRef.current[1], qRef.current[2], '#f97316', true);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const scaleY = CW / rect.height;
    const tx = (e.clientX - rect.left) * scaleX;
    const ty = (e.clientY - rect.top)  * scaleY;
    targetRef.current = { x: tx, y: ty };

    const sol = ik(tx, ty);
    if (!sol) {
      setIkStatus('Target out of workspace — no solution');
      // redraw without animating
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        drawGrid(ctx); drawWorkspaceArc(ctx);
        drawTarget(ctx, tx, ty, '#ef4444');
        drawArm(ctx, qRef.current[0], qRef.current[1], qRef.current[2], '#f97316', true);
      }
      return;
    }
    setIkStatus(`Solving → q1:${(sol[0]*RAD).toFixed(1)}° q2:${(sol[1]*RAD).toFixed(1)}° q3:${(sol[2]*RAD).toFixed(1)}°`);
    animateTo(sol);
  }, [animateTo]);

  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      <div>
        <span className="text-xs font-bold tracking-widest text-orange-400">LAB 02</span>
        <h2 className="text-xl font-semibold text-whiteHull mt-0.5">Inverse Kinematics</h2>
        <p className="mt-1 text-sm text-slate-400">
          Click anywhere in the workspace. The arm solves 3-DOF geometric IK analytically
          and smoothly interpolates to the solution — the same principle used in MoveIt.
        </p>
      </div>
      <div className="flex flex-col xl:flex-row gap-5">
        <div className="flex-shrink-0">
          <div className="rounded-xl overflow-hidden cursor-crosshair"
            style={{ width: CW, height: CW, border: '1px solid rgba(251,146,60,0.25)' }}>
            <canvas ref={canvasRef} width={CW} height={CW} className="block" onClick={handleClick} />
          </div>
          <p className="text-xs text-slate-500 font-mono mt-2">
            <span className="text-orange-400">click</span> canvas to set target
          </p>
        </div>
        <div className="flex flex-col gap-3 flex-1 min-w-[220px]">
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-2">IK Status</h3>
            <p className={`text-xs font-mono ${ikStatus.includes('no solution') ? 'text-red-400' : 'text-orange-300'}`}>
              {ikStatus}
            </p>
          </div>
          <div className="simulator-panel rounded-xl p-4 font-mono text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-2 font-sans">
              Solved Joint State
            </h3>
            <div className="space-y-0.5 text-slate-400">
              <div><span className="text-slate-500">q1: </span><span className="text-orange-300">{(liveQ[0]*RAD).toFixed(2)}°</span></div>
              <div><span className="text-slate-500">q2: </span><span className="text-orange-300">{(liveQ[1]*RAD).toFixed(2)}°</span></div>
              <div><span className="text-slate-500">q3: </span><span className="text-orange-300">{(liveQ[2]*RAD).toFixed(2)}°</span></div>
            </div>
          </div>
          <div className="simulator-panel rounded-xl p-4 text-xs text-slate-400">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-2">IK Algorithm</h3>
            <ol className="list-decimal list-inside space-y-1 text-slate-400">
              <li>Back-project wrist from target by L3</li>
              <li>Compute elbow angle via law of cosines</li>
              <li>Solve base+shoulder for wrist position</li>
              <li>Set wrist angle to maintain orientation</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LAB 03 — Pick & Place
   ══════════════════════════════════════════════════════════════ */

const PICK_POS  = { x: CX - 130, y: CY - 30 };
const PLACE_POS = { x: CX + 120, y: CY - 30 };
const HOME_Q    = [80 * DEG, -30 * DEG, -20 * DEG];

// Waypoints for a pick-and-place cycle (target pos, grip state, label)
function buildPickPlaceWaypoints() {
  const approachPick  = { x: PICK_POS.x,  y: PICK_POS.y - 55 };
  const atPick        = { x: PICK_POS.x,  y: PICK_POS.y };
  const liftPick      = { x: PICK_POS.x,  y: PICK_POS.y - 60 };
  const approachPlace = { x: PLACE_POS.x, y: PLACE_POS.y - 55 };
  const atPlace       = { x: PLACE_POS.x, y: PLACE_POS.y };
  const liftPlace     = { x: PLACE_POS.x, y: PLACE_POS.y - 60 };

  return [
    { pos: approachPick,  grip: false, label: 'Approach pick' },
    { pos: atPick,        grip: false, label: 'Descend to pick' },
    { pos: atPick,        grip: true,  label: 'Close gripper' },
    { pos: liftPick,      grip: true,  label: 'Lift object' },
    { pos: approachPlace, grip: true,  label: 'Move to place' },
    { pos: atPlace,       grip: true,  label: 'Descend to place' },
    { pos: atPlace,       grip: false, label: 'Open gripper' },
    { pos: liftPlace,     grip: false, label: 'Retract' },
  ];
}

const WAYPOINTS = buildPickPlaceWaypoints();

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpQ(qa, qb, t) { return qa.map((v, i) => lerp(v, qb[i], t)); }

function drawObject(ctx, x, y, gripped, color = '#fbbf24') {
  ctx.save();
  ctx.fillStyle = gripped ? color : color + '88';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const size = 14;
  ctx.beginPath();
  ctx.roundRect?.(x - size / 2, y - size / 2, size, size, 3) ?? ctx.rect(x - size / 2, y - size / 2, size, size);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPlatform(ctx, x, y, label, color = 'rgba(251,146,60,0.3)') {
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(251,146,60,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect?.(x - 28, y, 56, 10, 3) ?? ctx.rect(x - 28, y, 56, 10);
  ctx.fill(); ctx.stroke();
  ctx.font = '9px monospace';
  ctx.fillStyle = 'rgba(251,146,60,0.7)';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 24);
  ctx.textAlign = 'start';
}

function PickPlaceLab() {
  const canvasRef  = useRef(null);
  const stateRef   = useRef({
    q: [...HOME_Q],
    wpIdx: -1,
    progress: 0,    // 0→1 interpolation to next waypoint
    grip: false,
    objPos: { ...PICK_POS },
    placed: false,
    running: false,
    fromQ: [...HOME_Q],
    toQ: null,
  });
  const rafRef  = useRef(null);
  const lastRef = useRef(null);
  const [running, setRunning]   = useState(false);
  const [wpIdx,   setWpIdx]     = useState(-1);
  const [grip,    setGrip]      = useState(false);
  const [placed,  setPlaced]    = useState(false);

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const s = stateRef.current;
    drawGrid(ctx);
    drawWorkspaceArc(ctx);
    drawPlatform(ctx, PICK_POS.x,  PICK_POS.y + 4, 'PICK');
    drawPlatform(ctx, PLACE_POS.x, PLACE_POS.y + 4, 'PLACE');
    if (!s.grip) drawObject(ctx, s.objPos.x, s.objPos.y, false);
    drawArm(ctx, s.q[0], s.q[1], s.q[2], '#f97316', true);
    if (s.grip) {
      const { ee } = fk(s.q[0], s.q[1], s.q[2]);
      drawObject(ctx, ee.x, ee.y + 8, true);
    }

    // Status HUD
    const label = s.wpIdx >= 0 && s.wpIdx < WAYPOINTS.length
      ? WAYPOINTS[s.wpIdx].label : (s.placed ? 'Done ✓' : 'Ready');
    ctx.fillStyle = 'rgba(1,13,31,0.9)';
    ctx.beginPath();
    ctx.roundRect?.(8, 8, 155, 30, 5) ?? ctx.rect(8, 8, 155, 30);
    ctx.fill();
    ctx.font = '10px monospace';
    ctx.fillStyle = s.running ? '#f97316' : '#4ade80';
    ctx.fillText(label, 16, 27);
  }, []);

  const loop = useCallback((now) => {
    if (!lastRef.current) lastRef.current = now;
    const dt = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;
    const s = stateRef.current;

    if (s.running && s.toQ) {
      s.progress = Math.min(1, s.progress + dt * 1.8);
      s.q = lerpQ(s.fromQ, s.toQ, s.progress);
      if (s.progress >= 1) {
        s.q = [...s.toQ];
        const wp = WAYPOINTS[s.wpIdx];
        s.grip = wp.grip;
        setGrip(wp.grip);

        const next = s.wpIdx + 1;
        if (next >= WAYPOINTS.length) {
          s.running = false;
          s.placed = true;
          s.objPos = { ...PLACE_POS };
          setRunning(false);
          setPlaced(true);
          setWpIdx(WAYPOINTS.length);
        } else {
          const target = WAYPOINTS[next].pos;
          const sol = ik(target.x, target.y);
          if (sol) {
            s.fromQ = [...s.q];
            s.toQ = sol;
            s.progress = 0;
            s.wpIdx = next;
            setWpIdx(next);
          } else {
            s.running = false;
            setRunning(false);
          }
        }
      }
    }

    redraw();
    rafRef.current = requestAnimationFrame(loop);
  }, [redraw]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  const startCycle = () => {
    const s = stateRef.current;
    s.running = true;
    s.placed  = false;
    s.grip    = false;
    s.objPos  = { ...PICK_POS };
    s.q       = [...HOME_Q];
    s.wpIdx   = 0;
    s.progress = 0;
    lastRef.current = null;

    const target = WAYPOINTS[0].pos;
    const sol = ik(target.x, target.y);
    if (sol) {
      s.fromQ = [...HOME_Q];
      s.toQ   = sol;
    }
    setRunning(true);
    setWpIdx(0);
    setGrip(false);
    setPlaced(false);
  };

  const reset = () => {
    cancelAnimationFrame(rafRef.current);
    const s = stateRef.current;
    s.running = false; s.placed = false; s.grip = false;
    s.q = [...HOME_Q]; s.objPos = { ...PICK_POS };
    s.wpIdx = -1; s.toQ = null; s.progress = 0;
    setRunning(false); setPlaced(false); setGrip(false); setWpIdx(-1);
    rafRef.current = requestAnimationFrame(loop);
  };

  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      <div>
        <span className="text-xs font-bold tracking-widest text-orange-400">LAB 03</span>
        <h2 className="text-xl font-semibold text-whiteHull mt-0.5">Pick &amp; Place</h2>
        <p className="mt-1 text-sm text-slate-400">
          Watch the arm execute a full pick-and-place cycle — approach, grasp, lift,
          transfer, and release. Each step uses IK to solve the joint trajectory.
        </p>
      </div>
      <div className="flex flex-col xl:flex-row gap-5">
        <div className="flex-shrink-0">
          <div className="rounded-xl overflow-hidden"
            style={{ width: CW, height: CW, border: '1px solid rgba(251,146,60,0.25)' }}>
            <canvas ref={canvasRef} width={CW} height={CW} className="block" />
          </div>
        </div>
        <div className="flex flex-col gap-3 flex-1 min-w-[220px]">
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-3">Execute</h3>
            <div className="flex flex-col gap-2">
              <button onClick={startCycle} disabled={running}
                className="rounded-lg bg-orange-500 py-2 text-sm font-semibold text-slate-950
                           hover:bg-orange-400 disabled:opacity-40 transition">
                ▶ Run Pick &amp; Place
              </button>
              <button onClick={reset}
                className="rounded-lg bg-slate-800 py-2 text-sm text-slate-400
                           hover:bg-slate-700 transition">
                Reset
              </button>
            </div>
            <div className="mt-3 flex gap-3 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-mono ${grip ? 'bg-orange-500/20 text-orange-300' : 'bg-slate-800 text-slate-500'}`}>
                gripper: {grip ? 'closed' : 'open'}
              </span>
              {placed && <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-mono">placed ✓</span>}
            </div>
          </div>
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-2">
              Waypoints {wpIdx >= 0 ? `(${Math.min(wpIdx + 1, WAYPOINTS.length)}/${WAYPOINTS.length})` : ''}
            </h3>
            <div className="flex flex-col gap-1">
              {WAYPOINTS.map((wp, i) => {
                const done   = i < wpIdx;
                const active = i === wpIdx && running;
                return (
                  <div key={i}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                      active ? 'bg-orange-500/15 ring-1 ring-orange-500/40'
                      : done  ? 'opacity-50' : 'bg-slate-800/40'
                    }`}>
                    <span className={`font-bold w-5 text-center ${done ? 'text-green-400' : active ? 'text-orange-400' : 'text-slate-500'}`}>
                      {done ? '✓' : i + 1}
                    </span>
                    <span className="text-slate-300">{wp.label}</span>
                    {wp.grip !== (i > 0 ? WAYPOINTS[i-1].grip : false) && (
                      <span className={`ml-auto text-[10px] ${wp.grip ? 'text-orange-400' : 'text-slate-400'}`}>
                        {wp.grip ? 'grip ↓' : 'release'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Header + lab cards
   ══════════════════════════════════════════════════════════════ */
const MANIP_LABS = [
  { num: '01', title: 'Forward Kinematics', desc: 'Drag joint sliders to see how q1/q2/q3 map to end-effector position in Cartesian space.', icon: '🦾' },
  { num: '02', title: 'Inverse Kinematics', desc: 'Click the workspace. The arm solves geometric 3-DOF IK analytically and animates to the solution.', icon: '🎯' },
  { num: '03', title: 'Pick & Place',        desc: 'Watch the arm plan and execute a full pick-and-place cycle with gripper control and trajectory interpolation.', icon: '📦' },
];

const cardVariants = {
  hidden:   { opacity: 0, y: 20 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.45, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] } }),
};

export default function ManipulationTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="simulator-panel relative overflow-hidden rounded-3xl p-7">
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">
              Manipulation Domain
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-whiteHull">
              Robotic Arm Labs
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Three labs exploring how robotic manipulators move — from direct joint
              control to autonomous pick-and-place using geometric inverse kinematics.
            </p>
          </div>
          {/* Mini arm preview cards */}
          <div className="flex flex-col gap-3">
            {MANIP_LABS.map((card, i) => (
              <motion.article key={card.num} custom={i} variants={cardVariants}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="glass-card rounded-2xl p-4">
                <div className="mb-1 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-base">{card.icon}</span>
                  <span className="text-xs font-bold tracking-widest text-orange-400">LAB {card.num}</span>
                </div>
                <h2 className="text-sm font-semibold text-orange-400">{card.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{card.desc}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </div>

      <FKLab />
      <IKLab />
      <PickPlaceLab />
    </div>
  );
}
