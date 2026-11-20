import CollisionAvoidanceV1 from '../components/archive/CollisionAvoidanceV1.jsx';
import LabArchive from './LabArchive.jsx';

const VERSIONS = [
  {
    tag: 'v1',
    title: 'Scripted encounter animation',
    status: 'Archived (this page)',
    stack: ['React', 'SVG', 'framer-motion'],
    notes: [
      'Three encounters drawn as fixed SVG curves; the policy mode only changes how far the curve bends.',
      'Closest point of approach, compliance and intervention figures come from a formula over scenario constants.',
    ],
  },
  {
    tag: 'v2',
    title: 'Ship dynamics + COLREG navigator',
    status: 'Live',
    stack: ['React', 'Canvas 2D', 'Nomoto ship model', 'CPA/TCPA', 'COLREG Rules 8, 13–17'],
    notes: [
      'Ships turn with the Nomoto model, rudder angle and rate limits; a ferry, container ship and tanker handle differently.',
      'The navigator classifies each encounter, plans alterations by simulating the turn, and every result is measured from the run and checked against the rules.',
    ],
  },
];

const KNOWN_ISSUES = [
  'The own ship follows a hand-drawn curve; it has no heading, rudder or turning dynamics, and the target always follows the same path.',
  '“Closest Point of Approach” is 1.8 − 0.9·traffic + 0.4·visibility ± a policy bonus, not a distance between the drawn ships.',
  'Compliance and intervention percentages are formulas over fixed scenario numbers; no rule is actually checked.',
  'In “Harbor Crossing” the target approaches on the own ship’s port bow, which makes the own ship the stand-on vessel, yet it is labelled as giving way.',
  'In “Channel Overtake” the own ship is being overtaken and is labelled stand-on, but it makes the same avoidance curve as in every other scenario.',
];

export default function MaritimeArchivePage() {
  return (
    <LabArchive
      accent="cyan"
      eyebrow="Archive · Maritime labs"
      title="How the Collision Avoidance lab evolved"
      liveTo="/simulators/maritime"
      tag="maritime-collision-v1-scripted"
      intro="The first Collision Avoidance lab is preserved below exactly as it shipped, so it can be compared with the current version, which simulates the ships and applies the collision regulations."
      versions={VERSIONS}
      knownIssues={KNOWN_ISSUES}
    >
      <CollisionAvoidanceV1 />
    </LabArchive>
  );
}
