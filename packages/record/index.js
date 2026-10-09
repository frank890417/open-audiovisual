// @openav/record — the performance video: the work + the performer's camera, composited
// into one canvas of an exact size (vertical 1080p … 4K), recorded with the work's own sound
// by one MediaRecorder (picture and sound in sync by construction), plus an event log and
// MIDI takes (record what you play, play it back into the show, save it as .mid).
//
// Pure (unit-tested): layout.js · mime.js · events.js · take.js · smf.js.
// Browser: compositor.js · recorder.js · audio.js · camera.js · take-player.js (clock-injectable).

export { LAYOUTS, PRESETS, presetById, resolveSize, layoutRects, framePoint, recommendedFps, recommendedBitrate } from './layout.js?v=0cfcfd4';
export { VIDEO_MIMES, AUDIO_MIMES, pickMime, extFor } from './mime.js?v=0cfcfd4';
export { EventLog, cleanValue } from './events.js?v=0cfcfd4';
export { TAKE_VERSION, normalizeTake, validateTake, trimSilence, quantizeTake, takeStats, midiEventsOf, signalsOfMidi, noteOf, noteOffFor } from './take.js?v=0cfcfd4';
export { toMidiFile, fromMidiFile } from './smf.js?v=0cfcfd4';
export { TakeRecorder, TakePlayer } from './take-player.js?v=0cfcfd4';
export { Compositor } from './compositor.js?v=0cfcfd4';
export { Recorder, mixTracks } from './recorder.js?v=0cfcfd4';
export { AudioTap } from './audio.js?v=0cfcfd4';
export { cameraConstraints, listCameras, listMicrophones, openCamera } from './camera.js?v=0cfcfd4';
