// Novation Launchkey 37 MK4: generated from https://openaudiovisual.com/controllers/novation-launchkey-37-mk4/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_lk37mk4 = {};

OAV_lk37mk4.setup = [];
OAV_lk37mk4.goodbye = [];
OAV_lk37mk4.encoders = {};

OAV_lk37mk4.init = function (id, debugging) {
    OAV_lk37mk4.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_lk37mk4.shutdown = function () {
    OAV_lk37mk4.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_lk37mk4.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_lk37mk4.turn = function (channel, control, value, status, group) {
    var target = OAV_lk37mk4.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_lk37mk4.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
