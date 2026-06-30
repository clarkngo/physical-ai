import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ConceptPanel,
  ExplorerHud,
  FullscreenToggle,
  MaritimeScene,
  SIMULATION_MODES,
  getConceptForSelection,
} from '../components/MaritimeExplorer';
import {
  DEFAULT_ATTACK_SCENARIO_ID,
  getInitialIncidentSteps,
  getScenarioById,
} from '../components/MaritimeExplorer/attackScenario.js';
import MaritimeSectionNav from '../components/MaritimeSectionNav';

export default function MaritimeExplorerPage() {
  const moduleRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [simulationMode, setSimulationMode] = useState(SIMULATION_MODES.OPERATIONAL);
  const [bottomDockMinimized, setBottomDockMinimized] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState(DEFAULT_ATTACK_SCENARIO_ID);
  const [incidentSteps, setIncidentSteps] = useState(() =>
    getInitialIncidentSteps(getScenarioById(DEFAULT_ATTACK_SCENARIO_ID)),
  );

  const selectedConcept = useMemo(
    () => getConceptForSelection(selectedId, simulationMode),
    [selectedId, simulationMode],
  );
  const hoveredConcept = useMemo(
    () => getConceptForSelection(hoveredId, simulationMode),
    [hoveredId, simulationMode],
  );

  useEffect(() => {
    if (simulationMode === SIMULATION_MODES.OPERATIONAL) {
      setIncidentSteps(getInitialIncidentSteps(getScenarioById(activeScenarioId)));
    }
  }, [simulationMode]);

  function handleScenarioChange(nextScenarioId) {
    setActiveScenarioId(nextScenarioId);
    setIncidentSteps(getInitialIncidentSteps(getScenarioById(nextScenarioId)));
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (event.code !== 'Space' && event.key !== ' ') return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      event.preventDefault();
      setSimulationMode((mode) =>
        mode === SIMULATION_MODES.OPERATIONAL
          ? SIMULATION_MODES.ATTACK
          : SIMULATION_MODES.OPERATIONAL,
      );
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <MaritimeSectionNav />

      <header className="glass-card rounded-2xl px-5 py-4 md:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pacificCyan">
          Interactive Learning Sandbox
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-whiteHull md:text-3xl">
          Maritime CPS Explorer
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          Immersive digital-twin viewport with floating HUD controls. Click assets in 3D or use the
          navigator overlay to inspect CPS concepts and threat vectors.
        </p>
      </header>

      <div
        ref={moduleRef}
        className="maritime-explorer-module h-[min(88vh,960px)] min-h-[640px] w-full rounded-2xl border border-white/10"
      >
        <MaritimeScene
          selectedId={selectedId}
          simulationMode={simulationMode}
          activeScenarioId={activeScenarioId}
          incidentSteps={incidentSteps}
          onSelect={setSelectedId}
          onHoverChange={setHoveredId}
        />

        <ExplorerHud
          selectedId={selectedId}
          hoveredConcept={hoveredConcept}
          simulationMode={simulationMode}
          onSelect={setSelectedId}
          onClearSelection={() => setSelectedId(null)}
          onSimulationModeChange={setSimulationMode}
          bottomDockMinimized={bottomDockMinimized}
          onToggleBottomDock={() => setBottomDockMinimized((min) => !min)}
          activeScenarioId={activeScenarioId}
          onScenarioChange={handleScenarioChange}
          incidentSteps={incidentSteps}
          onCompleteIncidentStep={(stepId) =>
            setIncidentSteps((prev) => ({ ...prev, [stepId]: true }))
          }
          conceptPanel={
            <ConceptPanel
              concept={selectedConcept}
              simulationMode={simulationMode}
              onClose={() => setSelectedId(null)}
            />
          }
        />

        <FullscreenToggle targetRef={moduleRef} />
      </div>
    </div>
  );
}
