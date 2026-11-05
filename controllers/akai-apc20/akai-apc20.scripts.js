// AKAI Professional APC20: generated from https://openaudiovisual.com/controllers/akai-apc20/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_apc20 = {};

OAV_apc20.setup = [];
OAV_apc20.goodbye = [];
OAV_apc20.encoders = {};

OAV_apc20.init = function (id, debugging) {
    OAV_apc20.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_apc20.shutdown = function () {
    OAV_apc20.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_apc20.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_apc20.turn = function (channel, control, value, status, group) {
    var target = OAV_apc20.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_apc20.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
