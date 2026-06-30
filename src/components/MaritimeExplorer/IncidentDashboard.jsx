import {
  ATTACK_SCENARIOS,
  getScenarioById,
  isIncidentResolved,
} from './attackScenario.js';

export default function IncidentDashboard({
  simulationMode,
  activeScenarioId,
  onScenarioChange,
  incidentSteps,
  onCompleteStep,
}) {
  const isAttack = simulationMode === 'ATTACK';
  if (!isAttack) return null;

  const scenario = getScenarioById(activeScenarioId);
  const resolved = isIncidentResolved(incidentSteps, scenario);
  const { alert, mitigationSteps, hardeningStrategies, title, resolvedMessage } = scenario;

  return (
    <div className="maritime-hud-interactive pointer-events-auto w-full rounded-xl border border-amber-500/40 bg-slate-950/90 backdrop-blur-md">
      <div className="border-b border-amber-500/30 px-4 py-3">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Change Scenario
            <select
              value={activeScenarioId}
              onChange={(e) => onScenarioChange(e.target.value)}
              className="maritime-hud mt-1 block w-full rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-200"
            >
              {ATTACK_SCENARIOS.map(({ id, title: scenarioTitle }) => (
                <option key={id} value={id}>
                  {scenarioTitle}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400">
            Active Incident · {title}
          </p>
        </div>
        {!resolved && (
          <p className="mt-2 text-sm font-semibold leading-snug text-red-400">{alert}</p>
        )}
        {resolved && (
          <p className="mt-2 text-sm font-semibold text-emerald-400">{resolvedMessage}</p>
        )}
      </div>

      {!resolved && (
        <div className="space-y-2 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Reactive Playbook
          </p>
          {mitigationSteps.map(({ id, label, detail }, index) => {
            const done = incidentSteps[id];
            const priorDone = mitigationSteps
              .slice(0, index)
              .every(({ id: stepId }) => incidentSteps[stepId]);
            const enabled = priorDone && !done;

            return (
              <button
                key={id}
                type="button"
                disabled={!enabled}
                onClick={() => onCompleteStep(id)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                  done
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : enabled
                      ? 'border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20'
                      : 'cursor-not-allowed border-white/5 bg-white/5 opacity-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                      done ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {done ? '✓' : index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-100">{label}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{detail}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {resolved && (
        <div className="space-y-2 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            System Hardening
          </p>
          {hardeningStrategies.map(({ title: strategyTitle, detail }) => (
            <div
              key={strategyTitle}
              className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2.5"
            >
              <p className="text-xs font-semibold text-cyan-300">{strategyTitle}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
