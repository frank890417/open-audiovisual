// Novation Launch Control: generated from https://openaudiovisual.com/controllers/novation-launch-control/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_launchcontrol = {};

OAV_launchcontrol.setup = [];
OAV_launchcontrol.goodbye = [];
OAV_launchcontrol.encoders = {};

OAV_launchcontrol.init = function (id, debugging) {
    OAV_launchcontrol.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_launchcontrol.shutdown = function () {
    OAV_launchcontrol.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_launchcontrol.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_launchcontrol.turn = function (channel, control, value, status, group) {
    var target = OAV_launchcontrol.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_launchcontrol.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
