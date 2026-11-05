// OP-1 field: generated from https://openaudiovisual.com/controllers/teenage-engineering-op-1-field/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_op1field = {};

OAV_op1field.setup = [];
OAV_op1field.goodbye = [];
OAV_op1field.encoders = {};

OAV_op1field.init = function (id, debugging) {
    OAV_op1field.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_op1field.shutdown = function () {
    OAV_op1field.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_op1field.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_op1field.turn = function (channel, control, value, status, group) {
    var target = OAV_op1field.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_op1field.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
