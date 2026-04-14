import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const scenarios = [
  { id: 'harbor-crossing',  name: 'Harbor Crossing',    traffic: 0.72, visibility: 0.68, compliance: 0.91 },
  { id: 'night-ferry',      name: 'Night Ferry Transit', traffic: 0.58, visibility: 0.44, compliance: 0.86 },
  { id: 'channel-overtake', name: 'Channel Overtake',    traffic: 0.79, visibility: 0.60, compliance: 0.83 },
];

// ── Per-scenario geometry ─────────────────────────────────────────────────
//
//  All coordinates live in a 300×200 canvas (viewBox "0 0 300 200").
//  Own Ship always travels left → right along y ≈ 100.
//  Target path varies by encounter type.
//
const SCENARIO_GEO = {
  'harbor-crossing': {
    // Target crosses diagonally from top-right — classic crossing situation
    targetWaypoints: [[260, 20], [210, 65], [155, 100], [100, 138], [50, 180]],
    ownStart: [10, 100],
    label: 'Crossing — give way to starboard vessel',
  },
  'night-ferry': {
    // Target on near-reciprocal course, head-on from the right
    targetWaypoints: [[285, 88], [220, 92], [155, 97], [90, 101], [20, 105]],
    ownStart: [10, 100],
    label: 'Head-on — both vessels alter to starboard',
  },
  'channel-overtake': {
    // Target overtaking from astern-starboard, both going right
    targetWaypoints: [[15, 135], [80, 125], [155, 115], [230, 107], [290, 102]],
    ownStart: [10, 100],
    label: 'Overtaking — stand-on vessel holds course',
  },
};

// ── Encounter visualisation ───────────────────────────────────────────────

function EncounterViz({ policyMode, scenario }) {
  const geo = SCENARIO_GEO[scenario.id];

  // devY: how far Own Ship curves away — depends on policy AND scenario risk
  const baseDevY   = policyMode === 'safety' ? 52 : policyMode === 'throughput' ? 16 : 32;
  const riskBonus  = Math.round(scenario.traffic * 12 + (1 - scenario.visibility) * 10);
  const devY       = baseDevY + riskBonus;

  // Own Ship AI waypoints — curves downward (+Y in SVG) to avoid
  const [sx, sy] = geo.ownStart;
  const midX     = 155;
  const endX     = 295;
  const ownAI    = [
    [sx,        sy],
    [sx + 60,   sy + devY * 0.5],
    [midX,      sy + devY],
    [midX + 70, sy + devY * 0.55],
    [endX,      sy + devY * 0.15],
  ];

  // Baseline (no AI) — straight line
  const ownBaseline = `M${sx},${sy} L${endX},${sy}`;

  // Path strings
  const ownAIPath  = ownAI.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const targetPath = geo.targetWaypoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');

  // CPA bubble: midpoint of avoidance arc
  const cpaX = midX;
  const cpaY = sy + devY;
  const cpaR = 14 + devY * 0.28;

  // Animated waypoints for each vessel (Framer Motion array keyframes)
  const ownXs     = ownAI.map(([x]) => x);
  const ownYs     = ownAI.map(([, y]) => y);
  const targetXs  = geo.targetWaypoints.map(([x]) => x);
  const targetYs  = geo.targetWaypoints.map(([, y]) => y);
  const times     = [0, 0.25, 0.5, 0.75, 1];

  // Visibility affects scene brightness
  const fogAlpha  = 1 - scenario.visibility * 0.55;

  return (
    <div className="overflow-hidden rounded-2xl border border-pacificCyan/25 bg-slate-950/90">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-pacificCyan">
          Bird's-Eye Encounter View
        </p>
        <p className="text-xs text-slate-500">{geo.label}</p>
      </div>

      {/* Zoomed-in viewBox centred on the action */}
      <svg viewBox="0 0 300 200" className="w-full" style={{ maxHeight: 240 }}>

        {/* Ocean background */}
        <rect width="300" height="200" fill="rgba(0,6,18,0.98)" />

        {/* Low-visibility fog overlay */}
        {scenario.visibility < 0.55 && (
          <rect width="300" height="200" fill={`rgba(20,30,50,${fogAlpha * 0.45})`} />
        )}

        {/* Subtle grid */}
        {[50, 100, 150].map((y) => (
          <line key={y} x1="0" y1={y} x2="300" y2={y}
            stroke="rgba(0,163,224,0.05)" strokeWidth="0.5" strokeDasharray="5 8" />
        ))}

        {/* Baseline (no AI) — dashed orange */}
        <path d={ownBaseline} fill="none"
          stroke="rgba(248,113,113,0.30)" strokeWidth="1.2" strokeDasharray="5 5" />

        {/* Target vessel path — dashed red */}
        <path d={targetPath} fill="none"
          stroke="rgba(248,113,113,0.28)" strokeWidth="1.2" strokeDasharray="5 5" />

        {/* AI-optimised Own Ship path — animated draw-on */}
        <AnimatePresence mode="wait">
          <motion.path
            key={`${scenario.id}-${policyMode}`}
            d={ownAIPath}
            fill="none"
            stroke="rgba(0,163,224,0.85)"
            strokeWidth="2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
          />
        </AnimatePresence>

        {/* CPA safety bubble */}
        <AnimatePresence>
          <motion.circle
            key={`cpa-${scenario.id}-${policyMode}`}
            cx={cpaX} cy={cpaY}
            fill="rgba(0,163,224,0.07)"
            stroke="rgba(0,163,224,0.4)"
            strokeWidth="0.8"
            strokeDasharray="3 3"
            initial={{ r: 0, opacity: 0 }}
            animate={{ r: cpaR, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          />
        </AnimatePresence>

        {/* CPA label */}
        <motion.text
          key={`cpa-label-${scenario.id}-${policyMode}`}
          x={cpaX + 4} y={cpaY - cpaR - 4}
          fontSize="7" fill="rgba(0,163,224,0.65)"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
        >
          CPA zone
        </motion.text>

        {/* Target vessel — animated */}
        <motion.g
          animate={{ x: targetXs, y: targetYs }}
          transition={{ duration: 5, repeat: Infinity, repeatType: 'loop', ease: 'linear', times }}
        >
          <polygon points="0,-6 -4,4 4,4" fill="rgba(248,113,113,0.95)" />
          <circle r="1.5" fill="rgba(248,113,113,0.5)" cy="0" />
        </motion.g>

        {/* Own Ship — animated along AI path */}
        <motion.g
          key={`ship-${scenario.id}-${policyMode}`}
          animate={{ x: ownXs, y: ownYs }}
          transition={{ duration: 5, repeat: Infinity, repeatType: 'loop', ease: 'linear', times }}
        >
          <polygon points="0,-6 -4,4 4,4" fill="rgba(0,163,224,0.95)" />
          <circle r="1.5" fill="rgba(0,163,224,0.4)" cy="0" />
        </motion.g>

        {/* Legend */}
        <g transform="translate(8,190)">
          <polygon points="0,-5 -3,3 3,3" fill="rgba(0,163,224,0.9)" />
          <text x="6" y="3" fontSize="7" fill="rgba(180,210,240,0.8)">Own Ship (AI)</text>
          <polygon points="80,-5 77,3 83,3" fill="rgba(248,113,113,0.9)" />
          <text x="86" y="3" fontSize="7" fill="rgba(180,210,240,0.8)">Target Vessel</text>
          <line x1="165" y1="0" x2="183" y2="0"
            stroke="rgba(248,113,113,0.4)" strokeWidth="1.5" strokeDasharray="3 2" />
          <text x="186" y="3" fontSize="7" fill="rgba(180,210,240,0.55)">Baseline (no AI)</text>
        </g>
      </svg>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function CollisionAvoidanceSimulator() {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [policyMode, setPolicyMode] = useState('balanced');
  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];

  const metrics = useMemo(() => {
    const policyPenalty = policyMode === 'safety' ? -7 : policyMode === 'throughput' ? 5 : 0;
    const approachBonus = policyMode === 'safety' ? 0.18 : policyMode === 'throughput' ? -0.15 : 0;
    const closestPoint  = (1.8 - scenario.traffic * 0.9 + scenario.visibility * 0.4 + approachBonus).toFixed(2);
    const intervention  = Math.round((1 - scenario.compliance) * 100 + scenario.traffic * 12 - approachBonus * 30);
    const policyScore   = Math.round(scenario.compliance * 100 - (1 - scenario.visibility) * 8 + policyPenalty);
    return { closestPoint, intervention, policyScore };
  }, [scenario, policyMode]);

  return (
    <section className="simulator-panel space-y-5 rounded-3xl p-6">
      <div>
        <h2 className="text-2xl font-semibold text-whiteHull">Collision Avoidance Lab</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">
          Each scenario shows a different encounter type. Switch policy modes to see how the AI
          adjusts the own ship's avoidance manoeuvre in real time.
        </p>
      </div>

      {/* Scenario selector */}
      <div className="glass-card flex flex-wrap items-center gap-2 rounded-2xl p-3 text-xs text-slate-200">
        <span className="font-semibold text-pacificCyan">Scenario:</span>
        {scenarios.map(({ id, name }) => (
          <button
            key={id}
            type="button"
            onClick={() => setScenarioId(id)}
            className={`rounded-full px-3 py-1.5 transition ${
              scenarioId === id ? 'bg-pacificCyan text-slate-950' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Policy mode toggle */}
      <div className="glass-card flex flex-wrap items-center gap-2 rounded-2xl p-3 text-xs text-slate-200">
        <span className="font-semibold text-pacificCyan">Policy Mode:</span>
        {[
          ['safety',     'Safety Prioritized'],
          ['balanced',   'Balanced'],
          ['throughput', 'Throughput Prioritized'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPolicyMode(id)}
            className={`rounded-full px-3 py-1.5 transition ${
              policyMode === id ? 'bg-pacificCyan text-slate-950' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bird's-eye view */}
      <EncounterViz policyMode={policyMode} scenario={scenario} />

      {/* Metric cards */}
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: 'Closest Point of Approach', value: `${metrics.closestPoint} nm`, good: Number(metrics.closestPoint) >= 1.2 },
          { label: 'Policy Compliance',         value: `${metrics.policyScore}%`,    good: metrics.policyScore >= 85 },
          { label: 'Intervention Likelihood',   value: `${metrics.intervention}%`,   good: metrics.intervention <= 12 },
        ].map(({ label, value, good }) => (
          <motion.div key={label} layout className="metric-card rounded-2xl p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
            <motion.p
              key={value}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`mt-1 text-lg font-semibold ${good ? 'text-pacificCyan' : 'text-orange-400'}`}
            >
              {value}
            </motion.p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
