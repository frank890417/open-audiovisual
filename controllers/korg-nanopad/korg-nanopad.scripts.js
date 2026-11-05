// KORG nanoPAD: generated from https://openaudiovisual.com/controllers/korg-nanopad/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_nanopad = {};

OAV_nanopad.setup = [];
OAV_nanopad.goodbye = [];
OAV_nanopad.encoders = {};

OAV_nanopad.init = function (id, debugging) {
    OAV_nanopad.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_nanopad.shutdown = function () {
    OAV_nanopad.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_nanopad.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_nanopad.turn = function (channel, control, value, status, group) {
    var target = OAV_nanopad.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_nanopad.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
