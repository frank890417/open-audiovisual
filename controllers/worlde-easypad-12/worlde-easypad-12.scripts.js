// Worlde Easypad.12: generated from https://openaudiovisual.com/controllers/worlde-easypad-12/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_easypad12 = {};

OAV_easypad12.setup = [];
OAV_easypad12.goodbye = [];
OAV_easypad12.encoders = {};

OAV_easypad12.init = function (id, debugging) {
    OAV_easypad12.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_easypad12.shutdown = function () {
    OAV_easypad12.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_easypad12.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_easypad12.turn = function (channel, control, value, status, group) {
    var target = OAV_easypad12.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_easypad12.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
