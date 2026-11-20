// MuJoCo scene for an indoor volleyball court (FIVB dimensions).
//
// Coordinates: z is up, x runs along the court length, y across it.
// The net sits on x = 0. Team A serves from x < 0 toward team B on x > 0.
// Court lines are part of the court, so the outer edge of each line is the boundary.

export const COURT = {
  halfLength: 9.0,       // 18 m court
  halfWidth: 4.5,        // 9 m court
  lineWidth: 0.05,
  attackLine: 3.0,       // 3 m from the net on each side
  netHeight: 2.43,       // men's net height
  netBand: 1.0,          // net is 1 m tall
  netHalfLength: 4.75,   // net is 9.5 m long
  postY: 5.0,            // posts 0.5 m outside the sidelines
  antennaHeight: 0.8,    // antennae extend 80 cm above the net
};

export const BALL = {
  radius: 0.105,         // FIVB: 65–67 cm circumference
  mass: 0.27,            // FIVB: 260–280 g
};

const netCenterZ = COURT.netHeight - COURT.netBand / 2;
const antennaZ = COURT.netHeight - COURT.netBand + (COURT.netBand + COURT.antennaHeight) / 2;
const antennaHalf = (COURT.netBand + COURT.antennaHeight) / 2;

// Air density / viscosity enable MuJoCo's fluid model. With fluidshape="ellipsoid"
// the ball gets quadratic drag plus Magnus lift, so topspin serves dip.
export const VOLLEYBALL_XML = `
<mujoco model="volleyball-court">
  <option timestep="0.001" density="1.204" viscosity="1.8e-5" integrator="implicitfast"/>

  <worldbody>
    <geom name="floor" type="plane" size="20 12 0.1" friction="0.6 0.005 0.0001"/>

    <geom name="net" type="box" pos="0 0 ${netCenterZ}" size="0.01 ${COURT.netHalfLength} ${COURT.netBand / 2}"
          solref="0.04 1" friction="0.3 0.005 0.0001"/>
    <geom name="post_left"  type="cylinder" pos="0 ${-COURT.postY} 1.25" size="0.05 1.25"/>
    <geom name="post_right" type="cylinder" pos="0 ${COURT.postY} 1.25"  size="0.05 1.25"/>
    <geom name="antenna_left"  type="cylinder" pos="0 ${-COURT.halfWidth} ${antennaZ}" size="0.005 ${antennaHalf}"/>
    <geom name="antenna_right" type="cylinder" pos="0 ${COURT.halfWidth} ${antennaZ}"  size="0.005 ${antennaHalf}"/>

    <body name="ball" pos="-10 0 3">
      <freejoint name="ball_free"/>
      <geom name="ball" type="sphere" size="${BALL.radius}" mass="${BALL.mass}"
            fluidshape="ellipsoid" fluidcoef="0.22 0.25 1.5 1.0 1.0" solref="-26000 -22" condim="6"
            friction="0.7 0.01 0.001"/>
    </body>
  </worldbody>
</mujoco>
`;
