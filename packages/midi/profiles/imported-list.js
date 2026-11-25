// @openav/midi · profiles/imported-list — controllers imported from QLC+ (tools/import-qlc.mjs writes this list).
// Their JSON files stay out of PROFILES so a page that embeds one controller does not fetch them all;
// resolveProfile() fetches the one it is asked for. Each row carries its match patterns, so matchProfile() can tell which file a port wants
// before any of them is loaded. The data is Apache-2.0: see NOTICE at the root of the repository.
// The files' address is in imported.js, which reads its own location (import.meta) and so is ES-module only; this list never says
// import.meta, because the lab bundles it into a classic script where that does not parse (docs/lab-integration.md).

export const IMPORTED = [
  { id: "adj-midicon-2", short: "midicon2", name: "American DJ MIDICON-2", maker: "American DJ", kind: 'device', match: { ports: ["^midicon-2(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "akai-apc20", short: "apc20", name: "AKAI Professional APC20", maker: "AKAI Professional", kind: 'device', match: { ports: ["^(akai\\s+)?apc\\s*20(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "akai-apc40", short: "apc40", name: "AKAI Professional APC40", maker: "AKAI Professional", kind: 'device', match: { ports: ["^(akai\\s+)?apc\\s*40(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "akai-apc-mini", short: "apcmini", name: "AKAI Professional APC Mini", maker: "AKAI Professional", kind: 'device', match: { ports: ["^(akai\\s+)?apc\\s*mini(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "behringer-bcf2000", short: "bcf2000", name: "Behringer BCF2000", maker: "Behringer", kind: 'device', match: { ports: ["^bcf\\s*2000(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "behringer-bcf2000-mackie-mode", short: "bcf2000mackiemode", name: "Behringer BCF2000 (Mackie mode)", maker: "Behringer", kind: 'device', match: { ports: [] } },
  { id: "behringer-bcr2000", short: "bcr2000", name: "Behringer BCR2000", maker: "Behringer", kind: 'device', match: { ports: ["^bcr\\s*2000(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "behringer-lc2412", short: "lc2412", name: "Behringer LC2412", maker: "Behringer", kind: 'device', match: { ports: [] } },
  { id: "behringer-x-touch-compact", short: "xtouchcompact", name: "Behringer X-Touch Compact", maker: "Behringer", kind: 'device', match: { ports: ["^x-?touch\\s*compact(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "behringer-x-touch-extender", short: "xtouchextender", name: "Behringer X-Touch Extender", maker: "Behringer", kind: 'device', match: { ports: ["^x-?touch[\\s-]*ext(ender)?(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "elation-midicon", short: "midicon", name: "Elation MIDIcon", maker: "Elation", kind: 'device', match: { ports: ["^midicon(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "korg-nanokontrol", short: "nanokontrol", name: "KORG nanoKONTROL", maker: "KORG", kind: 'device', match: { ports: ["^nanokontrol(\\s+slider/knob)?(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "korg-nanokontrol-studio", short: "nanokontrolstudio", name: "KORG nanoKONTROL Studio", maker: "KORG", kind: 'device', match: { ports: ["^nanokontrol\\s*studio(\\s+ctrl)?(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "korg-nanopad", short: "nanopad", name: "KORG nanoPAD", maker: "KORG", kind: 'device', match: { ports: ["^nanopad(\\s+pad)?(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "korg-nanopad2", short: "nanopad2", name: "KORG NanoPAD2", maker: "KORG", kind: 'device', match: { ports: ["^nanopad2(\\s+pad)?(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "m-vave-smc-pad", short: "smcpad", name: "M-VAVE SMC-PAD", maker: "M-VAVE", kind: 'device', match: { ports: ["^smc[\\s-]*pad(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "novation-launch-control", short: "launchcontrol", name: "Novation Launch Control", maker: "Novation", kind: 'device', match: { ports: ["^launch\\s*control(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "novation-launchpad", short: "launchpad", name: "Novation Launchpad", maker: "Novation", kind: 'device', match: { ports: ["^launchpad(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "novation-launchpad-mk2", short: "launchpadmk2", name: "Novation Launchpad MK2", maker: "Novation", kind: 'device', match: { ports: ["^launchpad\\s*mk2(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "novation-launchpad-pro", short: "launchpadpro", name: "Novation Launchpad Pro", maker: "Novation", kind: 'device', match: { ports: ["^launchpad\\s*pro(\\s+standalone\\s+port)?(\\s+\\d+)?$"] } },
  { id: "pmj-9-faders-controller", short: "9faderscontroller", name: "PMJ 9 Faders Controller", maker: "PMJ", kind: 'device', match: { ports: [] } },
  { id: "pmj-circus", short: "circus", name: "PMJ Circus", maker: "PMJ", kind: 'device', match: { ports: [] } },
  { id: "pmj-midikey", short: "midikey", name: "PMJ MidiKey", maker: "PMJ", kind: 'device', match: { ports: [] } },
  { id: "showtec-showmaster-24", short: "showmaster24", name: "ShowTec ShowMaster 24", maker: "ShowTec", kind: 'device', match: { ports: [] } },
  { id: "worlde-easypad-12", short: "easypad12", name: "Worlde Easypad.12", maker: "Worlde", kind: 'device', match: { ports: ["^(worlde\\s+)?easy\\s*pad(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "worlde-orca-pad16", short: "orcapad16", name: "Worlde Orca PAD16", maker: "Worlde", kind: 'device', match: { ports: ["^(worlde\\s+)?orca\\s*pad\\s*16(\\s+(midi|port))*(\\s+\\d+)?$"] } },
  { id: "zoom-r16", short: "r16", name: "Zoom R16", maker: "Zoom", kind: 'device', match: { ports: ["^zoom\\s*r16(_r24)?(\\s+(midi|port))*(\\s+\\d+)?$"] } },
];

/** The row for an id or short name, or null. */
export function importedRow(ref) {
  return IMPORTED.find((p) => p.id === ref || p.short === ref) || null;
}

/** importedUrl() for code that may run as a classic script: imported.js is imported on first use. Where that file is not next to
 *  this one (the lab's bundle) the import fails and the answer is null, so only the shipped profiles are offered. */
export async function importedUrlOf(ref) {
  if (!importedRow(ref)) return null;
  try { return (await import('./imported.js?v=9a90f849')).importedUrl(ref); } catch { return null; }
}
