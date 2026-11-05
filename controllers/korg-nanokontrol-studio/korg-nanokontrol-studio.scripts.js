// KORG nanoKONTROL Studio: generated from https://openaudiovisual.com/controllers/korg-nanokontrol-studio/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_nanokontrolstudio = {};

OAV_nanokontrolstudio.setup = [];
OAV_nanokontrolstudio.goodbye = [];
OAV_nanokontrolstudio.encoders = {};

OAV_nanokontrolstudio.init = function (id, debugging) {
    OAV_nanokontrolstudio.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_nanokontrolstudio.shutdown = function () {
    OAV_nanokontrolstudio.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_nanokontrolstudio.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_nanokontrolstudio.turn = function (channel, control, value, status, group) {
    var target = OAV_nanokontrolstudio.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_nanokontrolstudio.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
