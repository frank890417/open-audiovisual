// ShowTec ShowMaster 24: generated from https://openaudiovisual.com/controllers/showtec-showmaster-24/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_showmaster24 = {};

OAV_showmaster24.setup = [];
OAV_showmaster24.goodbye = [];
OAV_showmaster24.encoders = {};

OAV_showmaster24.init = function (id, debugging) {
    OAV_showmaster24.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_showmaster24.shutdown = function () {
    OAV_showmaster24.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_showmaster24.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_showmaster24.turn = function (channel, control, value, status, group) {
    var target = OAV_showmaster24.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_showmaster24.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
