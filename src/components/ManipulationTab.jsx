import { lazy, Suspense, useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

// Physics labs run on MuJoCo (WebAssembly); load them only when this tab opens.
const MujocoArmLabs = lazy(() => import('./MujocoArm/MujocoArmLabs.jsx'));

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

// The tool point is the grip centre: L3 + GRIP_LEN past the wrist joint.
const LT = L3 + GRIP_LEN;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * 3-link inverse kinematics: put the grip centre on (tx, ty) with the gripper
 * pointing at angle phi (math frame, radians; −90° = straight down).
 * Returns both elbow solutions as [q1, q2, q3] arrays (empty if unreachable).
 */
function ikSolutions(tx, ty, phi) {
  const x = tx - CX, y = CY - ty;                 // canvas → math frame (y up)
  const wx = x - LT * Math.cos(phi);               // wrist position: back off from
  const wy = y - LT * Math.sin(phi);              // the target along the tool axis
  const r2 = wx * wx + wy * wy;
  const c2 = (r2 - L1 * L1 - L2 * L2) / (2 * L1 * L2);   // law of cosines
  if (c2 < -1 || c2 > 1) return [];
  return [-1, 1].map((sign) => {
    const q2 = sign * Math.acos(c2);
    const q1 = Math.atan2(wy, wx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
    const q3 = wrapAngle(phi - q1 - q2);          // whatever is left to reach phi
    return [wrapAngle(q1), q2, q3];
  });
}

/**
 * Solve for a click. If the requested tool angle is unreachable, search for the
 * nearest angle that is. Picks the elbow-up or elbow-down solution.
 */
function ik(tx, ty, phi, elbowUp = true) {
  for (let d = 0; d <= 180; d += 1) {
    for (const s of d === 0 ? [0] : [1, -1]) {
      const p = phi + s * d * DEG;
      const sols = ikSolutions(tx, ty, p);
      if (!sols.length) continue;
      const elbowY = (q) => Math.sin(q[0]);      // higher = elbow up
      const [a, b] = sols;
      const q = (elbowY(a) >= elbowY(b)) === elbowUp ? a : b;
      return { q, phi: p, adjusted: d !== 0 };
    }
  }
  return null;
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
              In Lab 04 the jaws squeeze a real (simulated) cube, held only by friction.
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
  const [phiDeg, setPhiDeg]   = useState(-90);
  const [elbowUp, setElbowUp] = useState(true);
  const [solution, setSolution] = useState(null);   // { q, phi, adjusted } | { none: true }
  const [check, setCheck]     = useState(null);     // FK check distance in px
  const [liveQ, setLiveQ]     = useState([...qRef.current]);

  const redrawCanvas = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawGrid(ctx); drawWorkspace(ctx);
    if (targetRef.current) drawTarget(ctx, targetRef.current.x, targetRef.current.y);
    return drawArm(ctx, qRef.current[0], qRef.current[1], qRef.current[2], '#f97316', true, false);
  }, []);

  const animateTo = useCallback((goal) => {
    // Turn each joint the short way round.
    const start = qRef.current;
    const tq = goal.map((g, i) => start[i] + wrapAngle(g - start[i]));
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
      const pts = redrawCanvas();
      if (!done) {
        rafRef.current = requestAnimationFrame(step);
      } else if (pts && targetRef.current) {
        // Forward-kinematics check: where did the grip centre actually land?
        setCheck(Math.hypot(pts.gripCenter.x - targetRef.current.x, pts.gripCenter.y - targetRef.current.y));
      }
    };
    cancelAnimationFrame(rafRef.current);
    lastTRef.current = null;
    setCheck(null);
    rafRef.current = requestAnimationFrame(step);
  }, [redrawCanvas]);

  useEffect(() => { redrawCanvas(); return () => cancelAnimationFrame(rafRef.current); }, [redrawCanvas]);

  const solve = useCallback((phi, up) => {
    const t = targetRef.current;
    if (!t) return;
    const sol = ik(t.x, t.y, phi * DEG, up);
    if (!sol) {
      setSolution({ none: true });
      setCheck(null);
      redrawCanvas();
      return;
    }
    setSolution(sol);
    animateTo(sol.q);
  }, [animateTo, redrawCanvas]);

  const handleClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    targetRef.current = {
      x: (e.clientX - rect.left) * (CW / rect.width),
      y: (e.clientY - rect.top)  * (CW / rect.height),
    };
    solve(phiDeg, elbowUp);
  }, [solve, phiDeg, elbowUp]);

  const statusText = !solution
    ? 'Click the canvas to set a target'
    : solution.none
      ? 'Out of reach at every tool angle — no solution'
      : solution.adjusted
        ? `Tool angle ${phiDeg}° can't reach; using ${(solution.phi * RAD).toFixed(0)}° instead`
        : `Solved with tool angle ${phiDeg}°`;

  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      <div>
        <span className="text-xs font-bold tracking-widest text-orange-400">LAB 02</span>
        <h2 className="text-xl font-semibold text-whiteHull mt-0.5">Inverse Kinematics</h2>
        <p className="mt-1 text-sm text-slate-400">
          Click anywhere in the workspace. The solver finds joint angles that put the gripper&apos;s grip
          centre on the target, pointing at the tool angle you choose.
        </p>
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
          <div className="simulator-panel rounded-xl p-4 space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400">Tool</h3>
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Tool angle φ</span>
                <span className="font-mono text-orange-300">{phiDeg}°{phiDeg === -90 && ' (pointing down)'}</span>
              </div>
              <input type="range" min={-180} max={180} step={5} value={phiDeg}
                onChange={(e) => { const v = +e.target.value; setPhiDeg(v); solve(v, elbowUp); }}
                className="w-full h-1.5 accent-orange-400" />
            </div>
            <div className="flex gap-2 text-xs">
              {[['Elbow up', true], ['Elbow down', false]].map(([label, up]) => (
                <button key={label} onClick={() => { setElbowUp(up); solve(phiDeg, up); }}
                  className={`rounded-lg px-3 py-1.5 transition ${elbowUp === up ? 'bg-orange-500 text-slate-900' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-2">IK Status</h3>
            <p className={`text-xs font-mono ${solution?.none ? 'text-red-400' : solution?.adjusted ? 'text-amber-300' : 'text-orange-300'}`}>{statusText}</p>
            {check !== null && (
              <p className="mt-1 text-xs font-mono text-slate-400">
                FK check: grip centre is <span className={check < 1 ? 'text-green-400' : 'text-red-400'}>{check.toFixed(2)} px</span> from the target
              </p>
            )}
          </div>
          <div className="simulator-panel rounded-xl p-4 font-mono text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-2 font-sans">Solved Joints</h3>
            <div className="space-y-0.5 text-slate-400">
              {['q1','q2','q3'].map((n,i) => (
                <div key={n}><span className="text-slate-500">{n}: </span>
                  <span className="text-orange-300">{(wrapAngle(liveQ[i])*RAD).toFixed(2)}°</span></div>
              ))}
            </div>
          </div>
          <div className="simulator-panel rounded-xl p-4 text-xs text-slate-400">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-2">Algorithm</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Back off from the target along the tool angle φ by the last link + fingers to get the wrist point</li>
              <li>Two-link IK to the wrist: law of cosines for q2 (two solutions: elbow up / down)</li>
              <li>atan2 for q1, then q3 = φ − q1 − q2 so the gripper points at φ</li>
              <li>If the wrist is out of reach, try the nearest tool angle that works</li>
            </ol>
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
  { num:'02', title:'Inverse Kinematics', desc:'Click the workspace: 3-link IK puts the grip centre on the target at your chosen tool angle.', icon:'🎯' },
  { num:'03', title:'Joint Control & Gravity', desc:'MuJoCo physics: torque motors, P / PD / gravity compensation, payloads and pushes.', icon:'⚙️' },
  { num:'04', title:'Physical Pick & Place',   desc:'MuJoCo physics: the cube is held only by friction. Tune grip, mass, μ and speed until it slips.', icon:'🧲' },
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
              Four labs: the geometry of the arm first (forward and inverse
              kinematics), then the same arm with real physics in MuJoCo, covering
              torque control, gravity and friction grasping.
            </p>
            <Link to="/simulators/manipulation/v1"
              className="mt-3 inline-block text-xs text-orange-300 transition hover:text-orange-200">
              See the original v1 labs (2D canvas) and how they evolved →
            </Link>
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
      <Suspense fallback={<div className="simulator-panel rounded-2xl p-6 text-sm text-slate-400">Loading MuJoCo physics labs…</div>}>
        <MujocoArmLabs />
      </Suspense>
    </div>
  );
}
