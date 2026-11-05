// Behringer LC2412: generated from https://openaudiovisual.com/controllers/behringer-lc2412/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_lc2412 = {};

OAV_lc2412.setup = [];
OAV_lc2412.goodbye = [];
OAV_lc2412.encoders = {};

OAV_lc2412.init = function (id, debugging) {
    OAV_lc2412.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_lc2412.shutdown = function () {
    OAV_lc2412.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_lc2412.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_lc2412.turn = function (channel, control, value, status, group) {
    var target = OAV_lc2412.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_lc2412.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
