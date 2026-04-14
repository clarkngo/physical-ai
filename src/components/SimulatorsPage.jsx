import { motion } from 'framer-motion';
import MaritimeSimulator from './MaritimeSimulator';
import SonarInterpretationSimulator from './SonarInterpretationSimulator';
import CollisionAvoidanceSimulator from './CollisionAvoidanceSimulator';

// ── Neural-network / sensor-fusion visualisation ──────────────────────────
//
//  Layers: [Sensor Inputs] → [Feature Extraction] → [Decision] → [Output]
//  Animated "data pulse" dots travel along each connection edge.

const INPUT_NODES = [
  { id: 'gps',     label: 'GPS',     y: 34,  pulseDelay: 0.0 },
  { id: 'sonar',   label: 'Sonar',   y: 70,  pulseDelay: 0.6 },
  { id: 'ais',     label: 'AIS',     y: 106, pulseDelay: 1.1 },
  { id: 'weather', label: 'Weather', y: 142, pulseDelay: 1.7 },
];

const HIDDEN_NODES = [
  { id: 'pattern', label: 'Pattern', y: 52,  pulseDelay: 0.3 },
  { id: 'risk',    label: 'Risk',    y: 88,  pulseDelay: 0.9 },
  { id: 'route',   label: 'Route',   y: 124, pulseDelay: 1.5 },
];

const OUTPUT_NODE = { id: 'maneuver', label: 'Maneuver\nCmd', y: 88 };

// Column x-coordinates in the 460×180 viewBox
const COL = { input: 52, hidden: 200, output: 348, label_in: 4, label_out: 400 };

// Build connection list with a stagger delay per edge
function buildEdges() {
  const edges = [];
  let delay = 0;
  INPUT_NODES.forEach((inp) => {
    HIDDEN_NODES.forEach((hid) => {
      edges.push({ x1: COL.input, y1: inp.y, x2: COL.hidden, y2: hid.y, delay: delay % 2.4 });
      delay += 0.18;
    });
  });
  HIDDEN_NODES.forEach((hid) => {
    edges.push({ x1: COL.hidden, y1: hid.y, x2: COL.output, y2: OUTPUT_NODE.y, delay: delay % 2.4 });
    delay += 0.28;
  });
  return edges;
}

const EDGES = buildEdges();

function NeuralNetViz() {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-pacificCyan/15 bg-slate-950/60 px-2 py-3">
      <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-widest text-pacificCyan">
        Physical AI · Sensor Fusion Pipeline
      </p>
      <svg viewBox="0 0 460 178" className="w-full" style={{ maxHeight: 160 }} aria-hidden="true">

        {/* ── Edges (static faint) ── */}
        {EDGES.map((e, i) => (
          <line
            key={`edge-${i}`}
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke="rgba(0,163,224,0.12)"
            strokeWidth="0.7"
          />
        ))}

        {/* ── Animated data pulses travelling along each edge ── */}
        {EDGES.map((e, i) => {
          const dx = e.x2 - e.x1;
          const dy = e.y2 - e.y1;
          return (
            <motion.circle
              key={`pulse-${i}`}
              r={2.2}
              fill="rgba(0,163,224,0.85)"
              initial={{ cx: e.x1, cy: e.y1, opacity: 0 }}
              animate={{
                cx:      [e.x1, e.x1 + dx * 0.5, e.x2],
                cy:      [e.y1, e.y1 + dy * 0.5, e.y2],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.8,
                delay: e.delay,
                repeat: Infinity,
                repeatDelay: 0.6,
                ease: 'easeInOut',
              }}
            />
          );
        })}

        {/* ── Input nodes ── */}
        {INPUT_NODES.map((n) => (
          <g key={n.id}>
            <motion.circle
              cx={COL.input} cy={n.y} r={8}
              fill="rgba(0,45,98,0.9)"
              stroke="rgba(0,163,224,0.55)"
              strokeWidth="1"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: n.pulseDelay }}
            />
            <text x={COL.label_in} y={n.y + 3.5} fontSize="7.5" fill="rgba(148,163,184,0.85)" textAnchor="start">
              {n.label}
            </text>
          </g>
        ))}

        {/* ── Hidden nodes ── */}
        {HIDDEN_NODES.map((n) => (
          <g key={n.id}>
            <motion.circle
              cx={COL.hidden} cy={n.y} r={10}
              fill="rgba(0,45,98,0.9)"
              stroke="rgba(0,163,224,0.75)"
              strokeWidth="1.2"
              animate={{ opacity: [0.6, 1, 0.6], r: [10, 11.5, 10] }}
              transition={{ duration: 2.8, repeat: Infinity, delay: n.pulseDelay }}
            />
            <text x={COL.hidden} y={n.y + 3} fontSize="7" fill="rgba(200,220,240,0.9)" textAnchor="middle">
              {n.label}
            </text>
          </g>
        ))}

        {/* ── Output node ── */}
        <g>
          <motion.circle
            cx={COL.output} cy={OUTPUT_NODE.y} r={13}
            fill="rgba(0,45,98,0.95)"
            stroke="rgba(0,163,224,1)"
            strokeWidth="1.5"
            animate={{ opacity: [0.75, 1, 0.75], r: [13, 14.5, 13] }}
            transition={{ duration: 2.0, repeat: Infinity }}
          />
          {/* Outer glow ring */}
          <motion.circle
            cx={COL.output} cy={OUTPUT_NODE.y}
            fill="none"
            stroke="rgba(0,163,224,0.3)"
            strokeWidth="1"
            animate={{ r: [16, 22, 16], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.0, repeat: Infinity }}
          />
          <text x={COL.output} y={OUTPUT_NODE.y + 3} fontSize="7" fill="rgba(0,163,224,1)" textAnchor="middle">
            Cmd
          </text>
        </g>

        {/* ── Output label ── */}
        <text x={COL.label_out} y={OUTPUT_NODE.y + 3.5} fontSize="7.5" fill="rgba(148,163,184,0.85)" textAnchor="start">
          Maneuver
        </text>

        {/* ── Layer labels ── */}
        {[
          { x: COL.input,  label: 'Sensor Inputs' },
          { x: COL.hidden, label: 'Feature Layer' },
          { x: COL.output, label: 'Decision Output' },
        ].map(({ x, label }) => (
          <text key={label} x={x} y={168} fontSize="7" fill="rgba(0,163,224,0.5)" textAnchor="middle">
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Lab summary cards ─────────────────────────────────────────────────────

const LAB_CARDS = [
  {
    num: '01',
    title: 'Route Optimization Lab',
    desc: 'Compare baseline and AI-optimized routing with live fuel and schedule metrics.',
    icon: '🧭',
  },
  {
    num: '02',
    title: 'Sonar Interpretation Lab',
    desc: 'Observe noisy signals on a live radar and tune classification confidence thresholds.',
    icon: '📡',
  },
  {
    num: '03',
    title: 'Collision Avoidance Lab',
    desc: "Watch the AI re-route an own ship in a bird's-eye view to maintain a safe CPA.",
    icon: '⚠️',
  },
];

const cardVariants = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ── Page ──────────────────────────────────────────────────────────────────

export default function SimulatorsPage() {
  return (
    <section className="space-y-8 pb-8">

      {/* Header panel */}
      <div className="simulator-panel relative overflow-hidden rounded-3xl p-7">
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-pacificCyan/20 blur-3xl" />

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left — copy */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pacificCyan">
              Physical AI · Simulation Studio
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-whiteHull md:text-4xl">
              Maritime AI Labs
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Three interactive labs examine how AI agents sense, reason, and act in real
              maritime conditions — from fuel-optimal routing to autonomous collision avoidance.
            </p>
          </div>

          {/* Right — neural net viz */}
          <NeuralNetViz />
        </div>
      </div>

      {/* Lab summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {LAB_CARDS.map((card, i) => (
          <motion.article
            key={card.num}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="glass-card rounded-2xl p-5"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-lg">
                {card.icon}
              </span>
              <span className="text-xs font-bold tracking-widest text-pacificCyan">
                LAB {card.num}
              </span>
            </div>
            <h2 className="text-base font-semibold text-pacificCyan">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{card.desc}</p>
          </motion.article>
        ))}
      </div>

      <MaritimeSimulator />
      <SonarInterpretationSimulator />
      <CollisionAvoidanceSimulator />
    </section>
  );
}
