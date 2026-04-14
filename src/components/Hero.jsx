import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const STATS = [
  { label: 'Vessels Tracked', value: '2,847' },
  { label: 'Routes Optimized', value: '12,491' },
  { label: 'CO₂ Avoided', value: '8,320 t' },
  { label: 'Hazards Flagged', value: '1,204' },
];

// Deterministic particle positions — no random so they stay stable on re-renders
const PARTICLES = [
  { x: 8,  y: 15, s: 2.2, d: 0.0, dur: 3.2 },
  { x: 18, y: 60, s: 1.5, d: 0.5, dur: 2.7 },
  { x: 32, y: 30, s: 1.8, d: 1.1, dur: 3.8 },
  { x: 48, y: 72, s: 2.5, d: 0.3, dur: 2.5 },
  { x: 55, y: 18, s: 1.4, d: 1.6, dur: 3.0 },
  { x: 65, y: 55, s: 2.0, d: 0.8, dur: 2.9 },
  { x: 72, y: 85, s: 1.6, d: 0.2, dur: 3.5 },
  { x: 80, y: 40, s: 1.9, d: 1.3, dur: 2.8 },
  { x: 88, y: 22, s: 2.3, d: 0.9, dur: 3.1 },
  { x: 93, y: 68, s: 1.5, d: 0.4, dur: 2.6 },
];

// Blips that appear on the sonar after a ring passes through them
const BLIPS = [
  { cx: 680, cy: 55,  delay: 0.8 },
  { cx: 710, cy: 115, delay: 1.5 },
  { cx: 555, cy: 42,  delay: 2.2 },
  { cx: 735, cy: 80,  delay: 0.4 },
  { cx: 600, cy: 135, delay: 2.9 },
];

function SonarBackground() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 800 360"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* Static faint range rings centred upper-right */}
      {[55, 115, 175, 235].map((r) => (
        <circle
          key={r}
          cx={680} cy={80}
          r={r}
          fill="none"
          stroke="rgba(0,163,224,0.06)"
          strokeWidth="1"
        />
      ))}

      {/* Radial lines of the sonar grid */}
      {[0, 45, 90, 135].map((angleDeg) => {
        const rad = (angleDeg * Math.PI) / 180;
        return (
          <line
            key={angleDeg}
            x1={680 + 240 * Math.cos(rad)}
            y1={80  - 240 * Math.sin(rad)}
            x2={680 - 240 * Math.cos(rad)}
            y2={80  + 240 * Math.sin(rad)}
            stroke="rgba(0,163,224,0.05)"
            strokeWidth="0.8"
          />
        );
      })}

      {/* Animated sweep line */}
      <g style={{ transformOrigin: '680px 80px' }}>
        <motion.g
          style={{ transformOrigin: '680px 80px' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
          <line
            x1={680} y1={80}
            x2={680} y2={-165}
            stroke="rgba(0,163,224,0.75)"
            strokeWidth="1.5"
          />
          {/* Sweep trail */}
          <line x1={680} y1={80} x2={655} y2={-164} stroke="rgba(0,163,224,0.3)"  strokeWidth="1" />
          <line x1={680} y1={80} x2={628} y2={-158} stroke="rgba(0,163,224,0.12)" strokeWidth="0.8" />
        </motion.g>
      </g>

      {/* Expanding pulse rings */}
      {[0, 1, 2, 3].map((i) => (
        <motion.circle
          key={i}
          cx={680} cy={80}
          fill="none"
          stroke="rgba(0,163,224,0.5)"
          strokeWidth="1.5"
          initial={{ r: 6, opacity: 0.7 }}
          animate={{ r: 248, opacity: 0 }}
          transition={{ duration: 3.6, delay: i * 0.9, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}

      {/* Detection blips */}
      {BLIPS.map(({ cx, cy, delay }, i) => (
        <motion.circle
          key={i}
          cx={cx} cy={cy}
          fill="rgba(0,163,224,0.95)"
          initial={{ r: 0, opacity: 0 }}
          animate={{ r: [0, 3.5, 2.5, 0], opacity: [0, 1, 0.7, 0] }}
          transition={{ duration: 2.6, delay, repeat: Infinity, repeatDelay: 1.0 }}
        />
      ))}
    </svg>
  );
}

function FloatingParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-pacificCyan"
          style={{
            left: `${p.x}%`,
            top:  `${p.y}%`,
            width:  p.s * 2,
            height: p.s * 2,
            opacity: 0.55,
          }}
          animate={{ y: [0, -10, 0], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: p.dur, delay: p.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function OceanWave() {
  return (
    <div className="pointer-events-none absolute bottom-0 left-0 w-full overflow-hidden" aria-hidden="true">
      <svg viewBox="0 0 1200 60" preserveAspectRatio="none" className="w-full" style={{ height: 56 }}>
        <motion.path
          fill="rgba(0,45,98,0.50)"
          animate={{
            d: [
              'M0,30 C250,5 500,55 750,30 C900,15 1050,45 1200,30 L1200,60 L0,60Z',
              'M0,42 C250,68 500,12 750,42 C900,58 1050,28 1200,42 L1200,60 L0,60Z',
              'M0,30 C250,5 500,55 750,30 C900,15 1050,45 1200,30 L1200,60 L0,60Z',
            ],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          fill="rgba(0,163,224,0.10)"
          animate={{
            d: [
              'M0,46 C400,20 800,72 1200,46 L1200,60 L0,60Z',
              'M0,34 C400,62 800,20 1200,34 L1200,60 L0,60Z',
              'M0,46 C400,20 800,72 1200,46 L1200,60 L0,60Z',
            ],
          }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
      </svg>
    </div>
  );
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.13 } },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};

export default function Hero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-pacificCyan/20 bg-gradient-to-br from-deepSea to-slate-900 px-8 pb-0 pt-10 md:px-14 md:pt-14 card-glow">
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-pacificCyan/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-10 h-48 w-48 rounded-full bg-deepSea/60 blur-2xl" />

      <SonarBackground />
      <FloatingParticles />

      <motion.div
        className="relative z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.p
          variants={itemVariants}
          className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-pacificCyan"
        >
          Maritime AI · Seattle · Summer 2026
        </motion.p>

        <motion.h1
          variants={itemVariants}
          className="max-w-3xl text-4xl font-bold leading-tight text-whiteHull md:text-6xl"
        >
          Physical AI:
          <br />
          <span className="bg-gradient-to-r from-pacificCyan to-cyan-300 bg-clip-text text-transparent">
            Maritime Edition
          </span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg"
        >
          A visual-first educational portal where non-technical learners explore AI-powered
          vessel routing, sonar sensing, and collision avoidance — all built to copy, paste,
          and tweak.
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="mt-7 flex flex-wrap gap-3"
        >
          <a
            href="#learning"
            className="rounded-xl bg-pacificCyan px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Start Learning
          </a>
          <Link
            to="/simulators"
            className="rounded-xl border border-pacificCyan/50 px-6 py-2.5 text-sm font-semibold text-pacificCyan transition hover:bg-pacificCyan/10"
          >
            Open Simulators
          </Link>
        </motion.div>

        {/* Stats row */}
        <motion.div
          variants={containerVariants}
          className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-pacificCyan/15 bg-pacificCyan/10 md:grid-cols-4"
        >
          {STATS.map((stat) => (
            <motion.div
              key={stat.label}
              variants={itemVariants}
              className="flex flex-col gap-0.5 bg-slate-950/60 px-5 py-4 backdrop-blur-sm"
            >
              <span className="text-2xl font-bold text-pacificCyan">{stat.value}</span>
              <span className="text-xs text-slate-400">{stat.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <OceanWave />

      {/* Bottom spacer so wave doesn't clip content */}
      <div className="h-14" />
    </section>
  );
}
