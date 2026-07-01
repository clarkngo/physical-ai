import { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

/* ── Shared constants ────────────────────────────────────────── */
const CW = 460;
const ACCENT = '#a78bfa';       // violet-400
const ACCENT2 = '#7c3aed';      // violet-700

/* ── Shared draw helpers ─────────────────────────────────────── */
function drawIsaacGrid(ctx) {
  ctx.fillStyle = '#07020f';
  ctx.fillRect(0, 0, CW, CW);
  ctx.strokeStyle = 'rgba(167,139,250,0.06)'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= CW; i += 24) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CW); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CW, i); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(167,139,250,0.20)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, CW - 1.5, CW - 1.5);
}

function hud(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(7,2,15,0.92)';
  ctx.beginPath(); ctx.roundRect?.(x, y, w, h, 5) ?? ctx.rect(x, y, w, h); ctx.fill();
  ctx.strokeStyle = 'rgba(167,139,250,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect?.(x, y, w, h, 5) ?? ctx.rect(x, y, w, h); ctx.stroke();
}

/* ══════════════════════════════════════════════════════════════
   LAB 01 — CartPole Balance
   Full Euler-integrated physics; PD controller stabilises the pole;
   user can click the canvas to apply an impulse.
   ══════════════════════════════════════════════════════════════ */
const CP = {
  g: 9.81, mc: 1.0, mp: 0.1, l: 0.5,
  cartW: 60, cartH: 22, wheelR: 8,
  trackY: CW * 0.70,
};
const CP_KP = 35, CP_KD = 8;       // PD gains
const CP_FORCE_CLIP = 22;

function cpStep(s, force, dt) {
  const { g, mc, mp, l } = CP;
  const sinT = Math.sin(s.theta), cosT = Math.cos(s.theta);
  const denom = mc + mp * sinT * sinT;
  const thetaAcc = (g * sinT - cosT * (force + mp * l * s.dtheta * s.dtheta * sinT) / denom)
    / (l * (4 / 3 - mp * cosT * cosT / denom));
  const xAcc = (force + mp * l * (s.dtheta * s.dtheta * sinT - thetaAcc * cosT)) / denom;
  return {
    x:      s.x      + s.dx     * dt,
    dx:     s.dx     + xAcc     * dt,
    theta:  s.theta  + s.dtheta * dt,
    dtheta: s.dtheta + thetaAcc * dt,
  };
}

function CartPoleLab() {
  const canvasRef = useRef(null);
  const S = useRef({ x: 0, dx: 0, theta: 0.05, dtheta: 0 });
  const rafRef = useRef(null);
  const lastRef = useRef(null);
  const [alive, setAlive] = useState(true);
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
  const aliveRef = useRef(true);

  const pxX = (x) => CW / 2 + x * 160;

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const s = S.current;
    drawIsaacGrid(ctx);

    // track
    ctx.strokeStyle = 'rgba(167,139,250,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(30, CP.trackY); ctx.lineTo(CW - 30, CP.trackY); ctx.stroke();

    const cx = pxX(s.x);
    const { cartW: cw, cartH: ch, wheelR: wr, trackY: ty } = CP;

    // cart body
    ctx.fillStyle = aliveRef.current ? '#1e1033' : '#1a0a0a';
    ctx.strokeStyle = aliveRef.current ? ACCENT : '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect?.(cx - cw / 2, ty - ch, cw, ch, 4) ?? ctx.rect(cx - cw / 2, ty - ch, cw, ch);
    ctx.fill(); ctx.stroke();

    // wheels
    [-cw * 0.32, cw * 0.32].forEach(ox => {
      ctx.beginPath(); ctx.arc(cx + ox, ty + wr * 0.4, wr, 0, Math.PI * 2);
      ctx.fillStyle = '#0f0020'; ctx.fill();
      ctx.strokeStyle = aliveRef.current ? ACCENT + 'aa' : '#ef4444aa'; ctx.lineWidth = 2; ctx.stroke();
    });

    // pole pivot
    const pivX = cx, pivY = ty - ch;
    // pole length in px
    const poleLen = CP.l * 320;
    const poleEndX = pivX + poleLen * Math.sin(s.theta);
    const poleEndY = pivY - poleLen * Math.cos(s.theta);

    // pole glow
    ctx.save();
    if (aliveRef.current) { ctx.shadowColor = ACCENT; ctx.shadowBlur = 10; }
    ctx.beginPath(); ctx.moveTo(pivX, pivY); ctx.lineTo(poleEndX, poleEndY);
    ctx.strokeStyle = aliveRef.current ? ACCENT : '#ef4444';
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();

    // pole ball
    ctx.beginPath(); ctx.arc(poleEndX, poleEndY, 7, 0, Math.PI * 2);
    ctx.fillStyle = aliveRef.current ? ACCENT2 : '#7f1d1d';
    ctx.strokeStyle = aliveRef.current ? ACCENT : '#ef4444';
    ctx.lineWidth = 2; ctx.fill(); ctx.stroke();

    // pivot dot
    ctx.beginPath(); ctx.arc(pivX, pivY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1033'; ctx.fill();
    ctx.strokeStyle = ACCENT + 'cc'; ctx.lineWidth = 1.5; ctx.stroke();

    // HUD
    hud(ctx, 8, 8, 200, 72);
    ctx.font = '10px monospace';
    [
      ['theta',  (s.theta * 180 / Math.PI).toFixed(2) + '°'],
      ['dtheta', s.dtheta.toFixed(3)                        ],
      ['x',      s.x.toFixed(3)                             ],
      ['step',   stepRef.current                            ],
      ['status', aliveRef.current ? 'balanced' : 'FAILED'  ],
    ].forEach(([l, v], i) => {
      ctx.fillStyle = '#475569'; ctx.fillText(l + ':', 16, 24 + i * 12);
      ctx.fillStyle = aliveRef.current ? ACCENT : '#f87171';
      ctx.fillText(v, 90, 24 + i * 12);
    });

    // hint
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(167,139,250,0.45)';
    ctx.fillText('click to disturb', 8, CW - 8);
  }, []);

  const loop = useCallback((now) => {
    if (!lastRef.current) lastRef.current = now;
    const dt = Math.min((now - lastRef.current) / 1000, 0.025);
    lastRef.current = now;

    if (aliveRef.current) {
      const s = S.current;
      const force = Math.max(-CP_FORCE_CLIP,
        Math.min(CP_FORCE_CLIP, -CP_KP * s.theta - CP_KD * s.dtheta));
      S.current = cpStep(s, force, dt);
      stepRef.current += 1;
      setStep(stepRef.current);

      const failed = Math.abs(S.current.theta) > 0.52 || Math.abs(S.current.x) > 2.2;
      if (failed) { aliveRef.current = false; setAlive(false); }
    }

    redraw();
    rafRef.current = requestAnimationFrame(loop);
  }, [redraw]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  const handleClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (CW / rect.width);
    const side = cx < CW / 2 ? 1 : -1;
    S.current.dtheta += side * 1.8;
    S.current.dx     += side * 0.6;
    if (!aliveRef.current) {
      aliveRef.current = true; setAlive(true);
      S.current = { x: 0, dx: 0, theta: side * 0.05, dtheta: 0 };
      stepRef.current = 0; setStep(0);
    }
  }, []);

  const reset = () => {
    S.current = { x: 0, dx: 0, theta: 0.05, dtheta: 0 };
    aliveRef.current = true; setAlive(true);
    stepRef.current = 0; setStep(0);
    lastRef.current = null;
  };

  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      <div>
        <span className="text-xs font-bold tracking-widest text-violet-400">LAB 01</span>
        <h2 className="text-xl font-semibold text-whiteHull mt-0.5">CartPole Balance</h2>
        <p className="mt-1 text-sm text-slate-400">
          Euler-integrated physics with a PD policy balancing the pole.
          Click left or right of the cart to apply an impulse disturbance.
        </p>
      </div>
      <div className="flex flex-col xl:flex-row gap-5">
        <div className="flex-shrink-0">
          <div className="rounded-xl overflow-hidden cursor-crosshair"
            style={{ width: CW, height: CW, border: '1px solid rgba(167,139,250,0.25)' }}>
            <canvas ref={canvasRef} width={CW} height={CW} className="block" onClick={handleClick} />
          </div>
        </div>
        <div className="flex flex-col gap-3 flex-1 min-w-[220px]">
          <div className="simulator-panel rounded-xl p-4 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-violet-400">Controls</h3>
            <button onClick={reset}
              className="w-full rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition">
              Reset Episode
            </button>
            <div className={`mt-2 rounded-lg px-3 py-2 text-xs font-mono ${alive ? 'bg-violet-900/30 text-violet-300' : 'bg-red-900/30 text-red-400'}`}>
              {alive ? `▶ Running — step ${step}` : '✕ Episode failed — click to restart'}
            </div>
          </div>
          <div className="simulator-panel rounded-xl p-4 text-xs text-slate-400 space-y-1.5">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-violet-400 mb-2">Policy</h3>
            <p>Linear PD controller: <span className="font-mono text-violet-300">F = −Kp·θ − Kd·θ̇</span></p>
            <p>Isaac Lab trains neural policies with PPO on this exact env to achieve &gt;10 k steps consistently.</p>
            <p className="text-slate-500 mt-2">Failure bounds: |θ| &gt; 30° or |x| &gt; 2.2 m</p>
          </div>
          <div className="simulator-panel rounded-xl p-4 text-xs text-slate-400">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-violet-400 mb-2">Physics</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>Euler integration @ 40 Hz</li>
              <li>Cart mass 1 kg, pole mass 0.1 kg</li>
              <li>Pole length 0.5 m</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LAB 02 — Quadruped Locomotion
   Sine-wave central-pattern generator drives 4-legged gait.
   User can switch gait pattern and terrain.
   ══════════════════════════════════════════════════════════════ */
const BODY_W = 90, BODY_H = 28;
const LEG_UPPER = 38, LEG_LOWER = 34;
const BODY_Y = CW * 0.48;

// gait phase offsets [FL, FR, BL, BR]
const GAITS = {
  trot:   [0, Math.PI, Math.PI, 0],
  walk:   [0, Math.PI * 1.5, Math.PI * 0.5, Math.PI],
  bound:  [0, 0, Math.PI, Math.PI],
};

const TERRAINS = {
  flat:   () => 0,
  ramp:   (x) => x * 0.18,
  bumpy:  (x) => Math.sin(x * 0.08) * 12 + Math.sin(x * 0.19) * 6,
};

function legPos(bodyX, bodyY, legOffX, phase, t, terrainFn) {
  const swing = Math.max(0, Math.sin(t * 3.5 + phase));
  const stance = Math.max(0, -Math.sin(t * 3.5 + phase));
  const footY0 = BODY_Y + BODY_H / 2 + LEG_UPPER + LEG_LOWER;
  const groundY = footY0 + terrainFn(bodyX + legOffX) - BODY_Y * 0.02;
  const hipX  = bodyX + legOffX;
  const hipY  = bodyY + BODY_H / 2;
  const liftH = swing * 26;
  const stepX = Math.sin(t * 3.5 + phase + 0.4) * 20;
  const footX = hipX + stepX;
  const footY = groundY - liftH;
  // knee: midpoint with perpendicular offset
  const mx = (hipX + footX) / 2;
  const my = (hipY + footY) / 2;
  const dx = footX - hipX, dy = footY - hipY;
  const nl = Math.sqrt(dx * dx + dy * dy) || 1;
  const kneeX = mx - (dy / nl) * 12;
  const kneeY = my + (dx / nl) * 12;
  return { hipX, hipY, kneeX, kneeY, footX, footY, contact: stance > 0.05 };
}

function QuadrupedLab() {
  const canvasRef = useRef(null);
  const tRef = useRef(0);
  const rafRef = useRef(null);
  const lastRef = useRef(null);
  const scrollRef = useRef(0);
  const [gait, setGait] = useState('trot');
  const [terrain, setTerrain] = useState('flat');
  const gaitRef = useRef('trot');
  const terrainRef = useRef('flat');

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawIsaacGrid(ctx);

    const t = tRef.current;
    const scroll = scrollRef.current;
    const phases = GAITS[gaitRef.current];
    const tfn = TERRAINS[terrainRef.current];

    // draw terrain strip
    ctx.save();
    ctx.beginPath();
    const baseY = BODY_Y + BODY_H / 2 + LEG_UPPER + LEG_LOWER;
    ctx.moveTo(0, CW);
    for (let px = 0; px <= CW; px += 3) {
      const worldX = px + scroll;
      ctx.lineTo(px, baseY + tfn(worldX));
    }
    ctx.lineTo(CW, CW); ctx.closePath();
    ctx.fillStyle = '#1a0a35'; ctx.fill();
    ctx.beginPath();
    for (let px = 0; px <= CW; px += 3) {
      const worldX = px + scroll;
      if (px === 0) ctx.moveTo(px, baseY + tfn(worldX));
      else ctx.lineTo(px, baseY + tfn(worldX));
    }
    ctx.strokeStyle = 'rgba(167,139,250,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();

    const bodyX = CW / 2;
    const bodyY = BODY_Y + tfn(bodyX + scroll) * 0.3;

    // legs
    const legOffsets = [-BODY_W * 0.38, BODY_W * 0.38, -BODY_W * 0.38, BODY_W * 0.38];
    const legNames = ['FL', 'FR', 'BL', 'BR'];
    const contacts = [];

    legOffsets.forEach((ox, i) => {
      const lp = legPos(bodyX, bodyY, ox, phases[i], t, (x) => tfn(x + scroll));
      contacts.push(lp.contact);
      const col = lp.contact ? ACCENT : ACCENT + '70';
      ctx.beginPath(); ctx.moveTo(lp.hipX, lp.hipY);
      ctx.lineTo(lp.kneeX, lp.kneeY); ctx.lineTo(lp.footX, lp.footY);
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      // joints
      [{ x: lp.hipX, y: lp.hipY }, { x: lp.kneeX, y: lp.kneeY }].forEach(j => {
        ctx.beginPath(); ctx.arc(j.x, j.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#0f0020'; ctx.fill(); ctx.strokeStyle = ACCENT + 'cc'; ctx.lineWidth = 1.5; ctx.stroke();
      });
      // foot contact marker
      if (lp.contact) {
        ctx.beginPath(); ctx.arc(lp.footX, lp.footY, 5, 0, Math.PI * 2);
        ctx.fillStyle = ACCENT + 'aa'; ctx.fill();
      }
      // leg label
      ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(167,139,250,0.55)';
      ctx.fillText(legNames[i], lp.hipX - 8, lp.hipY - 8);
    });

    // body
    ctx.save();
    ctx.shadowColor = ACCENT; ctx.shadowBlur = 12;
    ctx.fillStyle = '#1e1033';
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect?.(bodyX - BODY_W / 2, bodyY - BODY_H / 2, BODY_W, BODY_H, 6) ??
      ctx.rect(bodyX - BODY_W / 2, bodyY - BODY_H / 2, BODY_W, BODY_H);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // head
    ctx.fillStyle = '#27114d'; ctx.strokeStyle = ACCENT + 'cc'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect?.(bodyX + BODY_W / 2 - 2, bodyY - 10, 20, 20, 4) ??
      ctx.rect(bodyX + BODY_W / 2 - 2, bodyY - 10, 20, 20);
    ctx.fill(); ctx.stroke();
    // eye
    ctx.beginPath(); ctx.arc(bodyX + BODY_W / 2 + 13, bodyY - 3, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = ACCENT; ctx.fill();

    // HUD
    hud(ctx, 8, 8, 175, 58);
    ctx.font = '10px monospace';
    [
      ['gait',    gaitRef.current  ],
      ['terrain', terrainRef.current],
      ['speed',   '1.8 m/s'       ],
      ['contact', contacts.filter(Boolean).length + '/4 feet'],
    ].forEach(([l, v], i) => {
      ctx.fillStyle = '#475569'; ctx.fillText(l + ':', 16, 24 + i * 11);
      ctx.fillStyle = ACCENT; ctx.fillText(v, 88, 24 + i * 11);
    });
  }, []);

  const loop = useCallback((now) => {
    if (!lastRef.current) lastRef.current = now;
    const dt = Math.min((now - lastRef.current) / 1000, 0.04);
    lastRef.current = now;
    tRef.current += dt;
    scrollRef.current += dt * 80;
    redraw();
    rafRef.current = requestAnimationFrame(loop);
  }, [redraw]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  const setG = (g) => { gaitRef.current = g; setGait(g); };
  const setT = (t) => { terrainRef.current = t; setTerrain(t); };

  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      <div>
        <span className="text-xs font-bold tracking-widest text-violet-400">LAB 02</span>
        <h2 className="text-xl font-semibold text-whiteHull mt-0.5">Quadruped Locomotion</h2>
        <p className="mt-1 text-sm text-slate-400">
          Central-pattern generator (CPG) drives a 4-legged gait. Switch gait patterns and terrain types.
        </p>
      </div>
      <div className="flex flex-col xl:flex-row gap-5">
        <div className="flex-shrink-0">
          <div className="rounded-xl overflow-hidden"
            style={{ width: CW, height: CW, border: '1px solid rgba(167,139,250,0.25)' }}>
            <canvas ref={canvasRef} width={CW} height={CW} className="block" />
          </div>
        </div>
        <div className="flex flex-col gap-3 flex-1 min-w-[220px]">
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-violet-400 mb-3">Gait Pattern</h3>
            <div className="flex flex-col gap-2">
              {Object.keys(GAITS).map(g => (
                <button key={g} onClick={() => setG(g)}
                  className={`rounded-lg py-2 text-sm font-medium capitalize transition ${
                    gait === g
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-violet-400 mb-3">Terrain</h3>
            <div className="flex flex-col gap-2">
              {Object.keys(TERRAINS).map(t => (
                <button key={t} onClick={() => setT(t)}
                  className={`rounded-lg py-2 text-sm font-medium capitalize transition ${
                    terrain === t
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="simulator-panel rounded-xl p-4 text-xs text-slate-400">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-violet-400 mb-2">CPG</h3>
            <p>Phase-coupled oscillators produce coordinated leg timing. Isaac Lab trains neural policies that modulate CPG frequency and amplitude via PPO rewards.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LAB 03 — RL Training Dashboard
   Simulates a live PPO training run: plots reward curve, entropy,
   and shows a policy-network heatmap updating each "iteration".
   ══════════════════════════════════════════════════════════════ */
const HIST_LEN = 80;

function makeTrainingState() {
  return {
    iter: 0,
    rewards: [],
    entropy: [],
    loss: [],
    weights: Array.from({ length: 16 }, () => (Math.random() - 0.5) * 2),
  };
}

function RLDashboardLab() {
  const canvasRef = useRef(null);
  const S = useRef(makeTrainingState());
  const rafRef = useRef(null);
  const lastRef = useRef(null);
  const tickRef = useRef(0);
  const [running, setRunning] = useState(false);
  const runRef = useRef(false);
  const [iter, setIter] = useState(0);

  const plotLine = (ctx, data, x0, y0, w, h, color, label) => {
    if (data.length < 2) return;
    const minV = Math.min(...data), maxV = Math.max(...data) || 1;
    const range = maxV - minV || 1;
    ctx.beginPath();
    data.forEach((v, i) => {
      const px = x0 + (i / (HIST_LEN - 1)) * w;
      const py = y0 + h - ((v - minV) / range) * h;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.stroke();
    // gradient fill
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + h);
    grad.addColorStop(0, color + '40'); grad.addColorStop(1, color + '00');
    ctx.lineTo(x0 + (data.length - 1) / (HIST_LEN - 1) * w, y0 + h);
    ctx.lineTo(x0, y0 + h); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    // label
    ctx.font = '9px monospace'; ctx.fillStyle = color;
    ctx.fillText(label + ': ' + data[data.length - 1].toFixed(2), x0 + 4, y0 + 12);
  };

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const s = S.current;
    drawIsaacGrid(ctx);

    // ── Policy network heatmap ────────────────────────────────
    const ROWS = 4, COLS = 4;
    const cellSize = 34, netX = 24, netY = 24;
    ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(167,139,250,0.5)';
    ctx.fillText('Policy weights', netX, netY - 8);
    s.weights.forEach((w, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      const intensity = (w + 2) / 4;
      const r = Math.round(lerp(7,  167, intensity));
      const g = Math.round(lerp(2,  139, intensity));
      const b = Math.round(lerp(15, 250, intensity));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(netX + col * cellSize, netY + row * cellSize, cellSize - 2, cellSize - 2);
      ctx.font = '7px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(w.toFixed(1), netX + col * cellSize + 4, netY + row * cellSize + 12);
    });

    // ── Charts ────────────────────────────────────────────────
    const chartX = 24, chartY = netY + ROWS * cellSize + 20;
    const chartW = CW - 48, chartH = 80;
    const chart2Y = chartY + chartH + 30;

    // reward chart bg
    hud(ctx, chartX, chartY - 16, chartW, chartH + 20);
    ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(167,139,250,0.55)';
    ctx.fillText('Episode Reward', chartX + 6, chartY - 4);
    plotLine(ctx, s.rewards, chartX + 4, chartY, chartW - 8, chartH - 4, '#4ade80', 'reward');

    hud(ctx, chartX, chart2Y - 16, chartW, chartH + 20);
    ctx.fillStyle = 'rgba(167,139,250,0.55)';
    ctx.fillText('Entropy / Policy Loss', chartX + 6, chart2Y - 4);
    plotLine(ctx, s.entropy, chartX + 4, chart2Y, chartW - 8, chartH - 4, ACCENT, 'entropy');
    plotLine(ctx, s.loss,    chartX + 4, chart2Y, chartW - 8, chartH - 4, '#f97316', 'loss');

    // iteration counter
    hud(ctx, CW - 100, 8, 90, 30);
    ctx.font = '10px monospace'; ctx.fillStyle = ACCENT;
    ctx.fillText('iter ' + s.iter, CW - 94, 27);
  }, []);

  function lerp(a, b, t) { return a + (b - a) * t; }

  const tick = useCallback(() => {
    const s = S.current;
    s.iter++;
    setIter(s.iter);
    const progress = Math.min(s.iter / 200, 1);
    const baseReward = -10 + progress * 35 + (Math.random() - 0.5) * 4;
    s.rewards.push(baseReward);
    if (s.rewards.length > HIST_LEN) s.rewards.shift();

    const baseEntropy = 1.2 - progress * 0.8 + (Math.random() - 0.5) * 0.1;
    s.entropy.push(Math.max(0.1, baseEntropy));
    if (s.entropy.length > HIST_LEN) s.entropy.shift();

    const baseLoss = 0.8 - progress * 0.55 + (Math.random() - 0.5) * 0.08;
    s.loss.push(Math.max(0.05, baseLoss));
    if (s.loss.length > HIST_LEN) s.loss.shift();

    // perturb weights slightly
    s.weights = s.weights.map(w =>
      Math.max(-2, Math.min(2, w + (Math.random() - 0.5) * 0.15 * (1 - progress * 0.7)))
    );
  }, []);

  const loop = useCallback((now) => {
    if (!lastRef.current) lastRef.current = now;
    const dt = now - lastRef.current;
    lastRef.current = now;
    tickRef.current += dt;
    if (runRef.current && tickRef.current >= 200) {
      tickRef.current = 0;
      tick();
    }
    redraw();
    rafRef.current = requestAnimationFrame(loop);
  }, [redraw, tick]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  const start = () => { runRef.current = true; setRunning(true); };
  const pause = () => { runRef.current = false; setRunning(false); };
  const reset = () => {
    runRef.current = false; setRunning(false);
    S.current = makeTrainingState(); setIter(0);
  };

  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      <div>
        <span className="text-xs font-bold tracking-widest text-violet-400">LAB 03</span>
        <h2 className="text-xl font-semibold text-whiteHull mt-0.5">RL Training Dashboard</h2>
        <p className="mt-1 text-sm text-slate-400">
          Simulated PPO training loop. Watch episode reward converge, entropy decay, and policy weights evolve.
        </p>
      </div>
      <div className="flex flex-col xl:flex-row gap-5">
        <div className="flex-shrink-0">
          <div className="rounded-xl overflow-hidden"
            style={{ width: CW, height: CW, border: '1px solid rgba(167,139,250,0.25)' }}>
            <canvas ref={canvasRef} width={CW} height={CW} className="block" />
          </div>
        </div>
        <div className="flex flex-col gap-3 flex-1 min-w-[220px]">
          <div className="simulator-panel rounded-xl p-4 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-violet-400 mb-2">Training</h3>
            <button onClick={running ? pause : start}
              className={`w-full rounded-lg py-2 text-sm font-semibold transition ${
                running
                  ? 'bg-slate-700 text-violet-300 hover:bg-slate-600'
                  : 'bg-violet-600 text-white hover:bg-violet-500'}`}>
              {running ? '⏸ Pause' : '▶ Train'}
            </button>
            <button onClick={reset}
              className="w-full rounded-lg bg-slate-800 py-2 text-sm text-slate-400 hover:bg-slate-700 transition">
              Reset
            </button>
            <div className={`rounded-lg px-3 py-2 text-xs font-mono ${running ? 'bg-violet-900/30 text-violet-300' : 'bg-slate-800/40 text-slate-500'}`}>
              {running ? `Training… iteration ${iter}` : iter > 0 ? `Paused at iter ${iter}` : 'Press Train to start'}
            </div>
          </div>
          <div className="simulator-panel rounded-xl p-4 text-xs text-slate-400 space-y-1">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-violet-400 mb-2">PPO Hyperparams</h3>
            {[['Algorithm','PPO'],['Env','CartPole-v1'],['Rollout steps','2048'],['Mini-batches','32'],
              ['Clip ε','0.2'],['Entropy coeff','0.01'],['Discount γ','0.99']].map(([k,v])=>(
              <div key={k} className="flex justify-between">
                <span className="text-slate-500">{k}</span>
                <span className="font-mono text-violet-300">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Header + export
   ══════════════════════════════════════════════════════════════ */
const ISAAC_LABS = [
  { num: '01', title: 'CartPole Balance',     desc: 'Full Euler physics + PD policy. Click to disturb — watch the controller recover.', icon: '⚖️' },
  { num: '02', title: 'Quadruped Locomotion', desc: 'CPG-driven 4-legged gait across flat, ramp, and bumpy terrain. Switch gaits live.', icon: '🐾' },
  { num: '03', title: 'RL Training Dashboard','desc': 'Simulated PPO run: reward convergence, entropy decay, and live policy-weight heatmap.', icon: '📈' },
];

const cardV = {
  hidden:   { opacity: 0, y: 20 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.45, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] } }),
};

export default function IsaacLabTab() {
  return (
    <div className="space-y-6">
      <div className="simulator-panel relative overflow-hidden rounded-3xl p-7">
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">Isaac Lab Domain</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-whiteHull">Isaac Lab Simulator</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Physics-based RL training environments modelled on NVIDIA Isaac Lab.
              Three labs cover classic control, legged locomotion, and the PPO training loop.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {ISAAC_LABS.map((c, i) => (
              <motion.article key={c.num} custom={i} variants={cardV}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="glass-card rounded-2xl p-4">
                <div className="mb-1 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-base">{c.icon}</span>
                  <span className="text-xs font-bold tracking-widest text-violet-400">LAB {c.num}</span>
                </div>
                <h2 className="text-sm font-semibold text-violet-400">{c.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{c.desc}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
      <CartPoleLab />
      <QuadrupedLab />
      <RLDashboardLab />
    </div>
  );
}
