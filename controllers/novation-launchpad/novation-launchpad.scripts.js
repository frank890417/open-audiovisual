// Novation Launchpad: generated from https://openaudiovisual.com/controllers/novation-launchpad/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_launchpad = {};

OAV_launchpad.setup = [];
OAV_launchpad.goodbye = [];
OAV_launchpad.encoders = {};

OAV_launchpad.init = function (id, debugging) {
    OAV_launchpad.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_launchpad.shutdown = function () {
    OAV_launchpad.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_launchpad.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_launchpad.turn = function (channel, control, value, status, group) {
    var target = OAV_launchpad.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_launchpad.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
