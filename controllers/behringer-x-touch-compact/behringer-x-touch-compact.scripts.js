// Behringer X-Touch Compact: generated from https://openaudiovisual.com/controllers/behringer-x-touch-compact/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_xtouchcompact = {};

OAV_xtouchcompact.setup = [];
OAV_xtouchcompact.goodbye = [];
OAV_xtouchcompact.encoders = {};

OAV_xtouchcompact.init = function (id, debugging) {
    OAV_xtouchcompact.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_xtouchcompact.shutdown = function () {
    OAV_xtouchcompact.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_xtouchcompact.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_xtouchcompact.turn = function (channel, control, value, status, group) {
    var target = OAV_xtouchcompact.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_xtouchcompact.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
