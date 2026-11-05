// Elation MIDIcon: generated from https://openaudiovisual.com/controllers/elation-midicon/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_midicon = {};

OAV_midicon.setup = [];
OAV_midicon.goodbye = [];
OAV_midicon.encoders = {};

OAV_midicon.init = function (id, debugging) {
    OAV_midicon.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_midicon.shutdown = function () {
    OAV_midicon.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_midicon.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_midicon.turn = function (channel, control, value, status, group) {
    var target = OAV_midicon.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_midicon.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
