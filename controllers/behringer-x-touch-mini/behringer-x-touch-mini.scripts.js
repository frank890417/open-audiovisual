// Behringer X-TOUCH MINI: generated from https://openaudiovisual.com/controllers/behringer-x-touch-mini/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_xtouchmini = {};

OAV_xtouchmini.setup = [];
OAV_xtouchmini.goodbye = [];
OAV_xtouchmini.encoders = {};

OAV_xtouchmini.init = function (id, debugging) {
    OAV_xtouchmini.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_xtouchmini.shutdown = function () {
    OAV_xtouchmini.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_xtouchmini.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_xtouchmini.turn = function (channel, control, value, status, group) {
    var target = OAV_xtouchmini.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_xtouchmini.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
