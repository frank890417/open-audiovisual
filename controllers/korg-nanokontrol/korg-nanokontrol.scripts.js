// KORG nanoKONTROL: generated from https://openaudiovisual.com/controllers/korg-nanokontrol/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_nanokontrol = {};

OAV_nanokontrol.setup = [];
OAV_nanokontrol.goodbye = [];
OAV_nanokontrol.encoders = {};

OAV_nanokontrol.init = function (id, debugging) {
    OAV_nanokontrol.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_nanokontrol.shutdown = function () {
    OAV_nanokontrol.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_nanokontrol.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_nanokontrol.turn = function (channel, control, value, status, group) {
    var target = OAV_nanokontrol.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_nanokontrol.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
