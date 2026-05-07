import { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

/* ── Constants ──────────────────────────────────────────────── */
const CW = 460;
const CX = CW / 2;
const CY = CW * 0.70;

const L1 = 110, L2 = 85, L3 = 55;
const GRIP_LEN  = 20;   // finger extension past ee (toward grip center)
const GRIP_PALM = 13;   // half-width of palm bar
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/* ── Kinematics ─────────────────────────────────────────────── */
function fk(q1, q2, q3) {
  const a1 = q1, a2 = q1 + q2, a3 = q1 + q2 + q3;
  const elbow = { x: CX + L1 * Math.cos(a1), y: CY - L1 * Math.sin(a1) };
  const wrist  = { x: elbow.x + L2 * Math.cos(a2), y: elbow.y - L2 * Math.sin(a2) };
  const ee     = { x: wrist.x  + L3 * Math.cos(a3), y: wrist.y  - L3 * Math.sin(a3) };
  return { elbow, wrist, ee };
}

function ik(tx, ty) {
  const wdx = tx - CX, wdy = CY - ty;
  const r2 = wdx * wdx + wdy * wdy, r = Math.sqrt(r2);
  if (r > L1 + L2 || r < Math.abs(L1 - L2)) return null;
  const cosQ2 = (r2 - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  const q2 = -Math.acos(Math.max(-1, Math.min(1, cosQ2)));
  const alpha = Math.atan2(wdy, wdx);
  const beta  = Math.atan2(L2 * Math.sin(-q2), L1 + L2 * Math.cos(-q2));
  const q1 = alpha - beta;
  const q3 = -q2 * 0.45;
  return [q1, q2, q3];
}

/* ── Gripper geometry ───────────────────────────────────────── */
function gripGeom(ee, a3, closed) {
  const fwdX = Math.cos(a3), fwdY = -Math.sin(a3);
  const perpX = Math.sin(a3), perpY =  Math.cos(a3);
  const spread = closed ? 5 : 14;

  const f1r = { x: ee.x + perpX * spread,  y: ee.y + perpY * spread  };
  const f2r = { x: ee.x - perpX * spread,  y: ee.y - perpY * spread  };
  const f1t = { x: f1r.x + fwdX * GRIP_LEN, y: f1r.y + fwdY * GRIP_LEN };
  const f2t = { x: f2r.x + fwdX * GRIP_LEN, y: f2r.y + fwdY * GRIP_LEN };
  // palm endpoints (wider than spread)
  const p1  = { x: ee.x + perpX * GRIP_PALM, y: ee.y + perpY * GRIP_PALM };
  const p2  = { x: ee.x - perpX * GRIP_PALM, y: ee.y - perpY * GRIP_PALM };
  // grip centre = midpoint of finger tips
  const gc  = { x: (f1t.x + f2t.x) / 2, y: (f1t.y + f2t.y) / 2 };
  return { f1r, f2r, f1t, f2t, p1, p2, gc };
}

function drawGripper(ctx, ee, a3, closed, color) {
  const { f1r, f2r, f1t, f2t, p1, p2 } = gripGeom(ee, a3, closed);
  const col = closed ? '#ffffff' : color;

  ctx.save();
  if (closed) { ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 14; }

  // palm bar
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke();

  // finger 1: palm-edge → root (narrowing inward) → tip
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y); ctx.lineTo(f1r.x, f1r.y); ctx.lineTo(f1t.x, f1t.y);
  ctx.strokeStyle = col; ctx.lineWidth = 4;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();

  // finger 2
  ctx.beginPath();
  ctx.moveTo(p2.x, p2.y); ctx.lineTo(f2r.x, f2r.y); ctx.lineTo(f2t.x, f2t.y);
  ctx.stroke();

  // fingertip dots
  [f1t, f2t].forEach(t => {
    ctx.beginPath(); ctx.arc(t.x, t.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
  });

  // inner-gap highlight when open so user can see the opening
  if (!closed) {
    ctx.beginPath(); ctx.moveTo(f1t.x, f1t.y); ctx.lineTo(f2t.x, f2t.y);
    ctx.strokeStyle = color + '44'; ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
  }

  ctx.restore();
}

/* ── Canvas background ──────────────────────────────────────── */
function drawGrid(ctx) {
  ctx.fillStyle = '#010d1f';
  ctx.fillRect(0, 0, CW, CW);
  ctx.strokeStyle = 'rgba(251,146,60,0.07)'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= CW; i += 23) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CW); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CW, i); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(251,146,60,0.22)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, CW - 1.5, CW - 1.5);
}

function drawWorkspace(ctx) {
  const maxR = L1 + L2 + L3 + GRIP_LEN;
  ctx.save();
  ctx.strokeStyle = 'rgba(251,146,60,0.08)'; ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.arc(CX, CY, maxR, -Math.PI, 0); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
}

/* ── Arm drawing ────────────────────────────────────────────── */
function drawArm(ctx, q1, q2, q3, color = '#f97316', glow = false, gripClosed = false) {
  const { elbow, wrist, ee } = fk(q1, q2, q3);
  const a3 = q1 + q2 + q3;
  const base = { x: CX, y: CY };

  if (glow) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 16; }

  // links
  [[base, elbow, 8], [elbow, wrist, 6], [wrist, ee, 4]].forEach(([a, b, w], i) => {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color + (i === 0 ? 'ff' : i === 1 ? 'cc' : '99');
    ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
  });

  if (glow) ctx.restore();

  // joints
  [{ pt: base, r: 10 }, { pt: elbow, r: 7 }, { pt: wrist, r: 7 }].forEach(({ pt, r }) => {
    ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a'; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  });

  // base mount
  ctx.beginPath(); ctx.moveTo(CX - 20, CY + 2); ctx.lineTo(CX + 20, CY + 2);
  ctx.strokeStyle = color + '88'; ctx.lineWidth = 4; ctx.stroke();

  // gripper
  drawGripper(ctx, ee, a3, gripClosed, color);

  const { gc } = gripGeom(ee, a3, gripClosed);
  return { base, elbow, wrist, ee, gripCenter: gc };
}

function drawTarget(ctx, tx, ty, color = '#fbbf24') {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2);
  ctx.fillStyle = color + 'cc'; ctx.fill();
  [[0,-18,0,-7],[0,18,0,7],[-18,0,-7,0],[18,0,7,0]].forEach(([dx1,dy1,dx2,dy2]) => {
    ctx.beginPath(); ctx.moveTo(tx+dx1, ty+dy1); ctx.lineTo(tx+dx2, ty+dy2); ctx.stroke();
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
    drawGrid(ctx); drawWorkspace(ctx);
    const { ee } = drawArm(ctx, q[0], q[1], q[2], '#f97316', true, false);
    // HUD
    ctx.fillStyle = 'rgba(1,13,31,0.9)';
    ctx.beginPath(); ctx.roundRect?.(8,8,185,58,5) ?? ctx.rect(8,8,185,58); ctx.fill();
    ctx.strokeStyle = 'rgba(251,146,60,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect?.(8,8,185,58,5) ?? ctx.rect(8,8,185,58); ctx.stroke();
    ctx.font = '10px monospace';
    [['q1',(q[0]*RAD).toFixed(1)+'°'],['q2',(q[1]*RAD).toFixed(1)+'°'],
     ['q3',(q[2]*RAD).toFixed(1)+'°'],['ee.x',ee.x.toFixed(1)],['ee.y',ee.y.toFixed(1)]
    ].forEach(([lbl, val], i) => {
      ctx.fillStyle = '#475569'; ctx.fillText(lbl + ':', 16, 22 + i * 11);
      ctx.fillStyle = '#f97316'; ctx.fillText(val, 70, 22 + i * 11);
    });
  }, [q]);

  useEffect(() => { redraw(); }, [redraw]);

  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      <div>
        <span className="text-xs font-bold tracking-widest text-orange-400">LAB 01</span>
        <h2 className="text-xl font-semibold text-whiteHull mt-0.5">Forward Kinematics</h2>
        <p className="mt-1 text-sm text-slate-400">Drag sliders to move each joint. Watch the gripper update in real time.</p>
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
            {['q1 (base)', 'q2 (shoulder)', 'q3 (elbow)'].map((label, i) => (
              <div key={i} className="mb-4 last:mb-0">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>{label}</span>
                  <span className="font-mono text-orange-300">{(q[i] * RAD).toFixed(1)}°</span>
                </div>
                <input type="range" min={i===0?0:-150} max={i===0?180:150} step={1} value={q[i]*RAD}
                  onChange={e => { const nq=[...q]; nq[i]=+e.target.value*DEG; setQ(nq); }}
                  className="w-full h-1.5 accent-orange-400" />
              </div>
            ))}
          </div>
          <div className="simulator-panel rounded-xl p-4 text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-2">Gripper</h3>
            <p className="text-slate-400">
              White bar = palm · Two angled fingers = jaws · Dashed gap = open jaw aperture.
              In Lab 03 you'll see the jaws close around the object.
            </p>
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
  const canvasRef = useRef(null);
  const qRef      = useRef([60*DEG, -40*DEG, -30*DEG]);
  const targetRef = useRef(null);
  const rafRef    = useRef(null);
  const lastTRef  = useRef(null);
  const [ikStatus, setIkStatus] = useState('Click the canvas to set a target');
  const [liveQ, setLiveQ]       = useState([...qRef.current]);

  const redrawCanvas = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawGrid(ctx); drawWorkspace(ctx);
    if (targetRef.current) drawTarget(ctx, targetRef.current.x, targetRef.current.y);
    drawArm(ctx, qRef.current[0], qRef.current[1], qRef.current[2], '#f97316', true, false);
  }, []);

  const animateTo = useCallback((tq) => {
    const step = (now) => {
      if (!lastTRef.current) lastTRef.current = now;
      const dt = Math.min((now - lastTRef.current) / 1000, 0.05);
      lastTRef.current = now;
      let done = true;
      qRef.current = qRef.current.map((a, i) => {
        const d = tq[i] - a;
        if (Math.abs(d) < 0.008) return tq[i];
        done = false;
        return a + Math.sign(d) * Math.min(Math.abs(d), 4.0 * dt);
      });
      setLiveQ([...qRef.current]);
      redrawCanvas();
      if (!done) rafRef.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(rafRef.current);
    lastTRef.current = null;
    rafRef.current = requestAnimationFrame(step);
  }, [redrawCanvas]);

  useEffect(() => { redrawCanvas(); return () => cancelAnimationFrame(rafRef.current); }, [redrawCanvas]);

  const handleClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const tx = (e.clientX - rect.left) * (CW / rect.width);
    const ty = (e.clientY - rect.top)  * (CW / rect.height);
    targetRef.current = { x: tx, y: ty };
    const sol = ik(tx, ty);
    if (!sol) {
      setIkStatus('Out of workspace — no solution');
      redrawCanvas();
      return;
    }
    setIkStatus(`q1:${(sol[0]*RAD).toFixed(1)}°  q2:${(sol[1]*RAD).toFixed(1)}°  q3:${(sol[2]*RAD).toFixed(1)}°`);
    animateTo(sol);
  }, [animateTo, redrawCanvas]);

  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      <div>
        <span className="text-xs font-bold tracking-widest text-orange-400">LAB 02</span>
        <h2 className="text-xl font-semibold text-whiteHull mt-0.5">Inverse Kinematics</h2>
        <p className="mt-1 text-sm text-slate-400">Click anywhere in the workspace — the arm solves 3-DOF IK and animates to the target.</p>
      </div>
      <div className="flex flex-col xl:flex-row gap-5">
        <div className="flex-shrink-0">
          <div className="rounded-xl overflow-hidden cursor-crosshair"
            style={{ width: CW, height: CW, border: '1px solid rgba(251,146,60,0.25)' }}>
            <canvas ref={canvasRef} width={CW} height={CW} className="block" onClick={handleClick} />
          </div>
          <p className="text-xs text-slate-500 font-mono mt-2"><span className="text-orange-400">click</span> canvas to set target</p>
        </div>
        <div className="flex flex-col gap-3 flex-1 min-w-[220px]">
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-2">IK Status</h3>
            <p className={`text-xs font-mono ${ikStatus.includes('no solution') ? 'text-red-400' : 'text-orange-300'}`}>{ikStatus}</p>
          </div>
          <div className="simulator-panel rounded-xl p-4 font-mono text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-2 font-sans">Solved Joints</h3>
            <div className="space-y-0.5 text-slate-400">
              {['q1','q2','q3'].map((n,i) => (
                <div key={n}><span className="text-slate-500">{n}: </span>
                  <span className="text-orange-300">{(liveQ[i]*RAD).toFixed(2)}°</span></div>
              ))}
            </div>
          </div>
          <div className="simulator-panel rounded-xl p-4 text-xs text-slate-400">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-2">Algorithm</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Two-link IK: law of cosines for elbow angle</li>
              <li>atan2 for base + shoulder angles</li>
              <li>Wrist angle set to maintain tool orientation</li>
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

// Object positions (where the grip centre should be when picking/placing)
const OBJ_Y     = CY + 72;    // object centre y  (below base)
const PICK_X    = CX - 128;
const PLACE_X   = CX + 118;
const PLAT_H    = 10;          // platform rect height
const OBJ_HALF  = 9;           // half-size of drawn cube

// IK targets: ee must be GRIP_LEN above the object (since grip centre = ee + fwd*GRIP_LEN,
// and for a roughly-downward approach fwd ≈ (0,+1), grip centre ≈ (ee.x, ee.y + GRIP_LEN))
const PICK_IK  = { x: PICK_X,  y: OBJ_Y - GRIP_LEN };
const PLACE_IK = { x: PLACE_X, y: OBJ_Y - GRIP_LEN };

const WPS = [
  { pos: { x: PICK_IK.x,  y: PICK_IK.y  - 55 }, grip: false, label: 'Approach pick'    },
  { pos: PICK_IK,                                  grip: false, label: 'Descend to pick'  },
  { pos: null,              gripOnly: true,         grip: true,  label: 'Close gripper'    },
  { pos: { x: PICK_IK.x,  y: PICK_IK.y  - 65 }, grip: true,  label: 'Lift object'      },
  { pos: { x: PLACE_IK.x, y: PLACE_IK.y - 55 }, grip: true,  label: 'Move to place'    },
  { pos: PLACE_IK,                                 grip: true,  label: 'Descend to place' },
  { pos: null,              gripOnly: true,         grip: false, label: 'Open gripper'     },
  { pos: { x: PLACE_IK.x, y: PLACE_IK.y - 65 }, grip: false, label: 'Retract'           },
];

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpQ(qa, qb, t) { return qa.map((v, i) => lerp(v, qb[i], t)); }

function drawPlatform(ctx, x) {
  const y = OBJ_Y + OBJ_HALF;
  // surface
  ctx.fillStyle = 'rgba(251,146,60,0.18)';
  ctx.strokeStyle = 'rgba(251,146,60,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect?.(x - 32, y, 64, PLAT_H, 3) ?? ctx.rect(x - 32, y, 64, PLAT_H);
  ctx.fill(); ctx.stroke();
  // legs
  [[x - 22, x - 16], [x + 16, x + 22]].forEach(([lx, rx]) => {
    ctx.fillStyle = 'rgba(251,146,60,0.12)';
    ctx.beginPath(); ctx.rect(lx, y + PLAT_H, rx - lx, 14); ctx.fill();
  });
}

function drawObject(ctx, x, y, gripped) {
  const s = OBJ_HALF;
  ctx.save();
  // glow when gripped
  if (gripped) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 14; }
  ctx.fillStyle   = gripped ? '#fbbf24' : '#b45309';
  ctx.strokeStyle = gripped ? '#fef08a' : '#f59e0b';
  ctx.lineWidth   = gripped ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.roundRect?.(x - s, y - s, s * 2, s * 2, 2) ?? ctx.rect(x - s, y - s, s * 2, s * 2);
  ctx.fill(); ctx.stroke();
  // cross detail
  ctx.strokeStyle = gripped ? 'rgba(254,240,138,0.4)' : 'rgba(251,191,36,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - s + 2, y); ctx.lineTo(x + s - 2, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - s + 2); ctx.lineTo(x, y + s - 2); ctx.stroke();
  ctx.restore();
}

function PickPlaceLab() {
  const canvasRef = useRef(null);
  const S = useRef({
    q: [100*DEG, -50*DEG, -25*DEG],
    wpIdx: -1, progress: 0,
    grip: false, objPos: { x: PICK_X, y: OBJ_Y },
    placed: false, running: false,
    fromQ: [100*DEG, -50*DEG, -25*DEG], toQ: null,
  });
  const rafRef  = useRef(null);
  const lastRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [wpIdx,   setWpIdx]   = useState(-1);
  const [grip,    setGrip]    = useState(false);
  const [placed,  setPlaced]  = useState(false);

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const s = S.current;
    drawGrid(ctx); drawWorkspace(ctx);
    drawPlatform(ctx, PICK_X);
    drawPlatform(ctx, PLACE_X);
    // platform labels
    ctx.font = '9px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(251,146,60,0.6)';
    ctx.fillText('PICK',  PICK_X,  OBJ_Y + OBJ_HALF + PLAT_H + 22);
    ctx.fillText('PLACE', PLACE_X, OBJ_Y + OBJ_HALF + PLAT_H + 22);
    ctx.textAlign = 'start';

    // draw free object only when not gripped
    if (!s.grip) drawObject(ctx, s.objPos.x, s.objPos.y, false);

    // draw arm (gets grip centre back)
    const { gripCenter } = drawArm(ctx, s.q[0], s.q[1], s.q[2], '#f97316', true, s.grip);

    // draw object at grip centre when held
    if (s.grip) drawObject(ctx, gripCenter.x, gripCenter.y, true);

    // HUD
    const label = s.wpIdx >= 0 && s.wpIdx < WPS.length
      ? WPS[s.wpIdx].label : (s.placed ? 'Done ✓' : 'Ready');
    ctx.fillStyle = 'rgba(1,13,31,0.9)';
    ctx.beginPath(); ctx.roundRect?.(8,8,162,30,5) ?? ctx.rect(8,8,162,30); ctx.fill();
    ctx.font = '10px monospace';
    ctx.fillStyle = s.running ? '#f97316' : (s.placed ? '#4ade80' : '#94a3b8');
    ctx.fillText(label, 14, 27);
  }, []);

  const advanceTo = useCallback((nextIdx) => {
    const s = S.current;
    const wp = WPS[nextIdx];
    if (!wp) return;
    if (wp.gripOnly) {
      // instant grip change — then advance past it
      const prev = s.grip;
      s.grip = wp.grip;
      setGrip(wp.grip);
      s.wpIdx = nextIdx;
      setWpIdx(nextIdx);

      // if releasing, drop object at current grip centre
      if (prev && !wp.grip) {
        const { ee } = fk(s.q[0], s.q[1], s.q[2]);
        const a3 = s.q[0] + s.q[1] + s.q[2];
        const { gc } = gripGeom(ee, a3, false);
        s.objPos = { x: gc.x, y: gc.y };
      }

      advanceTo(nextIdx + 1);
      return;
    }
    const sol = ik(wp.pos.x, wp.pos.y);
    if (!sol) { s.running = false; setRunning(false); return; }
    s.fromQ = [...s.q]; s.toQ = sol; s.progress = 0;
    s.wpIdx = nextIdx; setWpIdx(nextIdx);
  }, []);

  const loop = useCallback((now) => {
    if (!lastRef.current) lastRef.current = now;
    const dt = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;
    const s = S.current;

    if (s.running && s.toQ) {
      s.progress = Math.min(1, s.progress + dt * 1.9);
      s.q = lerpQ(s.fromQ, s.toQ, s.progress);
      if (s.progress >= 1) {
        s.q = [...s.toQ];
        const next = s.wpIdx + 1;
        if (next >= WPS.length) {
          s.running = false; s.placed = true;
          setRunning(false); setPlaced(true); setWpIdx(WPS.length);
        } else {
          advanceTo(next);
        }
      }
    }
    redraw();
    rafRef.current = requestAnimationFrame(loop);
  }, [redraw, advanceTo]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  const startCycle = () => {
    const s = S.current;
    s.running = true; s.placed = false; s.grip = false;
    s.objPos = { x: PICK_X, y: OBJ_Y };
    s.q = [100*DEG, -50*DEG, -25*DEG];
    s.wpIdx = -1; s.toQ = null; s.progress = 0;
    lastRef.current = null;
    setRunning(true); setWpIdx(-1); setGrip(false); setPlaced(false);
    advanceTo(0);
  };

  const reset = () => {
    const s = S.current;
    s.running = false; s.placed = false; s.grip = false;
    s.q = [100*DEG, -50*DEG, -25*DEG]; s.objPos = { x: PICK_X, y: OBJ_Y };
    s.wpIdx = -1; s.toQ = null; s.progress = 0;
    setRunning(false); setPlaced(false); setGrip(false); setWpIdx(-1);
  };

  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      <div>
        <span className="text-xs font-bold tracking-widest text-orange-400">LAB 03</span>
        <h2 className="text-xl font-semibold text-whiteHull mt-0.5">Pick &amp; Place</h2>
        <p className="mt-1 text-sm text-slate-400">
          Watch the arm approach, close its jaws around the object, lift it, transfer, and release.
          Each step uses IK to plan the joint trajectory.
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
                className="rounded-lg bg-slate-800 py-2 text-sm text-slate-400 hover:bg-slate-700 transition">
                Reset
              </button>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap text-xs">
              <span className={`px-2 py-0.5 rounded-full font-mono transition-colors ${
                grip ? 'bg-white/20 text-white font-bold' : 'bg-slate-800 text-slate-500'}`}>
                {grip ? '⊏⊐ closed' : '⊏ · · ⊐ open'}
              </span>
              {placed && <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-mono">placed ✓</span>}
            </div>
          </div>
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-2">
              Steps {wpIdx >= 0 ? `(${Math.min(wpIdx+1,WPS.length)}/${WPS.length})` : ''}
            </h3>
            <div className="flex flex-col gap-1">
              {WPS.map((wp, i) => {
                const done   = i < wpIdx;
                const active = i === wpIdx && running;
                return (
                  <div key={i} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                    active ? 'bg-orange-500/15 ring-1 ring-orange-500/40'
                    : done  ? 'opacity-40' : 'bg-slate-800/40'}`}>
                    <span className={`font-bold w-5 text-center ${
                      done ? 'text-green-400' : active ? 'text-orange-400' : 'text-slate-500'}`}>
                      {done ? '✓' : i+1}
                    </span>
                    <span className="text-slate-300">{wp.label}</span>
                    {wp.gripOnly && (
                      <span className={`ml-auto text-[10px] ${wp.grip ? 'text-white' : 'text-slate-400'}`}>
                        {wp.grip ? '⊏⊐' : '⊏⊐ open'}
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
   Header + export
   ══════════════════════════════════════════════════════════════ */
const MANIP_LABS = [
  { num:'01', title:'Forward Kinematics', desc:'Drag joint sliders to see how angles map to end-effector position.', icon:'🦾' },
  { num:'02', title:'Inverse Kinematics', desc:'Click the workspace — 3-DOF IK solves analytically and the arm animates to target.', icon:'🎯' },
  { num:'03', title:'Pick & Place',       desc:'Full cycle: approach, jaw close, lift, transfer, jaw open. Gripper state is always visible.', icon:'📦' },
];
const cardV = {
  hidden:   { opacity: 0, y: 20 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.45, delay: i*0.12, ease:[0.22,1,0.36,1] } }),
};

export default function ManipulationTab() {
  return (
    <div className="space-y-6">
      <div className="simulator-panel relative overflow-hidden rounded-3xl p-7">
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">Manipulation Domain</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-whiteHull">Robotic Arm Labs</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Three labs covering direct joint control, geometric IK, and an
              autonomous pick-and-place cycle with a parallel-jaw gripper.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {MANIP_LABS.map((c, i) => (
              <motion.article key={c.num} custom={i} variants={cardV}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="glass-card rounded-2xl p-4">
                <div className="mb-1 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-base">{c.icon}</span>
                  <span className="text-xs font-bold tracking-widest text-orange-400">LAB {c.num}</span>
                </div>
                <h2 className="text-sm font-semibold text-orange-400">{c.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{c.desc}</p>
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
