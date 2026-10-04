// lab.wire.js — @openav/record in the cheyuwu-lab runtime (see packages/mapping/lab.wire.js for the contract).
// Exposes the kits and wires nothing: the lab host decides when to composite, record, save takes and
// autoplay them on a preview (lab.rec, the lab's own capture API, stays the lab's).
//   lab.recordKit   work + camera → one canvas of an exact size → MediaRecorder with the work's sound
//   lab.takes       MIDI takes on lab.signals: new lab.takes.TakeRecorder({ signals: lab.signals }),
//                   new lab.takes.TakePlayer({ signals: lab.signals, take, yieldToLive: true })
lab.recordKit = {
  Compositor, Recorder, AudioTap, EventLog, mixTracks,
  layoutRects, framePoint, LAYOUTS, PRESETS, presetById, resolveSize, recommendedFps, recommendedBitrate,
  pickMime, extFor, listCameras, listMicrophones, openCamera, cameraConstraints,
};
lab.takes = {
  TakeRecorder, TakePlayer,
  normalizeTake, validateTake, trimSilence, quantizeTake, takeStats, midiEventsOf, signalsOfMidi,
  toMidiFile, fromMidiFile,
};
