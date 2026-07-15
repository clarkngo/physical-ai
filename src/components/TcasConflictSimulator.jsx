import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * TCAS II classroom model (qualitative).
 * Real TCAS issues TAs then RAs based on time-to-CPA (Tau) and altitude.
 * ALIM (altitude limit) grows with altitude band; coordinated RAs use
 * Mode S air-to-air for complementary senses (one climb / one descend).
 */

const SCENARIOS = [
  {
    id: 'converging-stars',
    name: 'Converging arrivals',
    altFt: 9000,
    closingKt: 420,
    dHFt: 200,
    rangeNm: 4.5,
    coordinated: true,
    label: 'Crossing STARs · same altitude band · coordinated RA',
  },
  {
    id: 'opposite-level',
    name: 'Opposite-direction level',
    altFt: 17000,
    closingKt: 880,
    dHFt: 100,
    rangeNm: 8.0,
    coordinated: true,
    label: 'Reciprocal tracks · FL170 · high closure rate',
  },
  {
    id: 'climb-through',
    name: 'Climb through level traffic',
    altFt: 6500,
    closingKt: 280,
    dHFt: 400,
    rangeNm: 3.2,
    coordinated: false,
    label: 'Departure climbing through arrival level · single RA',
  },
];

/** ALIM (ft) — simplified from TCAS II tables by altitude band */
function alimFt(altFt) {
  if (altFt < 5000) return 300;
  if (altFt < 10000) return 350;
  if (altFt < 20000) return 400;
  return 600;
}

function SenseViz({ scenario, sense }) {
  const climb = sense === 'climb' || sense === 'increase_climb';
  const ownY = climb ? 70 : 130;
  const intrY = climb ? 130 : 70;
  const ownEndY = climb ? 40 : 160;
  const intrEndY = scenario.coordinated ? (climb ? 160 : 40) : intrY;

  const ownPath = `M30,${ownY} L150,${(ownY + ownEndY) / 2} L280,${ownEndY}`;
  const intrPath = `M270,${intrY} L150,${(intrY + intrEndY) / 2} L40,${intrEndY}`;
  const noRaOwn = `M30,${ownY} L280,${ownY}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-500/25 bg-slate-950/90">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
          Vertical geometry · TCAS II
        </p>
        <p className="text-xs text-slate-500">{scenario.label}</p>
      </div>
      <svg viewBox="0 0 300 200" className="w-full" style={{ maxHeight: 240 }}>
        <rect width="300" height="200" fill="rgba(2,8,20,0.98)" />
        {/* Altitude bands */}
        {[50, 100, 150].map((y) => (
          <line key={y} x1="0" y1={y} x2="300" y2={y}
            stroke="rgba(56,189,248,0.06)" strokeWidth="0.5" strokeDasharray="4 6" />
        ))}
        <text x="6" y="14" fontSize="7" fill="rgba(148,163,184,0.5)">↑ altitude</text>

        <path d={noRaOwn} fill="none" stroke="rgba(248,113,113,0.3)" strokeWidth="1.2" strokeDasharray="5 4" />

        <AnimatePresence mode="wait">
          <motion.path
            key={`own-${sense}-${scenario.id}`}
            d={ownPath}
            fill="none"
            stroke="rgba(56,189,248,0.9)"
            strokeWidth="2.2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8 }}
          />
        </AnimatePresence>
        <path d={intrPath} fill="none" stroke="rgba(248,113,113,0.55)" strokeWidth="1.6" strokeDasharray="4 3" />

        {/* ALIM band around CPA */}
        <motion.rect
          key={`alim-${sense}-${scenario.id}`}
          x="130"
          y={100 - 20}
          width="40"
          height="40"
          fill="rgba(56,189,248,0.06)"
          stroke="rgba(56,189,248,0.35)"
          strokeWidth="0.8"
          strokeDasharray="3 2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
        <text x="150" y="88" fontSize="6.5" fill="rgba(56,189,248,0.65)" textAnchor="middle">
          ALIM {alimFt(scenario.altFt)} ft
        </text>

        <motion.g
          animate={{ x: [30, 150, 280], y: [ownY, (ownY + ownEndY) / 2, ownEndY] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'linear', times: [0, 0.5, 1] }}
        >
          <polygon points="0,-5 -5,4 5,4" fill="rgba(56,189,248,0.95)" />
        </motion.g>
        <motion.g
          animate={{ x: [270, 150, 40], y: [intrY, (intrY + intrEndY) / 2, intrEndY] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'linear', times: [0, 0.5, 1] }}
        >
          <polygon points="0,-5 -5,4 5,4" fill="rgba(248,113,113,0.95)" />
        </motion.g>

        <g transform="translate(8,188)">
          <polygon points="0,-4 -3,3 3,3" fill="rgba(56,189,248,0.9)" />
          <text x="6" y="3" fontSize="7" fill="rgba(180,210,240,0.8)">Ownship RA</text>
          <polygon points="80,-4 77,3 83,3" fill="rgba(248,113,113,0.9)" />
          <text x="86" y="3" fontSize="7" fill="rgba(180,210,240,0.8)">
            Intruder{scenario.coordinated ? ' (coord.)' : ''}
          </text>
        </g>
      </svg>
    </div>
  );
}

export default function TcasConflictSimulator() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [sense, setSense] = useState('climb');
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];

  const metrics = useMemo(() => {
    // Tau ≈ range / closing speed (hours → seconds)
    const tauSec = (scenario.rangeNm / scenario.closingKt) * 3600;
    const alim = alimFt(scenario.altFt);

    // Predicted vertical miss if no RA (current ΔH)
    const noRaMiss = Math.abs(scenario.dHFt);

    // With RA: climb/descend rates ~1500–2500 fpm simplified by sense
    const fpm =
      sense === 'increase_climb' || sense === 'increase_descend' ? 2500 :
      sense === 'climb' || sense === 'descend' ? 1500 : 0;
    const senseSign = sense.includes('climb') ? 1 : -1;
    const raDelta = (fpm * (tauSec / 60)) * senseSign;
    // Intruder coordinated opposite sense adds separation
    const intruderDelta = scenario.coordinated ? -raDelta * 0.7 : 0;
    const predictedMiss = Math.abs(noRaMiss + raDelta - intruderDelta);

    const taThreshold = 35; // sec — simplified TA tau
    const raThreshold = 25;
    const advisory =
      tauSec <= raThreshold ? 'RA' :
      tauSec <= taThreshold ? 'TA' :
      'Traffic';

    const protectsAlim = predictedMiss >= alim;
    const aural =
      sense === 'climb' ? 'CLIMB, CLIMB' :
      sense === 'descend' ? 'DESCEND, DESCEND' :
      sense === 'increase_climb' ? 'INCREASE CLIMB' :
      'INCREASE DESCENT';

    return {
      tauSec: tauSec.toFixed(0),
      alim,
      noRaMiss,
      predictedMiss: Math.round(predictedMiss),
      advisory,
      protectsAlim,
      aural,
      closingKt: scenario.closingKt,
      altFt: scenario.altFt,
    };
  }, [scenario, sense]);

  return (
    <section id="lab-tcas" className="simulator-panel space-y-5 rounded-3xl p-6">
      <div>
        <h2 className="text-2xl font-semibold text-whiteHull">TCAS Conflict Lab</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">
          Traffic Collision Avoidance System II issues Traffic Advisories (TA) then Resolution
          Advisories (RA) from time-to-CPA (Tau). This lab shows whether a selected RA sense clears
          the altitude limit (ALIM) before Tau expires.
        </p>
      </div>

      <div className="glass-card flex flex-wrap items-center gap-2 rounded-2xl p-3 text-xs text-slate-200">
        <span className="font-semibold text-sky-400">Encounter:</span>
        {SCENARIOS.map(({ id, name }) => (
          <button
            key={id}
            type="button"
            onClick={() => setScenarioId(id)}
            className={`rounded-full px-3 py-1.5 transition ${
              scenarioId === id ? 'bg-sky-400 text-slate-950' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="glass-card flex flex-wrap items-center gap-2 rounded-2xl p-3 text-xs text-slate-200">
        <span className="font-semibold text-sky-400">Ownship RA sense:</span>
        {[
          ['climb', 'Climb'],
          ['increase_climb', 'Increase climb'],
          ['descend', 'Descend'],
          ['increase_descend', 'Increase descent'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSense(id)}
            className={`rounded-full px-3 py-1.5 transition ${
              sense === id ? 'bg-sky-400 text-slate-950' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <SenseViz scenario={scenario} sense={sense} />

      <div className="glass-card rounded-2xl px-4 py-3 font-mono text-sm tracking-wide text-amber-300">
        Aural: {metrics.aural}
        <span className="ml-3 text-xs text-slate-500">
          advisory state · {metrics.advisory}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: 'Tau (time to CPA)', value: `${metrics.tauSec} s`, good: Number(metrics.tauSec) > 20 },
          { label: 'ALIM at altitude', value: `${metrics.alim} ft`, good: true },
          { label: 'Predicted miss w/ RA', value: `${metrics.predictedMiss} ft`, good: metrics.protectsAlim },
          { label: 'Closure / altitude', value: `${metrics.closingKt} kt · ${metrics.altFt.toLocaleString()} ft`, good: true },
        ].map(({ label, value, good }) => (
          <motion.div key={label} layout className="metric-card rounded-2xl p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
            <motion.p
              key={value}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-1 text-lg font-semibold ${good ? 'text-sky-400' : 'text-orange-400'}`}
            >
              {value}
            </motion.p>
          </motion.div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        Simplified teaching model — real TCAS II also uses sensitivity levels (SL), protected
        volumes, and inhibits (e.g. inhibited climb RAs near ground). Coordinated encounters
        exchange Mode S RA intentions so both aircraft do not climb into each other.
      </p>
    </section>
  );
}
