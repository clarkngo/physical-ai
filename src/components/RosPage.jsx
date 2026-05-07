import { useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import RosNodeGraph    from './RosNodeGraph';
import RosTopicMonitor from './RosTopicMonitor';

// ── Static rosData for the dev-tool panels ────────────────────
const STATIC_ROS_DATA = {
  pose:       { x: 5.544, y: 5.544, theta: 0, lv: 0, av: 0 },
  cmdVel:     { linear_x: 0, angular_z: 0 },
  cmdActive:  false,
  poseActive: true,
};

// ── Hero stats ─────────────────────────────────────────────────
const STATS = [
  { label: 'ROS 2 Packages',   value: '100k+' },
  { label: 'Community Members',value: '1M+'   },
  { label: 'Robot Platforms',  value: '500+'  },
  { label: 'Sim Frequency',    value: '62 Hz' },
];

// ── Deterministic floating particles (green-tinted) ────────────
const PARTICLES = [
  { x: 6,  y: 18, s: 2.0, d: 0.0, dur: 3.1 },
  { x: 15, y: 62, s: 1.4, d: 0.6, dur: 2.8 },
  { x: 29, y: 35, s: 1.8, d: 1.2, dur: 3.6 },
  { x: 44, y: 75, s: 2.4, d: 0.2, dur: 2.4 },
  { x: 52, y: 20, s: 1.5, d: 1.7, dur: 3.0 },
  { x: 63, y: 58, s: 1.9, d: 0.7, dur: 2.9 },
  { x: 71, y: 88, s: 1.6, d: 0.3, dur: 3.4 },
  { x: 82, y: 44, s: 2.1, d: 1.4, dur: 2.7 },
  { x: 90, y: 25, s: 2.2, d: 0.8, dur: 3.2 },
  { x: 96, y: 70, s: 1.4, d: 0.5, dur: 2.6 },
];

// ── ROS node-network background (mirrors sonar in Hero.jsx) ───
//   Hub at (660, 80) — upper right, same zone as sonar centre
const HUB   = { x: 660, y: 80 };
const R_NODES = [
  { x: 520, y: 145, label: '/turtlesim' },
  { x: 415, y: 78,  label: '/teleop'    },
  { x: 610, y: 195, label: '/rviz2'     },
  { x: 730, y: 155, label: '/rosout'    },
  { x: 672, y: 22,  label: '/param'     },
];

function RosNetworkBackground() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 800 360"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* Static faint range rings from hub */}
      {[55, 115, 175, 235].map((r) => (
        <circle key={r} cx={HUB.x} cy={HUB.y} r={r}
          fill="none" stroke="rgba(74,222,128,0.05)" strokeWidth="1" />
      ))}

      {/* Radial grid lines */}
      {[0, 45, 90, 135].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <line key={deg}
            x1={HUB.x + 240 * Math.cos(rad)} y1={HUB.y - 240 * Math.sin(rad)}
            x2={HUB.x - 240 * Math.cos(rad)} y2={HUB.y + 240 * Math.sin(rad)}
            stroke="rgba(74,222,128,0.04)" strokeWidth="0.8" />
        );
      })}

      {/* Spoke edges hub → each node */}
      {R_NODES.map((n, i) => (
        <line key={i} x1={HUB.x} y1={HUB.y} x2={n.x} y2={n.y}
          stroke="rgba(74,222,128,0.14)" strokeWidth="0.9" />
      ))}

      {/* Animated data packets along each spoke */}
      {R_NODES.map((n, i) => (
        <motion.circle key={i} r={3}
          fill="rgba(74,222,128,0.9)"
          style={{ filter: 'drop-shadow(0 0 3px #4ade80)' }}
          initial={{ cx: HUB.x, cy: HUB.y, opacity: 0 }}
          animate={{
            cx:      [HUB.x, n.x],
            cy:      [HUB.y, n.y],
            opacity: [0, 0.9, 0.9, 0],
          }}
          transition={{
            duration: 1.2, delay: i * 0.55,
            repeat: Infinity, repeatDelay: 1.8, ease: 'easeInOut',
          }}
        />
      ))}

      {/* Expanding pulse rings from hub */}
      {[0, 1, 2, 3].map((i) => (
        <motion.circle key={i} cx={HUB.x} cy={HUB.y}
          fill="none" stroke="rgba(74,222,128,0.45)" strokeWidth="1.5"
          initial={{ r: 6, opacity: 0.7 }}
          animate={{ r: 248, opacity: 0 }}
          transition={{ duration: 3.6, delay: i * 0.9, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}

      {/* Hub core */}
      <motion.circle cx={HUB.x} cy={HUB.y} r={10}
        fill="rgba(74,222,128,0.2)" stroke="rgba(74,222,128,0.7)" strokeWidth="1.5"
        animate={{ r: [10, 13, 10], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Hub spokes (ROS logo shape) */}
      {[[HUB.x, HUB.y-7], [HUB.x, HUB.y+7], [HUB.x-7, HUB.y], [HUB.x+7, HUB.y]].map(([ex,ey], i) => (
        <line key={i} x1={HUB.x} y1={HUB.y} x2={ex} y2={ey}
          stroke="rgba(74,222,128,0.6)" strokeWidth="1.5" />
      ))}

      {/* Satellite node circles */}
      {R_NODES.map((n, i) => (
        <g key={i}>
          <motion.circle cx={n.x} cy={n.y} r={5}
            fill="rgba(15,23,42,0.9)" stroke="rgba(74,222,128,0.5)" strokeWidth="1"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.2 + i * 0.3, repeat: Infinity, delay: i * 0.4 }}
          />
          <text x={n.x} y={n.y - 9} textAnchor="middle"
            fontSize="6.5" fill="rgba(74,222,128,0.3)" fontFamily="monospace">
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
        <motion.div key={i} className="absolute rounded-full bg-green-400"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s * 2, height: p.s * 2, opacity: 0.45 }}
          animate={{ y: [0, -10, 0], opacity: [0.25, 0.7, 0.25] }}
          transition={{ duration: p.dur, delay: p.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function CircuitWave() {
  return (
    <div className="pointer-events-none absolute bottom-0 left-0 w-full overflow-hidden" aria-hidden="true">
      <svg viewBox="0 0 1200 60" preserveAspectRatio="none" className="w-full" style={{ height: 56 }}>
        <motion.path
          fill="rgba(20,83,45,0.40)"
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
          fill="rgba(74,222,128,0.08)"
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

function RosHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-green-500/20
                        bg-gradient-to-br from-[#010d1f] to-slate-900 px-8 pb-0 pt-10
                        md:px-14 md:pt-14"
      style={{ boxShadow: '0 0 0 1px rgba(74,222,128,0.12), 0 18px 80px rgba(0,45,20,0.45)' }}>

      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-green-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-10 h-48 w-48 rounded-full bg-green-900/20 blur-2xl" />

      <RosNetworkBackground />
      <FloatingParticles />

      <motion.div className="relative z-10" variants={containerVariants} initial="hidden" animate="visible">

        <motion.p variants={itemVariants}
          className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-green-400">
          Robotics AI · ROS 2 · Summer 2026
        </motion.p>

        <motion.h1 variants={itemVariants}
          className="max-w-3xl text-4xl font-bold leading-tight text-whiteHull md:text-6xl">
          Physical AI:
          <br />
          <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
            Robotics Edition
          </span>
        </motion.h1>

        <motion.p variants={itemVariants}
          className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
          Hands-on Robot Operating System — drive a virtual turtle, visualize the node
          graph, and monitor live topics in real time. All built to copy, paste, and tweak.
        </motion.p>

        <motion.div variants={itemVariants} className="mt-7 flex flex-wrap gap-3">
          <Link to="/simulators"
            className="rounded-xl bg-green-400 px-6 py-2.5 text-sm font-semibold
                       text-slate-950 transition hover:bg-emerald-300">
            Launch TurtleSim
          </Link>
          <a href="#tools"
            className="rounded-xl border border-green-500/50 px-6 py-2.5 text-sm font-semibold
                       text-green-400 transition hover:bg-green-500/10">
            Open Dev Tools
          </a>
        </motion.div>

        {/* Stats row */}
        <motion.div variants={containerVariants}
          className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl
                     border border-green-500/15 bg-green-500/10 md:grid-cols-4">
          {STATS.map((s) => (
            <motion.div key={s.label} variants={itemVariants}
              className="flex flex-col gap-0.5 bg-slate-950/60 px-5 py-4 backdrop-blur-sm">
              <span className="text-2xl font-bold text-green-400">{s.value}</span>
              <span className="text-xs text-slate-400">{s.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <CircuitWave />
      <div className="h-14" />
    </section>
  );
}

// ── Dev-tool tabs ──────────────────────────────────────────────
const TABS = [
  { id: 'rqt_graph',     label: 'rqt_graph',    icon: '⬡' },
  { id: 'topic_monitor', label: 'Topic Monitor', icon: '📡' },
];

// ── Quick-ref commands ─────────────────────────────────────────
const CMDS = [
  'ros2 run turtlesim turtlesim_node',
  'ros2 run turtlesim turtle_teleop_key',
  'ros2 topic echo /turtle1/pose',
  'rqt_graph',
];

const VALID_TOOLS = TABS.map(t => t.id);

export default function RosPage() {
  const { tool } = useParams();
  const navigate  = useNavigate();
  const activeTab = VALID_TOOLS.includes(tool) ? tool : 'rqt_graph';

  useEffect(() => {
    if (!tool) navigate('/ros/rqt_graph', { replace: true });
    else if (!VALID_TOOLS.includes(tool)) navigate('/ros/rqt_graph', { replace: true });
  }, [tool, navigate]);

  const setActiveTab = (id) => navigate(`/ros/${id}`);

  return (
    <div className="flex flex-col gap-6">

      <RosHero />

      {/* ── Dev tools section ──────────────────────────────── */}
      <div id="tools" className="glass-card rounded-2xl px-6 py-5">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">ROS Developer Tools</h2>
            <p className="mt-0.5 text-sm text-slate-400">
              <span className="text-slate-500">TurtleSim available under</span>
              <span className="text-green-400"> Simulators → Robotics</span>
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-full bg-slate-900/60
                          border border-green-900/60 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-slate-400 font-mono">roscore</span>
            <span className="text-xs text-green-400 font-mono font-semibold">RUNNING</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {CMDS.map(cmd => (
            <code key={cmd}
              className="rounded-lg bg-slate-900/80 border border-slate-800 px-3 py-1
                         text-[11px] text-green-400 font-mono">
              {cmd}
            </code>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-green-400 text-slate-950'
                : 'glass-card text-slate-300 hover:text-white'
            }`}>
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}>
        {activeTab === 'rqt_graph'     && <RosNodeGraph    rosData={STATIC_ROS_DATA} />}
        {activeTab === 'topic_monitor' && <RosTopicMonitor rosData={STATIC_ROS_DATA} />}
      </motion.div>

    </div>
  );
}
