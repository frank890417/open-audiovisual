// American DJ MIDICON-2: generated from https://openaudiovisual.com/controllers/adj-midicon-2/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_midicon2 = {};

OAV_midicon2.setup = [];
OAV_midicon2.goodbye = [];
OAV_midicon2.encoders = {};

OAV_midicon2.init = function (id, debugging) {
    OAV_midicon2.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_midicon2.shutdown = function () {
    OAV_midicon2.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_midicon2.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_midicon2.turn = function (channel, control, value, status, group) {
    var target = OAV_midicon2.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_midicon2.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
