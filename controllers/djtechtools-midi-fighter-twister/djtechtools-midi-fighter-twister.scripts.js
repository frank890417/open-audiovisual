// DJ TechTools Midi Fighter Twister: generated from https://openaudiovisual.com/controllers/djtechtools-midi-fighter-twister/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_twister = {};

OAV_twister.setup = [];
OAV_twister.goodbye = [];
OAV_twister.encoders = {};

OAV_twister.init = function (id, debugging) {
    OAV_twister.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_twister.shutdown = function () {
    OAV_twister.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_twister.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_twister.turn = function (channel, control, value, status, group) {
    var target = OAV_twister.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_twister.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
