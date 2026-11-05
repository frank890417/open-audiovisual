// M-VAVE SMC-Mixer: generated from https://openaudiovisual.com/controllers/m-vave-smc-mixer/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_smcmixer = {};

OAV_smcmixer.setup = [];
OAV_smcmixer.goodbye = [];
OAV_smcmixer.encoders = {};

OAV_smcmixer.init = function (id, debugging) {
    OAV_smcmixer.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_smcmixer.shutdown = function () {
    OAV_smcmixer.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_smcmixer.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_smcmixer.turn = function (channel, control, value, status, group) {
    var target = OAV_smcmixer.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_smcmixer.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
