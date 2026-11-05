// AKAI MIDImix: generated from https://openaudiovisual.com/controllers/akai-midimix/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_midimix = {};

OAV_midimix.setup = [];
OAV_midimix.goodbye = [];
OAV_midimix.encoders = {};

OAV_midimix.init = function (id, debugging) {
    OAV_midimix.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_midimix.shutdown = function () {
    OAV_midimix.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_midimix.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_midimix.turn = function (channel, control, value, status, group) {
    var target = OAV_midimix.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_midimix.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
