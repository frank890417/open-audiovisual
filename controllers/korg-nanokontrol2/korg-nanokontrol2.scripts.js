// Korg nanoKONTROL2: generated from https://openaudiovisual.com/controllers/korg-nanokontrol2/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_nano2 = {};

OAV_nano2.setup = [];
OAV_nano2.goodbye = [];
OAV_nano2.encoders = {};

OAV_nano2.init = function (id, debugging) {
    OAV_nano2.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_nano2.shutdown = function () {
    OAV_nano2.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_nano2.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_nano2.turn = function (channel, control, value, status, group) {
    var target = OAV_nano2.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_nano2.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
