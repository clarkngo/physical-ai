import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── shared ──────────────────────────────────────────────────── */
const G = '#4ade80';   // green
const G2 = '#86efac';  // light-green
const DIM = 'rgba(74,222,128,0.18)';

function CliBlock({ lines }) {
  return (
    <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs leading-relaxed">
      {lines.map((l, i) => (
        <div key={i} className={l.startsWith('#') ? 'text-slate-600' : l.startsWith('$') ? 'text-green-400' : 'text-slate-300'}>
          {l}
        </div>
      ))}
    </div>
  );
}

function FactList({ facts }) {
  return (
    <ul className="space-y-2">
      {facts.map((f, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
          <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-400/60" />
          {f}
        </li>
      ))}
    </ul>
  );
}

function ConceptHeader({ eyebrow, title, subtitle, color = G }) {
  return (
    <div className="mb-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] mb-1" style={{ color }}>
        {eyebrow}
      </p>
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <p className="mt-2 text-sm text-slate-400 max-w-2xl">{subtitle}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PANEL 1 — NODES
   ════════════════════════════════════════════════════════════════ */

const NODE_GRAPH = [
  { id: 'teleop',    label: '/teleop_key',     x: 90,  y: 75,  color: '#4ade80' },
  { id: 'turtlesim', label: '/turtlesim',      x: 270, y: 140, color: '#4ade80' },
  { id: 'rviz',      label: '/rviz2',          x: 90,  y: 205, color: '#4ade80' },
  { id: 'ros2cli',   label: '/ros2cli',        x: 450, y: 75,  color: '#4ade80' },
  { id: 'rosout',    label: '/rosout',         x: 450, y: 205, color: '#86efac' },
];

const NODE_EDGES = [
  { from: 'teleop',    to: 'turtlesim', topic: '/turtle1/cmd_vel',  delay: 0.0 },
  { from: 'ros2cli',   to: 'turtlesim', topic: '/turtle1/cmd_vel',  delay: 0.7 },
  { from: 'turtlesim', to: 'rviz',      topic: '/turtle1/pose',     delay: 0.3 },
  { from: 'turtlesim', to: 'rosout',    topic: '/rosout',           delay: 1.1 },
];

const NODE_INFO = {
  teleop:    { subs: [], pubs: ['/turtle1/cmd_vel'], services: [] },
  turtlesim: { subs: ['/turtle1/cmd_vel'], pubs: ['/turtle1/pose', '/rosout'], services: ['/spawn', '/turtle1/set_pen', '/reset'] },
  rviz:      { subs: ['/turtle1/pose'], pubs: [], services: [] },
  ros2cli:   { subs: [], pubs: ['/turtle1/cmd_vel'], services: [] },
  rosout:    { subs: ['/rosout'], pubs: [], services: [] },
};

function NodesPanel() {
  const [selected, setSelected] = useState('turtlesim');

  const getPos = (id) => NODE_GRAPH.find(n => n.id === id);

  return (
    <div className="space-y-6">
      <ConceptHeader
        eyebrow="ROS 2 Concept · ros2 node"
        title="Nodes"
        subtitle="A node is a single-purpose executable — the fundamental building block of any ROS 2 system. Each node has one modular responsibility and communicates with others via topics, services, and actions."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">

        {/* animated graph */}
        <div className="simulator-panel rounded-2xl p-2 overflow-hidden"
          style={{ border: '1px solid rgba(74,222,128,0.2)' }}>
          <p className="text-[10px] font-mono text-green-400/50 px-3 pt-2 pb-1 uppercase tracking-widest">
            rqt_graph · turtlesim session
          </p>
          <svg viewBox="0 0 540 280" className="w-full" style={{ maxHeight: 280 }}>
            {/* grid bg */}
            {Array.from({ length: 12 }, (_, i) => (
              <line key={`h${i}`} x1={0} y1={i*25} x2={540} y2={i*25}
                stroke="rgba(74,222,128,0.04)" strokeWidth="0.5" />
            ))}
            {Array.from({ length: 22 }, (_, i) => (
              <line key={`v${i}`} x1={i*25} y1={0} x2={i*25} y2={280}
                stroke="rgba(74,222,128,0.04)" strokeWidth="0.5" />
            ))}

            {/* edges */}
            {NODE_EDGES.map((e, i) => {
              const a = getPos(e.from), b = getPos(e.to);
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
              return (
                <g key={i}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="rgba(74,222,128,0.15)" strokeWidth="1.5" />
                  {/* traveling packet */}
                  <motion.circle r={4} fill={G}
                    style={{ filter: 'drop-shadow(0 0 4px #4ade80)' }}
                    initial={{ cx: a.x, cy: a.y, opacity: 0 }}
                    animate={{
                      cx: [a.x, mx, b.x],
                      cy: [a.y, my, b.y],
                      opacity: [0, 1, 0],
                    }}
                    transition={{ duration: 1.4, delay: e.delay, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }}
                  />
                  {/* topic label at midpoint */}
                  <text x={mx} y={my - 6} textAnchor="middle"
                    fontSize="7" fill="rgba(74,222,128,0.35)" fontFamily="monospace">
                    {e.topic}
                  </text>
                </g>
              );
            })}

            {/* nodes */}
            {NODE_GRAPH.map(n => {
              const isSelected = selected === n.id;
              return (
                <g key={n.id} style={{ cursor: 'pointer' }}
                  onClick={() => setSelected(n.id)}>
                  {/* selection ring */}
                  {isSelected && (
                    <motion.circle cx={n.x} cy={n.y} r={22}
                      fill="none" stroke={G} strokeWidth="1.5"
                      animate={{ r: [22, 26, 22], opacity: [0.8, 0.3, 0.8] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    />
                  )}
                  {/* pulse ring */}
                  <motion.circle cx={n.x} cy={n.y} r={14}
                    fill="none" stroke={G} strokeWidth="0.8"
                    animate={{ r: [14, 20, 14], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 2.2, repeat: Infinity, delay: NODE_GRAPH.indexOf(n) * 0.4 }}
                  />
                  {/* core */}
                  <motion.circle cx={n.x} cy={n.y} r={12}
                    fill={isSelected ? 'rgba(74,222,128,0.25)' : 'rgba(15,23,42,0.9)'}
                    stroke={isSelected ? G : 'rgba(74,222,128,0.5)'}
                    strokeWidth={isSelected ? 2 : 1.2}
                    animate={{ opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: NODE_GRAPH.indexOf(n) * 0.3 }}
                  />
                  {/* label */}
                  <text x={n.x} y={n.y + 24} textAnchor="middle"
                    fontSize="8.5" fill={isSelected ? G : 'rgba(148,163,184,0.7)'}
                    fontFamily="monospace" fontWeight={isSelected ? 'bold' : 'normal'}>
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="text-[10px] text-slate-600 px-3 pb-2 font-mono">
            Click a node to inspect
          </p>
        </div>

        {/* info panel */}
        <div className="flex flex-col gap-3">
          <div className="simulator-panel rounded-2xl p-4"
            style={{ border: '1px solid rgba(74,222,128,0.2)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-1">
              $ ros2 node info
            </p>
            <p className="font-mono text-sm text-white mb-3">
              {NODE_GRAPH.find(n => n.id === selected)?.label}
            </p>
            <AnimatePresence mode="wait">
              <motion.div key={selected}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                className="font-mono text-xs space-y-2">
                <div>
                  <p className="text-slate-500 mb-1">Subscribers:</p>
                  {NODE_INFO[selected].subs.length === 0
                    ? <p className="text-slate-700 pl-2">None</p>
                    : NODE_INFO[selected].subs.map(s => (
                        <p key={s} className="text-green-300 pl-2">{s}</p>
                      ))}
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Publishers:</p>
                  {NODE_INFO[selected].pubs.length === 0
                    ? <p className="text-slate-700 pl-2">None</p>
                    : NODE_INFO[selected].pubs.map(p => (
                        <p key={p} className="text-green-300 pl-2">{p}</p>
                      ))}
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Services:</p>
                  {NODE_INFO[selected].services.length === 0
                    ? <p className="text-slate-700 pl-2">None</p>
                    : NODE_INFO[selected].services.map(s => (
                        <p key={s} className="text-green-300 pl-2">{s}</p>
                      ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <CliBlock lines={[
            '# List all active nodes',
            '$ ros2 node list',
            '/turtlesim',
            '/teleop_key',
            '/rviz2',
            '/rosout',
            '',
            '# Inspect a node',
            '$ ros2 node info /turtlesim',
          ]} />
        </div>
      </div>

      <FactList facts={[
        'Each node has a single, modular responsibility (e.g. one node reads LIDAR, another plans the path).',
        'Nodes communicate via topics (async), services (request/response), actions (long-running), and parameters.',
        'A single executable can host multiple nodes — but splitting them gives you fine-grained restart and isolation control.',
        'Use ros2 node list to see every active node in the ROS graph, and ros2 node info to inspect its connections.',
      ]} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PANEL 2 — TOPICS
   ════════════════════════════════════════════════════════════════ */

const TOPIC_CONFIGS = [
  {
    id: '1to1',
    label: '1 Publisher → 1 Subscriber',
    publishers:  [{ id: 'pub1', label: '/turtlesim', y: 100 }],
    subscribers: [{ id: 'sub1', label: '/rviz2',     y: 100 }],
    topic: '/turtle1/pose',
    type:  'geometry_msgs/msg/Pose2D',
    packets: [{ delay: 0, y: 100 }],
  },
  {
    id: '1toN',
    label: '1 Publisher → Many Subscribers',
    publishers:  [{ id: 'pub1', label: '/turtlesim',  y: 100 }],
    subscribers: [
      { id: 'sub1', label: '/rviz2',   y: 55  },
      { id: 'sub2', label: '/logger',  y: 100 },
      { id: 'sub3', label: '/planner', y: 145 },
    ],
    topic: '/turtle1/pose',
    type:  'geometry_msgs/msg/Pose2D',
    packets: [{ delay: 0, y: 55 }, { delay: 0.3, y: 100 }, { delay: 0.6, y: 145 }],
  },
  {
    id: 'Nto1',
    label: 'Many Publishers → 1 Subscriber',
    publishers:  [
      { id: 'pub1', label: '/teleop',  y: 55  },
      { id: 'pub2', label: '/planner', y: 100 },
      { id: 'pub3', label: '/ros2cli', y: 145 },
    ],
    subscribers: [{ id: 'sub1', label: '/turtlesim', y: 100 }],
    topic: '/turtle1/cmd_vel',
    type:  'geometry_msgs/msg/Twist',
    packets: [{ delay: 0, y: 55 }, { delay: 0.4, y: 100 }, { delay: 0.8, y: 145 }],
  },
];

const ECHO_LINES = [
  'linear:',
  '  x: 1.5',
  '  y: 0.0',
  '  z: 0.0',
  'angular:',
  '  x: 0.0',
  '  y: 0.0',
  '  z: 0.5',
  '---',
];

function TopicsPanel() {
  const [cfgIdx, setCfgIdx] = useState(0);
  const cfg = TOPIC_CONFIGS[cfgIdx];
  const PUB_X = 80, BUS_X1 = 155, BUS_X2 = 385, SUB_X = 460;
  const SVG_H = 200;
  const midBus = (BUS_X1 + BUS_X2) / 2;

  // echo ticker
  const [echoIdx, setEchoIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setEchoIdx(i => (i + 1) % (ECHO_LINES.length + 1)), 350);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6">
      <ConceptHeader
        eyebrow="ROS 2 Concept · ros2 topic"
        title="Topics"
        subtitle="A topic is a named communication channel — a publisher sends typed messages onto it, and any number of subscribers consume them asynchronously and independently. Neither side waits for the other."
      />

      {/* config selector */}
      <div className="flex flex-wrap gap-2">
        {TOPIC_CONFIGS.map((c, i) => (
          <button key={c.id} onClick={() => setCfgIdx(i)}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              cfgIdx === i
                ? 'bg-green-400/20 ring-1 ring-green-400/60 text-green-300'
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60'
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">

        {/* diagram */}
        <div className="simulator-panel rounded-2xl p-2 overflow-hidden"
          style={{ border: '1px solid rgba(74,222,128,0.2)' }}>
          <p className="text-[10px] font-mono text-green-400/50 px-3 pt-2 pb-1 uppercase tracking-widest">
            Publisher / Subscriber pattern · {cfg.topic}
          </p>
          <AnimatePresence mode="wait">
            <motion.svg key={cfgIdx} viewBox={`0 0 540 ${SVG_H}`}
              className="w-full" style={{ maxHeight: SVG_H }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}>

              {/* Topic bus bar */}
              <rect x={BUS_X1} y={SVG_H/2 - 18} width={BUS_X2 - BUS_X1} height={36}
                rx={6} fill="rgba(74,222,128,0.06)" stroke="rgba(74,222,128,0.3)" strokeWidth="1" />
              <text x={midBus} y={SVG_H/2 - 24} textAnchor="middle"
                fontSize="8" fill="rgba(74,222,128,0.5)" fontFamily="monospace">
                {cfg.topic}
              </text>
              <text x={midBus} y={SVG_H/2 + 30} textAnchor="middle"
                fontSize="7" fill="rgba(74,222,128,0.3)" fontFamily="monospace">
                {cfg.type}
              </text>
              <text x={midBus} y={SVG_H/2 + 5} textAnchor="middle"
                fontSize="9" fill="rgba(74,222,128,0.6)" fontFamily="monospace" fontWeight="bold">
                TOPIC BUS
              </text>

              {/* Publishers */}
              {cfg.publishers.map((p) => {
                const edgeY = SVG_H / 2;
                const pY = p.y;
                return (
                  <g key={p.id}>
                    {/* line from node to bus */}
                    <line x1={PUB_X + 14} y1={pY} x2={BUS_X1} y2={edgeY}
                      stroke="rgba(74,222,128,0.2)" strokeWidth="1" strokeDasharray="3 3" />
                    {/* node */}
                    <motion.circle cx={PUB_X} cy={pY} r={13}
                      fill="rgba(15,23,42,0.9)" stroke={G} strokeWidth="1.5"
                      animate={{ opacity: [0.8, 1, 0.8] }}
                      transition={{ duration: 2, repeat: Infinity }} />
                    <text x={PUB_X} y={pY + 4} textAnchor="middle"
                      fontSize="6.5" fill={G} fontFamily="monospace">PUB</text>
                    <text x={PUB_X} y={pY + 26} textAnchor="middle"
                      fontSize="7.5" fill="rgba(148,163,184,0.7)" fontFamily="monospace">
                      {p.label}
                    </text>
                  </g>
                );
              })}

              {/* Subscribers */}
              {cfg.subscribers.map((s) => {
                const edgeY = SVG_H / 2;
                return (
                  <g key={s.id}>
                    <line x1={BUS_X2} y1={edgeY} x2={SUB_X - 14} y2={s.y}
                      stroke="rgba(74,222,128,0.2)" strokeWidth="1" strokeDasharray="3 3" />
                    <motion.circle cx={SUB_X} cy={s.y} r={13}
                      fill="rgba(15,23,42,0.9)" stroke={G2} strokeWidth="1.5"
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 2.4, repeat: Infinity, delay: 0.5 }} />
                    <text x={SUB_X} y={s.y + 4} textAnchor="middle"
                      fontSize="6.5" fill={G2} fontFamily="monospace">SUB</text>
                    <text x={SUB_X} y={s.y + 26} textAnchor="middle"
                      fontSize="7.5" fill="rgba(148,163,184,0.7)" fontFamily="monospace">
                      {s.label}
                    </text>
                  </g>
                );
              })}

              {/* Animated packets — pub→bus */}
              {cfg.publishers.map((p, pi) => (
                <motion.circle key={`pp-${pi}`} r={4} fill={G}
                  style={{ filter: 'drop-shadow(0 0 4px #4ade80)' }}
                  initial={{ cx: PUB_X, cy: p.y, opacity: 0 }}
                  animate={{
                    cx: [PUB_X, BUS_X1 + 10, midBus],
                    cy: [p.y, SVG_H/2, SVG_H/2],
                    opacity: [0, 1, 0.6],
                  }}
                  transition={{ duration: 0.7, delay: pi * 0.35, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' }}
                />
              ))}

              {/* Animated packets — bus→sub */}
              {cfg.subscribers.map((s, si) => (
                <motion.circle key={`ps-${si}`} r={4} fill={G2}
                  style={{ filter: 'drop-shadow(0 0 4px #86efac)' }}
                  initial={{ cx: midBus, cy: SVG_H/2, opacity: 0 }}
                  animate={{
                    cx: [midBus, BUS_X2 - 10, SUB_X],
                    cy: [SVG_H/2, SVG_H/2, s.y],
                    opacity: [0.6, 1, 0],
                  }}
                  transition={{ duration: 0.7, delay: 0.7 + si * 0.2, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' }}
                />
              ))}
            </motion.svg>
          </AnimatePresence>
        </div>

        {/* echo + cli */}
        <div className="flex flex-col gap-3">
          <div className="simulator-panel rounded-2xl p-4"
            style={{ border: '1px solid rgba(74,222,128,0.2)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-2">
              $ ros2 topic echo {cfg.topic}
            </p>
            <div className="font-mono text-xs space-y-0.5">
              {ECHO_LINES.slice(0, echoIdx).map((l, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                  className={l === '---' ? 'text-green-400/50 mt-1' : l.startsWith('  ') ? 'text-slate-300 pl-2' : 'text-slate-400'}>
                  {l}
                </motion.div>
              ))}
              <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-1.5 h-3 bg-green-400 align-middle" />
            </div>
          </div>
          <CliBlock lines={[
            '# List topics',
            '$ ros2 topic list -t',
            '',
            '# Echo live messages',
            '$ ros2 topic echo /turtle1/pose',
            '',
            '# Publish from CLI',
            '$ ros2 topic pub /turtle1/cmd_vel \\',
            '  geometry_msgs/msg/Twist \\',
            "  '{linear: {x: 1.0}}'",
            '',
            '# Measure rate',
            '$ ros2 topic hz /turtle1/pose',
          ]} />
        </div>
      </div>

      <FactList facts={[
        'Publishers and subscribers are decoupled — neither knows the other exists. A publisher sends whether or not anyone is listening.',
        'All publishers and subscribers on the same topic must use identical message types (type-safe at connection time).',
        'Topics support one-to-one, one-to-many, and many-to-many configurations simultaneously.',
        'QoS profiles (reliability, durability, history depth) control how messages are buffered and delivered.',
        'Use ros2 topic hz to verify publish frequency and ros2 topic bw to measure bandwidth.',
      ]} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PANEL 3 — SERVICES
   ════════════════════════════════════════════════════════════════ */

const SERVICES = [
  {
    id: 'set_pen',
    name: '/turtle1/set_pen',
    type: 'turtlesim/srv/SetPen',
    request:  ['uint8 r', 'uint8 g', 'uint8 b', 'uint8 width', 'uint8 off'],
    response: ['(empty)'],
    client: '/teleop_key',
    server: '/turtlesim',
    callExample: "ros2 service call /turtle1/set_pen \\\n  turtlesim/srv/SetPen \\\n  '{r: 255, g: 0, b: 0, width: 5}'",
  },
  {
    id: 'spawn',
    name: '/spawn',
    type: 'turtlesim/srv/Spawn',
    request:  ['float32 x', 'float32 y', 'float32 theta', 'string name'],
    response: ['string name'],
    client: '/ros2cli',
    server: '/turtlesim',
    callExample: "ros2 service call /spawn \\\n  turtlesim/srv/Spawn \\\n  '{x: 5.5, y: 5.5, name: \"turtle2\"}'",
  },
  {
    id: 'reset',
    name: '/reset',
    type: 'std_srvs/srv/Empty',
    request:  ['(empty)'],
    response: ['(empty)'],
    client: '/ros2cli',
    server: '/turtlesim',
    callExample: "ros2 service call /reset \\\n  std_srvs/srv/Empty",
  },
];

// phase: 'idle' | 'requesting' | 'processing' | 'responding' | 'done'
function ServicesPanel() {
  const [svcIdx, setSvcIdx] = useState(0);
  const [phase, setPhase]   = useState('idle');
  const timerRef = useRef(null);
  const svc = SERVICES[svcIdx];

  const runCycle = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('requesting');
    timerRef.current = setTimeout(() => {
      setPhase('processing');
      timerRef.current = setTimeout(() => {
        setPhase('responding');
        timerRef.current = setTimeout(() => {
          setPhase('done');
          timerRef.current = setTimeout(() => setPhase('idle'), 1200);
        }, 900);
      }, 800);
    }, 900);
  }, [phase]);

  // auto-cycle
  useEffect(() => {
    const t = setTimeout(runCycle, 1200);
    return () => clearTimeout(t);
  }, [phase]);  // eslint-disable-line

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const CLIENT_X = 90, SERVER_X = 450, MID = 270, Y = 110;
  const reqActive  = phase === 'requesting' || phase === 'processing' || phase === 'responding' || phase === 'done';
  const respActive = phase === 'responding' || phase === 'done';

  return (
    <div className="space-y-6">
      <ConceptHeader
        eyebrow="ROS 2 Concept · ros2 service"
        title="Services"
        subtitle="A service is a synchronous request/response channel. A client sends a typed request to a server and blocks until it receives the typed response. Unlike topics, data is exchanged only when explicitly requested."
      />

      {/* service selector */}
      <div className="flex flex-wrap gap-2">
        {SERVICES.map((s, i) => (
          <button key={s.id} onClick={() => { setSvcIdx(i); setPhase('idle'); }}
            className={`rounded-xl px-3 py-1.5 text-xs font-mono transition ${
              svcIdx === i
                ? 'bg-green-400/20 ring-1 ring-green-400/60 text-green-300'
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60'
            }`}>
            {s.name}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">

        {/* diagram */}
        <div className="simulator-panel rounded-2xl p-2 overflow-hidden"
          style={{ border: '1px solid rgba(74,222,128,0.2)' }}>
          <p className="text-[10px] font-mono text-green-400/50 px-3 pt-2 pb-1 uppercase tracking-widest">
            Request / Response · {svc.name}
          </p>
          <AnimatePresence mode="wait">
            <motion.svg key={svcIdx} viewBox="0 0 540 220"
              className="w-full" style={{ maxHeight: 220 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}>

              {/* background grid */}
              {Array.from({ length: 9 }, (_, i) => (
                <line key={`h${i}`} x1={0} y1={i*25} x2={540} y2={i*25}
                  stroke="rgba(74,222,128,0.03)" strokeWidth="0.5" />
              ))}

              {/* ── request arrow ─────────── */}
              <line x1={CLIENT_X + 16} y1={Y - 22} x2={SERVER_X - 16} y2={Y - 22}
                stroke={reqActive ? 'rgba(74,222,128,0.5)' : 'rgba(74,222,128,0.12)'}
                strokeWidth="1.5" strokeDasharray="5 3" />
              <polygon
                points={`${SERVER_X-16},${Y-26} ${SERVER_X-8},${Y-22} ${SERVER_X-16},${Y-18}`}
                fill={reqActive ? G : 'rgba(74,222,128,0.2)'} />
              <text x={MID} y={Y - 30} textAnchor="middle"
                fontSize="8" fill={reqActive ? 'rgba(74,222,128,0.7)' : 'rgba(74,222,128,0.2)'}
                fontFamily="monospace">
                REQUEST
              </text>

              {/* traveling request packet */}
              {phase === 'requesting' && (
                <motion.circle r={5} fill={G}
                  style={{ filter: 'drop-shadow(0 0 6px #4ade80)' }}
                  initial={{ cx: CLIENT_X + 16, cy: Y - 22, opacity: 0 }}
                  animate={{ cx: SERVER_X - 16, cy: Y - 22, opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 0.85, ease: 'easeInOut' }}
                />
              )}

              {/* ── response arrow ─────────── */}
              <line x1={SERVER_X - 16} y1={Y + 22} x2={CLIENT_X + 16} y2={Y + 22}
                stroke={respActive ? 'rgba(251,191,36,0.5)' : 'rgba(251,191,36,0.1)'}
                strokeWidth="1.5" strokeDasharray="5 3" />
              <polygon
                points={`${CLIENT_X+16},${Y+26} ${CLIENT_X+8},${Y+22} ${CLIENT_X+16},${Y+18}`}
                fill={respActive ? '#fbbf24' : 'rgba(251,191,36,0.2)'} />
              <text x={MID} y={Y + 38} textAnchor="middle"
                fontSize="8" fill={respActive ? 'rgba(251,191,36,0.7)' : 'rgba(251,191,36,0.2)'}
                fontFamily="monospace">
                RESPONSE
              </text>

              {/* traveling response packet */}
              {phase === 'responding' && (
                <motion.circle r={5} fill="#fbbf24"
                  style={{ filter: 'drop-shadow(0 0 6px #fbbf24)' }}
                  initial={{ cx: SERVER_X - 16, cy: Y + 22, opacity: 0 }}
                  animate={{ cx: CLIENT_X + 16, cy: Y + 22, opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 0.85, ease: 'easeInOut' }}
                />
              )}

              {/* ── client node ─────────── */}
              <motion.circle cx={CLIENT_X} cy={Y} r={16}
                fill={phase === 'done' ? 'rgba(74,222,128,0.2)' : 'rgba(15,23,42,0.9)'}
                stroke={G} strokeWidth="1.5"
                animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }} />
              <text x={CLIENT_X} y={Y + 4} textAnchor="middle"
                fontSize="7" fill={G} fontFamily="monospace">CLIENT</text>
              <text x={CLIENT_X} y={Y + 30} textAnchor="middle"
                fontSize="8" fill="rgba(148,163,184,0.7)" fontFamily="monospace">
                {svc.client}
              </text>

              {/* ── server node ─────────── */}
              <motion.circle cx={SERVER_X} cy={Y} r={16}
                fill={phase === 'processing' ? 'rgba(74,222,128,0.25)' : 'rgba(15,23,42,0.9)'}
                stroke={G} strokeWidth={phase === 'processing' ? 2 : 1.5}
                animate={phase === 'processing' ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
                transition={{ duration: 0.5, repeat: phase === 'processing' ? Infinity : 0 }} />
              {/* processing spinner */}
              {phase === 'processing' && (
                <motion.circle cx={SERVER_X} cy={Y} r={22}
                  fill="none" stroke={G} strokeWidth="1.5"
                  strokeDasharray="8 8"
                  animate={{ rotate: 360 }}
                  style={{ transformOrigin: `${SERVER_X}px ${Y}px` }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
              )}
              <text x={SERVER_X} y={Y + 4} textAnchor="middle"
                fontSize="7" fill={G} fontFamily="monospace">SERVER</text>
              <text x={SERVER_X} y={Y + 30} textAnchor="middle"
                fontSize="8" fill="rgba(148,163,184,0.7)" fontFamily="monospace">
                {svc.server}
              </text>

              {/* status label */}
              <text x={MID} y={Y + 3} textAnchor="middle"
                fontSize="9" fontFamily="monospace"
                fill={
                  phase === 'idle'        ? 'rgba(74,222,128,0.25)'
                  : phase === 'requesting' ? G
                  : phase === 'processing' ? '#fbbf24'
                  : phase === 'responding' ? '#fbbf24'
                  : G
                }>
                {phase === 'idle'        ? 'waiting...'
                 : phase === 'requesting'? 'sending request →'
                 : phase === 'processing'? 'processing...'
                 : phase === 'responding'? '← sending response'
                 : 'done ✓'}
              </text>
            </motion.svg>
          </AnimatePresence>

          <div className="flex justify-center pb-2">
            <button onClick={runCycle} disabled={phase !== 'idle'}
              className="rounded-lg bg-green-400/10 border border-green-400/30 px-3 py-1
                         text-xs text-green-400 font-mono hover:bg-green-400/20
                         disabled:opacity-40 transition">
              {phase === 'idle' ? '▶ Trigger call' : phase}
            </button>
          </div>
        </div>

        {/* type definition + cli */}
        <div className="flex flex-col gap-3">
          <div className="simulator-panel rounded-2xl p-4"
            style={{ border: '1px solid rgba(74,222,128,0.2)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-1">
              $ ros2 interface show
            </p>
            <p className="font-mono text-xs text-slate-500 mb-3">{svc.type}</p>
            <AnimatePresence mode="wait">
              <motion.div key={svcIdx}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="font-mono text-xs space-y-0.5">
                <p className="text-slate-500 mb-1"># Request</p>
                {svc.request.map(f => <p key={f} className="text-green-300 pl-2">{f}</p>)}
                <p className="text-green-400/40 my-1">---</p>
                <p className="text-slate-500 mb-1"># Response</p>
                {svc.response.map(f => <p key={f} className="text-green-300 pl-2">{f}</p>)}
              </motion.div>
            </AnimatePresence>
          </div>

          <CliBlock lines={[
            '# List services',
            '$ ros2 service list -t',
            '',
            '# Call a service',
            ...svc.callExample.split('\n').map((l, i) => i === 0 ? '$ ' + l : '  ' + l),
            '',
            '# Find by type',
            '$ ros2 service find \\',
            '  turtlesim/srv/Spawn',
          ]} />
        </div>
      </div>

      <FactList facts={[
        'Services are synchronous — the client blocks waiting for the response. Use actions for long-running tasks.',
        'Each service has two typed sections in its .srv file: request fields above "---", response fields below.',
        'Every node automatically advertises ~6 parameter-related services (/get_parameters, /set_parameters, etc.).',
        'Only one server can own a given service name; many clients can call the same service concurrently.',
        'Topics stream data continuously — services deliver data only when asked. Choose based on your communication pattern.',
      ]} />
    </div>
  );
}

/* ── exports ────────────────────────────────────────────────── */
export { NodesPanel, TopicsPanel, ServicesPanel };
