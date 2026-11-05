// Behringer BCF2000: generated from https://openaudiovisual.com/controllers/behringer-bcf2000/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_bcf2000 = {};

OAV_bcf2000.setup = [];
OAV_bcf2000.goodbye = [];
OAV_bcf2000.encoders = {};

OAV_bcf2000.init = function (id, debugging) {
    OAV_bcf2000.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_bcf2000.shutdown = function () {
    OAV_bcf2000.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_bcf2000.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_bcf2000.turn = function (channel, control, value, status, group) {
    var target = OAV_bcf2000.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_bcf2000.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
