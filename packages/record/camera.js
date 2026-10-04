// camera.js — the performer's webcam (and microphones), asked for the right way.
//
// `ideal`, never `exact`, for size and rate: a camera that cannot do 1920×1080
// should still open at what it can, not throw in front of an audience. Most
// webcams top out at 1080p30, so a 4K stack layout upscales the camera; the
// work above it stays sharp because it is drawn at the output size.

/**
 * getUserMedia constraints for a camera. Pure.
 * @param {{deviceId?:string, width?:number, height?:number, fps?:number, facingMode?:string}} [opts]
 * @returns {MediaStreamConstraints}
 */
export function cameraConstraints({ deviceId = '', width = 1920, height = 1080, fps = 30, facingMode = '' } = {}) {
  /** @type {MediaTrackConstraints} */
  const video = { width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: fps } };
  if (deviceId) video.deviceId = { exact: deviceId };
  else if (facingMode) video.facingMode = facingMode;
  return { video, audio: false };
}

const md = () => {
  const m = typeof navigator !== 'undefined' && navigator.mediaDevices;
  if (!m) throw new Error('record: no navigator.mediaDevices here (needs https or localhost)');
  return m;
};

const listKind = async (kind) => (await md().enumerateDevices())
  .filter((d) => d.kind === kind)
  .map((d, i) => ({ deviceId: d.deviceId, groupId: d.groupId, label: d.label || `${kind === 'videoinput' ? 'Camera' : 'Microphone'} ${i + 1}` }));

/**
 * Video inputs. Browsers hide labels (and sometimes ids) until the page has had
 * camera permission once — call again after openCamera() for real names.
 * @returns {Promise<{deviceId:string, groupId:string, label:string}[]>}
 */
export function listCameras() { return listKind('videoinput'); }

/** Audio inputs (same label rule as listCameras). */
export function listMicrophones() { return listKind('audioinput'); }

/**
 * Open a camera: ideal 1920×1080 at 30 fps unless told otherwise.
 * The caller owns the stream: stop its tracks when done (the Compositor never does).
 * @param {{deviceId?:string, width?:number, height?:number, fps?:number, facingMode?:string}} [opts]
 * @returns {Promise<MediaStream>}
 */
export function openCamera(opts = {}) {
  return md().getUserMedia(cameraConstraints(opts));
}
