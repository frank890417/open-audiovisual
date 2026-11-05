// PMJ MidiKey: generated from https://openaudiovisual.com/controllers/pmj-midikey/
// init and shutdown send what the profile says sets the device up. turn reads relative encoders.
var OAV_midikey = {};

OAV_midikey.setup = [];
OAV_midikey.goodbye = [];
OAV_midikey.encoders = {};

OAV_midikey.init = function (id, debugging) {
    OAV_midikey.setup.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_midikey.shutdown = function () {
    OAV_midikey.goodbye.forEach(function (msg) { midi.sendSysexMsg(msg, msg.length); });
};

OAV_midikey.steps = function (value, mode) {
    if (mode === "offset64") { return value - 64; }
    if (mode === "offset16") { return value - 16; }
    if (mode === "twos") { return value < 64 ? value : value - 128; }
    return value & 0x40 ? -(value & 0x3f) : value;
};

OAV_midikey.turn = function (channel, control, value, status, group) {
    var target = OAV_midikey.encoders[status + ":" + control];
    if (!target) { return; }
    var steps = OAV_midikey.steps(value, target.mode);
    if (target.group === "[Library]") {
        engine.setValue(target.group, target.key, steps);
    } else {
        var next = engine.getParameter(target.group, target.key) + steps / 128;
        engine.setParameter(target.group, target.key, Math.max(0, Math.min(1, next)));
    }
};
