// Behringer X-Touch Extender: generated from https://openaudiovisual.com/controllers/behringer-x-touch-extender/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_xtouchextender = {};

OAV_xtouchextender.setup = [];
OAV_xtouchextender.goodbye = [];
OAV_xtouchextender.encoders = {};

OAV_xtouchextender.init = function (id, debugging) {
    OAV_xtouchextender.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_xtouchextender.shutdown = function () {
    OAV_xtouchextender.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_xtouchextender.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_xtouchextender.turn = function (channel, control, value, status, group) {
    var target = OAV_xtouchextender.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_xtouchextender.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
