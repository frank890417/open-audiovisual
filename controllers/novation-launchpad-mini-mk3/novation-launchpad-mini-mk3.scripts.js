// Novation Launchpad Mini MK3: generated from https://openaudiovisual.com/controllers/novation-launchpad-mini-mk3/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_lpmini = {};

OAV_lpmini.setup = [[240,0,32,41,2,13,0,4,247]];
OAV_lpmini.goodbye = [];
OAV_lpmini.encoders = {};

OAV_lpmini.init = function (id, debugging) {
    OAV_lpmini.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_lpmini.shutdown = function () {
    OAV_lpmini.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_lpmini.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_lpmini.turn = function (channel, control, value, status, group) {
    var target = OAV_lpmini.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_lpmini.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
