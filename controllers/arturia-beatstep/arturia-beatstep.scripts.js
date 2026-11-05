// Arturia BeatStep: generated from https://openaudiovisual.com/controllers/arturia-beatstep/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_beatstep = {};

OAV_beatstep.setup = [];
OAV_beatstep.goodbye = [];
OAV_beatstep.encoders = {};

OAV_beatstep.init = function (id, debugging) {
    OAV_beatstep.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_beatstep.shutdown = function () {
    OAV_beatstep.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_beatstep.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_beatstep.turn = function (channel, control, value, status, group) {
    var target = OAV_beatstep.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_beatstep.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
