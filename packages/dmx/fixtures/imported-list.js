// @openav/dmx · fixtures/imported-list — fixtures imported from the Open Fixture Library (tools/import-ofl.mjs writes this list).
// Their JSON files stay out of FIXTURES, so a page that patches one light does not fetch 42: loadImportedFixture(id) in
// imported.js imports the one it is asked for. Each row is read off its file: id, manufacturer, name, kind and each mode's footprint.
// The data is MIT (Open Fixture Library): see NOTICE at the root of the repository. None of it has been checked on a light.

export const IMPORTED_FIXTURES = [
  {"id":"american-dj-encore-profile-1000-ww","manufacturer":"American DJ","name":"Encore Profile 1000 WW","kind":"par","modes":[{"id":"1ch","footprint":1},{"id":"2ch","footprint":2},{"id":"3ch","footprint":3}]},
  {"id":"american-dj-inno-pocket-beam-q4","manufacturer":"American DJ","name":"Inno Pocket Beam Q4","kind":"moving-head","modes":[{"id":"10ch","footprint":10},{"id":"11ch","footprint":11},{"id":"13ch","footprint":13}]},
  {"id":"american-dj-pocket-pro","manufacturer":"American DJ","name":"Pocket Pro","kind":"moving-head","modes":[{"id":"13ch","footprint":13},{"id":"11ch","footprint":11}]},
  {"id":"american-dj-stinger-spot","manufacturer":"American DJ","name":"Stinger Spot","kind":"moving-head","modes":[{"id":"9ch","footprint":9},{"id":"11ch","footprint":11}]},
  {"id":"american-dj-xs-400","manufacturer":"American DJ","name":"XS 400","kind":"moving-head","modes":[{"id":"16ch","footprint":16},{"id":"18ch","footprint":18}]},
  {"id":"beamz-pls25-par","manufacturer":"BeamZ","name":"PLS25 Par","kind":"par","modes":[{"id":"6ch","footprint":6}]},
  {"id":"betopper-mini-moving-head-lm70s","manufacturer":"Betopper","name":"Mini Moving Head LM70S","kind":"moving-head","modes":[{"id":"9ch","footprint":9},{"id":"14ch","footprint":14}]},
  {"id":"blizzard-hotbox-exa","manufacturer":"Blizzard","name":"HotBox EXA","kind":"par","modes":[{"id":"11ch","footprint":11},{"id":"10ch","footprint":10},{"id":"8ch","footprint":8},{"id":"6ch","footprint":6},{"id":"3ch","footprint":3}]},
  {"id":"blizzard-puck-rgbaw","manufacturer":"Blizzard","name":"Puck RGBAW","kind":"par","modes":[{"id":"12ch","footprint":12},{"id":"5ch","footprint":5},{"id":"3ch","footprint":3}]},
  {"id":"boomtonedj-silentpar-12x10w-6in1","manufacturer":"BoomToneDJ","name":"SilentPAR 12x10W 6in1","kind":"par","modes":[{"id":"6ch","footprint":6},{"id":"10ch","footprint":10}]},
  {"id":"cameo-auro-spot-100","manufacturer":"cameo","name":"Auro Spot 100","kind":"moving-head","modes":[{"id":"5ch","footprint":5},{"id":"13ch","footprint":13},{"id":"22ch","footprint":22}]},
  {"id":"cameo-flat-par-can-tri-7x-3w-ir","manufacturer":"cameo","name":"Flat PAR Can Tri 7x 3W IR","kind":"par","modes":[{"id":"2ch","footprint":2},{"id":"3ch1","footprint":3},{"id":"3ch2","footprint":3},{"id":"6ch","footprint":6}]},
  {"id":"cameo-q-spot-40-rgbw","manufacturer":"cameo","name":"Q-Spot 40 RGBW","kind":"par","modes":[{"id":"2ch","footprint":2},{"id":"3ch-1","footprint":3},{"id":"3ch-2","footprint":3},{"id":"4ch","footprint":4},{"id":"9ch","footprint":9}]},
  {"id":"cameo-root-par-6","manufacturer":"cameo","name":"ROOT PAR 6","kind":"par","modes":[{"id":"2ch","footprint":2},{"id":"4ch1","footprint":4},{"id":"4ch2","footprint":4},{"id":"5ch","footprint":5},{"id":"6ch","footprint":6},{"id":"8ch","footprint":8},{"id":"11ch","footprint":11},{"id":"d3ch","footprint":3},{"id":"d5ch1","footprint":5},{"id":"d5ch2","footprint":5},{"id":"d6ch","footprint":6},{"id":"d7ch","footprint":7},{"id":"d9ch","footprint":9},{"id":"d12ch","footprint":12}]},
  {"id":"cameo-thunder-wash-100-w","manufacturer":"cameo","name":"Thunder Wash 100 W","kind":"strobe","modes":[{"id":"1ch","footprint":1},{"id":"2ch","footprint":2},{"id":"3ch1","footprint":3},{"id":"3ch2","footprint":3}]},
  {"id":"chauvet-dj-intimidator-spot-110","manufacturer":"Chauvet DJ","name":"Intimidator Spot 110","kind":"moving-head","modes":[{"id":"12ch","footprint":12},{"id":"6ch","footprint":6}]},
  {"id":"chauvet-dj-slimpar-pro-rgba","manufacturer":"Chauvet DJ","name":"SlimPAR Pro RGBA","kind":"par","modes":[{"id":"4ch","footprint":4},{"id":"5ch","footprint":5},{"id":"10ch","footprint":10}]},
  {"id":"chauvet-dj-slimpar-q12-bt","manufacturer":"Chauvet DJ","name":"SlimPAR Q12 BT","kind":"par","modes":[{"id":"4ch","footprint":4},{"id":"8ch","footprint":8}]},
  {"id":"chauvet-dj-slimpar-t12-bt","manufacturer":"Chauvet DJ","name":"SlimPAR T12 BT","kind":"par","modes":[{"id":"3ch","footprint":3},{"id":"7ch","footprint":7}]},
  {"id":"eurolite-led-7c-7-silent-slim","manufacturer":"Eurolite","name":"LED 7C-7 Silent Slim","kind":"par","modes":[{"id":"3ch","footprint":3},{"id":"5ch","footprint":5},{"id":"7ch","footprint":7},{"id":"9ch","footprint":9},{"id":"12ch","footprint":12}]},
  {"id":"eurolite-led-bar-3-hcl-bar","manufacturer":"Eurolite","name":"LED Bar-3 HCL Bar","kind":"par","modes":[{"id":"2ch","footprint":2},{"id":"3ch","footprint":3},{"id":"4ch","footprint":4},{"id":"6ch","footprint":6},{"id":"10ch","footprint":10}]},
  {"id":"eurolite-led-ml-56-rgbw","manufacturer":"Eurolite","name":"LED ML-56 RGBW","kind":"par","modes":[{"id":"4ch","footprint":4},{"id":"6ch","footprint":6}]},
  {"id":"eurolite-led-par-56-tcl","manufacturer":"Eurolite","name":"LED PAR-56 TCL","kind":"par","modes":[{"id":"5ch","footprint":5},{"id":"3ch","footprint":3}]},
  {"id":"eurolite-led-party-tcl-spot","manufacturer":"Eurolite","name":"LED PARty TCL Spot","kind":"par","modes":[{"id":"5ch","footprint":5}]},
  {"id":"eurolite-led-theatre-cob-200-rgb-ww","manufacturer":"Eurolite","name":"LED Theatre COB 200 RGB+WW","kind":"par","modes":[{"id":"3ch","footprint":3},{"id":"4ch","footprint":4},{"id":"5ch","footprint":5},{"id":"6ch","footprint":6},{"id":"10ch","footprint":10}]},
  {"id":"eurolite-led-tmh-17","manufacturer":"Eurolite","name":"LED TMH-17","kind":"moving-head","modes":[{"id":"9ch","footprint":9},{"id":"11ch","footprint":11}]},
  {"id":"eurolite-led-tmh-7","manufacturer":"Eurolite","name":"LED TMH-7","kind":"moving-head","modes":[{"id":"11ch","footprint":11}]},
  {"id":"fun-generation-picospot-20-led","manufacturer":"Fun Generation","name":"PicoSpot 20 LED","kind":"moving-head","modes":[{"id":"5ch","footprint":5},{"id":"9ch","footprint":9},{"id":"11ch","footprint":11}]},
  {"id":"ibiza-light-par-mini-rgb3","manufacturer":"Ibiza light","name":"LED PAR CAN 12x3W 3-in-1 RGB","kind":"par","modes":[{"id":"par-mini-rgb3","footprint":7}]},
  {"id":"lightmaxx-platinum-mini-tri-par","manufacturer":"lightmaXX","name":"Platinum Mini TRI-PAR","kind":"par","modes":[{"id":"6ch","footprint":6}]},
  {"id":"prolights-smartbat","manufacturer":"Prolights","name":"SMARTBAT","kind":"par","modes":[{"id":"4ch","footprint":4},{"id":"6ch","footprint":6},{"id":"10ch","footprint":10}]},
  {"id":"showtec-accent-spot-q4-rgbw","manufacturer":"Showtec","name":"Accent Spot Q4 RGBW","kind":"par","modes":[{"id":"4ch","footprint":4},{"id":"6ch","footprint":6},{"id":"12ch","footprint":12}]},
  {"id":"showtec-club-par-12-6-rgbwauv","manufacturer":"Showtec","name":"Club Par 12/6 RGBWAUV","kind":"par","modes":[{"id":"6ch","footprint":6},{"id":"11ch","footprint":11}]},
  {"id":"showtec-kanjo-spot-60","manufacturer":"Showtec","name":"Kanjo Spot 60","kind":"moving-head","modes":[{"id":"8ch","footprint":8},{"id":"10ch","footprint":10}]},
  {"id":"showtec-kanjo-wash-rgb","manufacturer":"Showtec","name":"Kanjo Wash RGB","kind":"moving-head","modes":[{"id":"8ch","footprint":8},{"id":"14ch","footprint":14}]},
  {"id":"stairville-bel6-ip-bar-hex","manufacturer":"Stairville","name":"BEL6 IP Bar HEX","kind":"par","modes":[{"id":"6ch","footprint":6},{"id":"10ch","footprint":10}]},
  {"id":"stairville-mh-100","manufacturer":"Stairville","name":"MH-100","kind":"moving-head","modes":[{"id":"9ch","footprint":9},{"id":"14ch","footprint":14}]},
  {"id":"stairville-mh-x30-led-spot","manufacturer":"Stairville","name":"MH-x30 LED Spot","kind":"moving-head","modes":[{"id":"9ch","footprint":9},{"id":"12ch","footprint":12}]},
  {"id":"stairville-revueled-120-cob-rgbww","manufacturer":"Stairville","name":"RevueLED 120 COB RGBWW","kind":"par","modes":[{"id":"7ch","footprint":7}]},
  {"id":"stairville-wild-wash-132-led-white-dmx","manufacturer":"Stairville","name":"Wild Wash 132 LED White DMX","kind":"strobe","modes":[{"id":"1ch","footprint":1},{"id":"2ch","footprint":2},{"id":"3ch1","footprint":3},{"id":"3ch2","footprint":3}]},
  {"id":"varytec-hero-wash-340fx-rgbw-zoom","manufacturer":"Varytec","name":"Hero Wash 340FX RGBW Zoom","kind":"moving-head","modes":[{"id":"8ch","footprint":8},{"id":"16ch","footprint":16}]},
  {"id":"varytec-led-theatre-spot-120-fc","manufacturer":"Varytec","name":"LED Theatre Spot 120 FC","kind":"par","modes":[{"id":"4ch","footprint":4},{"id":"6ch","footprint":6},{"id":"8ch","footprint":8}]},
];

/** The row for an imported fixture's id, or null. */
export function importedFixtureRow(id) {
  return IMPORTED_FIXTURES.find((f) => f.id === id) || null;
}
