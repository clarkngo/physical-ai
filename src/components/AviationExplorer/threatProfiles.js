export const HUMAN_THREAT_ACTORS = [
  {
    id: 'airline_pilot',
    label: 'Airline Pilot',
    role: 'Flight Deck · EFB Access',
    bodyColor: 0x1d4ed8,
    headColor: 0xfbbf24,
    threatVector: 'Social Engineering / Credential Theft',
    description: 'Compromised electronic flight bag credentials enabling unauthorized performance data loads.',
  },
  {
    id: 'mro_technician',
    label: 'MRO Technician',
    role: 'Maintenance · Physical Access',
    bodyColor: 0xea580c,
    headColor: 0xffedd5,
    threatVector: 'Malicious Dataload / Supply Chain',
    description: 'Unsigned LRU swaps or USB maintenance tools during scheduled hangar visits.',
  },
  {
    id: 'ramp_agent',
    label: 'Ramp Agent',
    role: 'Turnaround · Badge Access',
    bodyColor: 0x111827,
    headColor: 0xe2e8f0,
    threatVector: 'Physical Breach / Tailgating',
    description: 'Bypassed airside gates exposing GPU controllers and open cargo doors.',
  },
];

export const MACHINE_THREAT_PROFILES = {
  ground_radar: {
    threatVector: 'ADS-B Ghost Injection',
    description: 'Forged extended squitter frames creating phantom traffic on surface maps.',
  },
  pushback_tug: {
    threatVector: 'GNSS Spoofing',
    description: 'Shifted tug coordinates causing wingtip conflicts during pushback.',
  },
};
