import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import FlightPathOptimizer from '../components/FlightPathOptimizer';
import AdsbIntegritySimulator from '../components/AdsbIntegritySimulator';
import TcasConflictSimulator from '../components/TcasConflictSimulator';
import AviationSectionNav from '../components/AviationSectionNav';

const LAB_IDS = {
  'flight-path': 'lab-flight-path',
  adsb: 'lab-adsb',
  tcas: 'lab-tcas',
};

const AVIATION_LABS = [
  {
    num: '01',
    title: 'Arrival Path Optimization',
    desc: 'CDO vs stepped vectors on KSEA HAWKZ4 → ILS 16L under TBFM metering and headwind.',
    icon: '🧭',
    lab: 'flight-path',
  },
  {
    num: '02',
    title: 'ADS-B Integrity',
    desc: 'Cross-check DF=17 NIC/NACp claims against MLAT and primary radar for ghost tracks.',
    icon: '📡',
    lab: 'adsb',
  },
  {
    num: '03',
    title: 'TCAS Conflict',
    desc: 'Select an RA sense and test whether predicted vertical miss clears ALIM before Tau.',
    icon: '⚠️',
    lab: 'tcas',
  },
];

const INPUT_NODES = [
  { id: 'adsb', label: 'ADS-B', y: 34, pulseDelay: 0.0 },
  { id: 'radar', label: 'Radar', y: 70, pulseDelay: 0.6 },
  { id: 'fms', label: 'FMS', y: 106, pulseDelay: 1.1 },
  { id: 'met', label: 'METAR', y: 142, pulseDelay: 1.7 },
];

const HIDDEN_NODES = [
  { id: 'integrity', label: 'Integrity', y: 52, pulseDelay: 0.3 },
  { id: 'conflict', label: 'Conflict', y: 88, pulseDelay: 0.9 },
  { id: 'path', label: 'Path', y: 124, pulseDelay: 1.5 },
];

const OUTPUT_NODE = { id: 'clearance', label: 'Clearance\nCmd', y: 88 };
const COL = { input: 52, hidden: 200, output: 348, label_in: 4, label_out: 400 };

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

function SensorFusionViz() {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-sky-500/15 bg-slate-950/60 px-2 py-3">
      <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-widest text-sky-400">
        Aviation CPS · Sensor Fusion Pipeline
      </p>
      <svg viewBox="0 0 460 178" className="w-full" style={{ maxHeight: 160 }} aria-hidden="true">
        {EDGES.map((e, i) => (
          <line key={`edge-${i}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke="rgba(56,189,248,0.12)" strokeWidth="0.7" />
        ))}
        {EDGES.map((e, i) => {
          const dx = e.x2 - e.x1;
          const dy = e.y2 - e.y1;
          return (
            <motion.circle
              key={`pulse-${i}`}
              r={2.2}
              fill="rgba(56,189,248,0.85)"
              initial={{ cx: e.x1, cy: e.y1, opacity: 0 }}
              animate={{
                cx: [e.x1, e.x1 + dx * 0.5, e.x2],
                cy: [e.y1, e.y1 + dy * 0.5, e.y2],
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
        {INPUT_NODES.map((n) => (
          <g key={n.id}>
            <motion.circle
              cx={COL.input}
              cy={n.y}
              r={8}
              fill="rgba(8,47,73,0.9)"
              stroke="rgba(56,189,248,0.55)"
              strokeWidth="1"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: n.pulseDelay }}
            />
            <text x={COL.label_in} y={n.y + 3.5} fontSize="7.5" fill="rgba(148,163,184,0.85)" textAnchor="start">
              {n.label}
            </text>
          </g>
        ))}
        {HIDDEN_NODES.map((n) => (
          <g key={n.id}>
            <motion.circle
              cx={COL.hidden}
              cy={n.y}
              r={10}
              fill="rgba(8,47,73,0.9)"
              stroke="rgba(56,189,248,0.75)"
              strokeWidth="1.2"
              animate={{ opacity: [0.6, 1, 0.6], r: [10, 11.5, 10] }}
              transition={{ duration: 2.8, repeat: Infinity, delay: n.pulseDelay }}
            />
            <text x={COL.hidden} y={n.y + 3} fontSize="7" fill="rgba(200,220,240,0.9)" textAnchor="middle">
              {n.label}
            </text>
          </g>
        ))}
        <g>
          <motion.circle
            cx={COL.output}
            cy={OUTPUT_NODE.y}
            r={13}
            fill="rgba(8,47,73,0.95)"
            stroke="rgba(56,189,248,1)"
            strokeWidth="1.5"
            animate={{ opacity: [0.75, 1, 0.75], r: [13, 14.5, 13] }}
            transition={{ duration: 2.0, repeat: Infinity }}
          />
          <text x={COL.output} y={OUTPUT_NODE.y + 3} fontSize="7" fill="rgba(56,189,248,1)" textAnchor="middle">
            Cmd
          </text>
        </g>
        <text x={COL.label_out} y={OUTPUT_NODE.y + 3.5} fontSize="7.5" fill="rgba(148,163,184,0.85)" textAnchor="start">
          Clearance
        </text>
      </svg>
    </div>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function AviationSimulatorsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const lab = searchParams.get('lab');
    const elId = LAB_IDS[lab];
    if (!elId) return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const jumpToLab = (lab) => {
    setSearchParams({ lab });
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <AviationSectionNav />

      <div className="simulator-panel relative overflow-hidden rounded-3xl p-7">
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
              Aviation Domain
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-whiteHull">
              Aviation AI Labs
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Teaching labs built on real procedure and avionics concepts: KSEA RNAV STARs and CDO,
              DF=17 ADS-B fused with MLAT/primary, and TCAS II Tau / ALIM resolution advisories.
            </p>
          </div>
          <SensorFusionViz />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {AVIATION_LABS.map((card, i) => (
          <motion.button
            key={card.num}
            type="button"
            custom={i}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            onClick={() => jumpToLab(card.lab)}
            className="glass-card rounded-2xl p-5 text-left"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-lg">
                {card.icon}
              </span>
              <span className="text-xs font-bold tracking-widest text-sky-400">LAB {card.num}</span>
            </div>
            <h2 className="text-base font-semibold text-sky-400">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{card.desc}</p>
          </motion.button>
        ))}
      </div>

      <FlightPathOptimizer />
      <AdsbIntegritySimulator />
      <TcasConflictSimulator />
    </div>
  );
}
