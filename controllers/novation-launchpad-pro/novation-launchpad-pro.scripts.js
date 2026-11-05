// Novation Launchpad Pro: generated from https://openaudiovisual.com/controllers/novation-launchpad-pro/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_launchpadpro = {};

OAV_launchpadpro.setup = [];
OAV_launchpadpro.goodbye = [];
OAV_launchpadpro.encoders = {};

OAV_launchpadpro.init = function (id, debugging) {
    OAV_launchpadpro.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_launchpadpro.shutdown = function () {
    OAV_launchpadpro.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_launchpadpro.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_launchpadpro.turn = function (channel, control, value, status, group) {
    var target = OAV_launchpadpro.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_launchpadpro.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
