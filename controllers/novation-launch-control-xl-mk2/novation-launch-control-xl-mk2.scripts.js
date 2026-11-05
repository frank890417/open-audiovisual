// Novation Launch Control XL (MK2): generated from https://openaudiovisual.com/controllers/novation-launch-control-xl-mk2/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_lcxl = {};

OAV_lcxl.setup = [[240,0,32,41,2,17,119,8,247]];
OAV_lcxl.goodbye = [];
OAV_lcxl.encoders = {};

OAV_lcxl.init = function (id, debugging) {
    OAV_lcxl.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_lcxl.shutdown = function () {
    OAV_lcxl.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_lcxl.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_lcxl.turn = function (channel, control, value, status, group) {
    var target = OAV_lcxl.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_lcxl.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
