// @openav/midi · profiles/imported — controllers imported from QLC+ (tools/import-qlc.mjs writes this list).
// Their JSON files stay out of PROFILES so a page that embeds one controller does not fetch them all;
// resolveProfile() fetches the one it is asked for. The data is Apache-2.0: see NOTICE at the root of the repository.

export const IMPORTED = [
  { id: "adj-midicon-2", short: "midicon2", name: "American DJ MIDICON-2", maker: "American DJ" },
  { id: "akai-apc20", short: "apc20", name: "AKAI Professional APC20", maker: "AKAI Professional" },
  { id: "akai-apc40", short: "apc40", name: "AKAI Professional APC40", maker: "AKAI Professional" },
  { id: "akai-apc-mini", short: "apcmini", name: "AKAI Professional APC Mini", maker: "AKAI Professional" },
  { id: "behringer-bcf2000", short: "bcf2000", name: "Behringer BCF2000", maker: "Behringer" },
  { id: "behringer-bcf2000-mackie-mode", short: "bcf2000mackiemode", name: "Behringer BCF2000 (Mackie mode)", maker: "Behringer" },
  { id: "behringer-bcr2000", short: "bcr2000", name: "Behringer BCR2000", maker: "Behringer" },
  { id: "behringer-lc2412", short: "lc2412", name: "Behringer LC2412", maker: "Behringer" },
  { id: "behringer-x-touch-compact", short: "xtouchcompact", name: "Behringer X-Touch Compact", maker: "Behringer" },
  { id: "behringer-x-touch-extender", short: "xtouchextender", name: "Behringer X-Touch Extender", maker: "Behringer" },
  { id: "elation-midicon", short: "midicon", name: "Elation MIDIcon", maker: "Elation" },
  { id: "korg-nanokontrol", short: "nanokontrol", name: "KORG nanoKONTROL", maker: "KORG" },
  { id: "korg-nanokontrol-studio", short: "nanokontrolstudio", name: "KORG nanoKONTROL Studio", maker: "KORG" },
  { id: "korg-nanopad", short: "nanopad", name: "KORG nanoPAD", maker: "KORG" },
  { id: "korg-nanopad2", short: "nanopad2", name: "KORG NanoPAD2", maker: "KORG" },
  { id: "m-vave-smc-mixer", short: "smcmixer", name: "M-VAVE SMC-Mixer", maker: "M-VAVE" },
  { id: "m-vave-smc-pad", short: "smcpad", name: "M-VAVE SMC-PAD", maker: "M-VAVE" },
  { id: "novation-launch-control", short: "launchcontrol", name: "Novation Launch Control", maker: "Novation" },
  { id: "novation-launchpad", short: "launchpad", name: "Novation Launchpad", maker: "Novation" },
  { id: "novation-launchpad-mk2", short: "launchpadmk2", name: "Novation Launchpad MK2", maker: "Novation" },
  { id: "novation-launchpad-pro", short: "launchpadpro", name: "Novation Launchpad Pro", maker: "Novation" },
  { id: "pmj-9-faders-controller", short: "9faderscontroller", name: "PMJ 9 Faders Controller", maker: "PMJ" },
  { id: "pmj-circus", short: "circus", name: "PMJ Circus", maker: "PMJ" },
  { id: "pmj-midikey", short: "midikey", name: "PMJ MidiKey", maker: "PMJ" },
  { id: "showtec-showmaster-24", short: "showmaster24", name: "ShowTec ShowMaster 24", maker: "ShowTec" },
  { id: "worlde-easypad-12", short: "easypad12", name: "Worlde Easypad.12", maker: "Worlde" },
  { id: "worlde-orca-pad16", short: "orcapad16", name: "Worlde Orca PAD16", maker: "Worlde" },
  { id: "zoom-r16", short: "r16", name: "Zoom R16", maker: "Zoom" },
];

/** Where an imported profile's JSON lives, or null for an id or short name that is not one of them. */
export function importedUrl(ref) {
  const hit = IMPORTED.find((p) => p.id === ref || p.short === ref);
  return hit ? new URL(`./imported/${hit.id}.json`, import.meta.url).href : null;
}
