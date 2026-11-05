// PMJ Circus: generated from https://openaudiovisual.com/controllers/pmj-circus/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_circus = {};

OAV_circus.setup = [];
OAV_circus.goodbye = [];
OAV_circus.encoders = {};

OAV_circus.init = function (id, debugging) {
    OAV_circus.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_circus.shutdown = function () {
    OAV_circus.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_circus.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_circus.turn = function (channel, control, value, status, group) {
    var target = OAV_circus.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_circus.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
