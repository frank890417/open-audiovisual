// PMJ 9 Faders Controller: generated from https://openaudiovisual.com/controllers/pmj-9-faders-controller/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_9faderscontroller = {};

OAV_9faderscontroller.setup = [];
OAV_9faderscontroller.goodbye = [];
OAV_9faderscontroller.encoders = {};

OAV_9faderscontroller.init = function (id, debugging) {
    OAV_9faderscontroller.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_9faderscontroller.shutdown = function () {
    OAV_9faderscontroller.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_9faderscontroller.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_9faderscontroller.turn = function (channel, control, value, status, group) {
    var target = OAV_9faderscontroller.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_9faderscontroller.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
