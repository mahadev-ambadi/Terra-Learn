// TerraLearn landing scene — a scroll-driven farm at dawn. Structure follows the Kage
// landing (fixed WebGL canvas behind a chaptered page, a camera on a Catmull-Rom rig
// driven by scroll progress, bloom + grain finish), with the temple replaced by the
// TerraLearn subject: crop rows, a glowing seedling under a holographic ring, a rising
// sun, drifting fireflies, and — in the "signal" chapter — soil sensors wired together.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { groundHeight, ROW, makeSoilMaterial, makeClods, makeDust, DofPass, type SoilUniforms } from "./soil";
import { makeDiorama, DIO, type DioramaSource } from "./diorama";
import { makeLandscape, type LandscapeSource } from "./landscape";
import { makeSapling, type SaplingSource } from "./sapling";

/** real photographic sources: the seedling cut-out, Poly Haven soil PBR set,
 * and a strip of photographed grass clumps (see grass-clumps.png) */
export type TerraAssets = {
  plant: string;
  /** the three Fields plates, each rebuilt as a 3D set the camera moves around */
  dioramas: DioramaSource[];
  /** the hero: a photographed field rebuilt as 3D ground */
  field: LandscapeSource;
  /** plate 2: a sprout photographed from both sides, orbited front to back */
  sapling: SaplingSource;
  soilDiff: string;
  soilNor: string;
  soilRough: string;
  soilDisp: string;
  soilAo: string;
  grass: string;
};
// u-start, u-width, width/height of each usable clump in grass-clumps.png (the 4th has a stray bar)
const GRASS_SPANS: [number, number, number][] = [
  [0.0, 0.251, 2.034],
  [0.251, 0.196, 2.091],
  [0.447, 0.153, 1.636],
  [0.813, 0.187, 2.095],
];

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const damp = (cur: number, to: number, rate: number, dt: number) => lerp(cur, to, 1 - Math.exp(-rate * dt));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cvs(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}
function canvasTex(c: HTMLCanvasElement, opts: { repeat?: [number, number]; srgb?: boolean } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* ---------------------------------------------------------------- textures */
function texSky() {
  const W = 1024, H = 1024, c = cvs(W, H), x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#03100a"); g.addColorStop(0.42, "#0b2a14"); g.addColorStop(0.72, "#2c3f10"); g.addColorStop(1, "#7a6a16");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // the low sun bleeding across the right-hand horizon
  const s = x.createRadialGradient(W * 0.82, H * 0.86, 4, W * 0.82, H * 0.86, W * 0.62);
  s.addColorStop(0, "rgba(255,226,120,.95)"); s.addColorStop(0.18, "rgba(240,190,60,.55)");
  s.addColorStop(0.5, "rgba(120,140,40,.20)"); s.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = s; x.fillRect(0, 0, W, H);
  // out-of-focus canopy bokeh, as in the reference plates
  const rnd = mulberry32(12);
  for (let i = 0; i < 46; i++) {
    const px = rnd() * W, py = rnd() * H * 0.8, r = 20 + rnd() * 70;
    const gold = rnd() > 0.55;
    const b = x.createRadialGradient(px, py, 0, px, py, r);
    b.addColorStop(0, gold ? "rgba(255,220,110,.20)" : "rgba(110,220,120,.16)");
    b.addColorStop(0.8, gold ? "rgba(255,200,80,.08)" : "rgba(90,200,110,.06)");
    b.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = b; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
  }
  return canvasTex(c);
}
/** crossed billboard planes for a photographed plant: normals bent upward so the crossing
 * planes light as one plant rather than as flat cards, and a vertex-colour ramp that darkens
 * the base the way a real canopy shades its own stem */
function crossQuads(w: number, h: number, planes: number, sink = 0, segs = 2) {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < planes; k++) {
    const g = new THREE.PlaneGeometry(w, h, 1, segs);
    g.translate(0, h / 2 - sink, 0);
    g.rotateY((k / planes) * Math.PI);
    const n = g.attributes.normal as THREE.BufferAttribute;
    const p = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(p.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < n.count; i++) {
      v.set(n.getX(i) * 0.35, 1, n.getZ(i) * 0.35).normalize();
      n.setXYZ(i, v.x, v.y, v.z);
      const t = clamp((p.getY(i) + sink) / h, 0, 1);
      const ao = 0.38 + 0.62 * Math.pow(t, 0.7);
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = ao;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts.push(g);
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  return merged;
}
function texGlow(inner = "rgba(255,255,255,1)", mid = "rgba(255,255,255,.35)") {
  const S = 256, c = cvs(S, S), x = c.getContext("2d")!;
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner); g.addColorStop(0.28, mid); g.addColorStop(0.62, "rgba(255,255,255,.07)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return canvasTex(c);
}
/** the holographic data ring wrapped around the seedling (reference plate 2) */
function texHud() {
  const S = 1024, c = cvs(S, S), x = c.getContext("2d")!, C = S / 2, rnd = mulberry32(31);
  x.translate(C, C);
  const ring = (r: number, w: number, a: number, dash?: number[]) => {
    x.strokeStyle = `rgba(255,236,150,${a})`; x.lineWidth = w; x.setLineDash(dash || []);
    x.beginPath(); x.arc(0, 0, r, 0, TAU); x.stroke();
  };
  for (let i = 0; i < 14; i++) ring(150 + i * 26, 1, 0.16 + (i % 3) * 0.08, i % 4 === 1 ? [3, 7] : undefined);
  ring(496, 2, 0.85); ring(480, 1, 0.5, [2, 5]);
  x.setLineDash([]);
  for (let i = 0; i < 180; i++) { // tick marks
    const a = (i / 180) * TAU, long = i % 5 === 0;
    x.strokeStyle = `rgba(255,236,150,${long ? 0.8 : 0.4})`; x.lineWidth = long ? 2 : 1;
    x.beginPath(); x.moveTo(Math.cos(a) * 466, Math.sin(a) * 466); x.lineTo(Math.cos(a) * (long ? 446 : 455), Math.sin(a) * (long ? 446 : 455)); x.stroke();
  }
  for (let i = 0; i < 70; i++) { // data glyph fragments
    const a = rnd() * TAU, r = 200 + rnd() * 240, w = 8 + rnd() * 34;
    x.save(); x.rotate(a); x.fillStyle = `rgba(255,236,150,${0.25 + rnd() * 0.5})`; x.fillRect(r, -1, w, 2); x.restore();
  }
  for (let i = 0; i < 28; i++) { // node dots
    const a = rnd() * TAU, r = 150 + rnd() * 320;
    x.fillStyle = "rgba(255,246,190,.9)"; x.beginPath(); x.arc(Math.cos(a) * r, Math.sin(a) * r, 2 + rnd() * 3, 0, TAU); x.fill();
  }
  return canvasTex(c);
}
function texGrid() {
  const S = 256, c = cvs(S, S), x = c.getContext("2d")!;
  x.strokeStyle = "rgba(170,255,140,.8)"; x.lineWidth = 2;
  x.strokeRect(1, 1, S - 2, S - 2);
  return canvasTex(c, { repeat: [20, 28] });
}
function texRing() {
  const S = 256, c = cvs(S, S), x = c.getContext("2d")!;
  const g = x.createRadialGradient(S / 2, S / 2, 84, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.62, "rgba(255,255,255,.9)"); g.addColorStop(0.86, "rgba(255,255,255,.3)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return canvasTex(c);
}

/* ------------------------------------------------------------------- rig */
const CAM = [
  { p: [0.0, 1.9, 11.5], t: [0.0, 2.4, -8.0], fov: 38 }, //  0 hero: the field, the seedling
  { p: [-0.575, 0.36, 5.4], t: [-0.35, -0.1, 2.6], fov: 40 }, //  1 ground: macro, looking down into the furrow
  { p: [0.0, 2.8, 2.6], t: [0.6, 3.6, -9.0], fov: 40 }, //  2 fields: facing the particle gallery
  { p: [0.0, 15.0, 3.0], t: [0.0, 0.0, -16.0], fov: 52 }, //  3 signal: aerial, sensors lit
  { p: [-1.5, 2.6, -14.0], t: [5.0, 3.4, -42.0], fov: 44 }, //  4 harvest: golden field, low sun
  { p: [0.0, 6.5, -21.0], t: [0.0, 2.0, -52.0], fov: 46 }, //  5 footer
] as const;

export type TerraScene = { dispose: () => void };

export function createTerraScene(
  canvas: HTMLCanvasElement,
  assets: TerraAssets,
  getProgress: () => number,
  /** 0..1 through the pinned Fields section (0 before it, 1 after) */
  getFields: () => number = () => 0,
  /** false while the page covers the canvas entirely: the loop idles instead of rendering unseen */
  getActive: () => boolean = () => true,
): TerraScene | null {
  const plantUrl = assets.plant;
  const REDUCED = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const COARSE = window.matchMedia?.("(hover: none)").matches ?? false;
  const DPR_MAX = Math.min(window.devicePixelRatio || 1, COARSE ? 1.25 : 1.5);
  // resolution governor, as in Kage: the scene is fill-bound, so pixels are the knob to turn
  const PERF = { scale: 1, acc: 0, n: 0 };
  let DPR = DPR_MAX;
  const vw = () => document.documentElement.clientWidth || window.innerWidth;
  const vh = () => document.documentElement.clientHeight || window.innerHeight;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  } catch (e) {
    console.error(e);
    return null;
  }
  renderer.setPixelRatio(DPR);
  renderer.setSize(vw(), vh(), false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  // no synchronous link-status query after every compile: that query serialises what the
  // browser would otherwise compile in parallel, and on Windows it was most of the cold start
  renderer.debug.checkShaderErrors = false;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1e2c12, 0.021);
  const camera = new THREE.PerspectiveCamera(38, vw() / vh(), 0.3, 300);
  scene.add(camera);

  const U = { uTime: { value: 0 }, uGrow: { value: 0.45 }, uRipe: { value: 0 } };
  const owned: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(o: T) => { owned.push(o); return o; };

  /* ---- sky, sun, bokeh ---- */
  const sky = new THREE.Mesh(
    own(new THREE.PlaneGeometry(420, 260)),
    new THREE.MeshBasicMaterial({ map: own(texSky()), fog: false, depthWrite: false, toneMapped: false }),
  );
  sky.position.set(0, 70, -160);
  scene.add(sky);
  const glowTex = own(texGlow("rgba(255,236,160,1)", "rgba(255,190,70,.42)"));
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.9 }));
  sun.position.set(52, 26, -150); sun.scale.set(110, 110, 1);
  scene.add(sun);

  const bokehTex = own(texGlow("rgba(255,255,255,.55)", "rgba(255,255,255,.22)"));
  const bokeh: THREE.Sprite[] = [];
  {
    const rnd = mulberry32(77);
    for (let i = 0; i < 16; i++) {
      const gold = rnd() > 0.5;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: bokehTex, color: gold ? 0xffd660 : 0x6fe08a, blending: THREE.AdditiveBlending,
        depthWrite: false, fog: false, opacity: 0.10 + rnd() * 0.14,
      }));
      const sz = 6 + rnd() * 16;
      s.scale.set(sz, sz, 1);
      s.position.set((rnd() - 0.5) * 120, 4 + rnd() * 34, -50 - rnd() * 70);
      s.userData = { x0: s.position.x, ph: rnd() * TAU, sp: 0.05 + rnd() * 0.1 };
      scene.add(s); bokeh.push(s);
    }
  }

  /* ---- lights ---- */
  const hemi = new THREE.HemisphereLight(0xb8dca0, 0x2a1d10, 1.25); scene.add(hemi);
  // a low, raking sun: it is what makes every crumb and ridge throw a shadow
  const SUN_DIR = new THREE.Vector3(0.5, 0.26, -0.83).normalize();
  const sunL = new THREE.DirectionalLight(0xffd68a, 2.8);
  sunL.castShadow = true;
  sunL.shadow.mapSize.set(COARSE ? 1024 : 2048, COARSE ? 1024 : 2048);
  Object.assign(sunL.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 90 });
  sunL.shadow.bias = -0.0004; sunL.shadow.normalBias = 0.02; sunL.shadow.radius = 3;
  // nothing that casts a shadow moves much, so the map is redrawn only when the view shifts
  sunL.shadow.autoUpdate = false;
  const lastShadowAt = new THREE.Vector3(1e9, 0, 0);
  scene.add(sunL, sunL.target);
  const SU: SoilUniforms = { uTime: U.uTime, uSunDir: { value: SUN_DIR.clone() }, uSunCol: { value: new THREE.Color(0xffd68a) } };
  const seedL = new THREE.PointLight(0xffe08a, 7, 14, 1.6); seedL.position.set(0, 2.2, -2.2); scene.add(seedL);

  /* ---- real-image sources ---- */
  const loader = new THREE.TextureLoader();
  const loadTex = (url: string, srgb: boolean, repeat?: [number, number]) => {
    const t = loader.load(url);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    owned.push(t);
    return t;
  };
  const plantTex = loadTex(plantUrl, true);

  /* ---- ground: photoscanned soil on a shared height field (ridges + clumps) ---- */
  const soilMaps = {
    diff: loadTex(assets.soilDiff, true, [34, 74]),
    nor: loadTex(assets.soilNor, false, [34, 74]),
    rough: loadTex(assets.soilRough, false, [34, 74]),
    ao: loadTex(assets.soilAo, false, [34, 74]),
    height: loadTex(assets.soilDisp, false),
  };
  soilMaps.height.wrapS = soilMaps.height.wrapT = THREE.RepeatWrapping;
  const groundGeo = own(new THREE.PlaneGeometry(96, 210, COARSE ? 160 : 288, COARSE ? 180 : 300));
  groundGeo.rotateX(-Math.PI / 2);
  {
    const p = groundGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i) - 55));
    groundGeo.computeVertexNormals();
  }
  const groundMat = own(makeSoilMaterial(soilMaps, SU));
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(0, 0, -55);
  ground.receiveShadow = true;
  scene.add(ground);

  /* ---- the crop: the photographed seedling, planted along every ridge ---- */
  const PLANT_ASPECT = 493 / 646;
  const CROP_H = 0.78;
  const cropGeo = own(crossQuads(CROP_H * PLANT_ASPECT, CROP_H, 2, 0.03));
  // Lambert, not Standard: a leaf card gains nothing visible from the full PBR shader, which
  // costs ~0.4 s to compile on Windows (D3D) — and cold-start latency is what the page is judged on
  const cropMat = new THREE.MeshLambertMaterial({
    map: plantTex, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, color: 0xf2f2f2,
  });
  cropMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uGrow = U.uGrow; sh.uniforms.uRipe = U.uRipe;
    sh.vertexShader = "uniform float uTime; uniform float uGrow;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.45;
       float hh = clamp(position.y / ${CROP_H.toFixed(2)}, 0.0, 1.0);
       transformed *= mix(0.55, 1.0, uGrow);
       // a gust front rolling down the field plus each plant's own flutter
       float gust = sin(uTime * 0.9 - instanceMatrix[3].z * 0.35) * 0.5 + 0.5;
       transformed.x += (sin(uTime * 1.7 + ph) * 0.035 + gust * 0.05) * hh * hh;
       transformed.z += cos(uTime * 1.3 + ph * 1.3) * 0.03 * hh * hh;`,
    );
    sh.fragmentShader = "uniform float uRipe;\n" + sh.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
       float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
       diffuseColor.rgb = mix(diffuseColor.rgb, lum * vec3(2.3, 1.75, 0.6), uRipe * 0.85);`,
    ).replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
       // billboards: keep the bent-up normal on both faces, or back faces light from below and go grey
       normal = normalize( vNormal );`);
  };
  own(cropMat);
  const inst: THREE.Matrix4[] = [];
  const rnd = mulberry32(2026);
  const Z0 = 8, Z1 = -96; // past this the fog has already taken the field
  const up = new THREE.Vector3(0, 1, 0);
  for (let x = -37.95; x < 38; x += ROW) {
    for (let z = Z0; z > Z1; z -= 0.62) {
      if (rnd() < 0.07) continue; // the odd gap where a seed failed
      if (z < -45 && rnd() < (-45 - z) / 70) continue; // thinning into the haze
      const jx = x + (rnd() - 0.5) * 0.14, jz = z + (rnd() - 0.5) * 0.3;
      if (Math.hypot(jx, jz + 4.0) < 2.4) continue; // the clearing around the seedling mound
      const s = 0.62 + rnd() * 0.62;
      const lean = new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.18, rnd() * TAU, (rnd() - 0.5) * 0.18));
      inst.push(new THREE.Matrix4().compose(
        new THREE.Vector3(jx, groundHeight(jx, jz) - 0.02, jz), lean,
        new THREE.Vector3(s, s * (0.85 + rnd() * 0.35), s),
      ));
    }
  }
  const crops = new THREE.InstancedMesh(cropGeo, cropMat, inst.length);
  const col = new THREE.Color();
  inst.forEach((m, i) => {
    crops.setMatrixAt(i, m);
    // mostly the photo's own green, with the natural spread of a real stand
    col.setHSL(0.25 + rnd() * 0.06, 0.45 + rnd() * 0.25, 0.5 + rnd() * 0.2);
    crops.setColorAt(i, col);
  });
  crops.instanceMatrix.needsUpdate = true;
  if (crops.instanceColor) crops.instanceColor.needsUpdate = true;
  crops.frustumCulled = false;
  crops.castShadow = true;
  crops.customDepthMaterial = own(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: plantTex, alphaTest: 0.5 }));
  scene.add(crops);

  /* ---- clods, crumbs and pebbles where the camera gets close ---- */
  const clods = makeClods(soilMaps, COARSE ? 2000 : 4200, (r) => {
    // dense around the seedling, the hero foreground and the macro path; sparse elsewhere
    const x = (r() - 0.5) * 18, z = 10 - r() * 22;
    const nearPath = Math.hypot(x + 0.6, (z - 3) * 0.6) < 4.5 || Math.hypot(x, z + 4) < 3;
    return nearPath || r() < 0.35 ? [x, z] : null;
  }, mulberry32(77));
  owned.push(clods.geometry, clods.material as THREE.Material);
  scene.add(clods);

  /* ---- dust hanging in the low sun ---- */
  const dust = makeDust(COARSE ? 500 : 1100, SU, own(texGlow("rgba(255,240,200,1)", "rgba(255,210,140,.35)")), mulberry32(88));
  owned.push(dust.geometry, dust.material as THREE.Material);
  scene.add(dust);

  /* ---- weeds: photographed grass clumps in the furrows and along the margins ---- */
  const grassGeo = own(crossQuads(1, 1, 2, 0.06, 1));
  const GN = 3200;
  const spanAttr = new Float32Array(GN * 2);
  const grassMat = new THREE.MeshLambertMaterial({
    map: loadTex(assets.grass, true), alphaTest: 0.62, side: THREE.DoubleSide, vertexColors: true,
  });
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uRipe = U.uRipe;
    sh.vertexShader = "uniform float uTime;\nattribute vec2 aSpan;\n" + sh.vertexShader
      .replace("#include <uv_vertex>", "#include <uv_vertex>\n vMapUv = vec2(aSpan.x + uv.x * aSpan.y, uv.y);")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        float gp = instanceMatrix[3].x * 1.3 + instanceMatrix[3].z * 0.7;
        float gh = clamp(position.y, 0.0, 1.0);
        transformed.x += sin(uTime * 2.1 + gp) * 0.06 * gh * gh;`);
    sh.fragmentShader = "uniform float uRipe;\n" + sh.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
       float glum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
       diffuseColor.rgb = mix(diffuseColor.rgb, glum * vec3(2.0, 1.6, 0.7), uRipe * 0.7);`,
    ).replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
       // billboards: keep the bent-up normal on both faces, or back faces light from below and go grey
       normal = normalize( vNormal );`);
  };
  own(grassMat);
  const gm: THREE.Matrix4[] = [];
  for (let i = 0; i < GN; i++) {
    const margin = rnd() < 0.18;
    const x = margin
      ? (rnd() < 0.5 ? -1 : 1) * (38 + rnd() * 8)
      : Math.round(((rnd() - 0.5) * 66) / ROW) * ROW + ROW / 2 + (rnd() - 0.5) * 0.3;
    const z = Z0 - rnd() * (Z0 - Z1);
    if (Math.hypot(x, z + 4.0) < 2.6) continue;
    const k = GRASS_SPANS[(rnd() * GRASS_SPANS.length) | 0];
    const h = (margin ? 0.45 : 0.18) + rnd() * (margin ? 0.4 : 0.2);
    spanAttr[gm.length * 2] = k[0];
    spanAttr[gm.length * 2 + 1] = k[1];
    gm.push(new THREE.Matrix4().compose(
      new THREE.Vector3(x, groundHeight(x, z) - 0.02, z),
      new THREE.Quaternion().setFromAxisAngle(up, rnd() * TAU),
      new THREE.Vector3(h * k[2], h, h * k[2]),
    ));
  }
  grassGeo.setAttribute("aSpan", new THREE.InstancedBufferAttribute(spanAttr.slice(0, gm.length * 2), 2));
  const weeds = new THREE.InstancedMesh(grassGeo, grassMat, gm.length);
  gm.forEach((m, i) => {
    weeds.setMatrixAt(i, m);
    col.setHSL(0.2 + rnd() * 0.06, 0.45 + rnd() * 0.2, 0.85 + rnd() * 0.12);
    weeds.setColorAt(i, col);
  });
  weeds.instanceMatrix.needsUpdate = true;
  if (weeds.instanceColor) weeds.instanceColor.needsUpdate = true;
  weeds.frustumCulled = false;
  scene.add(weeds);

  /* ---- the seedling: mound, photographic cut-out, holographic ring, glass dome ---- */
  const seedling = new THREE.Group();
  seedling.position.set(0, 0, -4);
  scene.add(seedling);
  const mound = new THREE.Mesh(
    own(new THREE.SphereGeometry(1.5, 40, 20)),
    new THREE.MeshLambertMaterial({
      map: loadTex(assets.soilDiff, true, [2, 2]), normalMap: loadTex(assets.soilNor, false, [2, 2]),
      color: 0x9a8a7a,
    }),
  );
  mound.scale.set(1, 0.26, 1);
  seedling.add(mound);
  const moundTop = 1.5 * 0.26 - 0.02;

  const PLANT_H = 3.1, PLANT_W = PLANT_H * PLANT_ASPECT;
  const plantPivot = new THREE.Group();
  plantPivot.position.y = moundTop;
  seedling.add(plantPivot);
  const plantGeo = own(new THREE.PlaneGeometry(PLANT_W, PLANT_H));
  plantGeo.translate(0, PLANT_H / 2, 0);
  const plantMat = new THREE.MeshBasicMaterial({ map: plantTex, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: false, color: 0xffffff, toneMapped: false });
  own(plantMat);
  const plant = new THREE.Mesh(plantGeo, plantMat);
  plantPivot.add(plant);

  const hudTex = own(texHud());
  const hudMat = (op: number) => new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const hudA = new THREE.Mesh(own(new THREE.PlaneGeometry(7.4, 7.4)), own(hudMat(0.85)));
  const hudB = new THREE.Mesh(own(new THREE.PlaneGeometry(8.6, 8.6)), own(hudMat(0.35)));
  hudA.position.y = hudB.position.y = PLANT_H * 0.62;
  seedling.add(hudA, hudB);

  const dome = new THREE.Mesh(
    own(new THREE.SphereGeometry(2.75, 48, 32)),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uOp: { value: 0.5 } },
      vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }",
      fragmentShader: "uniform float uOp; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0); gl_FragColor = vec4(vec3(0.62,1.0,0.7)*f, f*uOp); }",
    }),
  );
  dome.position.y = 1.5;
  own(dome.material as THREE.ShaderMaterial);
  seedling.add(dome);

  /* ---- fireflies ---- */
  const FF = COARSE ? 160 : 320;
  const ffPos = new Float32Array(FF * 3), ffSeed = new Float32Array(FF);
  for (let i = 0; i < FF; i++) {
    ffPos[i * 3] = (rnd() - 0.5) * 34; ffPos[i * 3 + 1] = rnd() * 9; ffPos[i * 3 + 2] = 8 - rnd() * 60; ffSeed[i] = rnd();
  }
  const ffGeo = own(new THREE.BufferGeometry());
  ffGeo.setAttribute("position", new THREE.BufferAttribute(ffPos, 3));
  const fireflies = new THREE.Points(ffGeo, own(new THREE.PointsMaterial({
    map: own(texGlow("rgba(255,236,150,1)", "rgba(255,200,60,.4)")), color: 0xffd45a, size: 0.42, sizeAttenuation: true,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.95,
  })));
  fireflies.frustumCulled = false;
  scene.add(fireflies);

  /* ---- soil sensors + the network between them (the "signal" chapter) ---- */
  const data = new THREE.Group(); data.visible = false; scene.add(data);
  const gridMat = own(new THREE.MeshBasicMaterial({ map: own(texGrid()), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, color: 0x9bff7a }));
  const grid = new THREE.Mesh(own(new THREE.PlaneGeometry(40, 56)), gridMat);
  grid.rotation.x = -Math.PI / 2; grid.position.set(0, 0.14, -32);
  data.add(grid);
  const ringTex = own(texRing());
  const nodes: { beam: THREE.Mesh; ring: THREE.Mesh; top: THREE.Vector3; ph: number }[] = [];
  const beamMat = own(new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  const beamGeo = own(new THREE.CylinderGeometry(0.035, 0.035, 3.2, 8, 1, true));
  beamGeo.translate(0, 1.6, 0);
  const ringGeo = own(new THREE.PlaneGeometry(1, 1));
  const nrnd = mulberry32(909);
  for (let i = 0; i < 16; i++) {
    const x = (nrnd() - 0.5) * 26, z = -8 - i * 2.8 - nrnd() * 1.5;
    const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.set(x, 0.1, z);
    const rm = own(new THREE.MeshBasicMaterial({ map: ringTex, color: 0xffe07a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    const ring = new THREE.Mesh(ringGeo, rm); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.16, z);
    data.add(beam, ring);
    nodes.push({ beam, ring, top: new THREE.Vector3(x, 3.3, z), ph: nrnd() * TAU });
  }
  const linePts: number[] = [];
  nodes.forEach((n, i) => [1, 3].forEach((k) => { const o = nodes[i + k]; if (o) linePts.push(n.top.x, n.top.y, n.top.z, o.top.x, o.top.y, o.top.z); }));
  const lineGeo = own(new THREE.BufferGeometry());
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePts, 3));
  const lineMat = own(new THREE.LineBasicMaterial({ color: 0xa8ff88, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  data.add(new THREE.LineSegments(lineGeo, lineMat));
  const tipGeo = own(new THREE.SphereGeometry(0.11, 12, 8));
  const tipMat = own(new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  nodes.forEach((n) => { const t = new THREE.Mesh(tipGeo, tipMat); t.position.copy(n.top); data.add(t); });

  /* ---- the Fields plates: each photograph rebuilt as a 3D set (see diorama.ts) that the camera
     moves around. They stand far off to the side of the farm, each in empty space, so nothing
     of the field can intrude; the camera cuts between them under a focus-pull light burst. ---- */
  const DIO_AT = [new THREE.Vector3(3000, 0, 0), new THREE.Vector3(3800, 0, 0)];
  // one breeze for every set: the clock, and a gust envelope that always breathes on its own and
  // swells further while the camera is being moved
  const DIO_SHARED = { uTime: U.uTime, uGust: { value: 0.6 } };
  let scrollGust = 0, lastF = 0;
  const dioramas = assets.dioramas.map((d, i) => makeDiorama(d, DIO_AT[i]!, DIO_SHARED));
  const sapling = makeSapling(assets.sapling, new THREE.Vector3(3400, 0, 0), DIO_SHARED);
  scene.add(sapling.group);
  // the three plates in order: tree in a bowl, the sprout (full orbit), hands
  const plates = [dioramas[0]!, sapling, dioramas[1]!];
  // plate 1 ends by diving into the grass inside the bowl; the sprout opens out of its moss
  const DIVE_AT = dioramas[0]!.imagePoint(0.4, 0.4, 1.2);
  let fS = 0;
  dioramas.forEach((d) => scene.add(d.group));
  // a little air in each set: slow warm motes between the lens and the subject
  const dioDust = makeDust(COARSE ? 260 : 520, SU, own(texGlow("rgba(255,240,200,1)", "rgba(255,210,140,.35)")), mulberry32(99));
  dioDust.scale.set(0.55, 2.6, 0.5);
  owned.push(dioDust.geometry, dioDust.material as THREE.Material);
  scene.add(dioDust);

  /* ---- the hero: a photographed field at sunset, rebuilt as 3D ground (landscape.ts). It stands
     apart from the synthetic farm, which is switched off while the hero holds the frame. ---- */
  const FIELD_AT = new THREE.Vector3(-3000, 0, 0);
  const field = makeLandscape(assets.field, FIELD_AT, DIO_SHARED, loader);
  scene.add(field.group);
  // the photographed field carries the hero *and* the Ground chapter, and stays behind the Fields
  // entry particles; the synthetic farm only takes over for the later chapters
  const synthetic: THREE.Object3D[] = [sky, sun, ...bokeh, ground, crops, clods, dust, weeds, fireflies];
  // the burst itself: a full-frame warm haze with drifting bokeh, drawn over everything
  const veilMat = own(new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, fog: false,
    uniforms: { uA: { value: 0 }, uGreen: { value: 0 }, uTime: U.uTime, uAspect: { value: 16 / 9 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: /* glsl */ `
      uniform float uA, uGreen, uTime, uAspect; varying vec2 vUv;
      float h(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main() {
        vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
        vec3 c = mix(vec3(0.86, 0.62, 0.26), vec3(0.22, 0.3, 0.12), smoothstep(0.0, 1.0, length(q)));
        c = mix(c, mix(vec3(0.55, 0.72, 0.28), vec3(0.16, 0.3, 0.1), smoothstep(0.0, 1.0, length(q))), uGreen);
        // a few large soft bokeh discs drifting through the light
        float b = 0.0;
        for (int i = 0; i < 9; i++) {
          vec2 o = vec2(h(vec2(float(i), 1.0)), h(vec2(float(i), 7.0))) - 0.5;
          o *= vec2(uAspect, 1.0) * 1.2; o.y += sin(uTime * 0.3 + float(i)) * 0.05;
          b += smoothstep(0.16, 0.12, length(q - o)) * 0.18;
        }
        gl_FragColor = vec4(c * (1.0 + b), uA * 0.9);
      }`,
  }));
  const veil = new THREE.Mesh(own(new THREE.PlaneGeometry(2, 2)), veilMat);
  veil.frustumCulled = false; veil.renderOrder = 999;
  scene.add(veil);

  const bufSize = new THREE.Vector2();
  // field → plate 1 is an assembly of particles (ENTRY_*); the later cuts use the light burst
  // the live set switches on beneath the particles once they are mostly formed (it is the same
  // picture), and the tiles then dissolve into it — the mosaic resolves into the crisp frame
  const ENTRY_START = 0.015, ENTRY_END = 0.1, ENTRY_LIVE = 0.082, ENTRY_FADE: [number, number] = [0.09, 0.104];
  const CUTS = [ENTRY_LIVE, 0.3, 0.72, 0.94]; // field → plate 1 → plate 2 → plate 3 → field
  const _dv = new THREE.Vector3(), _dt = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  /** vertical fov that keeps each photograph filling the frame: on a screen wider than the plates
   *  were framed for, zoom in a touch instead of letting the camera see past the photo's edge */
  const dioFov = () => {
    const a = vw() / vh();
    return a <= DIO.DESIGN_ASPECT ? DIO.FOV
      : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(DIO.FOV / 2)) * DIO.DESIGN_ASPECT / a));
  };
  /** the camera around set i at eased progress e: the reference view (which reproduces the
   *  photograph) rotated about the subject, so the subject holds its place while the world turns */
  const dioPose = (i: number, e: number, px: number, py: number, cam: THREE.PerspectiveCamera) => {
    const d = dioramas[i]!, ref = DIO_AT[i]!;
    const yaw = lerp(-0.28, 0.28, e) + px * 0.05;
    // push in from the photograph's own framing — never out past it: the reference camera's view
    // is all the photo covers, so backing off would show the edge of the world
    _dv.set(ref.x, ref.y, ref.z + DIO.D).sub(d.pivot).multiplyScalar(lerp(1.0, 0.88, e)).applyAxisAngle(_up, yaw);
    _dt.set(ref.x, ref.y, ref.z).sub(d.pivot).applyAxisAngle(_up, yaw);
    cam.position.copy(d.pivot).add(_dv);
    cam.position.y += lerp(0.45, -0.3, e) + py * 0.15;
    cam.lookAt(_dt.add(d.pivot).setY(_dt.y + 0.75)); // aim a touch high: the subject clears the nav bar
    const fov = dioFov();
    if (Math.abs(cam.fov - fov) > 1e-3 || cam.aspect !== vw() / vh()) {
      cam.fov = fov; cam.aspect = vw() / vh(); cam.updateProjectionMatrix();
    }
  };

  /* ---- entry: the first plate assembles out of particles streaming in from every side. They
     take their colour from an off-screen render of exactly the frame the 3D set opens on, so
     when they lock together they *are* that frame and the live set takes over underneath. ---- */
  const entryRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  const entryCam = new THREE.PerspectiveCamera(DIO.FOV, 16 / 9, 0.3, 300);
  const E_COLS = COARSE ? 150 : 210;
  let entryPts: THREE.Points;
  {
    const rows = Math.round(E_COLS / (16 / 9)), n = E_COLS * rows;
    const pos = new Float32Array(n * 3), rnd4 = new Float32Array(n * 4), r = mulberry32(515);
    for (let j = 0; j < rows; j++) for (let i = 0; i < E_COLS; i++) {
      const k = j * E_COLS + i;
      pos[k * 3] = (i + 0.5) / E_COLS; pos[k * 3 + 1] = (j + 0.5) / rows;
      rnd4[k * 4] = r(); rnd4[k * 4 + 1] = r(); rnd4[k * 4 + 2] = r(); rnd4[k * 4 + 3] = r();
    }
    const g = own(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aRand", new THREE.BufferAttribute(rnd4, 4));
    entryPts = new THREE.Points(g, own(new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, fog: false,
      uniforms: { uTex: { value: entryRT.texture }, uA: { value: 0 }, uFade: { value: 1 }, uTile: { value: 8 }, uAspect: { value: 16 / 9 }, uTime: U.uTime },
      vertexShader: /* glsl */ `
        uniform float uA, uTile, uAspect, uTime; uniform sampler2D uTex;
        attribute vec4 aRand; varying vec3 vCol; varying float vSt; varying float vAlpha;
        void main() {
          vec2 uv = position.xy;
          // staggered arrival: stragglers still in flight while the first have landed
          float st = clamp(uA * 1.65 - aRand.x * 0.65, 0.0, 1.0);
          float e = 1.0 - pow(1.0 - st, 3.0);
          vec2 target = uv * 2.0 - 1.0;
          // start well outside the frame, from every direction, spiralling in
          float ang = aRand.y * 6.28318;
          vec2 dir = vec2(cos(ang), sin(ang));
          vec2 start = dir * (1.6 + aRand.z * 1.6) + target * 0.25;
          vec2 p = mix(start, target, e);
          float swirl = (1.0 - e) * (1.4 + aRand.w * 1.6) * (aRand.w > 0.5 ? 1.0 : -1.0);
          vec2 off = p - target;
          p = target + vec2(off.x * cos(swirl) - off.y * sin(swirl), off.x * sin(swirl) + off.y * cos(swirl));
          p.y += sin(uTime * 1.3 + aRand.y * 20.0) * 0.02 * (1.0 - e);
          gl_Position = vec4(p, 0.0, 1.0);
          vCol = textureLod(uTex, uv, 0.0).rgb;
          vSt = e; vAlpha = smoothstep(0.0, 0.12, st);
          // bright motes in flight, settling into tiles that close up into the picture
          gl_PointSize = uTile * mix(0.45 + aRand.z * 0.5, 1.45, e);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uFade; varying vec3 vCol; varying float vSt; varying float vAlpha;
        void main() {
          vec2 q = gl_PointCoord * 2.0 - 1.0; float d = length(q);
          float a = mix(1.0 - smoothstep(0.4, 1.0, d), 1.0, smoothstep(0.75, 1.0, vSt));
          if (a < 0.02) discard;
          vec3 c = vCol * (1.0 + (1.0 - vSt) * 0.9) + vec3(1.0, 0.85, 0.45) * (1.0 - vSt) * 0.35 * (1.0 - d);
          gl_FragColor = vec4(c, a * vAlpha * uFade);
        }`,
    })));
    entryPts.frustumCulled = false; entryPts.renderOrder = 1000; entryPts.visible = false;
    scene.add(entryPts);
  }
  const eUni = (entryPts.material as THREE.ShaderMaterial).uniforms as Record<string, THREE.IUniform>;
  /** renders set 0 from its opening camera into the texture the particles sample */
  const renderEntryFrame = (px: number, py: number) => {
    renderer.getDrawingBufferSize(bufSize);
    const w = Math.max(4, Math.round(bufSize.x / 2)), h = Math.max(4, Math.round(bufSize.y / 2));
    if (entryRT.width !== w || entryRT.height !== h) entryRT.setSize(w, h);
    dioPose(0, 0, px, py, entryCam);
    const g = dioramas[0]!.group, wasVisible = g.visible;
    g.visible = true;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(entryRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(g, entryCam);
    renderer.setRenderTarget(prev);
    g.visible = wasVisible;
    eUni.uTile!.value = (bufSize.x / E_COLS) * 1.02;
  };

  /** Fields state for progress f: which set holds the frame, the camera around it, the transitions */
  let midOrbit = 0;
  const paintFields = (fRaw: number, pointerX: number, pointerY: number, dt: number) => {
    midOrbit = 0;
    // scroll arrives in wheel-sized steps: ease it so every camera move is one continuous glide
    fS = Math.abs(fRaw - fS) > 0.35 ? fRaw : damp(fS, fRaw, 7, dt);
    const f = fRaw <= 0 || fRaw >= 1 ? fRaw : fS;
    const inSection = f > 0 && f < 1;
    // breeze: two slow swells out of phase, so it never stops and never visibly loops; moving the
    // camera through the scene whips up a gust that settles back over a couple of seconds
    const t = U.uTime.value;
    const breeze = 0.55 + 0.22 * Math.sin(t * 0.23) + 0.16 * Math.sin(t * 0.61 + 1.3);
    scrollGust = damp(scrollGust, Math.min(0.9, (Math.abs(f - lastF) / Math.max(dt, 1e-3)) * 6), 2.2, dt);
    lastF = f;
    DIO_SHARED.uGust.value = breeze + scrollGust;
    // entry: particles assemble across [ENTRY_START, ENTRY_END]; the formed tiles then dissolve
    // over the live set, which is the same picture beneath them
    const assemble = clamp((f - ENTRY_START) / (ENTRY_END - ENTRY_START), 0, 1);
    const handover = 1 - clamp((f - ENTRY_FADE[0]) / (ENTRY_FADE[1] - ENTRY_FADE[0]), 0, 1);
    entryPts.visible = inSection && assemble > 0.001 && handover > 0.001;
    if (entryPts.visible) {
      renderEntryFrame(pointerX, pointerY);
      eUni.uA!.value = assemble;
      eUni.uFade!.value = handover;
    }
    let burst = 0;
    if (inSection) for (const c of CUTS.slice(1)) burst = Math.max(burst, Math.pow(Math.max(0, 1 - Math.abs(f - c) / 0.045), 2));
    veilMat.uniforms.uA!.value = burst;
    // the dive into the bowl's grass comes out in moss: that cut is a soft green, not a light leak
    veilMat.uniforms.uGreen!.value = Math.abs(f - CUTS[1]!) < 0.06 ? 1 : 0;
    veil.visible = burst > 0.002;
    let active = -1;
    for (let i = 0; i < 3; i++) if (f >= CUTS[i]! && f < CUTS[i + 1]!) active = i;
    // plate 3's photograph is never drawn: the page's scroll-scrubbed Saath film (TerraLanding)
    // holds that stretch of the timeline, and this set only keeps the camera and lens on course
    plates.forEach((d, i) => { d.group.visible = i === active && i !== 2; });
    dioDust.visible = active >= 0;
    // while the particles form over the field, the lens relaxes so the formed picture is sharp
    if (active < 0) return entryPts.visible ? { focus: -1, burst: 0, calm: assemble, ap: 0 } : null;
    const d = plates[active]!;
    const k = (f - CUTS[active]!) / (CUTS[active + 1]! - CUTS[active]!);
    const ease = (x: number) => x * x * (3 - 2 * x);
    if (active === 0) {
      // orbit, then dive into the grass inside the bowl until it fills the frame
      const orbitK = clamp(k / 0.74, 0, 1), dive = ease(clamp((k - 0.74) / 0.26, 0, 1));
      dioPose(0, ease(orbitK), pointerX, pointerY, camera);
      if (dive > 0) {
        _dv.copy(camera.position);
        _dt.copy(camera.position).sub(DIVE_AT).setLength(0.55).add(DIVE_AT);
        camera.position.lerpVectors(_dv, _dt, dive * dive);
        const q0 = camera.quaternion.clone();
        camera.lookAt(DIVE_AT);
        camera.quaternion.slerpQuaternions(q0, camera.quaternion.clone(), ease(clamp(dive * 1.6, 0, 1)));
      }
    } else if (active === 1) {
      // out of the moss, then all the way round: front photograph → back photograph
      const pull = 1 - ease(clamp(k / 0.2, 0, 1));
      // a beat exactly on the photograph once the pull-out lands, then the orbit
      const orbitE = ease(clamp((k - 0.24) / 0.76, 0, 1));
      sapling.pose(camera, orbitE, pull, pointerX, pointerY, vw() / vh());
      midOrbit = THREE.MathUtils.smoothstep(Math.sin(Math.PI * orbitE), 0.03, 0.3);
    } else {
      dioPose(1, ease(k), pointerX, pointerY, camera);
    }
    dioDust.position.set(d.pivot.x, d.pivot.y - 3.2, d.pivot.z + 1);
    const near = active === 0 && k > 0.74 ? camera.position.distanceTo(DIVE_AT) : Infinity;
    // at a photograph's own viewpoint the lens adds nothing (the photo has its depth of field
    // already); mid-orbit the sprout gets a shallow macro lens over the reconstructed set
    const ap = active === 1 ? 0.2 + 3.0 * midOrbit : 0.25;
    return { focus: Math.min(near, camera.position.distanceTo(d.pivot) - d.depthOfSubject * 0.5), burst, calm: 0, ap };
  };

  /* ---- post ---- */
  // the scene target keeps its depth as a texture so the lens blur reads true per-pixel depth
  const sceneRT = new THREE.WebGLRenderTarget(vw() * DPR, vh() * DPR, { type: THREE.HalfFloatType, samples: COARSE ? 0 : 2 });
  sceneRT.depthTexture = new THREE.DepthTexture(vw() * DPR, vh() * DPR);
  const composer = new EffectComposer(renderer, sceneRT);
  composer.setPixelRatio(DPR);
  composer.setSize(vw(), vh());
  composer.addPass(new RenderPass(scene, camera));
  const dof = new DofPass(camera);
  composer.addPass(dof);
  // per chapter: focus distance (m) and aperture (blur px at 720p) — the macro chapter is shallowest
  const FOCUS = [15.5, 1.35, 11.3, 18, 24, 30];
  const APERTURE = [3.0, 6.5, 2.8, 0.6, 2.4, 2.0];
  const bloom = new UnrealBloomPass(new THREE.Vector2(vw(), vh()), 0.52, 0.7, 0.9);
  composer.addPass(bloom);
  // Final pass. A photograph already *is* a finished, tone-mapped image: run it through ACES and
  // bloom again and its colour, contrast and clarity drift (washed highlights, glowing edges). So
  // the photographed scenes are written straight out, and only the synthetic farm is tone-mapped;
  // uTM crossfades between the two.
  const finalPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTM: { value: 1 }, uExposure: { value: renderer.toneMappingExposure } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform float uTM, uExposure; varying vec2 vUv;
      vec3 rrt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
      vec3 aces(vec3 c) {
        const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
        const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
        c *= uExposure / 0.6;
        return clamp(O * rrt(I * c), 0.0, 1.0);
      }
      vec3 srgb(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        gl_FragColor = vec4(srgb(mix(c, aces(c), uTM)), 1.0);
      }`,
  });
  composer.addPass(finalPass);
  let tmS = 1;

  /* ---- rig ---- */
  const curveP = new THREE.CatmullRomCurve3(CAM.map((c) => new THREE.Vector3(...c.p)), false, "catmullrom", 0.42);
  const curveT = new THREE.CatmullRomCurve3(CAM.map((c) => new THREE.Vector3(...c.t)), false, "catmullrom", 0.42);
  const RIG = { smooth: 0, mx: 0, my: 0, tmx: 0, tmy: 0 };
  const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3();
  const fogA = new THREE.Color(0x1e2c12), fogB = new THREE.Color(0x3a2a0c), sunA = new THREE.Color(0xffd68a), sunB = new THREE.Color(0xff9a3c);

  const onPointer = (e: PointerEvent) => {
    RIG.tmx = (e.clientX / vw()) * 2 - 1;
    RIG.tmy = -((e.clientY / vh()) * 2 - 1);
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  const onResize = () => {
    renderer.setPixelRatio(DPR);
    renderer.setSize(vw(), vh(), false);
    composer.setPixelRatio(DPR);
    composer.setSize(vw(), vh());
    camera.aspect = vw() / vh();
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize, { passive: true });
  const onLost = (e: Event) => e.preventDefault();
  canvas.addEventListener("webglcontextlost", onLost);

  let raf = 0, last = performance.now(), clock = 0, intro = 0, alive = true, visible = !document.hidden;
  const onVis = () => { visible = !document.hidden; last = performance.now(); };
  document.addEventListener("visibilitychange", onVis);

  const frame = (now: number) => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    if (!getActive() && clock > 1) { last = now; return; }
    const raw = (now - last) / 1000;
    const dt = Math.min(raw, 0.05);
    last = now;
    // skip the warm-up (shader compiles, texture uploads, first shadow) — judging the GPU on
    // those frames used to throw the resolution away for no reason
    // Resolution governor. It reacts to *sustained* slowness only: one-off hitches (a texture
    // upload, a shader, entering a new scene) used to be read as a slow GPU and halved the
    // resolution, which is what made the photographs soft. So it counts slow frames, ignores
    // isolated spikes, steps down gently, and never below 75% — clarity is the point.
    if (clock > 4) {
      PERF.n++;
      if (raw > 0.026 && raw < 0.12) PERF.acc++;          // slow, but not a one-off stall
      if (PERF.n >= 45) {
        const slowShare = PERF.acc / PERF.n; PERF.acc = 0; PERF.n = 0;
        const prev = PERF.scale;
        if (slowShare > 0.7 && PERF.scale > 0.75) PERF.scale = Math.max(0.75, PERF.scale - 0.1);
        else if (slowShare < 0.15 && PERF.scale < 1) PERF.scale = Math.min(1, PERF.scale + 0.1);
        if (PERF.scale !== prev) { DPR = DPR_MAX * PERF.scale; onResize(); }
      }
    }
    if (!REDUCED) clock += dt;
    intro = REDUCED ? 1 : Math.min(1, intro + Math.min(raw, 0.1) / 1.6);

    const p = clamp(getProgress(), 0, CAM.length - 1);
    RIG.smooth = REDUCED ? p : damp(RIG.smooth, p, 5, dt);
    RIG.mx = damp(RIG.mx, RIG.tmx, 2.6, dt);
    RIG.my = damp(RIG.my, RIG.tmy, 2.6, dt);
    const sp = RIG.smooth;

    // chapter-driven world state
    U.uTime.value = clock;
    U.uGrow.value = lerp(0.45, 1, smooth(0, 2.4, sp));
    U.uRipe.value = smooth(3.2, 4.5, sp);
    const data_ = smooth(2.3, 3.0, sp) * (1 - smooth(3.9, 4.5, sp));
    data.visible = data_ > 0.001;
    gridMat.opacity = data_ * 0.32;
    beamMat.opacity = data_ * 0.55; lineMat.opacity = data_ * 0.6; tipMat.opacity = data_;
    nodes.forEach((n, i) => {
      const k = (clock * 0.35 + n.ph / TAU) % 1;
      const s = 0.4 + k * 3.2;
      n.ring.scale.set(s, s, 1);
      (n.ring.material as THREE.MeshBasicMaterial).opacity = data_ * Math.sin(k * Math.PI) * 0.55;
      n.beam.scale.y = 0.85 + Math.sin(clock * 1.4 + i) * 0.12;
    });
    const seedVis = 0;
    seedling.visible = seedVis > 0.01;
    (hudA.material as THREE.MeshBasicMaterial).opacity = 0.85 * seedVis;
    (hudB.material as THREE.MeshBasicMaterial).opacity = 0.35 * seedVis;
    (dome.material as THREE.ShaderMaterial).uniforms.uOp.value = 0.5 * seedVis * (1 - smooth(1.8, 2.6, sp) * 0.5);
    seedL.intensity = 7 * seedVis;

    const ripe = U.uRipe.value;
    sunL.color.copy(sunA).lerp(sunB, ripe);
    sunL.intensity = 2.8 + ripe * 1.2;
    (scene.fog as THREE.FogExp2).color.copy(fogA).lerp(fogB, ripe);
    (sun.material as THREE.SpriteMaterial).opacity = 0.75 + ripe * 0.25;
    sun.scale.setScalar(110 + ripe * 60);
    hemi.intensity = 1.25 - ripe * 0.2;
    (sky.material as THREE.MeshBasicMaterial).color.setRGB(1 + ripe * 0.12, 1, 1 - ripe * 0.22);

    // seedling motion: face the camera about Y, breathe, rotate the data ring
    plantPivot.rotation.y = Math.atan2(camera.position.x - seedling.position.x, camera.position.z - seedling.position.z);
    plantPivot.rotation.z = Math.sin(clock * 0.9) * 0.012;
    for (const [m, dir] of [[hudA, 1], [hudB, -1]] as const) {
      m.quaternion.copy(camera.quaternion);
      m.rotateZ(clock * 0.06 * dir);
    }

    // fireflies drift upward and wrap
    const fp = ffGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < FF; i++) {
      const s = ffSeed[i];
      let y = fp.getY(i) + dt * (0.12 + s * 0.3);
      if (y > 9.5) y = 0.2;
      fp.setXYZ(i, fp.getX(i) + Math.sin(clock * 0.4 + s * 20) * dt * 0.35, y, fp.getZ(i) + Math.cos(clock * 0.3 + s * 17) * dt * 0.3);
    }
    fp.needsUpdate = true;
    bokeh.forEach((b) => { b.position.x = b.userData.x0 + Math.sin(clock * b.userData.sp + b.userData.ph) * 4; });

    // camera on the rig
    const N = CAM.length - 1;
    const u = clamp(sp / N, 0, 1);
    curveP.getPoint(u, _p); curveT.getPoint(u, _t);
    const i = clamp(Math.floor(sp), 0, N - 1), f = clamp(sp - i, 0, 1);
    let fov = lerp(CAM[i].fov, CAM[i + 1].fov, f);
    const aspect = vw() / vh();
    const nf = clamp((1.62 - aspect) / 1.05, 0, 1); // tall frames step back and open up
    if (nf > 0) { _d.subVectors(_p, _t).normalize(); _p.addScaledVector(_d, nf * 6); _p.y += nf * 0.8; fov *= 1 + nf * 0.36; }
    const io = 1 - easeOut(intro);
    _p.z += io * 5; _p.y += io * 0.6; fov += io * 8;
    const par = 1 - smooth(0, 1.6, sp) * 0.5;
    _p.x += RIG.mx * 0.6 * par; _p.y += RIG.my * 0.3 * par;
    _t.x -= RIG.mx * 0.2 * par;
    camera.position.copy(_p);
    camera.lookAt(_t);
    if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
    // inside the pinned Fields section a photographed set takes the camera over
    const dio = paintFields(clamp(getFields(), 0, 1), RIG.mx, RIG.my, dt);
    // hero + Ground: the photographed field holds the frame until the Fields plates take over
    const plateOn = !!dio && dio.focus >= 0;
    const heroOn = !plateOn && (sp < 1.999 || clamp(getFields(), 0, 1) < 0.5);
    // photographs: true colour, no glow; the synthetic farm: tone-mapped, with its bloom
    tmS = damp(tmS, heroOn || plateOn ? 0 : 1, 6, dt);
    finalPass.uniforms.uTM!.value = tmS;
    bloom.strength = lerp(0.04, 0.52, tmS);
    field.group.visible = heroOn;
    synthetic.forEach((o) => { o.visible = !heroOn; });
    if (heroOn) {
      seedling.visible = false;
      // push in along the furrow toward the sun: the intro settles in, scrolling carries on;
      // the pointer steps the camera across the rows and pans it a touch
      const ie = easeOut(intro);
      // Ground chapter: carry on down the furrow and tip the lens toward the soil
      const ground = smooth(0.35, 1.2, sp);
      const dolly = ie * 0.7 + smooth(0, 1, sp) * 1.0 + smooth(0.8, 2, sp) * 0.6;
      field.pose(camera, dolly, RIG.mx * 0.32, (1 - ie) * 0.25 + Math.max(0, RIG.my) * 0.08,
        -RIG.mx * 0.035, RIG.my * 0.02 - ground * 0.07);
      if (Math.abs(camera.fov - dioFov()) > 1e-3) { camera.fov = dioFov(); camera.updateProjectionMatrix(); }
      dioDust.visible = true;
      dioDust.position.set(FIELD_AT.x, FIELD_AT.y - 2.6, FIELD_AT.z + 4);
    }

    // lens: focus and aperture follow the chapter; the pinned Fields gallery holds its own focus
    {
      renderer.getDrawingBufferSize(bufSize);
      const i0 = clamp(Math.floor(sp), 0, CAM.length - 2), k = clamp(sp - i0, 0, 1);
      const foc = lerp(FOCUS[i0]!, FOCUS[i0 + 1]!, k), ap = lerp(APERTURE[i0]!, APERTURE[i0 + 1]!, k);
      const inSet = !!dio && dio.focus >= 0;
      const groundK = smooth(0.35, 1.2, sp);
      // hero: focus far down the field; Ground: pulled onto the near furrow, horizon falls soft
      dof.uniforms.uFocus!.value = heroOn ? lerp(30, 7, groundK) : inSet ? dio!.focus : foc;
      // the photographs carry their own depth of field; the lens only adds the focus-pull at a cut,
      // and relaxes entirely while the entry particles form, so the formed picture is crisp
      const burstAp = dio ? dio.burst : clamp(Number(veilMat.uniforms.uA!.value), 0, 1);
      // the photograph is sharp throughout: only the nearest rows soften as the camera pushes in
      const baseAp = heroOn ? lerp(0.25, 3.2, groundK) * (1 - (dio?.calm ?? 0) * 0.8) : inSet ? dio!.ap : ap * (1 - (dio?.calm ?? 0));
      dof.uniforms.uAperture!.value = (baseAp + burstAp * 9) * (vh() / 720);
      dof.uniforms.uMaxCoC!.value = 8 * (vh() / 720);
    }
    // the shadow window rides with what the camera is looking at
    sunL.target.position.set(_t.x * 0.5 + _p.x * 0.5, 0, _t.z * 0.5 + _p.z * 0.5);
    sunL.position.copy(sunL.target.position).addScaledVector(SUN_DIR, 40);
    if (lastShadowAt.distanceToSquared(sunL.target.position) > 0.25) {
      lastShadowAt.copy(sunL.target.position);
      sunL.shadow.needsUpdate = true;
    }
    SU.uSunCol.value.copy(sunL.color).multiplyScalar(sunL.intensity / 2.8);
    (dust.material as THREE.ShaderMaterial).uniforms.uPx!.value = bufSize.y / (2 * Math.tan((camera.fov * Math.PI) / 360));
    (dioDust.material as THREE.ShaderMaterial).uniforms.uPx!.value = bufSize.y / (2 * Math.tan((camera.fov * Math.PI) / 360));
    veilMat.uniforms.uAspect!.value = vw() / vh();

    composer.render();
  };
  if (import.meta.env.DEV) (window as unknown as { __terra?: unknown }).__terra = { renderer, scene, dof, bloom, sunL, clods, crops, weeds, ground, groundMat, dust, PERF };

  // Compile every program off the main thread (KHR_parallel_shader_compile) while the loader is
  // still up. On Windows/ANGLE a heavy shader compiled synchronously on first draw freezes the
  // page for seconds — loader included — so the shadow-depth programs, which a plain
  // compileAsync(scene) never sees, are warmed here too. The loader hands over the moment the
  // first real frame is on screen ("terra:ready").
  const warm = new THREE.Scene();
  {
    // the shadow pass's depth programs for the instanced casters
    const cropDepth = new THREE.InstancedMesh(cropGeo, crops.customDepthMaterial!, 1);
    const clodDepth = new THREE.InstancedMesh(clods.geometry, own(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })), 1);
    [cropDepth, clodDepth].forEach((m) => { m.frustumCulled = false; warm.add(m); });
  }
  // compiled against the target they will really draw into: off-screen targets drop tone mapping
  // and colour-space conversion from the program key, so compiling against the canvas builds a
  // different set of programs and every one is then rebuilt, synchronously, on the first frame
  const compileInto = (target: THREE.WebGLRenderTarget | null, obj: THREE.Object3D) => {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    const p = renderer.compileAsync(obj, camera, scene);
    renderer.setRenderTarget(prev);
    return p;
  };
  // the hero photograph must be on the GPU before the loader hands over
  scene.remove(sapling.group);
  const compiled = Promise.all([compileInto(sceneRT, scene), compileInto(sceneRT, warm), field.ready]);
  Promise.race([compiled, new Promise((r) => setTimeout(r, 6000))]).catch(() => {}).finally(() => {
    if (!alive) return;
    last = performance.now();
    let first = true;
    const kick = (now: number) => {
      frame(now);
      if (first) {
        first = false;
        (window as unknown as { __terraReady?: boolean }).__terraReady = true;
        window.dispatchEvent(new Event("terra:ready"));
        // later chapters' programs warm up in the background, well before they are scrolled to
        data.visible = true;
        renderer.compileAsync(data, camera).catch(() => {});
        data.visible = false;
        dioramas.forEach((d) => d.load(loader));
        sapling.load(loader);
        scene.add(sapling.group);
        compileInto(sceneRT, sapling.group).catch(() => {});
      }
    };
    raf = requestAnimationFrame(kick);
  });

  return {
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      owned.forEach((o) => o.dispose());
      dioramas.forEach((d) => d.dispose());
      sapling.dispose();
      field.dispose();
      entryRT.dispose();
      crops.dispose();
      weeds.dispose();
      dof.dispose();
      sceneRT.depthTexture?.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
}
