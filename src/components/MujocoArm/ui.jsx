// Small UI pieces shared by the MuJoCo arm labs (orange Manipulation styling).

export const ACCENT = '#f97316';

export function Slider({ label, value, min, max, step, unit, onChange, disabled, digits }) {
  const d = digits ?? (step < 1 ? (step < 0.1 ? 2 : 1) : 0);
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-400">
          {Number(value).toFixed(d)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-orange-500 disabled:opacity-40"
      />
    </label>
  );
}

export function Stat({ label, value, tone = 'text-slate-200' }) {
  return (
    <div className="rounded-xl bg-slate-900/70 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-0.5 font-mono text-sm ${tone}`}>{value}</p>
    </div>
  );
}

export function Chip({ active, onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-xs transition disabled:opacity-40 ${
        active ? 'bg-orange-500 text-slate-900' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

export function ViewOverlay({ status, error }) {
  if (status === 'ready') return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 p-6 text-center text-sm">
      {status === 'loading' ? (
        <span className="text-slate-300">Loading MuJoCo WebAssembly…</span>
      ) : (
        <span className="text-red-300">Could not load MuJoCo: {error}</span>
      )}
    </div>
  );
}

export function LabHeader({ num, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold tracking-widest text-orange-400">LAB {num}</span>
        <span className="rounded-md bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-orange-300">
          MuJoCo physics
        </span>
      </div>
      <h2 className="mt-0.5 text-xl font-semibold text-whiteHull">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-400">{children}</p>
    </div>
  );
}

// Same names as the 2D labs use for the three joints.
export const JOINT_LABELS = ['q1 (base)', 'q2 (shoulder)', 'q3 (elbow)'];
export const JOINT_COLORS = ['#f97316', '#38bdf8', '#a78bfa'];
