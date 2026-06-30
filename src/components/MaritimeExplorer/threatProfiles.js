export const HUMAN_THREAT_ACTORS = [
  {
    id: 'port_operator',
    label: 'Port Operator',
    role: 'Operations · HMI Access',
    bodyColor: 0x1d4ed8,
    headColor: 0xfbbf24,
    threatVector: 'Social Engineering / Credential Theft',
    description: 'Compromised HMI terminal access via phishing or shared credential reuse.',
  },
  {
    id: 'third_party_technician',
    label: 'Third-Party Technician',
    role: 'Maintenance · Physical Access',
    bodyColor: 0xea580c,
    headColor: 0xffedd5,
    threatVector: 'Malicious USB / Insider Threat',
    description: 'Direct physical access to PLC cabinets during scheduled maintenance windows.',
  },
  {
    id: 'security_guard',
    label: 'Security Guard',
    role: 'Perimeter · Access Control',
    bodyColor: 0x111827,
    headColor: 0xe2e8f0,
    threatVector: 'Physical Breach',
    description: 'Bypassed access control gates or tailgating through OT-restricted zones.',
  },
];

export const MACHINE_THREAT_PROFILES = {
  straddle_carrier: {
    threatVector: 'GPS Spoofing',
    description: 'Manipulating coordinate feeds to cause physical yard collisions.',
  },
  power_hub: {
    threatVector: 'Firmware Tampering',
    description: 'Overloading local transformers via unauthorized industrial protocol commands.',
  },
};
