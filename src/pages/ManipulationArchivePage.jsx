import ManipulationV1Labs from '../components/archive/ManipulationV1Labs.jsx';
import LabArchive from './LabArchive.jsx';

const VERSIONS = [
  {
    tag: 'v1',
    title: '2D canvas labs',
    status: 'Archived (this page)',
    stack: ['React', 'HTML Canvas 2D', 'Hand-written kinematics', 'framer-motion'],
    notes: [
      'Forward kinematics, inverse kinematics and pick-and-place drawn on a 460 px canvas.',
      'No physics: joints are set directly, and the cube is attached to the gripper by script.',
    ],
  },
  {
    tag: 'v2',
    title: 'Fixed IK + MuJoCo physics',
    status: 'Live',
    stack: ['React', 'Canvas 2D (Labs 01–02)', 'MuJoCo 4 (WebAssembly)', 'three.js'],
    notes: [
      'Inverse kinematics now places the gripper (not the wrist) on the target, with a chosen tool angle.',
      'Lab 03 became two MuJoCo labs: torque control with gravity, and pick-and-place held only by friction.',
    ],
  },
];

const KNOWN_ISSUES = [
  'Lab 02 solves inverse kinematics for the wrist joint, so the gripper overshoots the clicked target by the last link plus the fingers (75 px).',
  'Lab 02 checks reach with two links only, so many clicks inside the drawn workspace report “no solution”.',
  'Lab 02 sets the last joint to −0.45 × the elbow angle, so the gripper angle is not actually held constant.',
  'Lab 03 moves the cube with the gripper by script; grip force, friction and mass play no part.',
];

export default function ManipulationArchivePage() {
  return (
    <LabArchive
      accent="orange"
      eyebrow="Archive · Manipulation labs"
      title="How the robotic arm labs evolved"
      liveTo="/simulators/manipulation"
      tag="manipulation-v1-2d"
      intro="The first version of the arm labs is preserved below exactly as it shipped, bugs included, so the iteration can be compared side by side with the current MuJoCo-based labs."
      versions={VERSIONS}
      knownIssues={KNOWN_ISSUES}
    >
      <ManipulationV1Labs />
    </LabArchive>
  );
}
