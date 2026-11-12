import { useState, useRef, useEffect } from 'react';

/* ── World constants (static render, no physics loop needed) ──── */
const CW    = 460;
const WORLD = 11.088;
const PX    = CW / WORLD;
const r2c   = (rx, ry) => [rx * PX, CW - ry * PX];

const SHELL_COLORS = ['#00a3e0', '#f472b6', '#4ade80', '#fb923c', '#a78bfa', '#facc15'];

/* ── Service schema (mirrors real turtlesim / std_srvs services) ── */
const SERVICES = [
  {
    id: 'spawn', path: '/spawn', type: 'turtlesim/srv/Spawn',
    fields: [
      { key: 'name',  label: 'name',  kind: 'text',   default: '' },
      { key: 'x',     label: 'x',     kind: 'number',  default: 5.0, step: 0.1 },
      { key: 'y',     label: 'y',     kind: 'number',  default: 5.0, step: 0.1 },
      { key: 'theta', label: 'theta', kind: 'number',  default: 0.0, step: 0.1 },
    ],
  },
  {
    id: 'kill', path: '/kill', type: 'turtlesim/srv/Kill',
    fields: [{ key: 'name', label: 'name', kind: 'turtleSelect' }],
  },
  {
    id: 'teleport', path: '/turtle1/teleport_absolute', type: 'turtlesim/srv/TeleportAbsolute',
    fields: [
      { key: 'target', label: 'target turtle', kind: 'turtleSelect' },
      { key: 'x',       label: 'x',             kind: 'number', default: 5.544, step: 0.1 },
      { key: 'y',       label: 'y',             kind: 'number', default: 5.544, step: 0.1 },
      { key: 'theta',   label: 'theta',         kind: 'number', default: 0.0,   step: 0.1 },
    ],
  },
  {
    id: 'set_pen', path: '/turtle1/set_pen', type: 'turtlesim/srv/SetPen',
    fields: [
      { key: 'target', label: 'target turtle', kind: 'turtleSelect' },
      { key: 'r',       label: 'r',     kind: 'number', default: 255, step: 1, min: 0, max: 255 },
      { key: 'g',       label: 'g',     kind: 'number', default: 0,   step: 1, min: 0, max: 255 },
      { key: 'b',       label: 'b',     kind: 'number', default: 0,   step: 1, min: 0, max: 255 },
      { key: 'width',   label: 'width', kind: 'number', default: 3,   step: 1, min: 1, max: 10  },
      { key: 'off',     label: 'off',   kind: 'checkbox', default: false },
    ],
  },
  { id: 'reset', path: '/reset', type: 'std_srvs/srv/Empty', fields: [] },
];

const mkTurtle = (name, x, y, theta, colorIdx) => ({
  name, x, y, theta, colorIdx, penColor: SHELL_COLORS[colorIdx], penWidth: 2.5, penOff: false,
});

function fmtVal(v) {
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number')  return Number.isInteger(v) ? v.toFixed(1) : v.toString();
  return `'${v}'`;
}

function buildRequestStr(service, values) {
  if (service.fields.length === 0) return '{}';
  const parts = service.fields.map(f => `${f.key}: ${fmtVal(values[f.key])}`);
  return `{${parts.join(', ')}}`;
}

/* ── Canvas render (pure function, called on demand) ────────────── */
function renderWorld(canvas, turtles, highlight) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#010d1f';
  ctx.fillRect(0, 0, CW, CW);
  ctx.strokeStyle = 'rgba(0,163,224,0.06)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= WORLD * 2; i++) {
    const p = (i / 2) * PX;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, CW); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(CW, p); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,163,224,0.25)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, CW - 1.5, CW - 1.5);

  turtles.forEach(t => {
    const [cx, cy] = r2c(t.x, t.y);
    const color = SHELL_COLORS[t.colorIdx];
    const flash = highlight === t.name;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-t.theta);
    if (flash) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 20; }
    else       { ctx.shadowColor = color; ctx.shadowBlur = 9; }
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fillStyle = color + 'cc'; ctx.fill();
    ctx.strokeStyle = flash ? '#fff' : color; ctx.lineWidth = flash ? 2 : 1.5; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.8;
    [0.35, 0.65, 0.9].forEach(f => { ctx.beginPath(); ctx.arc(0, 0, 13 * f, 0, Math.PI * 2); ctx.stroke(); });
    ctx.beginPath(); ctx.arc(13 * 1.1, 0, 13 * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(13 * 1.2, 0, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (!t.penOff) {
      ctx.beginPath();
      ctx.arc(cx, cy + 20, 3, 0, Math.PI * 2);
      ctx.fillStyle = t.penColor; ctx.fill();
    }

    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(148,163,184,0.6)'; ctx.textAlign = 'center';
    ctx.fillText(`/${t.name}`, cx, cy - 20);
    ctx.textAlign = 'start';
  });
}

/* ── Component ───────────────────────────────────────────────── */
export default function ServiceCallLab() {
  const canvasRef = useRef(null);
  const nextIdx   = useRef(1);

  const [turtles,  setTurtles]  = useState([mkTurtle('turtle1', WORLD / 2, WORLD / 2, 0, 0)]);
  const [svcId,    setSvcId]    = useState('spawn');
  const [values,   setValuesSt] = useState(() => defaultsFor('spawn', ['turtle1']));
  const [busy,     setBusy]     = useState(false);
  const [highlight,setHighlight]= useState(null);
  const [log,       setLog]     = useState([]);

  const service = SERVICES.find(s => s.id === svcId);
  const names = turtles.map(t => t.name);

  function defaultsFor(id, turtleNames) {
    const s = SERVICES.find(x => x.id === id);
    const v = {};
    s.fields.forEach(f => {
      if (f.kind === 'turtleSelect') v[f.key] = turtleNames[0] ?? 'turtle1';
      else v[f.key] = f.default;
    });
    return v;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) renderWorld(canvas, turtles, highlight);
  }, [turtles, highlight]);

  const selectService = (id) => {
    setSvcId(id);
    setValuesSt(defaultsFor(id, names));
  };

  const updateField = (key, val) => setValuesSt(v => ({ ...v, [key]: val }));

  const callService = () => {
    if (busy) return;
    setBusy(true);
    const reqStr = buildRequestStr(service, values);
    const latency = 140 + Math.random() * 360;

    setTimeout(() => {
      let next = turtles.map(t => ({ ...t }));
      let ok = true, respStr = '{}', errStr = '';

      if (svcId === 'spawn') {
        let name = (values.name || '').trim();
        if (!name) { name = `turtle${nextIdx.current + 1}`; }
        if (next.some(t => t.name === name)) {
          ok = false; errStr = `a turtle named [${name}] already exists`;
        } else {
          const idx = nextIdx.current % SHELL_COLORS.length;
          nextIdx.current += 1;
          next.push(mkTurtle(name, +values.x, +values.y, +values.theta, idx));
          respStr = `{name: '${name}'}`;
          setHighlight(name);
        }
      } else if (svcId === 'kill') {
        if (!next.some(t => t.name === values.name)) {
          ok = false; errStr = `Tried to kill turtle "${values.name}" which does not exist`;
        } else {
          next = next.filter(t => t.name !== values.name);
          respStr = '{}';
        }
      } else if (svcId === 'teleport') {
        const t = next.find(t => t.name === values.target);
        if (!t) { ok = false; errStr = `turtle [${values.target}] does not exist`; }
        else {
          t.x = Math.max(0.2, Math.min(WORLD - 0.2, +values.x));
          t.y = Math.max(0.2, Math.min(WORLD - 0.2, +values.y));
          t.theta = +values.theta;
          respStr = '{}';
          setHighlight(t.name);
        }
      } else if (svcId === 'set_pen') {
        const t = next.find(t => t.name === values.target);
        if (!t) { ok = false; errStr = `turtle [${values.target}] does not exist`; }
        else {
          t.penColor = `rgb(${values.r|0},${values.g|0},${values.b|0})`;
          t.penWidth = +values.width;
          t.penOff = !!values.off;
          respStr = '{}';
          setHighlight(t.name);
        }
      } else if (svcId === 'reset') {
        nextIdx.current = 1;
        next = [mkTurtle('turtle1', WORLD / 2, WORLD / 2, 0, 0)];
        respStr = '{}';
        setHighlight('turtle1');
      }

      setTurtles(next);
      setLog(l => [{
        id: Date.now(), service: service.path, type: service.type,
        reqStr, respStr: ok ? respStr : null, errStr: ok ? null : errStr,
        latency: Math.round(latency), ok,
      }, ...l].slice(0, 20));
      setBusy(false);
      if (svcId !== 'kill') setTimeout(() => setHighlight(null), 500);
    }, latency);
  };

  return (
    <div className="simulator-panel rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold tracking-widest text-green-400">LAB 05</span>
        </div>
        <h2 className="text-xl font-semibold text-whiteHull">Service Call Lab</h2>
        <p className="mt-1 text-sm text-slate-400">
          Topics stream data asynchronously with no reply. Services are the other half of ROS 2
          communication — a synchronous request that <em>blocks</em> until a response (or error)
          comes back. Call <code className="text-green-400">/spawn</code>, <code className="text-green-400">/kill</code>,
          {' '}<code className="text-green-400">/turtle1/teleport_absolute</code>, <code className="text-green-400">/turtle1/set_pen</code> and
          {' '}<code className="text-green-400">/reset</code> against the live turtlesim world below.
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-5">
        {/* Canvas */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <div className="simulator-panel rounded-xl overflow-hidden" style={{ width: CW, height: CW }}>
            <canvas ref={canvasRef} width={CW} height={CW} className="block" />
          </div>
          <p className="text-xs text-slate-500 font-mono">{turtles.length} turtle{turtles.length !== 1 ? 's' : ''} alive</p>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-3 flex-1 min-w-[260px]">

          {/* Service picker */}
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-3">Service</h3>
            <div className="grid grid-cols-1 gap-1.5">
              {SERVICES.map(s => (
                <button key={s.id} onClick={() => selectService(s.id)}
                  className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-xs font-mono transition ${
                    svcId === s.id ? 'bg-green-400/20 ring-1 ring-green-400/60 text-green-300' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60'
                  }`}>
                  <span>{s.path}</span>
                  <span className="text-[10px] opacity-60">{s.type.split('/').pop()}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Request form */}
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-3">Request</h3>
            {service.fields.length === 0 ? (
              <p className="text-xs text-slate-600 italic mb-3">This service takes an empty request.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-3">
                {service.fields.map(f => (
                  <div key={f.key} className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 w-24 flex-shrink-0">{f.label}</label>
                    {f.kind === 'turtleSelect' ? (
                      <select value={values[f.key]} onChange={e => updateField(f.key, e.target.value)}
                        className="flex-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200 border border-slate-700">
                        {names.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    ) : f.kind === 'checkbox' ? (
                      <input type="checkbox" checked={!!values[f.key]}
                        onChange={e => updateField(f.key, e.target.checked)}
                        className="accent-green-400" />
                    ) : f.kind === 'text' ? (
                      <input type="text" value={values[f.key]} placeholder="auto"
                        onChange={e => updateField(f.key, e.target.value)}
                        className="flex-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200 border border-slate-700" />
                    ) : (
                      <input type="number" value={values[f.key]} step={f.step ?? 1} min={f.min} max={f.max}
                        onChange={e => updateField(f.key, +e.target.value)}
                        className="flex-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200 border border-slate-700" />
                    )}
                  </div>
                ))}
              </div>
            )}
            <button onClick={callService} disabled={busy}
              className="w-full rounded-lg bg-green-400 py-2 text-sm font-semibold text-slate-950
                         hover:bg-emerald-300 disabled:opacity-50 transition">
              {busy ? '⏳ Waiting for response…' : '▶ Call Service'}
            </button>
          </div>

          {/* Call log */}
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-green-400 mb-2">Call Log</h3>
            <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
              {log.length === 0 ? (
                <p className="text-xs text-slate-600 italic">No calls yet</p>
              ) : log.map(entry => (
                <div key={entry.id}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-mono leading-relaxed ${
                    entry.ok ? 'bg-slate-800/50' : 'bg-red-900/20 ring-1 ring-red-800/40'
                  }`}>
                  <div className="text-slate-300">
                    ros2 service call <span className="text-green-400">{entry.service}</span>
                  </div>
                  <div className="pl-3 text-slate-500">req: {entry.reqStr}</div>
                  {entry.ok
                    ? <div className="pl-3 text-slate-500">resp: <span className="text-slate-400">{entry.respStr}</span></div>
                    : <div className="pl-3 text-red-400">error: {entry.errStr}</div>}
                  <div className="pl-3 text-slate-600">{entry.latency} ms</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
