// M-VAVE SMC-PAD: generated from https://openaudiovisual.com/controllers/m-vave-smc-pad/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_smcpad = {};

OAV_smcpad.setup = [];
OAV_smcpad.goodbye = [];
OAV_smcpad.encoders = {};

OAV_smcpad.init = function (id, debugging) {
    OAV_smcpad.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_smcpad.shutdown = function () {
    OAV_smcpad.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_smcpad.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_smcpad.turn = function (channel, control, value, status, group) {
    var target = OAV_smcpad.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_smcpad.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
