// A photograph rebuilt as a small 3D set the camera can move around ("3D photo" / 2.5D).
//
// Each plate is split offline (see the asset build) into:
//   · a background — the photo with the object removed, the hole filled from the surrounding
//     bokeh and the frame extended a little so the camera can move without meeting an edge
//   · the object, cut out, with a depth map "inflated" from its own silhouette (rounded in the
//     middle, thin at the edges — how a canopy, a bowl or a pair of hands actually bulges)
//   · optionally a near layer — the out-of-focus foreground leaves
//
// Every layer is built along the rays of a reference camera: a pixel at image (u, v) placed at
// depth z sits exactly where that camera would have seen it. From the reference position the set
// reproduces the photo pixel for pixel; from anywhere else the layers separate with true
// parallax — the object turns against its background, the leaves slide across the frame — which
// is what makes a camera move read as moving *around* the subject, while the photo itself is
// never rotated or distorted. Everything is unlit: the light is the photograph's own.
import * as THREE from "three";

export type DioramaMeta = { w: number; h: number; pad: number; box: [number, number, number, number]; near?: boolean };
export type DioramaSource = {
  meta: DioramaMeta;
  bg: string; obj: string; depth: string; near?: string;
  /** background depth (world units, negative = behind the subject) at the bottom and top of the frame */
  bgDepth: [number, number];
  /** how far the subject bulges toward the lens, as a fraction of its width */
  bulge: number;
  /** wind: a mask over the object crop (R = crown sway, G = leaf flutter), plus whether the near
   *  leaves and the distant foliage (top of the background) move in the same breeze */
  wind?: { mask: string; near?: boolean; bg?: boolean };
};

/** uniforms every set shares: the clock, and the gust envelope (breeze + scroll-driven gusts) */
export type DioramaShared = { uTime: THREE.IUniform<number>; uGust: THREE.IUniform<number> };

/** the reference camera every plate is built for */
export const DIO = { D: 10, FOV: 38, OVERSCAN: 1.1, DESIGN_ASPECT: 16 / 9 };

const VERT = /* glsl */ `
  uniform vec4 uBox;       // uv rect (u0, v0, u1, v1) this mesh covers in image space
  uniform vec2 uImg;       // image-plane size at the subject's depth (world units)
  uniform float uD;        // reference camera distance
  uniform sampler2D uDepth;
  uniform float uZ0, uZ1;  // depth at the bottom/top of the box (background) or base depth (object)
  uniform float uBulge;    // object: depth-map scale toward the lens
  uniform float uUseDepth;
  uniform sampler2D uWindMask; uniform float uWind; uniform float uTime; uniform float uGust;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec2 img = mix(uBox.xy, uBox.zw, uv);
    float z = mix(uZ0, uZ1, smoothstep(-0.1, 0.75, img.y));
    if (uUseDepth > 0.5) z = uZ0 + textureLod(uDepth, uv, 0.0).r * uBulge;
    float s = (uD - z) / uD;                       // push the pixel out along its own view ray
    vec3 p = vec3((img.x - 0.5) * uImg.x * s, (img.y - 0.5) * uImg.y * s, z);
    if (uWind > 0.0) {
      // the crown bends: a gust front travels across it, the top moves most, the trunk base not
      // at all; bending also dips the top a little, the way a real canopy leans into the wind
      float sway = textureLod(uWindMask, uv, 0.0).r * uWind * uGust;
      float t = uTime;
      float wx = sin(t * 0.9 + img.x * 6.0 - img.y * 2.0) * 0.6 + sin(t * 1.9 + img.x * 11.0 + 1.7) * 0.25;
      float wz = cos(t * 0.7 + img.x * 5.0 + 0.4) * 0.35;
      p.x += wx * sway * 0.12;
      p.y -= abs(wx) * sway * 0.03;
      p.z += wz * sway * 0.09;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const FRAG = /* glsl */ `
  uniform sampler2D uMap; uniform float uOpacity; uniform float uCut; uniform float uEdge;
  uniform sampler2D uWindMask; uniform float uWind; uniform float uTime; uniform float uGust;
  uniform float uNearWind; uniform float uBgWind;
  varying vec2 vUv;
  float wh(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float wn(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec2 uvw = vUv;
    float t = uTime, fl = 0.0;
    if (uWind > 0.0) {
      // leaf flutter: the texture itself shivers inside the canopy, hardest at the free edges
      fl = texture2D(uWindMask, vUv).g * uWind;
      vec2 n = vec2(wn(vUv * 42.0 + vec2(t * 1.7, t * 0.6)), wn(vUv * 42.0 + vec2(-t * 1.2, t * 1.4) + 7.3)) - 0.5;
      uvw += n * 0.0045 * fl * (0.4 + uGust);
    }
    if (uNearWind > 0.0) {
      // the out-of-focus leaves in front of the lens drift and bob
      vec2 n = vec2(wn(vUv * 2.5 + vec2(t * 0.35, 0.0)), wn(vUv * 2.5 + vec2(0.0, t * 0.3) + 4.0)) - 0.5;
      uvw += n * 0.02 * uNearWind * uGust + (vec2(wn(vUv * 16.0 + t * 1.4), wn(vUv * 16.0 - t * 1.2 + 9.0)) - 0.5) * 0.004 * uNearWind;
    }
    if (uBgWind > 0.0) {
      // the distant foliage across the top of the frame breathes very slightly
      vec2 n = vec2(wn(vUv * 3.0 + vec2(t * 0.22, 0.0)), wn(vUv * 3.0 + vec2(0.0, t * 0.18) + 2.0)) - 0.5;
      uvw += n * 0.006 * uBgWind * uGust * smoothstep(0.55, 0.85, vUv.y);
    }
    vec4 c = texture2D(uMap, uvw);
    // sun flickering through moving leaves
    if (fl > 0.0) c.rgb *= 1.0 + (wn(vUv * 70.0 + t * 2.2) - 0.5) * 0.22 * fl * (0.5 + uGust);
    // a layer that runs off the photo's edge dissolves there instead of ending on a straight cut
    if (uEdge > 0.0) c.a *= smoothstep(0.0, uEdge, vUv.x) * smoothstep(1.0, 1.0 - uEdge, vUv.x)
                         * smoothstep(0.0, uEdge, vUv.y) * smoothstep(1.0, 1.0 - uEdge, vUv.y);
    if (c.a < uCut) discard;
    gl_FragColor = vec4(c.rgb, c.a * uOpacity);
  }`;

export type Diorama = {
  group: THREE.Group;
  /** world-space point the camera orbits (the subject's centre) */
  pivot: THREE.Vector3;
  /** subject radius toward the lens, for focusing */
  depthOfSubject: number;
  load: (loader: THREE.TextureLoader) => void;
  /** world point of image (u, v) (v up), `z` toward the lens from the subject plane */
  imagePoint: (u: number, v: number, z: number) => THREE.Vector3;
  dispose: () => void;
};

export function makeDiorama(src: DioramaSource, at: THREE.Vector3, shared: DioramaShared): Diorama {
  const { meta } = src;
  const ai = meta.w / meta.h;
  // cover the design frame with a little overscan so small camera moves stay inside real pixels
  const H0 = 2 * DIO.D * Math.tan(THREE.MathUtils.degToRad(DIO.FOV / 2));
  const Hi = Math.max(H0, (H0 * DIO.DESIGN_ASPECT) / ai) * DIO.OVERSCAN;
  const img = new THREE.Vector2(Hi * ai, Hi);
  const group = new THREE.Group();
  group.position.copy(at);
  const mats: THREE.ShaderMaterial[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const texs: THREE.Texture[] = [];
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  blank.needsUpdate = true;
  texs.push(blank);

  const layer = (box: [number, number, number, number], segs: [number, number], u: Record<string, unknown>, order: number, transparent: boolean) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent, depthWrite: true, fog: false,
      uniforms: {
        uBox: { value: new THREE.Vector4(...box) }, uImg: { value: img }, uD: { value: DIO.D },
        uDepth: { value: blank }, uZ0: { value: 0 }, uZ1: { value: 0 }, uBulge: { value: 0 }, uUseDepth: { value: 0 },
        uMap: { value: blank }, uOpacity: { value: 1 }, uCut: { value: transparent ? 0.02 : -1 }, uEdge: { value: 0 },
        uWindMask: { value: blank }, uWind: { value: 0 }, uNearWind: { value: 0 }, uBgWind: { value: 0 },
        ...Object.fromEntries(Object.entries(u).map(([k, v]) => [k, { value: v }])),
        uTime: shared.uTime, uGust: shared.uGust,
      },
    });
    const geo = new THREE.PlaneGeometry(1, 1, segs[0], segs[1]);
    geo.translate(0.5, 0.5, 0); // uv == position, so the shader can place every vertex itself
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    group.add(mesh);
    mats.push(mat); geos.push(geo);
    return mat;
  };

  const p = meta.pad;
  const bgMat = layer([-p, -p, 1 + p, 1 + p], [96, 64], { uZ0: src.bgDepth[0], uZ1: src.bgDepth[1], uBgWind: src.wind?.bg ? 1 : 0 }, 0, false);
  const boxW = (meta.box[2] - meta.box[0]) * img.x;
  const bulge = boxW * src.bulge;
  const objMat = layer(meta.box, [160, 160], { uZ0: 0, uBulge: bulge, uUseDepth: 1 }, 1, true);
  const nearMat = src.near ? layer([0, 0, 1, 1], [2, 2], { uZ0: 3.6, uZ1: 3.6, uEdge: 0.14, uNearWind: src.wind?.near ? 1 : 0 }, 2, true) : null;

  // the subject's centre, a little in front of its silhouette plane
  const cx = ((meta.box[0] + meta.box[2]) / 2 - 0.5) * img.x;
  const cy = ((meta.box[1] + meta.box[3]) / 2 - 0.5) * img.y;
  const pivot = new THREE.Vector3(cx, cy, bulge * 0.4).add(at);

  let loaded = false;
  return {
    group, pivot, depthOfSubject: bulge,
    imagePoint(u, v, z) {
      const s = (DIO.D - z) / DIO.D;
      return new THREE.Vector3((u - 0.5) * img.x * s, (v - 0.5) * img.y * s, z).add(at);
    },
    load(loader) {
      if (loaded) return;
      loaded = true;
      const tex = (url: string, srgb: boolean, target: THREE.ShaderMaterial, key: string) => {
        loader.load(url, (t) => {
          t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          t.anisotropy = 8;
          t.generateMipmaps = true;
          texs.push(t);
          target.uniforms[key]!.value = t;
        });
      };
      tex(src.bg, true, bgMat, "uMap");
      tex(src.obj, true, objMat, "uMap");
      tex(src.depth, false, objMat, "uDepth");
      if (src.near && nearMat) tex(src.near, true, nearMat, "uMap");
      if (src.wind) {
        // the wind switches on only once its mask is in, so nothing ever moves that shouldn't
        loader.load(src.wind.mask, (t) => {
          t.colorSpace = THREE.NoColorSpace;
          texs.push(t);
          objMat.uniforms.uWindMask!.value = t;
          objMat.uniforms.uWind!.value = 1;
        });
      }
    },
    dispose() {
      mats.forEach((m) => m.dispose());
      geos.forEach((g) => g.dispose());
      texs.forEach((t) => t.dispose());
    },
  };
}
