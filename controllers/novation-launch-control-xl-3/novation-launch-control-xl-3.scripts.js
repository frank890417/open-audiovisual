// Novation Launch Control XL 3: generated from https://openaudiovisual.com/controllers/novation-launch-control-xl-3/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_lcxl3 = {};

OAV_lcxl3.setup = [];
OAV_lcxl3.goodbye = [];
OAV_lcxl3.encoders = {};

OAV_lcxl3.init = function (id, debugging) {
    OAV_lcxl3.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_lcxl3.shutdown = function () {
    OAV_lcxl3.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_lcxl3.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_lcxl3.turn = function (channel, control, value, status, group) {
    var target = OAV_lcxl3.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_lcxl3.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
