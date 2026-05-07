import { motion } from 'framer-motion';
import HardwareLayer from './HardwareLayer';

/* ── Deterministic floating particles ───────────────────────── */
const PARTICLES = [
  { x:  8, y: 22, s: 1.8, d: 0.0, dur: 3.2 },
  { x: 18, y: 68, s: 1.3, d: 0.8, dur: 2.9 },
  { x: 33, y: 40, s: 2.0, d: 1.4, dur: 3.5 },
  { x: 47, y: 78, s: 1.5, d: 0.3, dur: 2.7 },
  { x: 55, y: 18, s: 1.7, d: 1.9, dur: 3.1 },
  { x: 68, y: 55, s: 2.1, d: 0.6, dur: 2.8 },
  { x: 75, y: 85, s: 1.4, d: 1.1, dur: 3.4 },
  { x: 84, y: 32, s: 1.9, d: 0.4, dur: 3.0 },
  { x: 91, y: 62, s: 1.6, d: 1.6, dur: 2.6 },
  { x: 97, y: 15, s: 2.2, d: 0.9, dur: 3.3 },
];

/* ── Road/waypoint network background ───────────────────────── */
const HUB   = { x: 680, y: 90 };
const WAYPOINTS = [
  { x: 530, y: 160, label: '/lidar'    },
  { x: 420, y:  72, label: '/slam'     },
  { x: 608, y: 200, label: '/planner'  },
  { x: 740, y: 158, label: '/control'  },
  { x: 686, y:  24, label: '/sensors'  },
];

function RoadNetworkBg() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 800 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {/* Range rings */}
      {[55, 115, 175, 230].map(r => (
        <circle key={r} cx={HUB.x} cy={HUB.y} r={r}
          fill="none" stroke="rgba(251,146,60,0.05)" strokeWidth="1" />
      ))}
      {/* Radial grid */}
      {[0, 45, 90, 135].map(deg => {
        const rad = deg * Math.PI / 180;
        return (
          <line key={deg}
            x1={HUB.x + 240 * Math.cos(rad)} y1={HUB.y - 240 * Math.sin(rad)}
            x2={HUB.x - 240 * Math.cos(rad)} y2={HUB.y + 240 * Math.sin(rad)}
            stroke="rgba(251,146,60,0.04)" strokeWidth="0.8" />
        );
      })}
      {/* Spoke edges */}
      {WAYPOINTS.map((n, i) => (
        <line key={i} x1={HUB.x} y1={HUB.y} x2={n.x} y2={n.y}
          stroke="rgba(251,146,60,0.14)" strokeWidth="0.9" />
      ))}
      {/* Animated packets */}
      {WAYPOINTS.map((n, i) => (
        <motion.circle key={i} r={3} fill="rgba(251,146,60,0.9)"
          style={{ filter: 'drop-shadow(0 0 3px #fb923c)' }}
          initial={{ cx: HUB.x, cy: HUB.y, opacity: 0 }}
          animate={{ cx: [HUB.x, n.x], cy: [HUB.y, n.y], opacity: [0, 0.9, 0.9, 0] }}
          transition={{ duration: 1.2, delay: i * 0.55, repeat: Infinity, repeatDelay: 1.8, ease: 'easeInOut' }}
        />
      ))}
      {/* Expanding pulses */}
      {[0, 1, 2, 3].map(i => (
        <motion.circle key={i} cx={HUB.x} cy={HUB.y}
          fill="none" stroke="rgba(251,146,60,0.4)" strokeWidth="1.5"
          initial={{ r: 6, opacity: 0.7 }}
          animate={{ r: 240, opacity: 0 }}
          transition={{ duration: 3.6, delay: i * 0.9, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
      {/* Hub core */}
      <motion.circle cx={HUB.x} cy={HUB.y} r={10}
        fill="rgba(251,146,60,0.2)" stroke="rgba(251,146,60,0.7)" strokeWidth="1.5"
        animate={{ r: [10, 13, 10], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {[[HUB.x, HUB.y-7],[HUB.x, HUB.y+7],[HUB.x-7, HUB.y],[HUB.x+7, HUB.y]].map(([ex,ey], i) => (
        <line key={i} x1={HUB.x} y1={HUB.y} x2={ex} y2={ey}
          stroke="rgba(251,146,60,0.6)" strokeWidth="1.5" />
      ))}
      {/* Satellite nodes */}
      {WAYPOINTS.map((n, i) => (
        <g key={i}>
          <motion.circle cx={n.x} cy={n.y} r={5}
            fill="rgba(15,23,42,0.9)" stroke="rgba(251,146,60,0.5)" strokeWidth="1"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.2 + i * 0.3, repeat: Infinity, delay: i * 0.4 }}
          />
          <text x={n.x} y={n.y - 9} textAnchor="middle"
            fontSize="6.5" fill="rgba(251,146,60,0.3)" fontFamily="monospace">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function FloatingParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {PARTICLES.map((p, i) => (
        <motion.div key={i} className="absolute rounded-full bg-orange-400"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s * 2, height: p.s * 2, opacity: 0.4 }}
          animate={{ y: [0, -10, 0], opacity: [0.2, 0.65, 0.2] }}
          transition={{ duration: p.dur, delay: p.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function TarmacWave() {
  return (
    <div className="pointer-events-none absolute bottom-0 left-0 w-full overflow-hidden" aria-hidden="true">
      <svg viewBox="0 0 1200 60" preserveAspectRatio="none" className="w-full" style={{ height: 56 }}>
        <motion.path fill="rgba(124,45,18,0.35)"
          animate={{ d: [
            'M0,30 C250,5 500,55 750,30 C900,15 1050,45 1200,30 L1200,60 L0,60Z',
            'M0,42 C250,68 500,12 750,42 C900,58 1050,28 1200,42 L1200,60 L0,60Z',
            'M0,30 C250,5 500,55 750,30 C900,15 1050,45 1200,30 L1200,60 L0,60Z',
          ]}}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path fill="rgba(251,146,60,0.07)"
          animate={{ d: [
            'M0,46 C400,20 800,72 1200,46 L1200,60 L0,60Z',
            'M0,34 C400,62 800,20 1200,34 L1200,60 L0,60Z',
            'M0,46 C400,20 800,72 1200,46 L1200,60 L0,60Z',
          ]}}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
      </svg>
    </div>
  );
}

/* ── Stats ───────────────────────────────────────────────────── */
const STATS = [
  { label: 'Manufacturing Processes', value: '3'      },
  { label: 'Max Yield Strength',      value: '1500 MPa' },
  { label: 'Avg Weight Reduction',    value: '~18 %'  },
  { label: 'Joint Precision',         value: '±0.1 mm' },
];

const containerV = { hidden: {}, visible: { transition: { staggerChildren: 0.13 } } };
const itemV = {
  hidden:  { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};

/* ── Hero ────────────────────────────────────────────────────── */
function AutonomousHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-orange-500/20
                        bg-gradient-to-br from-[#010d1f] to-slate-900 px-8 pb-0 pt-10
                        md:px-14 md:pt-14"
      style={{ boxShadow: '0 0 0 1px rgba(251,146,60,0.12), 0 18px 80px rgba(45,20,0,0.45)' }}>

      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-10 h-48 w-48 rounded-full bg-orange-900/20 blur-2xl" />

      <RoadNetworkBg />
      <FloatingParticles />

      <motion.div className="relative z-10" variants={containerV} initial="hidden" animate="visible">

        <motion.p variants={itemV}
          className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-orange-400">
          Autonomous Vehicles · Physical AI · Industrial Layer
        </motion.p>

        <motion.h1 variants={itemV}
          className="max-w-3xl text-4xl font-bold leading-tight text-whiteHull md:text-6xl">
          Physical AI:
          <br />
          <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
            Autonomous Edition
          </span>
        </motion.h1>

        <motion.p variants={itemV}
          className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
          Before a vehicle can navigate, sense, or decide — its body must be engineered
          to survive. Explore the industrial manufacturing processes that give autonomous
          vehicles their physical form: hot stamping, hydroforming, and laser welding.
        </motion.p>

        <motion.div variants={itemV} className="mt-7 flex flex-wrap gap-3">
          <a href="#hardware"
            className="rounded-xl bg-orange-400 px-6 py-2.5 text-sm font-semibold
                       text-slate-950 transition hover:bg-amber-300">
            View Hardware Layer
          </a>
          <a href="#hardware"
            className="rounded-xl border border-orange-500/50 px-6 py-2.5 text-sm font-semibold
                       text-orange-400 transition hover:bg-orange-500/10">
            Manufacturing Specs
          </a>
        </motion.div>

        {/* Stats row */}
        <motion.div variants={containerV}
          className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl
                     border border-orange-500/15 bg-orange-500/10 md:grid-cols-4">
          {STATS.map(s => (
            <motion.div key={s.label} variants={itemV}
              className="flex flex-col gap-0.5 bg-slate-950/60 px-5 py-4 backdrop-blur-sm">
              <span className="text-2xl font-bold text-orange-400">{s.value}</span>
              <span className="text-xs text-slate-400">{s.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <TarmacWave />
      <div className="h-14" />
    </section>
  );
}

/* ── Page ────────────────────────────────────────────────────── */
export default function AutonomousPage() {
  return (
    <div className="flex flex-col gap-6">
      <AutonomousHero />
      <div id="hardware">
        <HardwareLayer />
      </div>
    </div>
  );
}
