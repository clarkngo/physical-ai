import { useState } from 'react';
import { motion } from 'framer-motion';
import RosNodeGraph    from './RosNodeGraph';
import RosTopicMonitor from './RosTopicMonitor';

const TABS = [
  { id: 'rqt_graph',     label: 'rqt_graph',    icon: '⬡' },
  { id: 'topic_monitor', label: 'Topic Monitor', icon: '📡' },
];

// Static rosData — no live turtle in this view; graph animates on its own
const STATIC_ROS_DATA = {
  pose:       { x: 5.544, y: 5.544, theta: 0, lv: 0, av: 0 },
  cmdVel:     { linear_x: 0, angular_z: 0 },
  cmdActive:  false,
  poseActive: true,
};

/* ── ROS gear-wheel icon ─────────────────────────────────────── */
function RosIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="14" fill="none" stroke="#00a3e0" strokeWidth="4" />
      {[[50,10],[50,90],[10,50],[90,50]].map(([x,y],i) => (
        <g key={i}>
          <line x1="50" y1="50" x2={x} y2={y} stroke="#00a3e0" strokeWidth="3.5" />
          <circle cx={x} cy={y} r="8" fill="#00a3e0" />
        </g>
      ))}
    </svg>
  );
}

export default function RosPage() {
  const [activeTab, setActiveTab] = useState('rqt_graph');

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl px-6 py-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-13 w-13 items-center justify-center rounded-xl
                          bg-[#010d1f] border border-pacificCyan/30 p-2">
            <RosIcon />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">ROS Developer Tools</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Node graph &middot; Topic Monitor
              &nbsp;<span className="text-slate-600">·</span>&nbsp;
              <span className="text-slate-500">TurtleSim available under
                <span className="text-pacificCyan"> Simulators → Robotics</span>
              </span>
            </p>
          </div>

          {/* roscore badge */}
          <div className="ml-auto flex items-center gap-2 rounded-full bg-slate-900/60
                          border border-green-900/60 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-slate-400 font-mono">roscore</span>
            <span className="text-xs text-green-400 font-mono font-semibold">RUNNING</span>
          </div>
        </div>

        {/* Quick-ref ros2 commands */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            'ros2 run turtlesim turtlesim_node',
            'ros2 run turtlesim turtle_teleop_key',
            'ros2 topic echo /turtle1/pose',
            'rqt_graph',
          ].map(cmd => (
            <code key={cmd}
              className="rounded-lg bg-slate-900/80 border border-slate-800 px-3 py-1
                         text-[11px] text-pacificCyan font-mono">
              {cmd}
            </code>
          ))}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`relative rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-pacificCyan text-slate-950'
                : 'glass-card text-slate-300 hover:text-white'
            }`}>
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────────── */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}>
        {activeTab === 'rqt_graph'     && <RosNodeGraph    rosData={STATIC_ROS_DATA} />}
        {activeTab === 'topic_monitor' && <RosTopicMonitor rosData={STATIC_ROS_DATA} />}
      </motion.div>

    </div>
  );
}
