import { AnimatePresence, motion } from 'framer-motion';
import { SIMULATION_MODES } from './subsystemConcepts.js';
import TelemetryChart from './TelemetryChart.jsx';

export default function ConceptPanel({ concept, simulationMode, onClose }) {
  const isAttack = simulationMode === SIMULATION_MODES.ATTACK;

  return (
    <AnimatePresence>
      {concept ? (
        <motion.aside
          key={`${concept.id}-${simulationMode}`}
          className={`maritime-hud maritime-hud-interactive flex max-h-[min(70vh,520px)] w-full flex-col overflow-hidden rounded-xl ${
            isAttack ? 'ring-1 ring-amber-500/30' : 'ring-1 ring-cyan-500/20'
          }`}
          initial={{ x: -24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -24, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              {isAttack && (
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400">
                  Cyber Attack Simulation
                </p>
              )}
              <p
                className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                  isAttack ? 'text-amber-400' : 'text-pacificCyan'
                }`}
              >
                {concept.category}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-whiteHull">{concept.title}</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {concept.isSubsystem ? `Subsystem · ${concept.label}` : concept.label}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {concept.showTelemetryChart && simulationMode === SIMULATION_MODES.OPERATIONAL && (
              <div className="mb-4">
                <TelemetryChart active />
              </div>
            )}

            {concept.showTelemetryChart && isAttack && (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-950/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                  Telemetry Integrity Alert
                </p>
                <p className="mt-1 font-mono text-[11px] text-amber-200/80">
                  Anomaly score 0.94 · checksum mismatch · stream desync detected
                </p>
                <div className="mt-2">
                  <TelemetryChart active />
                </div>
              </div>
            )}

            <p className="text-sm leading-relaxed text-slate-300">{concept.description}</p>

            {concept.isSubsystem && (
              <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Sub-component ID
                </p>
                <p className="mt-1 font-mono text-xs text-cyan-400/90">{concept.id}</p>
              </div>
            )}
          </div>
        </motion.aside>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="maritime-hud hidden max-w-xs rounded-xl px-4 py-4 md:block"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-pacificCyan">
            Concept Panel
          </p>
          <h2 className="mt-2 text-sm font-semibold text-whiteHull">Select a port asset</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Click in the 3D scene or use the asset navigator below to open CPS explainers here.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
