// @openav/align · warp-gl — the calibrated output in WebGL: the art render target (or a pattern texture) → the desktop,
// each tile one finely divided mesh placed by its zone (four corners + mesh); the fragment shader takes that segment,
// multiplies the feather and the gain, cuts the masks. Stacks and blend bands add up (additive blending).
// THREE is passed in by the caller (the package has no dependencies). Not calibrated = the same pixels as createBlitter's
// 1:1 or scaled copy, and it can turn a feed (feed.rotate), which createBlitter cannot.
import { zoneGrid } from './warp.js?v=cedb93fa';

const MAX_MASKS = 8;
const VERT = `
attribute vec2 zuv;
varying vec2 vZ;
void main() { vZ = zuv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `precision highp float;
varying vec2 vZ;
uniform sampler2D uTex; uniform vec4 uSrc; uniform vec4 uFeather; uniform float uGamma; uniform float uGain;
uniform vec4 uMasks[${MAX_MASKS}]; uniform int uMaskN;
float edge(float t, float w) { return w <= 0.0 ? 1.0 : (t >= w ? 1.0 : 0.5 - 0.5 * cos(3.14159265 * clamp(t / w, 0.0, 1.0))); }
void main() {
  vec2 st = vec2(uSrc.x + vZ.x * uSrc.z, uSrc.y + (1.0 - vZ.y) * uSrc.w);
  vec3 c = texture2D(uTex, st).rgb;
  float f = edge(vZ.x, uFeather.x) * edge(1.0 - vZ.x, uFeather.y) * edge(vZ.y, uFeather.z) * edge(1.0 - vZ.y, uFeather.w);
  f = pow(f, 1.0 / uGamma);
  for (int i = 0; i < ${MAX_MASKS}; i++) {
    if (i >= uMaskN) break;
    vec4 m = uMasks[i];
    if (vZ.x >= m.x && vZ.x <= m.x + m.z && vZ.y >= m.y && vZ.y <= m.y + m.w) f = 0.0;
  }
  gl_FragColor = vec4(c * f * uGain, 1.0);
}`;

/**
 * A warp renderer on three.js: build the meshes from a calibration, then draw a texture through them.
 *   build(mapping, zones, n = 32)  again whenever the calibration changes ((n + 1)² vertices a tile: cheap);
 *                                   zones = normalizeCalibration(…).variants[variant].zones
 *   draw(renderer, texture, region) region = the part of the desktop this canvas shows { x, y, w, h } (one window over
 *                                   the whole desktop, or one window per output); the caller sets the viewport
 * A render target and a CanvasTexture (flipY on by default) both have v = 1 at the top: one formula for both.
 * @param {object} THREE  the three.js module
 * @returns {{ meshes: Map, build(mapping:object, zones:object, n?:number):void, draw(renderer:object, texture:object, region:object):void, dispose():void }}
 */
export function createWarpRenderer(THREE) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1, 1);
  const meshes = new Map();
  const clear = () => { for (const m of meshes.values()) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } meshes.clear(); };
  return {
    meshes,
    build(mapping, zones, n = 32) {
      clear();
      const A = mapping.art;
      for (const t of mapping.tiles) {
        const z = zones[t.name]; if (!z) continue;
        const g = zoneGrid(z, n);
        const geo = new THREE.BufferGeometry();
        const p3 = new Float32Array((g.pos.length / 2) * 3);
        for (let i = 0, k = 0; i < g.pos.length; i += 2, k += 3) { p3[k] = g.pos[i]; p3[k + 1] = g.pos[i + 1]; }
        geo.setAttribute('position', new THREE.BufferAttribute(p3, 3));
        geo.setAttribute('zuv', new THREE.BufferAttribute(g.uv, 2));
        geo.setIndex(new THREE.BufferAttribute(g.index, 1));
        const masks = Array.from({ length: MAX_MASKS }, (_, i) => { const m = z.masks[i]; return m ? new THREE.Vector4(m.u, m.v, m.w, m.h) : new THREE.Vector4(); });
        const mat = new THREE.ShaderMaterial({
          vertexShader: VERT, fragmentShader: FRAG,
          uniforms: {
            uTex: { value: null },
            uSrc: { value: new THREE.Vector4(t.src.x / A.w, 1 - (t.src.y + t.src.h) / A.h, t.src.w / A.w, t.src.h / A.h) },
            uFeather: { value: new THREE.Vector4(z.feather.l, z.feather.r, z.feather.t, z.feather.b) },
            uGamma: { value: z.gamma }, uGain: { value: z.gain },
            uMasks: { value: masks }, uMaskN: { value: Math.min(MAX_MASKS, z.masks.length) },
          },
          depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        scene.add(mesh); meshes.set(t.name, mesh);
      }
    },
    draw(renderer, texture, region) {
      camera.left = region.x; camera.right = region.x + region.w; camera.top = region.y; camera.bottom = region.y + region.h;
      camera.updateProjectionMatrix();
      for (const m of meshes.values()) m.material.uniforms.uTex.value = texture;
      renderer.setRenderTarget(null);
      renderer.setScissorTest(false);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, false, false);
      const ac = renderer.autoClear; renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = ac;
    },
    dispose: clear,
  };
}
