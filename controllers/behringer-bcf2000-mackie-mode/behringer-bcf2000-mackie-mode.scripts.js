// Behringer BCF2000 (Mackie mode): generated from https://openaudiovisual.com/controllers/behringer-bcf2000-mackie-mode/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_bcf2000mackiemode = {};

OAV_bcf2000mackiemode.setup = [];
OAV_bcf2000mackiemode.goodbye = [];
OAV_bcf2000mackiemode.encoders = {};

OAV_bcf2000mackiemode.init = function (id, debugging) {
    OAV_bcf2000mackiemode.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_bcf2000mackiemode.shutdown = function () {
    OAV_bcf2000mackiemode.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_bcf2000mackiemode.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_bcf2000mackiemode.turn = function (channel, control, value, status, group) {
    var target = OAV_bcf2000mackiemode.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_bcf2000mackiemode.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
