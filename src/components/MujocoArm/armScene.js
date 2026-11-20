// MuJoCo scene for a planar 3-DOF arm with a parallel-jaw gripper.
//
// It is the same arm as the 2D Manipulation labs (link lengths 110 / 85 / 55 px
// at 4 mm per px), moving in the vertical x–z plane, but here every joint is
// driven by a torque motor and the gripper holds objects only by friction.
//
// Joint angles follow the 2D labs: q1 is measured from +x toward +z (up), and
// q2, q3 are relative to the previous link. Hinge axes are −y so a positive
// angle lifts the link.

export const ARM = {
  shoulderZ: 0.9,
  L1: 0.44,
  L2: 0.34,
  L3: 0.22,
  tcpOffset: 0.075,          // tool centre point: between the fingertips, past the wrist link
  torqueLimit: [120, 80, 30], // N·m per joint
  jointRange: [[-0.6, 3.75], [-2.8, 2.8], [-2.6, 2.6]],
  fingerTravel: 0.04,         // each finger slides up to 4 cm inward
};

export const TASK = {
  cubeHalf: 0.03,             // 6 cm cube
  tableTop: 0.58,
  // Both tables sit on the arm's right. A planar arm moving left → right would
  // have to swing the gripper over the top, upside down, and fling the cube.
  pickX: 0.36,
  placeX: 0.70,
};

const rgba = {
  arm1: '0.976 0.451 0.086 1',
  arm2: '0.984 0.573 0.235 1',
  arm3: '0.992 0.729 0.455 1',
  joint: '0.12 0.16 0.23 1',
  steel: '0.58 0.64 0.72 1',
  finger: '0.85 0.88 0.92 1',
  table: '0.22 0.27 0.35 1',
  cube: '0.98 0.75 0.14 1',
  payload: '0.66 0.55 0.98 1',
};

/**
 * @param {{ withTask?: boolean, withPayload?: boolean }} opts
 *   withTask: add the pick/place tables and a cube.
 *   withPayload: add a weight carried at the hand whose mass can be changed at runtime.
 */
export function buildArmXML({ withTask = false, withPayload = false } = {}) {
  const { shoulderZ, L1, L2, L3, torqueLimit, jointRange, fingerTravel } = ARM;
  const { cubeHalf, tableTop, pickX, placeX } = TASK;
  const fingerX = 0.03 + 0.045; // palm half-depth + finger half-length

  const tables = withTask
    ? `
    <geom name="pick_table"  type="box" pos="${pickX} 0 ${tableTop / 2}"  size="0.13 0.16 ${tableTop / 2}" rgba="${rgba.table}"/>
    <geom name="place_table" type="box" pos="${placeX} 0 ${tableTop / 2}" size="0.13 0.16 ${tableTop / 2}" rgba="${rgba.table}"/>
    <body name="cube" pos="${pickX} 0 ${tableTop + cubeHalf + 0.001}">
      <!-- Small armature keeps the light cube numerically stable when it pivots in the grip. -->
      <joint name="cube" type="free" armature="0.005"/>
      <geom name="cube" type="box" size="${cubeHalf} ${cubeHalf} ${cubeHalf}" mass="0.3"
            friction="0.8 0.01 0.0005" condim="4" rgba="${rgba.cube}"/>
    </body>`
    : '';

  const payload = withPayload
    ? `
            <body name="payload" pos="0.06 0 -0.06">
              <geom name="payload" type="sphere" size="0.035" mass="0.001" contype="0" conaffinity="0" rgba="${rgba.payload}"/>
            </body>`
    : '';

  return `
<mujoco model="planar-arm">
  <compiler angle="radian"/>
  <!-- Elliptic friction cones with a high impratio stop the soft-contact creep that
       would otherwise let a firmly held cube slowly slide out of the fingers. -->
  <option timestep="0.002" integrator="implicitfast" cone="elliptic" impratio="10"/>

  <default>
    <joint damping="0.4" armature="0.05"/>
    <geom friction="0.6 0.005 0.0001"/>
    <motor ctrllimited="true"/>
  </default>

  <worldbody>
    <geom name="floor" type="plane" size="3 3 0.1" rgba="0.06 0.09 0.15 1"/>
    <geom name="pedestal" type="cylinder" pos="0 0 ${(shoulderZ - 0.05) / 2}" size="0.09 ${(shoulderZ - 0.05) / 2}" rgba="${rgba.steel}"/>
    ${tables}

    <body name="link1" pos="0 0 ${shoulderZ}">
      <joint name="shoulder" type="hinge" axis="0 -1 0" range="${jointRange[0].join(' ')}" limited="true"/>
      <geom name="shoulder_hub" type="cylinder" size="0.07 0.06" euler="1.5708 0 0" mass="0.5" rgba="${rgba.joint}" contype="0" conaffinity="0"/>
      <geom name="link1" type="capsule" fromto="0 0 0 ${L1} 0 0" size="0.045" mass="3" rgba="${rgba.arm1}"/>

      <body name="link2" pos="${L1} 0 0">
        <joint name="elbow" type="hinge" axis="0 -1 0" range="${jointRange[1].join(' ')}" limited="true"/>
        <geom name="elbow_hub" type="cylinder" size="0.055 0.05" euler="1.5708 0 0" mass="0.3" rgba="${rgba.joint}" contype="0" conaffinity="0"/>
        <geom name="link2" type="capsule" fromto="0 0 0 ${L2} 0 0" size="0.037" mass="2" rgba="${rgba.arm2}"/>

        <body name="link3" pos="${L2} 0 0">
          <joint name="wrist" type="hinge" axis="0 -1 0" range="${jointRange[2].join(' ')}" limited="true"/>
          <geom name="wrist_hub" type="cylinder" size="0.045 0.045" euler="1.5708 0 0" mass="0.2" rgba="${rgba.joint}" contype="0" conaffinity="0"/>
          <geom name="link3" type="capsule" fromto="0 0 0 ${L3 - 0.03} 0 0" size="0.03" mass="0.5" rgba="${rgba.arm3}"/>

          <body name="hand" pos="${L3} 0 0">
            <geom name="palm" type="box" size="0.03 0.075 0.03" mass="0.3" rgba="${rgba.steel}"/>
            <site name="tcp" pos="${ARM.tcpOffset} 0 0" size="0.008"/>
            ${payload}
            <body name="finger_l" pos="${fingerX} 0.058 0">
              <joint name="finger_l" type="slide" axis="0 -1 0" range="0 ${fingerTravel}" limited="true" damping="4" armature="0.01"/>
              <geom name="finger_l" type="box" size="0.045 0.009 0.022" mass="0.05"
                    friction="0.1 0.005 0.0001" condim="4" rgba="${rgba.finger}"/>
            </body>
            <body name="finger_r" pos="${fingerX} -0.058 0">
              <joint name="finger_r" type="slide" axis="0 1 0" range="0 ${fingerTravel}" limited="true" damping="4" armature="0.01"/>
              <geom name="finger_r" type="box" size="0.045 0.009 0.022" mass="0.05"
                    friction="0.1 0.005 0.0001" condim="4" rgba="${rgba.finger}"/>
            </body>
          </body>
        </body>
      </body>
    </body>
  </worldbody>

  <contact>
    <exclude body1="link1" body2="link2"/>
    <exclude body1="link2" body2="link3"/>
    <exclude body1="link3" body2="hand"/>
  </contact>

  <actuator>
    <motor name="shoulder" joint="shoulder" ctrlrange="${-torqueLimit[0]} ${torqueLimit[0]}"/>
    <motor name="elbow"    joint="elbow"    ctrlrange="${-torqueLimit[1]} ${torqueLimit[1]}"/>
    <motor name="wrist"    joint="wrist"    ctrlrange="${-torqueLimit[2]} ${torqueLimit[2]}"/>
    <!-- Fingers: stiff position servos whose force is capped by the grip-force setting. -->
    <position name="grip_l" joint="finger_l" kp="3000" ctrlrange="0 ${fingerTravel}" forcelimited="true" forcerange="-20 20"/>
    <position name="grip_r" joint="finger_r" kp="3000" ctrlrange="0 ${fingerTravel}" forcelimited="true" forcerange="-20 20"/>
  </actuator>
</mujoco>
`;
}
