import { motion } from 'framer-motion';
import sonarSignals from '../data/sonarSignals.json';

const levels = [
  {
    id: 1,
    title: 'Level 1: The Blue Economy',
    icon: '🌊',
    text: 'Explore zero-waste maritime innovation using friendly concept cards inspired by Gunter Pauli.',
    accent: 'from-cyan-500/20 to-deepSea/40',
  },
  {
    id: 2,
    title: 'Level 2: Digital Twins',
    icon: '🛳️',
    text: 'A simplified ship simulation demonstrates route updates based on changing sea and traffic conditions.',
    accent: 'from-blue-500/20 to-deepSea/40',
  },
  {
    id: 3,
    title: 'Level 3: Physical Sensing',
    icon: '📡',
    text: 'Watch sonar pulses transform into a pseudo-3D mesh pattern using CSS + SVG animation.',
    accent: 'from-pacificCyan/20 to-deepSea/40',
  },
];

// ── Improved Sonar Mesh ───────────────────────────────────────────────────

function SonarMesh() {
  const W = 560;
  const H = 200;
  const padX = 50;
  const stepX = (W - padX * 2) / (sonarSignals.length - 1);

  const points = sonarSignals.map((s, i) => ({
    x: padX + i * stepX,
    y: H - 24 - s.strength * (H - 60),
    strength: s.strength,
    distance: s.distance,
  }));

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="overflow-hidden rounded-2xl border border-pacificCyan/20 bg-slate-900/70 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-pacificCyan">
        Live Sonar Feed — Puget Sound Transit
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full">
        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={frac}
            x1={padX - 8} y1={H - 24 - frac * (H - 60)}
            x2={W - padX + 8} y2={H - 24 - frac * (H - 60)}
            stroke="rgba(0,163,224,0.10)"
            strokeWidth="0.8"
            strokeDasharray="4 4"
          />
        ))}

        {/* Vertical drop lines */}
        {points.map((p, i) => (
          <motion.line
            key={i}
            x1={p.x} y1={H - 8}
            x2={p.x} y2={p.y}
            stroke="rgba(0,163,224,0.18)"
            strokeWidth="1"
            initial={{ scaleY: 0, originY: `${H - 8}px` }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeOut' }}
          />
        ))}

        {/* Connecting polyline */}
        <motion.polyline
          fill="none"
          stroke="rgba(0,163,224,0.65)"
          strokeWidth="2"
          strokeLinejoin="round"
          points={polylinePoints}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        />

        {/* Area fill */}
        <motion.polyline
          fill="rgba(0,163,224,0.07)"
          stroke="none"
          points={`${padX},${H - 8} ${polylinePoints} ${W - padX},${H - 8}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.3 }}
        />

        {/* Signal blobs */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            fill={p.strength > 0.6 ? 'rgba(0,163,224,0.85)' : 'rgba(0,163,224,0.45)'}
            initial={{ r: 0, opacity: 0 }}
            animate={{
              r: [4 + p.strength * 14, 6 + p.strength * 16, 4 + p.strength * 14],
              opacity: [0.55, 0.95, 0.55],
            }}
            transition={{
              duration: 2.8 + i * 0.25,
              delay: 0.4 + i * 0.12,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Distance labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={H - 2}
            textAnchor="middle"
            fontSize="9"
            fill="rgba(148,163,184,0.7)"
          >
            {p.distance} km
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Section variants ──────────────────────────────────────────────────────

const sectionVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14 } },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 28, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const titleVariants = {
  hidden:  { opacity: 0, x: -18 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6 } },
};

// ── Component ─────────────────────────────────────────────────────────────

export default function LearningPathway() {

  return (
    <section id="learning" className="space-y-6">
      <motion.h2
        variants={titleVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        className="text-3xl font-semibold text-whiteHull"
      >
        Learning Pathway
        <span className="ml-3 text-base font-normal text-pacificCyan">Non-Tech Track</span>
      </motion.h2>

      <motion.div
        className="grid gap-5 md:grid-cols-3"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
      >
        {levels.map((level) => (
          <motion.article
            key={level.id}
            variants={cardVariants}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className={`relative overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br ${level.accent} p-5 card-glow`}
          >
            {/* Subtle corner glow */}
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-pacificCyan/10 blur-2xl" />

            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 text-lg">
                {level.icon}
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest text-pacificCyan">
                Level {level.id}
              </span>
            </div>

            <h3 className="text-lg font-semibold leading-snug text-whiteHull">{level.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{level.text}</p>
          </motion.article>
        ))}
      </motion.div>

      <SonarMesh />
    </section>
  );
}
