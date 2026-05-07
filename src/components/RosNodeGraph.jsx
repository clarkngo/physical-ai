import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Layout (SVG viewBox 0 0 720 340) ───────────────────────── */
//
//  [/teleop_turtle]───(/turtle1/cmd_vel)───[/turtlesim]───(/rosout)
//        80,170             280,170            480,170      640,100
//                                                │
//                                       (/turtle1/pose)
//                                            480,270
//                                                │
//                                          [/rviz2]
//                                           480,340  (inactive)
//

const NODES = [
  { id: 'teleop',    label: '/teleop_turtle',  x: 80,  y: 170, type: 'node' },
  { id: 'turtlesim', label: '/turtlesim',      x: 480, y: 170, type: 'node' },
  { id: 'rviz2',     label: '/rviz2',          x: 480, y: 340, type: 'node', dim: true },
];

const TOPICS = [
  { id: 'cmd_vel', label: '/turtle1/cmd_vel', x: 280, y: 170, type: 'topic' },
  { id: 'pose',    label: '/turtle1/pose',    x: 480, y: 270, type: 'topic' },
  { id: 'rosout',  label: '/rosout',          x: 640, y: 100, type: 'topic' },
];

// [from, to, topic-id]
const EDGES = [
  { from: { x: 80,  y: 170 }, to: { x: 230, y: 170 }, topicId: 'cmd_vel', dir: 'pub' },  // teleop → cmd_vel
  { from: { x: 330, y: 170 }, to: { x: 430, y: 170 }, topicId: 'cmd_vel', dir: 'sub' },  // cmd_vel → turtlesim
  { from: { x: 480, y: 195 }, to: { x: 480, y: 245 }, topicId: 'pose',    dir: 'pub' },  // turtlesim → pose
  { from: { x: 480, y: 295 }, to: { x: 480, y: 315 }, topicId: 'pose',    dir: 'sub' },  // pose → rviz2
  { from: { x: 510, y: 158 }, to: { x: 608, y: 110 }, topicId: 'rosout',  dir: 'pub' },  // turtlesim → rosout
];

const NW = 120; // node box width
const NH = 32;  // node box height
const TW = 136; // topic box width
const TH = 28;  // topic box height

/* ── Packet that travels along an edge ──────────────────────── */
function Packet({ from, to, color, delay = 0 }) {
  return (
    <motion.circle
      r={4}
      fill={color}
      style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      initial={{ cx: from.x, cy: from.y, opacity: 0 }}
      animate={{
        cx:      [from.x, to.x],
        cy:      [from.y, to.y],
        opacity: [0, 1, 1, 0],
      }}
      transition={{ duration: 0.55, delay, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.9 }}
    />
  );
}

/* ── Node box ────────────────────────────────────────────────── */
function NodeBox({ x, y, label, active, dim }) {
  const color = active ? '#00a3e0' : dim ? '#1e293b' : '#334155';
  return (
    <g>
      <rect x={x - NW / 2} y={y - NH / 2} width={NW} height={NH} rx={8}
        fill={active ? 'rgba(0,163,224,0.18)' : dim ? 'rgba(15,23,42,0.5)' : 'rgba(30,41,59,0.9)'}
        stroke={color} strokeWidth={active ? 1.5 : 0.8} />
      {active && (
        <rect x={x - NW / 2} y={y - NH / 2} width={NW} height={NH} rx={8}
          fill="none" stroke="#00a3e0" strokeWidth={2} opacity={0.3}>
          <animate attributeName="stroke-width" values="1;3;1" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity"      values="0.3;0.6;0.3" dur="1.8s" repeatCount="indefinite" />
        </rect>
      )}
      <circle cx={x - NW / 2 + 12} cy={y} r={4}
        fill={active ? '#00a3e0' : dim ? '#1e293b' : '#475569'}
        stroke={active ? '#7dd3fc' : 'none'} strokeWidth={1}>
        {active && <animate attributeName="r" values="4;5.5;4" dur="1.4s" repeatCount="indefinite" />}
      </circle>
      <text x={x - NW / 2 + 22} y={y + 4} fontSize={9} fontFamily="monospace"
        fill={active ? '#e2e8f0' : dim ? '#334155' : '#94a3b8'}>
        {label}
      </text>
    </g>
  );
}

/* ── Topic box ───────────────────────────────────────────────── */
function TopicBox({ x, y, label, active }) {
  return (
    <g>
      <rect x={x - TW / 2} y={y - TH / 2} width={TW} height={TH} rx={5}
        fill={active ? 'rgba(251,146,60,0.15)' : 'rgba(15,23,42,0.9)'}
        stroke={active ? '#fb923c' : '#334155'} strokeWidth={active ? 1.5 : 0.75} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={8.5} fontFamily="monospace"
        fill={active ? '#fdba74' : '#64748b'}>
        {label}
      </text>
    </g>
  );
}

/* ── Arrow head ──────────────────────────────────────────────── */
function Arrow({ from, to, active, dim }) {
  const dx   = to.x - from.x, dy = to.y - from.y;
  const len  = Math.sqrt(dx * dx + dy * dy);
  const ux   = dx / len,      uy = dy / len;
  const tipX = to.x - ux * 2, tipY = to.y - uy * 2;
  const color = active ? '#00a3e0' : dim ? '#1e293b' : '#334155';

  return (
    <g>
      <line x1={from.x} y1={from.y} x2={tipX} y2={tipY}
        stroke={color} strokeWidth={active ? 1.5 : 0.75} strokeDasharray={active ? 'none' : '4 3'} />
      <polygon
        points={`${tipX},${tipY} ${tipX - ux * 7 + uy * 3.5},${tipY - uy * 7 - ux * 3.5} ${tipX - ux * 7 - uy * 3.5},${tipY - uy * 7 + ux * 3.5}`}
        fill={color} />
    </g>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export default function RosNodeGraph({ rosData }) {
  const poseActive = rosData?.poseActive ?? true;

  // cmdActive: use prop if live data present, otherwise self-animate
  // (burst on for 1.2s every 4s so the graph looks alive in standalone mode)
  const [simCmd, setSimCmd] = useState(false);
  const hasLiveData = rosData?.cmdActive !== undefined && rosData?.cmdActive !== false;
  const cmdActive  = hasLiveData ? rosData.cmdActive : simCmd;

  useEffect(() => {
    if (hasLiveData) return; // live turtle is driving it, don't interfere
    const fire = () => {
      setSimCmd(true);
      setTimeout(() => setSimCmd(false), 1200);
    };
    fire();
    const id = setInterval(fire, 4000);
    return () => clearInterval(id);
  }, [hasLiveData]);

  const isActive = (topicId) => {
    if (topicId === 'cmd_vel') return cmdActive;
    if (topicId === 'pose')    return poseActive;
    if (topicId === 'rosout')  return true; // always alive
    return false;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Graph */}
      <div className="simulator-panel rounded-2xl p-5">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-200">rqt_graph</h3>
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] text-slate-400 font-mono">
            Nodes/Topics (All)
          </span>
          <div className="ml-auto flex items-center gap-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-6 rounded-sm" style={{ background: '#00a3e0' }} />
              Node
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-6 rounded-sm" style={{ background: '#fb923c' }} />
              Topic
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl bg-[#010d1f]">
          <svg viewBox="0 0 720 390" className="w-full" style={{ minWidth: 560, maxHeight: 340 }}>
            {/* Background grid */}
            {Array.from({ length: 24 }, (_, i) => (
              <line key={`v${i}`} x1={i * 30} y1={0} x2={i * 30} y2={390}
                stroke="rgba(0,163,224,0.04)" strokeWidth={0.5} />
            ))}
            {Array.from({ length: 13 }, (_, i) => (
              <line key={`h${i}`} x1={0} y1={i * 30} x2={720} y2={i * 30}
                stroke="rgba(0,163,224,0.04)" strokeWidth={0.5} />
            ))}

            {/* Edges */}
            {EDGES.map((e, i) => (
              <Arrow key={i} from={e.from} to={e.to} active={isActive(e.topicId)} />
            ))}

            {/* Animated packets */}
            <AnimatePresence>
              {cmdActive && (
                <>
                  <Packet key="p1" from={{ x: 80, y: 170 }} to={{ x: 230, y: 170 }} color="#00a3e0" delay={0} />
                  <Packet key="p2" from={{ x: 330, y: 170 }} to={{ x: 430, y: 170 }} color="#00a3e0" delay={0.2} />
                </>
              )}
              {poseActive && (
                <>
                  <Packet key="p3" from={{ x: 480, y: 195 }} to={{ x: 480, y: 245 }} color="#4ade80" delay={0} />
                  <Packet key="p4" from={{ x: 480, y: 295 }} to={{ x: 480, y: 315 }} color="#4ade80" delay={0.3} />
                </>
              )}
              <Packet key="p5" from={{ x: 510, y: 158 }} to={{ x: 608, y: 110 }} color="#a78bfa" delay={0.1} />
            </AnimatePresence>

            {/* Topics */}
            {TOPICS.map(t => (
              <TopicBox key={t.id} x={t.x} y={t.y} label={t.label} active={isActive(t.id)} />
            ))}

            {/* Nodes */}
            {NODES.map(n => (
              <NodeBox key={n.id} x={n.x} y={n.y} label={n.label}
                active={n.id === 'turtlesim' ? true : n.id === 'teleop' ? cmdActive : false}
                dim={n.dim} />
            ))}
          </svg>
        </div>
      </div>

      {/* Node info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            name: '/teleop_turtle',
            color: '#00a3e0',
            active: cmdActive,
            pub: ['/turtle1/cmd_vel'],
            sub: [],
            desc: 'Reads keyboard / d-pad input and publishes velocity commands.',
          },
          {
            name: '/turtlesim',
            color: '#4ade80',
            active: true,
            pub: ['/turtle1/pose', '/rosout'],
            sub: ['/turtle1/cmd_vel'],
            desc: 'Simulates a turtle. Integrates cmd_vel and publishes pose at ~62 Hz.',
          },
          {
            name: '/rviz2',
            color: '#a78bfa',
            active: false,
            pub: [],
            sub: ['/turtle1/pose'],
            desc: '3-D visualizer (inactive). Subscribes to pose for live transform overlay.',
          },
        ].map(node => (
          <div key={node.name} className={`simulator-panel rounded-xl p-4 ${!node.active ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ background: node.active ? node.color : '#334155',
                         boxShadow: node.active ? `0 0 6px ${node.color}` : 'none' }} />
              <span className="font-mono text-xs text-slate-200">{node.name}</span>
              {node.active
                ? <span className="ml-auto text-[10px] text-green-400 font-semibold">RUNNING</span>
                : <span className="ml-auto text-[10px] text-slate-500">INACTIVE</span>}
            </div>
            <p className="text-[11px] text-slate-400 mb-3">{node.desc}</p>
            {node.pub.length > 0 && (
              <div className="mb-1.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Publishes</span>
                {node.pub.map(t => (
                  <div key={t} className="font-mono text-[11px] text-amber-400 mt-0.5">{t}</div>
                ))}
              </div>
            )}
            {node.sub.length > 0 && (
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Subscribes</span>
                {node.sub.map(t => (
                  <div key={t} className="font-mono text-[11px] text-pacificCyan mt-0.5">{t}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
