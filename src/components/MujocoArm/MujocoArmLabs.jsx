import ArmDynamicsLab from './ArmDynamicsLab.jsx';
import PhysicalPickPlaceLab from './PhysicalPickPlaceLab.jsx';

// Lazy-loaded as one chunk so MuJoCo's WebAssembly only downloads on the Manipulation tab.
export default function MujocoArmLabs() {
  return (
    <>
      <ArmDynamicsLab />
      <PhysicalPickPlaceLab />
    </>
  );
}
