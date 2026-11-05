// AKAI APC40 mkII: generated from https://openaudiovisual.com/controllers/akai-apc40-mk2/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_apc40mk2 = {};

OAV_apc40mk2.setup = [[240,71,127,41,96,0,4,64,1,0,0,247]];
OAV_apc40mk2.goodbye = [];
OAV_apc40mk2.encoders = {"176:47":{"group":"[Library]","key":"MoveVertical","mode":"twos"},"176:13":{"group":"[Channel1]","key":"pregain","mode":"twos"}};

OAV_apc40mk2.init = function (id, debugging) {
    OAV_apc40mk2.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_apc40mk2.shutdown = function () {
    OAV_apc40mk2.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_apc40mk2.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_apc40mk2.turn = function (channel, control, value, status, group) {
    var target = OAV_apc40mk2.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_apc40mk2.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
