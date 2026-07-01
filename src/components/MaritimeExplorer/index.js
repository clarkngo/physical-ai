import { SIMULATION_MODES } from './subsystemConcepts.js';
import { getConceptById, getConceptForSelection } from './maritimeConcepts.js';

export { default as MaritimeScene } from './MaritimeScene.jsx';
export { default as ConceptPanel } from './ConceptPanel.jsx';
export { default as TelemetryChart } from './TelemetryChart.jsx';
export { default as ExplorerHud } from './ExplorerHud.jsx';
export { default as FullscreenToggle } from './FullscreenToggle.jsx';
export { default as IncidentDashboard } from './IncidentDashboard.jsx';
export * from './maritimeConcepts.js';
export * from './attackScenario.js';
export * from './threatProfiles.js';
export * from './subsystemConcepts.js';

export function resolveSelectionConcept(selectionId, simulationMode = SIMULATION_MODES.OPERATIONAL) {
  return getConceptForSelection(selectionId, simulationMode);
}
