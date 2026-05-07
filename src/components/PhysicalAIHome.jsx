import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

/* ── Animated node-network background ───────────────────────── */
const BG_NODES = [
  { x: 6,  y: 10, label: 'LIDAR'     },
  { x: 27, y: 4,  label: 'GPS'       },
  { x: 55, y: 7,  label: 'Camera'    },
  { x: 82, y: 15, label: 'Radar'     },
  { x: 94, y: 45, label: 'IMU'       },
  { x: 78, y: 74, label: 'Actuators' },
  { x: 52, y: 90, label: 'ROS'       },
  { x: 22, y: 84, label: 'SLAM'      },
  { x: 4,  y: 57, label: 'Planner'   },
  { x: 38, y: 46, label: 'DNN'       },
  { x: 66, y: 42, label: 'Control'   },
  { x: 20, y: 33, label: 'Fusion'    },
  { x: 45, y: 22, label: 'Predict'   },
];

// Precompute edges once (distance < 30)
const BG_EDGES = BG_NODES.reduce((acc, n, i) => {
  BG_NODES.slice(i + 1).forEach((m, j) => {
    const dx = n.x - m.x, dy = n.y - m.y;
    if (dx * dx + dy * dy < 900) acc.push([i, i + 1 + j]);
  });
  return acc;
}, []);

function NetworkBg() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      {BG_EDGES.map(([i, j], k) => (
        <motion.line key={k}
          x1={BG_NODES[i].x} y1={BG_NODES[i].y}
          x2={BG_NODES[j].x} y2={BG_NODES[j].y}
          stroke="#00a3e0" strokeWidth="0.25"
          animate={{ opacity: [0.08, 0.22, 0.08] }}
          transition={{ duration: 3 + (k % 5) * 0.7, repeat: Infinity, delay: k * 0.15 }}
        />
      ))}
      {BG_NODES.map((n, i) => (
        <g key={i}>
          <motion.circle cx={n.x} cy={n.y} r={0.9} fill="#00a3e0"
            animate={{ r: [0.9, 1.6, 0.9], opacity: [0.35, 0.85, 0.35] }}
            transition={{ duration: 2.4 + (i % 4) * 0.5, repeat: Infinity, delay: i * 0.28 }}
          />
          <text x={n.x + 1.6} y={n.y + 0.8} fontSize="2.1"
            fill="rgba(148,163,184,0.18)" fontFamily="monospace">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ── Domain icons ────────────────────────────────────────────── */
function MaritimeIcon({ color }) {
  return (
    <svg width="36" height="36" viewBox="0 0 80 80" fill="none">
      <path d="M14 46 L40 24 L66 46 L60 57 L20 57 Z"
        fill={color + '22'} stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="40" y1="24" x2="40" y2="11" stroke={color} strokeWidth="2" />
      <path d="M40 13 L56 30 L40 30 Z" fill={color + '44'} stroke={color} strokeWidth="1.5" />
      <path d="M4 65 Q14 59 24 65 Q34 71 44 65 Q54 59 64 65 Q72 68 76 65"
        fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RosIcon({ color }) {
  return (
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="15" fill="none" stroke={color} strokeWidth="4" />
      {[[50, 10], [50, 90], [10, 50], [90, 50]].map(([x, y], i) => (
        <g key={i}>
          <line x1="50" y1="50" x2={x} y2={y} stroke={color} strokeWidth="3.5" />
          <circle cx={x} cy={y} r="8" fill={color} />
        </g>
      ))}
    </svg>
  );
}

function AutonomousIcon({ color }) {
  return (
    <svg width="36" height="36" viewBox="0 0 80 80" fill="none">
      <rect x="10" y="37" width="60" height="24" rx="6"
        fill={color + '22'} stroke={color} strokeWidth="2" />
      <path d="M22 37 L28 22 L52 22 L58 37"
        fill={color + '22'} stroke={color} strokeWidth="2" />
      <circle cx="23" cy="61" r="7" fill="none" stroke={color} strokeWidth="2.5" />
      <circle cx="57" cy="61" r="7" fill="none" stroke={color} strokeWidth="2.5" />
      <circle cx="40" cy="18" r="3" fill={color} />
      {[-45, -25, -8, 8, 25, 45].map((deg, i) => {
        const r = (deg - 90) * Math.PI / 180;
        return <line key={i} x1="40" y1="18" x2={40 + Math.cos(r) * 17} y2={18 + Math.sin(r) * 17}
          stroke={color} strokeWidth="1" opacity="0.55" />;
      })}
    </svg>
  );
}

function AerialIcon({ color }) {
  return (
    <svg width="36" height="36" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="6" fill={color} />
      {[[18, 18], [62, 18], [18, 62], [62, 62]].map(([cx, cy], i) => {
        const mid = [(40 + cx) / 2, (40 + cy) / 2];
        return (
          <g key={i}>
            <line x1="40" y1="40" x2={cx} y2={cy} stroke={color} strokeWidth="2.5" />
            <motion.ellipse cx={cx} cy={cy} rx="11" ry="4"
              fill="none" stroke={color} strokeWidth="1.5" opacity="0.7"
              style={{ transformOrigin: `${cx}px ${cy}px` }}
              animate={{ rotateZ: [0, 360] }}
              transition={{ duration: 0.6 + i * 0.1, repeat: Infinity, ease: 'linear' }}
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ── Domain data ─────────────────────────────────────────────── */
const DOMAINS = [
  {
    id: 'maritime',
    title: 'Maritime Edition',
    subtitle: 'Autonomous vessels · Ocean sensing · Navigation',
    description: 'Deep-sea navigation, radar interpretation, and collision avoidance through interactive simulators and curated research.',
    color: '#00a3e0',
    link: '/maritime',
    chips: ['Route Optimization', 'Collision Avoidance', 'Sonar Interpretation'],
    stat: '12,491 research papers',
    active: true,
  },
  {
    id: 'ros',
    title: 'Robotics & ROS',
    subtitle: 'TurtleSim · rqt_graph · Topic monitoring',
    description: 'Hands-on Robot Operating System with live TurtleSim, animated node graph, and real-time rostopic echo.',
    color: '#4ade80',
    link: '/ros',
    chips: ['TurtleSim', 'rqt_graph', 'rostopic echo'],
    stat: '4 active ROS nodes',
    active: true,
  },
  {
    id: 'autonomous',
    title: 'Autonomous Vehicles',
    subtitle: 'LIDAR · Path planning · SLAM',
    description: 'Sensor fusion, simultaneous localization and mapping, and real-time path planning for ground vehicles.',
    color: '#fb923c',
    link: null,
    active: false,
  },
  {
    id: 'aerial',
    title: 'Aerial Systems',
    subtitle: 'UAV control · Swarm · Vision',
    description: 'Drone flight dynamics, swarm coordination, and visual navigation for unmanned aerial vehicles.',
    color: '#a78bfa',
    link: null,
    active: false,
  },
];

function DomainIcon({ id, color }) {
  if (id === 'maritime')  return <MaritimeIcon color={color} />;
  if (id === 'ros')       return <RosIcon color={color} />;
  if (id === 'autonomous')return <AutonomousIcon color={color} />;
  return <AerialIcon color={color} />;
}

/* ── Main component ──────────────────────────────────────────── */
export default function PhysicalAIHome() {
  return (
    <div className="flex flex-col gap-10">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden glass-card rounded-2xl px-8 py-20 text-center"
        style={{ minHeight: 340 }}>
        <NetworkBg />

        <motion.div className="relative z-10"
          initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}>

          {/* Badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-pacificCyan/10
                          border border-pacificCyan/30 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-pacificCyan animate-pulse" />
            <span className="text-xs font-mono text-pacificCyan tracking-widest uppercase">
              Learning Platform
            </span>
          </div>

          {/* Title */}
          <h1 className="mb-4 text-5xl font-bold tracking-tight text-white md:text-6xl">
            Physical <span className="text-pacificCyan">AI</span>
          </h1>

          <p className="mb-3 text-xl text-slate-300">
            Where intelligence meets the physical world
          </p>
          <p className="mx-auto mb-8 max-w-xl text-sm text-slate-500">
            Explore intelligent systems across maritime autonomy, robotics, autonomous vehicles,
            and aerial platforms — through interactive simulators and curated research.
          </p>

          {/* CTA */}
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/maritime"
              className="rounded-xl bg-pacificCyan px-6 py-2.5 text-sm font-semibold
                         text-slate-950 transition hover:bg-cyan-300">
              Maritime Edition
            </Link>
            <Link to="/ros"
              className="rounded-xl border border-slate-700 px-6 py-2.5 text-sm font-semibold
                         text-slate-300 transition hover:bg-slate-800">
              Robotics &amp; ROS
            </Link>
          </div>
        </motion.div>
      </div>

      {/* ── Domains ──────────────────────────────────────────── */}
      <div>
        <div className="mb-5 flex items-baseline gap-3">
          <h2 className="text-lg font-bold text-white">Domains</h2>
          <span className="text-sm text-slate-500">2 active · 2 coming soon</span>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {DOMAINS.map((d, i) => (
            <motion.div key={d.id}
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 + i * 0.08 }}>
              <div className={`simulator-panel flex h-full flex-col rounded-2xl p-6 transition
                               ${d.active ? 'hover:border-slate-600' : 'opacity-55'}`}
                style={{ border: `1px solid ${d.color}${d.active ? '38' : '1a'}` }}>

                {/* Header */}
                <div className="mb-4 flex items-start gap-4">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ background: d.color + '18', border: `1px solid ${d.color}38` }}>
                    <DomainIcon id={d.id} color={d.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white">{d.title}</h3>
                      {!d.active && (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs" style={{ color: d.color + 'cc' }}>{d.subtitle}</p>
                  </div>
                </div>

                <p className="mb-4 flex-1 text-sm text-slate-400">{d.description}</p>

                {d.active && (
                  <>
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {d.chips.map(c => (
                        <span key={c}
                          className="rounded-full bg-slate-800/80 px-2.5 py-1 text-[11px] text-slate-400">
                          {c}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-slate-500">{d.stat}</span>
                      <Link to={d.link}
                        className="rounded-lg px-4 py-1.5 text-xs font-semibold transition"
                        style={{
                          background: d.color + '1a',
                          color: d.color,
                          border: `1px solid ${d.color}44`,
                        }}>
                        Explore →
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

    </div>
  );
}
