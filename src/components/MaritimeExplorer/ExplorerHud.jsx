import { MARITIME_CONCEPTS } from './maritimeConcepts.js';
import { SIMULATION_MODES, SUBSYSTEM_CONCEPTS } from './subsystemConcepts.js';
import { HUMAN_THREAT_ACTORS, MACHINE_THREAT_PROFILES } from './threatProfiles.js';
import IncidentDashboard from './IncidentDashboard.jsx';

const OBJECT_HINTS = Object.values(MARITIME_CONCEPTS).map(({ id, label, title }) => ({
  id,
  label,
  title,
}));

const SUBSYSTEM_HINTS = Object.values(SUBSYSTEM_CONCEPTS).map(({ id, label, parentAsset }) => ({
  id,
  label,
  parentAsset,
}));

export default function ExplorerHud({
  selectedId,
  hoveredConcept,
  simulationMode,
  onSelect,
  onClearSelection,
  onSimulationModeChange,
  conceptPanel,
  incidentSteps,
  onCompleteIncidentStep,
  activeScenarioId,
  onScenarioChange,
  bottomDockMinimized,
  onToggleBottomDock,
}) {
  const isAttack = simulationMode === SIMULATION_MODES.ATTACK;

  return (
    <div className="maritime-hud-root">
      <div className="maritime-hud-topbar">
        <div className="maritime-hud pointer-events-none max-w-md rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-pacificCyan">
            Digital Twin · Live
          </p>
          <p className="mt-1 text-sm text-slate-200">
            {hoveredConcept
              ? hoveredConcept.label
              : 'Orbit · zoom · click assets · Space toggles mode'}
          </p>
        </div>

        <div className="maritime-hud-interactive flex flex-wrap items-center gap-2">
          <div className="maritime-hud rounded-xl p-1">
            <div className="flex gap-1">
              {[SIMULATION_MODES.OPERATIONAL, SIMULATION_MODES.ATTACK].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSimulationModeChange(mode)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    simulationMode === mode
                      ? mode === SIMULATION_MODES.ATTACK
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-pacificCyan text-slate-950'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {mode === SIMULATION_MODES.OPERATIONAL ? 'Ops' : 'Attack'}
                </button>
              ))}
            </div>
          </div>

          {selectedId && !isAttack && (
            <button
              type="button"
              onClick={onClearSelection}
              className="maritime-hud rounded-xl px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {!isAttack && conceptPanel && (
        <div className="maritime-concept-float">{conceptPanel}</div>
      )}

      {isAttack && (
        <div className="maritime-incident-panel">
          <IncidentDashboard
            simulationMode={simulationMode}
            activeScenarioId={activeScenarioId}
            onScenarioChange={onScenarioChange}
            incidentSteps={incidentSteps}
            onCompleteStep={onCompleteIncidentStep}
          />
        </div>
      )}

      <div
        className={`maritime-hud-dock-wrap ${bottomDockMinimized ? 'maritime-hud-dock-wrap--minimized' : ''}`}
      >
        <button
          type="button"
          onClick={onToggleBottomDock}
          className="maritime-hud-dock-toggle maritime-hud-interactive maritime-hud flex items-center gap-1.5 rounded-t-lg px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 transition hover:text-slate-200"
          aria-expanded={!bottomDockMinimized}
          aria-label={bottomDockMinimized ? 'Show HUD panel' : 'Hide HUD panel'}
        >
          <span
            className="inline-block transition-transform duration-300"
            style={{ transform: bottomDockMinimized ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            ▾
          </span>
          {bottomDockMinimized ? 'Show HUD' : 'Hide HUD'}
        </button>

        <div className="maritime-hud-dock maritime-hud">
          {isAttack && (
            <div className="border-b border-white/10">
              <div className="px-4 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Threat Actors · Humans & Machines
                </p>
              </div>
              <div className="maritime-hud-interactive grid gap-1 p-2 sm:grid-cols-2 lg:grid-cols-3">
                {HUMAN_THREAT_ACTORS.map(({ id, label, role, threatVector }) => (
                  <div key={id} className="rounded-lg bg-white/5 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-200">{label}</p>
                    <p className="text-[10px] text-slate-500">{role}</p>
                    <p className="mt-1 text-[10px] text-amber-400/90">{threatVector}</p>
                  </div>
                ))}
                {['straddle_carrier', 'power_hub'].map((id) => {
                  const concept = MARITIME_CONCEPTS[id];
                  const profile = MACHINE_THREAT_PROFILES[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelect(id)}
                      className="rounded-lg bg-white/5 px-3 py-2 text-left transition hover:bg-white/10"
                    >
                      <p className="text-xs font-semibold text-slate-200">{concept.label}</p>
                      <p className="text-[10px] text-slate-500">{concept.category}</p>
                      <p className="mt-1 text-[10px] text-amber-400/90">{profile.threatVector}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-b border-white/10 px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Port Assets
            </p>
          </div>
          <div className="maritime-hud-interactive grid gap-1 p-2 sm:grid-cols-2 lg:grid-cols-4">
            {OBJECT_HINTS.map(({ id, label, title }) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                className={`rounded-lg px-3 py-2 text-left transition ${
                  selectedId === id
                    ? isAttack
                      ? 'bg-amber-500/20 ring-1 ring-amber-400/50'
                      : 'bg-cyan-500/15 ring-1 ring-cyan-400/40'
                    : 'hover:bg-white/5'
                }`}
              >
                <p className="text-[10px] text-slate-500">{label}</p>
                <p className="text-xs text-slate-200">{title}</p>
              </button>
            ))}
          </div>

          <div className="border-t border-white/10 px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Sub-components
            </p>
          </div>
          <div className="maritime-hud-interactive grid gap-1 p-2 sm:grid-cols-2">
            {SUBSYSTEM_HINTS.map(({ id, label, parentAsset }) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                className={`rounded-lg px-3 py-2 text-left transition ${
                  selectedId === id
                    ? isAttack
                      ? 'bg-amber-500/20 ring-1 ring-amber-400/50'
                      : 'bg-cyan-500/15 ring-1 ring-cyan-400/40'
                    : 'hover:bg-white/5'
                }`}
              >
                <p className="font-mono text-[9px] text-slate-600">{id}</p>
                <p className="text-xs text-slate-300">{label}</p>
                <p className="text-[10px] text-slate-500">{parentAsset}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
