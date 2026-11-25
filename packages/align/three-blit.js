// @openav/align · three-blit — the mapping in WebGL without a calibration: the art render target → the desktop canvas,
// each tile copied 1:1 (or scaled as the layout says) with a viewport and a scissor. THREE is passed in by the caller.
//
// three's setViewport and setScissor take CSS px and multiply by the pixel ratio inside: physical px are divided first
// (blitPlan does it). Without that every tile is drawn twice as big over its neighbours.
// Ask the renderer for the canvas's size (getDrawingBufferSize), never window.innerWidth: the two differ when the
// canvas is fitted into the window.
import { blitPlan } from './mapping.js?v=7229c5d3';

/**
 * A function that copies a texture onto the canvas through a mapping, tile by tile.
 * @param {object} THREE      the three.js module
 * @param {object} renderer   a THREE.WebGLRenderer
 * @returns {(texture: object, mapping: object) => {mismatch:boolean}}
 */
export function createBlitter(THREE, renderer, { onMismatch = (m) => console.warn(m) } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: null }, uOff: { value: new THREE.Vector2(0, 0) }, uScl: { value: new THREE.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUV; void main(){ vUV = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'precision highp float; uniform sampler2D uTex; uniform vec2 uOff, uScl; varying vec2 vUV; void main(){ gl_FragColor = texture2D(uTex, uOff + vUV * uScl); }',
    depthTest: false, depthWrite: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let warned = false;

  return function blit(texture, mapping) {
    const pr = renderer.getPixelRatio();
    const db = renderer.getDrawingBufferSize(new THREE.Vector2());
    const plan = blitPlan(mapping, { pixelRatio: pr, buffer: { w: Math.round(db.x), h: Math.round(db.y) } });
    if (plan.tiles.some((t) => t.rotate)) throw new Error(`[align] layout ${mapping.id} turns a feed: a viewport copy cannot turn, use createWarpRenderer`);
    if (plan.mismatch && !warned) {
      warned = true;
      onMismatch(`[align] the canvas is ${Math.round(db.x)}×${Math.round(db.y)}, layout ${mapping.id}'s desktop is ${mapping.desktop.w}×${mapping.desktop.h}: tiles go to their absolute place and whatever falls outside is cut`);
    }
    const f = plan.full;
    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    renderer.setViewport(f.x, f.y, f.w, f.h);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, true);
    mat.uniforms.uTex.value = texture;
    for (const t of plan.tiles) {
      const v = t.viewport, s = t.scissor;
      renderer.setViewport(v.x, v.y, v.w, v.h);
      renderer.setScissor(s.x, s.y, s.w, s.h);
      renderer.setScissorTest(true);
      mat.uniforms.uOff.value.set(t.uvOffset.x, t.uvOffset.y);
      mat.uniforms.uScl.value.set(t.uvScale.x, t.uvScale.y);
      renderer.render(scene, cam);
    }
    renderer.setScissorTest(false);
    renderer.setViewport(f.x, f.y, f.w, f.h);
    return { mismatch: plan.mismatch };
  };
}
