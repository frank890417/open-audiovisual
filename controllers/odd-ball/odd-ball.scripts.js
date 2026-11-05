// ODD Ball: generated from https://openaudiovisual.com/controllers/odd-ball/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_oddball = {};

OAV_oddball.setup = [];
OAV_oddball.goodbye = [];
OAV_oddball.encoders = {};

OAV_oddball.init = function (id, debugging) {
    OAV_oddball.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_oddball.shutdown = function () {
    OAV_oddball.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_oddball.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_oddball.turn = function (channel, control, value, status, group) {
    var target = OAV_oddball.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_oddball.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
