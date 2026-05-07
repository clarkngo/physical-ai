import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AVAILABLE_TOPICS = [
  { name: '/turtle1/pose',    type: 'turtlesim/msg/Pose',       hz: '~62 Hz',  color: '#4ade80' },
  { name: '/turtle1/cmd_vel', type: 'geometry_msgs/msg/Twist',  hz: 'on-key',  color: '#00a3e0' },
  { name: '/rosout',          type: 'rcl_interfaces/msg/Log',   hz: '~2 Hz',   color: '#a78bfa' },
  { name: '/parameter_events',type: 'rcl_interfaces/msg/ParameterEvent', hz: 'rare', color: '#fb923c' },
];

function formatMsg(topic, rosData) {
  if (topic === '/turtle1/pose' && rosData?.pose) {
    const p = rosData.pose;
    return `---\nx: ${p.x?.toFixed(6) ?? '5.544445'}\ny: ${p.y?.toFixed(6) ?? '5.544445'}\ntheta: ${p.theta?.toFixed(6) ?? '0.000000'}\nlinear_velocity: ${p.lv?.toFixed(6) ?? '0.000000'}\nangular_velocity: ${p.av?.toFixed(6) ?? '0.000000'}`;
  }
  if (topic === '/turtle1/cmd_vel' && rosData?.cmdVel) {
    const c = rosData.cmdVel;
    return `---\nlinear:\n  x: ${c.linear_x?.toFixed(6) ?? '0.000000'}\n  y: 0.000000\n  z: 0.000000\nangular:\n  x: 0.000000\n  y: 0.000000\n  z: ${c.angular_z?.toFixed(6) ?? '0.000000'}`;
  }
  if (topic === '/rosout') {
    return `---\nstamp:\n  sec: ${Math.floor(Date.now()/1000)}\n  nanosec: ${(Date.now()%1000)*1e6|0}\nlevel: 20\nname: turtlesim\nmsg: Spawning turtle [turtle1] at (5.544, 5.544, 0.000)`;
  }
  return '---\n(no data)';
}

/* ── Scrolling message log ───────────────────────────────────── */
function MessageLog({ messages, topicColor }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <div className="h-full overflow-y-auto font-mono text-xs leading-relaxed p-3 space-y-2">
      <AnimatePresence initial={false}>
        {messages.map((m, i) => (
          <motion.div key={m.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="border-b border-slate-800 pb-2">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-slate-600">{new Date(m.ts).toISOString().slice(11, 23)}</span>
              <span className="font-semibold" style={{ color: topicColor }}>{m.topic}</span>
            </div>
            <pre className="text-slate-300 whitespace-pre-wrap">{m.content}</pre>
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={endRef} />
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export default function RosTopicMonitor({ rosData }) {
  const [selectedTopic, setSelectedTopic] = useState('/turtle1/pose');
  const [echoActive,    setEchoActive]    = useState(false);
  const [messages,      setMessages]      = useState([]);
  const [msgId,         setMsgId]         = useState(0);
  const intervalRef = useRef(null);

  const selectedMeta = AVAILABLE_TOPICS.find(t => t.name === selectedTopic);

  /* Start/stop topic echo */
  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (!echoActive) return;

    const push = () => {
      setMsgId(id => {
        const newId = id + 1;
        setMessages(prev => [
          ...prev.slice(-49),
          { id: newId, ts: Date.now(), topic: selectedTopic, content: formatMsg(selectedTopic, rosData) },
        ]);
        return newId;
      });
    };

    push(); // immediate first message
    const hz = selectedTopic === '/turtle1/pose' ? 250
             : selectedTopic === '/rosout'       ? 2000
             : 500;
    intervalRef.current = setInterval(push, hz);
    return () => { clearInterval(intervalRef.current); intervalRef.current = null; };
  }, [echoActive, selectedTopic]); // eslint-disable-line

  /* Update latest message in place when rosData changes, without flooding */
  useEffect(() => {
    if (!echoActive) return;
    setMessages(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      return [
        ...prev.slice(0, -1),
        { ...last, ts: Date.now(), content: formatMsg(selectedTopic, rosData) },
      ];
    });
  }, [rosData, echoActive, selectedTopic]);

  const clearLog = () => setMessages([]);

  return (
    <div className="flex flex-col lg:flex-row gap-5" style={{ minHeight: 540 }}>

      {/* Left: topic list */}
      <div className="flex flex-col gap-3 lg:w-72 flex-shrink-0">

        {/* rostopic list */}
        <div className="simulator-panel rounded-xl p-4">
          <h3 className="mb-1 text-[11px] font-bold uppercase tracking-widest text-pacificCyan">
            rostopic list
          </h3>
          <p className="mb-3 text-[10px] text-slate-500 font-mono">$ rostopic list</p>
          <div className="flex flex-col gap-1">
            {AVAILABLE_TOPICS.map(t => (
              <button key={t.name} onClick={() => { setSelectedTopic(t.name); setEchoActive(false); clearLog(); }}
                className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition ${
                  selectedTopic === t.name ? 'bg-pacificCyan/15 ring-1 ring-pacificCyan/40' : 'hover:bg-slate-800/60'
                }`}>
                <span className="mt-1 h-2 w-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
                <div>
                  <div className="font-mono text-xs text-slate-200">{t.name}</div>
                  <div className="text-[10px] text-slate-500">{t.type}</div>
                </div>
                <span className="ml-auto text-[10px] text-slate-600 font-mono mt-0.5">{t.hz}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Topic info */}
        {selectedMeta && (
          <div className="simulator-panel rounded-xl p-4">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-pacificCyan">
              rostopic info
            </h3>
            <div className="space-y-1 font-mono text-[11px]">
              <div><span className="text-slate-500">Type: </span><span className="text-slate-300">{selectedMeta.type}</span></div>
              <div className="mt-2 text-slate-500">Publishers:</div>
              <div className="pl-3 text-pacificCyan">
                {selectedMeta.name === '/turtle1/cmd_vel' ? '/teleop_turtle' : '/turtlesim'}
              </div>
              {(selectedMeta.name !== '/rosout') && (
                <>
                  <div className="mt-1 text-slate-500">Subscribers:</div>
                  <div className="pl-3 text-amber-400">
                    {selectedMeta.name === '/turtle1/cmd_vel' ? '/turtlesim' : '/rviz2'}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: echo panel */}
      <div className="simulator-panel rounded-xl flex flex-col flex-1 overflow-hidden" style={{ minHeight: 480 }}>

        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
          <span className="font-mono text-xs text-slate-400">$</span>
          <span className="font-mono text-xs text-slate-200">
            rostopic echo&nbsp;
            <span style={{ color: selectedMeta?.color ?? '#fff' }}>{selectedTopic}</span>
          </span>

          <div className="ml-auto flex items-center gap-2">
            {echoActive && (
              <span className="flex items-center gap-1.5 text-[10px] text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                streaming
              </span>
            )}
            <button onClick={clearLog}
              className="rounded-md bg-slate-800 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-700 transition">
              Clear
            </button>
            <button onClick={() => setEchoActive(v => !v)}
              className={`rounded-md px-3 py-1 text-[11px] font-semibold transition ${
                echoActive ? 'bg-red-900/60 text-red-300 hover:bg-red-900' : 'bg-pacificCyan text-slate-950 hover:bg-cyan-300'
              }`}>
              {echoActive ? '■ Stop' : '▶ Echo'}
            </button>
          </div>
        </div>

        {/* Message stream */}
        <div className="flex-1 overflow-hidden">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-600 text-sm font-mono">
              {echoActive ? 'Waiting for messages…' : 'Press ▶ Echo to subscribe'}
            </div>
          ) : (
            <MessageLog messages={messages} topicColor={selectedMeta?.color ?? '#94a3b8'} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-4 py-2 flex items-center gap-4 text-[10px] text-slate-600 font-mono">
          <span>{messages.length} messages</span>
          {messages.length > 0 && (
            <span>last: {new Date(messages[messages.length - 1].ts).toISOString().slice(11, 23)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
