// The hero photograph (a cornfield at sunset) rebuilt as real 3D ground the camera can move over.
//
// A landscape has a simple, exact geometry: everything below the horizon lies on a ground plane,
// everything above it is far away. Every pixel is placed along the reference camera's own ray at
// the distance where that ray meets the ground (the distance grows without bound toward the
// horizon); the sky and the far hills sit on a distant shell. From the reference position the
// set reproduces the photograph exactly; as the camera moves the near rows sweep past quickly and
// the horizon barely moves — true parallax, with no holes, because the ground is one continuous
// surface. The photo itself is never rotated or warped. It is unlit: the light is the sunset's.
//
// Life on top: a breeze that ripples through the crop (strongest in the near rows, with a sheen
// travelling down the field like wind over real corn), heat shimmer along the horizon, and the
// clouds drifting a touch.
import * as THREE from "three";
import { DIO } from "./diorama";

export type LandscapeMeta = { w: number; h: number; pad: number; horizon: number; sun: [number, number] };
export type LandscapeSource = { meta: LandscapeMeta; image: string; wind: string };

const VERT = /* glsl */ `
  uniform vec2 uImg; uniform float uD, uPad, uYh, uK, uDmin, uDmax;
  varying vec2 vTex; varying vec2 vImg; varying float vDist;
  void main() {
    vec2 img = mix(vec2(-uPad), vec2(1.0 + uPad), uv);   // image space, the photo is [0,1]
    vTex = uv; vImg = img;
    float y = (img.y - 0.5) * uImg.y;
    float dy = uYh - y;                                    // how far below the horizon
    float dist = clamp(uK / max(dy, uK / uDmax), uDmin, uDmax);
    vDist = dist;
    float s = dist / uD;                                   // out along the pixel's own ray
    vec3 p = vec3((img.x - 0.5) * uImg.x * s, y * s, uD - dist);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap, uWind; uniform float uTime, uGust, uPad; uniform vec2 uSun;
  varying vec2 vTex; varying vec2 vImg; varying float vDist;
  float h(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float n(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec3 w = texture2D(uWind, vTex).rgb;          // r = crop, g = sky
    float t = uTime;
    vec2 uv = vTex;
    // a gust front travelling down the field toward the lens, in ground distance
    float wave = sin(vDist * 0.22 + t * 1.3 + vImg.x * 3.0) * 0.5 + 0.5;
    wave = pow(wave, 3.0) * uGust;
    float crop = w.r;
    vec2 flutter = vec2(n(vImg * vec2(90.0, 60.0) + vec2(t * 1.6, t * 0.4)), n(vImg * vec2(90.0, 60.0) + vec2(-t * 1.1, t * 1.3) + 5.0)) - 0.5;
    uv += (flutter * 0.0035 * (0.5 + uGust) + vec2(wave * 0.0025, -wave * 0.0012)) * crop / (1.0 + 2.0 * uPad);
    // heat shimmer on the horizon and a slow drift of the clouds (clear of the sun)
    float band = exp(-pow((vImg.y - uSun.y) * 55.0, 2.0));
    uv.x += (n(vec2(vImg.x * 140.0, t * 3.0)) - 0.5) * 0.0009 * band;
    float sunDist = length((vImg - uSun) * vec2(1.8, 1.0));
    uv.x += sin(t * 0.05) * 0.004 * w.g * smoothstep(0.08, 0.3, sunDist) / (1.0 + 2.0 * uPad);
    vec3 c = texture2D(uMap, uv).rgb;
    // the leaves that lean with a gust catch more of the low sun
    c *= 1.0 + wave * crop * 0.12;
    gl_FragColor = vec4(c, 1.0);
  }`;

export type Landscape = {
  group: THREE.Group;
  /** resolves when the photograph is on the GPU */
  ready: Promise<void>;
  /** places `cam` at the reference view, moved `dolly` along the ground toward the horizon,
   *  `side` across it and `up` off it, with a small pan (yaw/pitch, radians) */
  pose: (cam: THREE.PerspectiveCamera, dolly: number, side: number, up: number, yaw: number, pitch: number) => void;
  dispose: () => void;
};

export function makeLandscape(src: LandscapeSource, at: THREE.Vector3, shared: { uTime: THREE.IUniform<number>; uGust: THREE.IUniform<number> }, loader: THREE.TextureLoader): Landscape {
  const { meta } = src;
  const ai = meta.w / meta.h;
  const H0 = 2 * DIO.D * Math.tan(THREE.MathUtils.degToRad(DIO.FOV / 2));
  const Hi = Math.max(H0, (H0 * DIO.DESIGN_ASPECT) / ai) * DIO.OVERSCAN;
  const img = new THREE.Vector2(Hi * ai, Hi);
  const yh = (meta.horizon - 0.5) * Hi;
  // scale: the bottom edge of the photograph lies 4 units ahead of the lens
  const K = 4.0 * (yh + 0.5 * Hi);
  const group = new THREE.Group();
  group.position.copy(at);
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, fog: false,
    uniforms: {
      uImg: { value: img }, uD: { value: DIO.D }, uPad: { value: meta.pad }, uYh: { value: yh }, uK: { value: K },
      uDmin: { value: 3.0 }, uDmax: { value: 240 }, uMap: { value: blank }, uWind: { value: blank },
      uSun: { value: new THREE.Vector2(meta.sun[0], meta.sun[1]) }, uTime: shared.uTime, uGust: shared.uGust,
    },
  });
  // dense toward the horizon, where the ground runs away fastest
  const geo = new THREE.PlaneGeometry(1, 1, 160, 220);
  geo.translate(0.5, 0.5, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  group.add(mesh);

  const texs: THREE.Texture[] = [blank];
  const load = (url: string, srgb: boolean, key: string) => new Promise<void>((done) => {
    loader.load(url, (t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8;
      texs.push(t);
      mat.uniforms[key]!.value = t;
      done();
    }, undefined, () => done());
  });
  const ready = Promise.all([load(src.image, true, "uMap"), load(src.wind, false, "uWind")]).then(() => undefined);

  // the ground plane's own frame, in set space: along it toward the horizon, and up off it
  const along = new THREE.Vector3(0, yh, -DIO.D).normalize();
  const up = new THREE.Vector3(0, DIO.D, yh).normalize();
  const e = new THREE.Euler(0, 0, 0, "YXZ");
  return {
    group, ready,
    pose(cam, dolly, side, lift, yaw, pitch) {
      cam.position.set(at.x + side, at.y, at.z + DIO.D).addScaledVector(along, dolly).addScaledVector(up, lift);
      e.set(pitch, yaw, 0);
      cam.quaternion.setFromEuler(e);
    },
    dispose() {
      mat.dispose(); geo.dispose();
      texs.forEach((t) => t.dispose());
    },
  };
}
