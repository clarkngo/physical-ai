import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Arrival optimization lab grounded in terminal-procedure concepts:
 * Continuous Descent Operations (CDO) vs stepped vectors into KSEA.
 * Fuel figures are pounds for a narrow-body arrival segment (not full mission fuel).
 */

const SCENARIOS = {
  vmc: {
    name: 'VMC · HAWKZ4',
    windKt: 12,
    meteringDelayMin: 2,
    trackNmBaseline: 48,
    notes: 'VMC · RNAV STAR HAWKZ4 → ILS 16L',
  },
  metering: {
    name: 'TBFM Metering',
    windKt: 18,
    meteringDelayMin: 11,
    trackNmBaseline: 62,
    notes: 'Time-Based Flow Management · path stretch upstream of CHINS',
  },
  imc: {
    name: 'IMC · Wind Shear',
    windKt: 32,
    meteringDelayMin: 7,
    trackNmBaseline: 55,
    notes: 'IMC · LLWS advisories · stepped descent preferred',
  },
};

// Typical narrow-body arrival: ~35–55 lb / NM in clean config during descent
const LB_PER_NM = { cdo: 38, balanced: 44, stepped: 52 };

function buildAnalytics({ scenarioId, profile, headwindKt, meterTightness, costIndex }) {
  const sc = SCENARIOS[scenarioId];
  const wind = headwindKt / 40;
  const meter = meterTightness / 100;

  // Path stretch: AI prefers CDO arcs when metering allows; stepped vectors otherwise
  const stretchFactor =
    profile === 'cdo' ? 0.88 - meter * 0.04 :
    profile === 'stepped' ? 1.12 + meter * 0.08 :
    0.96 + meter * 0.05;

  const trackNm = sc.trackNmBaseline * stretchFactor + wind * 4;
  const baselineTrack = sc.trackNmBaseline + wind * 6 + meter * 10;

  const burnRate = LB_PER_NM[profile] * (1 + wind * 0.15);
  const aiFuelLb = trackNm * burnRate;
  const baselineFuelLb = baselineTrack * LB_PER_NM.stepped * (1 + wind * 0.18);

  // Groundspeed proxy from cost index (higher CI → higher speed, less time, more fuel)
  const gsKt = 280 + costIndex * 0.9 - headwindKt;
  const aiMin = (trackNm / gsKt) * 60 + sc.meteringDelayMin * (profile === 'cdo' ? 0.7 : 1);
  const baselineMin = (baselineTrack / (gsKt * 0.92)) * 60 + sc.meteringDelayMin;

  // Separation risk proxy (higher for aggressive CDO in dense metering)
  const sepRisk =
    profile === 'cdo' ? 18 + meter * 28 + wind * 10 :
    profile === 'stepped' ? 8 + meter * 12 :
    12 + meter * 18;

  const co2Kg = Math.max(0, baselineFuelLb - aiFuelLb) * 3.16; // Jet-A ≈ 3.16 kg CO₂ / lb
  const confidence = Math.round(
    72 +
    (profile === 'cdo' && meter < 0.4 ? 12 : 0) +
    (profile === 'stepped' && meter > 0.55 ? 10 : 0) +
    (1 - wind) * 8,
  );

  return {
    trackNm,
    baselineTrack,
    aiFuelLb,
    baselineFuelLb,
    aiMin,
    baselineMin,
    sepRisk: Math.min(92, sepRisk),
    co2Kg,
    confidence: Math.min(96, confidence),
    gsKt: Math.round(gsKt),
  };
}

function ApproachViz({ scenarioId, profile, headwindKt, meterTightness }) {
  const sc = SCENARIOS[scenarioId];
  const meter = meterTightness / 100;
  const wind = headwindKt / 40;

  // Lateral path stretch increases with metering; CDO stays closer to published STAR
  const bulge =
    profile === 'cdo' ? 22 + meter * 18 :
    profile === 'stepped' ? 48 + meter * 35 + wind * 12 :
    34 + meter * 26;

  const baseline = 'M24,148 L92,118 L160,88 L220,58 L272,42';
  const aiPath =
    profile === 'stepped'
      ? `M24,148 L70,148 L70,118 L120,118 L120,88 L175,88 L175,62 L230,62 L272,42`
      : `M24,148 Q${70 + meter * 30},${148 - bulge * 0.2} ${110},${120 - bulge * 0.35} Q${170},${70 - bulge * 0.15} ${220},${52} T272,42`;

  const waypoints = [
    { x: 24, y: 148, name: 'HAWKZ' },
    { x: 110, y: 120 - (profile === 'stepped' ? 0 : bulge * 0.2), name: 'CHINS' },
    { x: 220, y: profile === 'stepped' ? 62 : 52, name: 'GLASR' },
    { x: 272, y: 42, name: '16L' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-500/25 bg-slate-950/90">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
          KSEA Arrival — Plan View
        </p>
        <p className="text-xs text-slate-500">{sc.notes}</p>
      </div>
      <svg viewBox="0 0 300 180" className="w-full" style={{ maxHeight: 220 }}>
        <rect width="300" height="180" fill="rgba(2,8,20,0.98)" />
        {[45, 90, 135].map((y) => (
          <line key={y} x1="0" y1={y} x2="300" y2={y}
            stroke="rgba(56,189,248,0.05)" strokeWidth="0.5" strokeDasharray="5 8" />
        ))}

        {/* Runway 16L */}
        <rect x="266" y="34" width="10" height="28" rx="1" fill="rgba(148,163,184,0.4)" />
        <text x="284" y="50" fontSize="7" fill="rgba(148,163,184,0.75)">RWY 16L</text>

        <path d={baseline} fill="none" stroke="rgba(248,113,113,0.35)" strokeWidth="1.4" strokeDasharray="5 4" />

        <AnimatePresence mode="wait">
          <motion.path
            key={`${scenarioId}-${profile}-${headwindKt}-${meterTightness}`}
            d={aiPath}
            fill="none"
            stroke="rgba(56,189,248,0.9)"
            strokeWidth="2.2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: 'easeInOut' }}
          />
        </AnimatePresence>

        {waypoints.map((wp) => (
          <g key={wp.name}>
            <circle cx={wp.x} cy={wp.y} r="2.2" fill="rgba(56,189,248,0.9)" />
            <text x={wp.x + 4} y={wp.y - 5} fontSize="6.5" fill="rgba(148,163,184,0.8)">
              {wp.name}
            </text>
          </g>
        ))}

        <g transform="translate(8,168)">
          <line x1="0" y1="0" x2="18" y2="0" stroke="rgba(56,189,248,0.9)" strokeWidth="2" />
          <text x="22" y="3" fontSize="7" fill="rgba(180,210,240,0.8)">
            {profile === 'cdo' ? 'CDO profile' : profile === 'stepped' ? 'Stepped vectors' : 'Hybrid STAR'}
          </text>
          <line x1="110" y1="0" x2="128" y2="0" stroke="rgba(248,113,113,0.45)" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="132" y="3" fontSize="7" fill="rgba(180,210,240,0.55)">Baseline vectors</text>
        </g>
      </svg>
    </div>
  );
}

export default function FlightPathOptimizer() {
  const [scenarioId, setScenarioId] = useState('vmc');
  const [profile, setProfile] = useState('balanced');
  const [headwindKt, setHeadwindKt] = useState(14);
  const [meterTightness, setMeterTightness] = useState(35);
  const [costIndex, setCostIndex] = useState(35);

  const analytics = useMemo(
    () => buildAnalytics({ scenarioId, profile, headwindKt, meterTightness, costIndex }),
    [scenarioId, profile, headwindKt, meterTightness, costIndex],
  );

  const fuelSavedLb = Math.max(0, analytics.baselineFuelLb - analytics.aiFuelLb);
  const timeSavedMin = analytics.baselineMin - analytics.aiMin;

  return (
    <section id="lab-flight-path" className="simulator-panel space-y-5 rounded-3xl p-6 md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-whiteHull md:text-3xl">
            Arrival Path Optimization Lab
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">
            Model a Seattle (KSEA) RNAV STAR into ILS 16L. Compare continuous descent (CDO) against
            stepped ATC vectors under time-based metering and headwind.
          </p>
        </div>
        <div className="rounded-xl border border-sky-500/30 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
          <span className="font-semibold text-sky-400">Planner confidence:</span> {analytics.confidence}%
        </div>
      </div>

      <div className="glass-card flex flex-wrap items-center gap-2 rounded-2xl p-3 text-xs text-slate-200">
        <span className="font-semibold uppercase tracking-wide text-sky-400">Traffic picture</span>
        {Object.entries(SCENARIOS).map(([id, sc]) => (
          <button
            key={id}
            type="button"
            onClick={() => setScenarioId(id)}
            className={`rounded-full px-3 py-1.5 transition ${
              scenarioId === id ? 'bg-sky-400 text-slate-950' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            {sc.name}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="glass-card rounded-2xl p-3 text-xs text-slate-300">
          Descent strategy
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-slate-100"
          >
            <option value="cdo">Continuous Descent (CDO)</option>
            <option value="balanced">Hybrid STAR + small vectors</option>
            <option value="stepped">Stepped altitude holds</option>
          </select>
        </label>
        <label className="glass-card rounded-2xl p-3 text-xs text-slate-300">
          Headwind: <span className="text-sky-400">{headwindKt} kt</span>
          <input type="range" min="0" max="40" value={headwindKt}
            onChange={(e) => setHeadwindKt(Number(e.target.value))} className="mt-2 w-full accent-sky-400" />
        </label>
        <label className="glass-card rounded-2xl p-3 text-xs text-slate-300">
          TBFM metering: <span className="text-sky-400">{meterTightness}%</span>
          <input type="range" min="0" max="95" value={meterTightness}
            onChange={(e) => setMeterTightness(Number(e.target.value))} className="mt-2 w-full accent-sky-400" />
        </label>
        <label className="glass-card rounded-2xl p-3 text-xs text-slate-300">
          Cost index: <span className="text-sky-400">{costIndex}</span>
          <input type="range" min="0" max="100" value={costIndex}
            onChange={(e) => setCostIndex(Number(e.target.value))} className="mt-2 w-full accent-sky-400" />
          <span className="mt-1 block text-[10px] text-slate-500">GS ≈ {analytics.gsKt} kt</span>
        </label>
      </div>

      <ApproachViz
        scenarioId={scenarioId}
        profile={profile}
        headwindKt={headwindKt}
        meterTightness={meterTightness}
      />

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: 'Optimized burn', value: `${analytics.aiFuelLb.toFixed(0)} lb`, color: 'text-sky-400' },
          { label: 'Baseline burn', value: `${analytics.baselineFuelLb.toFixed(0)} lb`, color: 'text-orange-400' },
          { label: 'Time vs vectors', value: `${timeSavedMin >= 0 ? '−' : '+'}${Math.abs(timeSavedMin).toFixed(1)} min`, color: timeSavedMin >= 0 ? 'text-sky-400' : 'text-orange-400' },
          { label: 'Track miles', value: `${analytics.trackNm.toFixed(1)} / ${analytics.baselineTrack.toFixed(1)} NM`, color: 'text-sky-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="metric-card rounded-2xl p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
            <p className={`text-lg font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-card rounded-2xl p-4 text-sm text-slate-200">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">Trade-offs</p>
          <p className="mt-2">
            Fuel saved:{' '}
            <span className="font-semibold text-sky-400">{fuelSavedLb.toFixed(0)} lb</span>
            {' · '}
            CO₂ avoided:{' '}
            <span className="font-semibold text-sky-400">{(analytics.co2Kg / 1000).toFixed(2)} t</span>
          </p>
          <p className="mt-2">
            Separation pressure index:{' '}
            <span className={`font-semibold ${analytics.sepRisk > 45 ? 'text-orange-400' : 'text-sky-400'}`}>
              {analytics.sepRisk.toFixed(0)}
            </span>
            <span className="text-xs text-slate-500"> (higher when CDO is forced through tight metering)</span>
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-xs leading-relaxed text-slate-400">
          CDO cuts level segments and idle thrust time; TBFM may still require path stretch upstream
          of CHINS so Scheduled Time of Arrival (STA) slots remain protected. Cost Index scales the
          preferred Mach/CAS schedule the FMS uses for that STAR.
        </div>
      </div>
    </section>
  );
}
