// Novation Launchpad MK2: generated from https://openaudiovisual.com/controllers/novation-launchpad-mk2/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_launchpadmk2 = {};

OAV_launchpadmk2.setup = [];
OAV_launchpadmk2.goodbye = [];
OAV_launchpadmk2.encoders = {};

OAV_launchpadmk2.init = function (id, debugging) {
    OAV_launchpadmk2.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_launchpadmk2.shutdown = function () {
    OAV_launchpadmk2.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_launchpadmk2.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_launchpadmk2.turn = function (channel, control, value, status, group) {
    var target = OAV_launchpadmk2.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_launchpadmk2.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
