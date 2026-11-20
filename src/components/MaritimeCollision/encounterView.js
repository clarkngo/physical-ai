// Canvas drawing for the Collision Avoidance lab: a north-up plot in nautical
// miles, like a radar/ECDIS display with true motion.

import { NM } from './shipModel.js';

export const VIEW = { xMin: -6.5, xMax: 6.5, yMin: -1, yMax: 10.5 }; // nm

const VECTOR_MIN = 6; // length of the speed vectors, in minutes

export function drawEncounter(canvas, enc, { showVectors = true } = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const scale = Math.min(w / (VIEW.xMax - VIEW.xMin), h / (VIEW.yMax - VIEW.yMin));
  const cx = w / 2;
  const cy = h / 2;
  const midX = (VIEW.xMax + VIEW.xMin) / 2;
  const midY = (VIEW.yMax + VIEW.yMin) / 2;
  const sx = (xm) => cx + (xm / NM - midX) * scale;
  const sy = (ym) => cy - (ym / NM - midY) * scale;

  // Sea and 1 nm grid.
  ctx.fillStyle = '#020a17';
  ctx.fillRect(0, 0, w, h);
  ctx.lineWidth = 1;
  ctx.font = '10px ui-monospace, monospace';
  for (let x = Math.ceil(VIEW.xMin - 2); x <= VIEW.xMax + 2; x++) {
    ctx.strokeStyle = x === 0 ? 'rgba(0,163,224,0.16)' : 'rgba(0,163,224,0.06)';
    ctx.beginPath();
    ctx.moveTo(sx(x * NM), 0);
    ctx.lineTo(sx(x * NM), h);
    ctx.stroke();
  }
  for (let y = Math.ceil(VIEW.yMin - 2); y <= VIEW.yMax + 2; y++) {
    ctx.strokeStyle = 'rgba(0,163,224,0.06)';
    ctx.beginPath();
    ctx.moveTo(0, sy(y * NM));
    ctx.lineTo(w, sy(y * NM));
    ctx.stroke();
  }
  // Scale bar.
  ctx.strokeStyle = 'rgba(148,163,184,0.7)';
  ctx.fillStyle = 'rgba(148,163,184,0.8)';
  ctx.beginPath();
  ctx.moveTo(12, h - 14);
  ctx.lineTo(12 + scale, h - 14);
  ctx.moveTo(12, h - 18);
  ctx.lineTo(12, h - 10);
  ctx.moveTo(12 + scale, h - 18);
  ctx.lineTo(12 + scale, h - 10);
  ctx.stroke();
  ctx.fillText('1 nm', 16 + scale, h - 10);
  ctx.fillText('N ↑', w - 30, 16);

  const own = enc.own;
  const ships = enc.ships;

  // Trails.
  ships.forEach((s, i) => {
    const trail = enc.trails[i];
    if (trail.length < 2) return;
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = i === 0 ? 2 : 1.5;
    ctx.beginPath();
    trail.forEach(([x, y], k) => (k ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
    ctx.lineTo(sx(s.x), sy(s.y));
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  // Safe-CPA ring around own ship.
  const safe = enc.opts.safeCpaNm * NM;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(34,211,238,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(sx(own.x), sy(own.y), safe * (scale / NM), 0, 2 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);

  if (!enc.done) {
    // Speed vectors: where each ship will be in VECTOR_MIN minutes if it holds course.
    if (showVectors) {
      ships.forEach((s) => {
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx(s.x), sy(s.y));
        ctx.lineTo(sx(s.x + s.vx * VECTOR_MIN * 60), sy(s.y + s.vy * VECTOR_MIN * 60));
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }

    // CPA markers: both ships' positions at the predicted closest point.
    enc.situation().forEach((sit, i) => {
      if (!(sit.tcpa > 0 && sit.tcpa < 30 * 60)) return;
      const t = enc.targets[i].ship;
      const ox = own.x + own.vx * sit.tcpa;
      const oy = own.y + own.vy * sit.tcpa;
      const tx = t.x + t.vx * sit.tcpa;
      const ty = t.y + t.vy * sit.tcpa;
      const danger = sit.dcpa < safe;
      ctx.strokeStyle = danger ? 'rgba(248,113,113,0.9)' : 'rgba(148,163,184,0.5)';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(sx(own.x), sy(own.y));
      ctx.lineTo(sx(ox), sy(oy));
      ctx.moveTo(sx(t.x), sy(t.y));
      ctx.lineTo(sx(tx), sy(ty));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(sx(ox), sy(oy));
      ctx.lineTo(sx(tx), sy(ty));
      ctx.stroke();
      ctx.fillStyle = danger ? 'rgba(248,113,113,0.95)' : 'rgba(148,163,184,0.8)';
      ctx.fillText(`CPA ${(sit.dcpa / NM).toFixed(2)} nm`, sx((ox + tx) / 2) + 6, sy((oy + ty) / 2) - 4);
    });
  } else {
    // After the run: mark where each target came closest.
    enc.minRange.forEach((m, i) => {
      const k = Math.min(Math.round(m.time / 10), enc.trails[0].length - 1);
      const o = enc.trails[0][k];
      const t = enc.trails[i + 1][k];
      if (!o || !t) return;
      ctx.strokeStyle = enc.targets[i].ship.color;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(sx(o[0]), sy(o[1]));
      ctx.lineTo(sx(t[0]), sy(t[1]));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = enc.targets[i].ship.color;
      ctx.fillText(`closest ${(m.range / NM).toFixed(2)} nm`, sx((o[0] + t[0]) / 2) + 6, sy((o[1] + t[1]) / 2));
    });
  }

  // Ships (icons are not to scale: a 250 m ship is ~1/7 nm).
  ships.forEach((s, i) => drawShip(ctx, sx(s.x), sy(s.y), s.psi, i === 0 ? 11 : 9, s.color));
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ships.forEach((s, i) => {
    ctx.fillStyle = s.color;
    ctx.fillText(i === 0 ? 'Own' : s.name.replace('Target ', ''), sx(s.x) + 12, sy(s.y) + 4);
  });

  if (enc.collided) {
    const t = enc.targets[enc.collided.target].ship;
    const x = sx((own.x + t.x) / 2);
    const y = sy((own.y + t.y) / 2);
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
      ctx.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16);
      ctx.stroke();
    }
  }
}

function drawShip(ctx, x, y, psi, size, color) {
  const f = [Math.sin(psi), -Math.cos(psi)]; // bow direction on screen
  const r = [Math.cos(psi), Math.sin(psi)]; // starboard on screen
  const pts = [
    [0, 1.1],
    [0.38, 0.35],
    [0.38, -1],
    [-0.38, -1],
    [-0.38, 0.35],
  ];
  ctx.fillStyle = color;
  ctx.strokeStyle = '#020a17';
  ctx.lineWidth = 1;
  ctx.beginPath();
  pts.forEach(([lx, ly], k) => {
    const px = x + (f[0] * ly + r[0] * lx) * size;
    const py = y + (f[1] * ly + r[1] * lx) * size;
    if (k) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
