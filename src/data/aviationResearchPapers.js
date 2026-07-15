export const aviationResearchPapers = [
  {
    id: 1,
    title: 'ADS-B Integrity and Spoof Detection on Airport Surfaces',
    source: 'MIT Lincoln Lab (Open Access)',
    markdown: `### Summary for Humans
This study shows how unauthenticated ADS-B broadcasts can be forged — and how ground receivers catch inconsistencies.

- Students see why **surveillance** is a cyber-physical sensor, not just a radio feed.
- Multi-sensor fusion (radar + multilateration) exposes ghost tracks.
- A clear bridge from message authenticity to ramp safety.`,
  },
  {
    id: 2,
    title: 'Flight Management System Trust Boundaries in Connected Avionics',
    source: 'NASA Ames Dataset',
    markdown: `### Summary for Humans
Researchers map where navigation data enters the FMS and which paths an attacker could abuse.

- Treat the FMS as a controller with trusted and untrusted inputs.
- Waypoint integrity checks stop fabricated route changes.
- Good classroom case for air–ground data links and crew workload.`,
  },
  {
    id: 3,
    title: 'Ramp Automation Security under Time-Critical Turnaround',
    source: 'Aviation CPS Consortium',
    markdown: `### Summary for Humans
This paper balances gate efficiency with locking down baggage loaders, fuel hydrants, and pushback systems.

- AI flags anomalous actuator commands during turnaround.
- Human ramp supervisors remain in the decision loop.
- Strong ethics angle: uptime vs. fail-safe shutdown in aviation ops.`,
  },
];
