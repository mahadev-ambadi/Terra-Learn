// WebGL engine for the scroll journey.
//
// One renderer, five chapter scenes. A chapter is a card: when it is sliding in it covers only
// the bottom part of the screen, so each frame renders the visible chapters in order, each
// scissored to the strip it covers, with its cameras shifted (setViewOffset) so the card's
// content travels up with it. Nothing here owns the scroll — the page calls frame(p, t).
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { covers, span } from "./timeline";
import {
  HUSK,
  LEAF_DARK,
  kernelGeometry,
  kernelMaterial,
  leafMaterial,
  makeCob,
  makePlant,
  makeSprout,
  makeWind,
  ribbonGeometry,
  rng,
  type Wind,
} from "./maize";

export type EngineOptions = {
  mobile: boolean;
  /** headline drawn as particles in the hero */
  titleLines: string[];
  titleFont: string;
  /** where the hero headline sits (centre, fraction of viewport height from the top) */
  titleY: number;
  fieldImage: string;
  plotsImage: string;
  /** called whenever the headline is (re)laid out, with its bottom edge in px from the top */
  onTitleLayout?: (bottomPx: number, fontPx: number) => void;
};

export type Engine = {
  frame: (p: number, timeMs: number) => void;
  pointer: (x: number, y: number) => void;
  resize: () => void;
  dispose: () => void;
};

/* ------------------------------------------------------------------ */
/*  shared shader bits                                                 */
/* ------------------------------------------------------------------ */

const NOISE = /* glsl */ `
  float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    float a = hash21(i), b = hash21(i+vec2(1,0)), c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i=0;i<5;i++){ s += a*vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

/** full-screen quad drawn first in a chapter; slides with the card via uOffY */
function backdrop(fragBody: string, uniforms: Record<string, THREE.IUniform>) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOffY: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, ...uniforms },
    vertexShader: /* glsl */ `
      uniform float uOffY; uniform vec2 uRes; varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); gl_Position.y += 2.0*uOffY/uRes.y; }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 uRes; uniform float uTime; varying vec2 vUv;
      ${NOISE}
      ${fragBody}
    `,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

/** soft round sprite for glows, dust and bokeh */
function glowPoints(opts: {
  count: number;
  fill: (i: number, pos: Float32Array, col: Float32Array, size: Float32Array, seed: Float32Array) => void;
  additive?: boolean;
  core?: number;
  halo?: number;
}) {
  const pos = new Float32Array(opts.count * 3);
  const col = new Float32Array(opts.count * 3);
  const size = new Float32Array(opts.count);
  const seed = new Float32Array(opts.count);
  for (let i = 0; i < opts.count; i++) opts.fill(i, pos, col, size, seed);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 }, uPx: { value: 1 }, uRise: { value: 0 }, uCore: { value: opts.core ?? 0.35 }, uHalo: { value: opts.halo ?? 0.55 } },
    vertexShader: /* glsl */ `
      attribute vec3 color; attribute float aSize; attribute float aSeed;
      uniform float uTime, uPx, uRise; varying vec3 vCol; varying float vTw;
      void main(){
        vec3 p = position;
        // slow vertical drift, wrapping within ±20 units of where the point was placed
        p.y += mod(uRise * (0.5 + aSeed) + 20.0, 40.0) - 20.0;
        p.x += sin(uTime*0.3 + aSeed*20.0)*0.08;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPx * (10.0 / max(0.5, -mv.z));
        vCol = color; vTw = 0.65 + 0.35*sin(uTime*(1.0+aSeed*2.0) + aSeed*40.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha, uCore, uHalo; varying vec3 vCol; varying float vTw;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float halo = pow(1.0 - d, 2.2);
        float core = smoothstep(uCore, uCore*0.6, d);
        float a = (halo*uHalo + core) * uAlpha * vTw;
        gl_FragColor = vec4(vCol * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return { points: pts, mat };
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

/* ------------------------------------------------------------------ */
/*  chapter plumbing                                                   */
/* ------------------------------------------------------------------ */

type Chapter = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  overlay?: { scene: THREE.Scene; camera: THREE.OrthographicCamera };
  clear: THREE.Color;
  backdrop: THREE.Mesh;
  update: (p: number, t: number, dt: number) => void;
};

function lights(scene: THREE.Scene, key: THREE.ColorRepresentation, keyI: number, rim: THREE.ColorRepresentation, rimI: number) {
  scene.add(new THREE.HemisphereLight("#d6ecd0", "#0b1a12", 0.55));
  const k = new THREE.DirectionalLight(key, keyI);
  k.position.set(-4, 5, 6);
  scene.add(k);
  const r = new THREE.DirectionalLight(rim, rimI);
  r.position.set(4, 2, -5);
  scene.add(r);
}

/* ------------------------------------------------------------------ */
/*  engine                                                             */
/* ------------------------------------------------------------------ */

export function createEngine(canvas: HTMLCanvasElement, opts: EngineOptions): Engine {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  const pickDpr = () => Math.min(window.devicePixelRatio || 1, opts.mobile ? 1.5 : 1.75);
  let dpr = pickDpr();
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.autoClear = false;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const loader = new THREE.TextureLoader();
  const wind = makeWind();
  let W = 1, H = 1;
  const pointerPx = new THREE.Vector2(-9999, -9999);
  const pointerN = new THREE.Vector2(0, 0);
  const pointerSm = new THREE.Vector2(0, 0);
  let lastPointerMove = -1e9;

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

  /* ---------------------------- hero ------------------------------ */

  const hero = (() => {
    const scene = new THREE.Scene();
    scene.environment = env;
    scene.environmentIntensity = 0.45;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 12.5);
    lights(scene, "#fff0cf", 2.6, "#a8f0cf", 2.2);

    const bd = backdrop(
      /* glsl */ `
      void main(){
        vec2 q = vUv - vec2(0.55, 0.62); q.x *= uRes.x/uRes.y;
        float r = length(q);
        vec3 c = mix(vec3(0.19,0.36,0.27), vec3(0.055,0.15,0.11), smoothstep(0.0, 1.05, r));
        c *= 0.9 + 0.2*fbm(vUv*3.0 + uTime*0.02);
        c += (hash21(vUv*uRes + uTime) - 0.5) * 0.025;
        gl_FragColor = vec4(c, 1.0);
      }`,
      {},
    );
    scene.add(bd);

    const rig = new THREE.Group();
    rig.position.set(0.25, 1.05, 0);
    scene.add(rig);
    const cob = makeCob(wind, 3.1);
    cob.rotation.set(0.1, 0, -0.16);
    rig.add(cob);

    // dark leaves fanned behind the ear, as on a plant photographed close
    const darkMat = leafMaterial(LEAF_DARK, wind, { roughness: 0.6 });
    const R = rng(11);
    const leafSpecs = [
      { x: -0.4, y: -3.0, z: -1.6, az: Math.PI * 1.05, tilt: -0.35, len: 6.5, bend: 1.0 },
      { x: 0.6, y: -3.1, z: -1.4, az: Math.PI * -0.05, tilt: -0.3, len: 6.2, bend: 1.2 },
      { x: 0.0, y: -3.2, z: -2.4, az: Math.PI * 0.62, tilt: -0.12, len: 7.0, bend: 0.5 },
      { x: -0.9, y: -2.6, z: -0.8, az: Math.PI * 0.9, tilt: -0.7, len: 5.0, bend: 1.5 },
      { x: 1.1, y: -2.8, z: -0.6, az: Math.PI * 0.12, tilt: -0.75, len: 5.2, bend: 1.4 },
    ];
    for (const s of leafSpecs) {
      const leaf = new THREE.Mesh(
        ribbonGeometry({ length: s.len, width: 0.62, bend: s.bend, bendStart: 0.25, fold: 0.18, wave: 0.07, twist: (R() - 0.5) * 0.8 }),
        darkMat,
      );
      leaf.position.set(s.x, s.y, s.z);
      leaf.rotation.y = -s.az;
      leaf.rotateZ(s.tilt);
      rig.add(leaf);
    }
    // a husk-coloured shank leaf under the ear
    {
      const leaf = new THREE.Mesh(ribbonGeometry({ length: 2.4, width: 0.5, bend: 0.4, bendStart: 0.4, fold: 0.3 }), leafMaterial(HUSK, wind));
      leaf.position.set(0.2, -2.6, -0.3);
      leaf.rotation.y = -Math.PI * 0.4;
      rig.add(leaf);
    }

    /* headline as particles that scatter around the cursor */
    const overlay = { scene: new THREE.Scene(), camera: new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10) };
    const TRAIL = 12;
    const trail = Array.from({ length: TRAIL }, () => new THREE.Vector3(-9999, -9999, 0));
    const titleMat = new THREE.ShaderMaterial({
      uniforms: {
        uTrail: { value: trail },
        uIntro: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: 2 },
        uFade: { value: 1 },
      },
      vertexShader: /* glsl */ `
        #define TRAIL ${TRAIL}
        attribute vec2 aHome; attribute vec2 aRnd;
        uniform vec3 uTrail[TRAIL]; uniform float uIntro, uTime, uSize, uFade;
        varying float vA;
        void main(){
          float ti = clamp((uIntro - aRnd.x*0.55)/0.45, 0.0, 1.0); ti = 1.0 - pow(1.0 - ti, 3.0);
          vec2 sc = (aRnd - 0.5) * vec2(1400.0, 700.0);
          vec2 p = mix(aHome + sc, aHome, ti);
          vec2 push = vec2(0.0);
          for (int i = 0; i < TRAIL; i++) {
            vec2 d = aHome - uTrail[i].xy; float dist = length(d);
            float k = uTrail[i].z * (1.0 - smoothstep(16.0, 54.0 + aRnd.y*46.0, dist));
            push += (d/(dist + 1.0)) * k;
          }
          float m = clamp(length(push), 0.0, 1.0);
          m = smoothstep(0.08, 0.9, m);
          vec2 dir = normalize(push + (aRnd - 0.5)*2.4 + 1e-4);
          p += dir * m * (25.0 + aRnd.y*140.0);
          p += vec2(sin(uTime*1.3 + aRnd.x*40.0)*10.0, 30.0 + aRnd.x*70.0) * m;
          vA = (1.0 - m*0.7) * ti * uFade;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
          gl_PointSize = uSize * (1.0 - m*0.5);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(0.965, 0.97, 0.95, vA); }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    let titlePts: THREE.Points | null = null;
    let titleBuiltFor = "";

    function buildTitle() {
      const key = `${W}x${H}@${dpr}`;
      if (key === titleBuiltFor) return;
      titleBuiltFor = key;
      if (titlePts) {
        overlay.scene.remove(titlePts);
        titlePts.geometry.dispose();
      }
      const lines = W < 720 ? opts.titleLines : [opts.titleLines.join(" ")];
      const cv = document.createElement("canvas");
      const g = cv.getContext("2d", { willReadFrequently: true })!;
      const fontAt = (fs: number) => `800 ${fs}px ${opts.titleFont}`;
      // fit the widest line to ~84% of the viewport
      let fs = 100;
      g.font = fontAt(fs);
      const widest = Math.max(...lines.map((l) => g.measureText(l).width));
      fs = Math.max(34, Math.min(W < 720 ? 92 : 172, (fs * W * 0.84) / widest));
      const lh = fs * 0.98;
      const textH = lh * lines.length;
      cv.width = Math.ceil(W);
      cv.height = Math.ceil(textH + fs * 0.4);
      g.font = fontAt(fs);
      g.fillStyle = "#fff";
      g.textAlign = "center";
      g.textBaseline = "middle";
      lines.forEach((l, i) => g.fillText(l, cv.width / 2, fs * 0.2 + lh * (i + 0.5)));
      const data = g.getImageData(0, 0, cv.width, cv.height).data;
      const step = Math.max(1.35, Math.min(2.6, fs / 62));
      const homes: number[] = [];
      const rnds: number[] = [];
      const cy = -(opts.titleY - 0.5) * H; // title centre in overlay coords (y up)
      for (let y = 0; y < cv.height; y += step) {
        for (let x = 0; x < cv.width; x += step) {
          const a = data[(Math.floor(y) * cv.width + Math.floor(x)) * 4 + 3]!;
          if (a < 128) continue;
          homes.push(x - cv.width / 2 + (Math.random() - 0.5) * step * 0.3, cy - (y - cv.height / 2));
          rnds.push(Math.random(), Math.random());
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array((homes.length / 2) * 3), 3));
      geo.setAttribute("aHome", new THREE.Float32BufferAttribute(homes, 2));
      geo.setAttribute("aRnd", new THREE.Float32BufferAttribute(rnds, 2));
      titlePts = new THREE.Points(geo, titleMat);
      titlePts.frustumCulled = false;
      overlay.scene.add(titlePts);
      titleMat.uniforms.uSize!.value = step * 1.32 * dpr;
      opts.onTitleLayout?.(opts.titleY * H + textH / 2, fs);
    }

    let introStart = -1;
    let lastTrailPush = 0;
    let wanderT = 0;
    const ch: Chapter & { buildTitle: () => void; pushTrail: (x: number, y: number, w: number, now: number) => void } = {
      scene,
      camera,
      overlay,
      clear: new THREE.Color("#0e2419"),
      backdrop: bd,
      buildTitle,
      pushTrail(x, y, w, now) {
        if (now - lastTrailPush < 16) {
          trail[0]!.set(x, y, Math.max(trail[0]!.z, w));
          return;
        }
        lastTrailPush = now;
        for (let i = TRAIL - 1; i > 0; i--) trail[i]!.copy(trail[i - 1]!);
        trail[0]!.set(x, y, w);
      },
      update(p, t, dt) {
        if (introStart < 0) introStart = t;
        const intro = Math.min(1, (t - introStart) / 2.2);
        titleMat.uniforms.uIntro!.value = intro;
        titleMat.uniforms.uTime!.value = t;
        for (const tr of trail) tr.z *= Math.pow(0.2, dt); // fade over ~1.5s
        // with no pointer about, let a slow invisible hand drift across the headline
        if (t - lastPointerMove > 3 && intro >= 1) {
          wanderT += dt;
          const x = Math.sin(wanderT * 0.37) * W * 0.36;
          const y = -(opts.titleY - 0.5) * H + Math.sin(wanderT * 0.81) * 30;
          ch.pushTrail(x, y, 0.32, t * 1000);
        }
        const k = easeOut(intro);
        rig.scale.setScalar(0.86 + 0.14 * k);
        rig.rotation.y = (1 - k) * -0.9 + Math.sin(t * 0.25) * 0.18 + pointerSm.x * 0.22;
        rig.rotation.x = pointerSm.y * 0.08;
        rig.position.y = 1.05 + Math.sin(t * 0.6) * 0.05 + p * 2;
      },
    };
    return ch;
  })();

  /* ------------------------- underground -------------------------- */

  const under = (() => {
    const scene = new THREE.Scene();
    scene.environment = env;
    scene.environmentIntensity = 0.6;
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    lights(scene, "#fff2d8", 2.2, "#9fe8d8", 1.6);

    // soil → dark → teal → green-teal, with soil specks early on
    const uPhase = { value: 0 };
    const uSoil = { value: 1 };
    const bd = backdrop(
      /* glsl */ `
      uniform float uPhase, uSoil;
      void main(){
        vec3 soil = vec3(0.16,0.15,0.135), dark = vec3(0.07,0.075,0.07), teal = vec3(0.06,0.2,0.19), green = vec3(0.1,0.25,0.22);
        vec3 c = mix(soil, dark, smoothstep(0.0, 0.25, uPhase));
        c = mix(c, teal, smoothstep(0.3, 0.55, uPhase));
        c = mix(c, green, smoothstep(0.7, 0.9, uPhase));
        vec2 q = vUv - 0.5; q.x *= uRes.x/uRes.y;
        c *= 1.0 - 0.55*smoothstep(0.2, 1.0, length(q));
        float n = fbm(vUv*vec2(uRes.x/uRes.y, 1.0)*6.0);
        c *= 0.85 + 0.3*n*mix(0.4, 1.0, uSoil);
        float speck = step(0.985, hash21(floor(vUv*uRes/2.0)));
        c += speck * 0.18 * uSoil;
        c += (hash21(vUv*uRes + uTime) - 0.5) * 0.03;
        gl_FragColor = vec4(c, 1.0);
      }`,
      { uPhase, uSoil },
    );
    scene.add(bd);

    // --- glowing fibre helix, closed by a loop at the bottom ---
    const helix = new THREE.Group();
    scene.add(helix);
    const HH = 11, HR = 0.95, TURNS = 2.1;
    const strand = (s: number, out: THREE.Vector3) => {
      // s 0..0.44 strand A down, 0.44..0.56 loop, 0.56..1 strand B up
      const loopA = 0.44, loopB = 0.56;
      const ang = (u: number) => u * TURNS * Math.PI * 2;
      if (s < loopA) {
        const u = s / loopA;
        out.set(Math.cos(ang(u)) * HR, HH / 2 - u * HH, Math.sin(ang(u)) * HR);
      } else if (s > loopB) {
        const u = 1 - (s - loopB) / (1 - loopB);
        out.set(Math.cos(ang(u) + Math.PI) * HR, HH / 2 - u * HH, Math.sin(ang(u) + Math.PI) * HR);
      } else {
        const v = (s - loopA) / (loopB - loopA); // 0..1 around the bottom
        const a0 = ang(1);
        const dx = Math.cos(a0), dz = Math.sin(a0);
        const phi = v * Math.PI;
        out.set(dx * HR * Math.cos(phi), -HH / 2 - Math.sin(phi) * HR * 1.7, dz * HR * Math.cos(phi));
      }
      return out;
    };
    const FIB = opts.mobile ? 34 : 64;
    const SEG = 520;
    const fpos: number[] = [];
    const fS: number[] = [];
    const fF: number[] = [];
    const R = rng(5);
    const tmp = new THREE.Vector3();
    for (let f = 0; f < FIB; f++) {
      const a1 = 3 + R() * 9, a2 = 3 + R() * 9, a3 = 3 + R() * 9;
      const p1 = R() * 6.28, p2 = R() * 6.28, p3 = R() * 6.28;
      const amp = 0.06 + R() * 0.26;
      const bright = R();
      let prev: [number, number, number] | null = null;
      for (let i = 0; i <= SEG; i++) {
        const s = i / SEG;
        strand(s, tmp);
        const x = tmp.x + Math.sin(s * a1 * 6.28 + p1) * amp;
        const y = tmp.y + Math.sin(s * a2 * 6.28 + p2) * amp;
        const z = tmp.z + Math.cos(s * a3 * 6.28 + p3) * amp;
        if (prev) {
          fpos.push(prev[0], prev[1], prev[2], x, y, z);
          fS.push((i - 1) / SEG, s);
          fF.push(bright, bright);
        }
        prev = [x, y, z];
      }
    }
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute("position", new THREE.Float32BufferAttribute(fpos, 3));
    fgeo.setAttribute("aS", new THREE.Float32BufferAttribute(fS, 1));
    fgeo.setAttribute("aF", new THREE.Float32BufferAttribute(fF, 1));
    const fmat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 }, uGrow: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aS; attribute float aF; varying float vS; varying float vF;
        void main(){ vS = aS; vF = aF; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uAlpha, uGrow; varying float vS; varying float vF;
        void main(){
          float g = 1.0 - smoothstep(uGrow - 0.04, uGrow, abs(vS - 0.5) * 2.0);
          vec3 c = mix(vec3(1.0, 0.36, 0.06), vec3(1.0, 0.85, 0.55), pow(vF, 3.0));
          float fl = 0.7 + 0.3*sin(uTime*2.0 + vF*50.0 + vS*40.0);
          float ends = smoothstep(0.0, 0.05, vS) * smoothstep(1.0, 0.95, vS);
          float a = uAlpha * (0.3 + 0.7*pow(vF, 3.0)) * fl * ends * g;
          gl_FragColor = vec4(c * a, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const fibres = new THREE.LineSegments(fgeo, fmat);
    fibres.frustumCulled = false;
    helix.add(fibres);
    // a soft halo strung along the strands, standing in for bloom
    const HALO = opts.mobile ? 260 : 520;
    const halo = glowPoints({
      count: HALO,
      fill(i, pos, col, size, seed) {
        strand(i / (HALO - 1), tmp);
        pos.set([tmp.x, tmp.y, tmp.z], i * 3);
        col.set([1, 0.42, 0.1], i * 3);
        size[i] = 26 + R() * 22;
        seed[i] = R();
      },
      core: 0.95,
    });
    helix.add(halo.points);

    // floating dust through the whole chapter
    const dust = glowPoints({
      count: opts.mobile ? 900 : 1800,
      fill(i, pos, col, size, seed) {
        pos[i * 3] = (R() - 0.5) * 24;
        pos[i * 3 + 1] = (R() - 0.5) * 18;
        pos[i * 3 + 2] = -10 + R() * 14;
        const warm = R();
        col.set([1, 0.75 + warm * 0.2, 0.55 + warm * 0.3], i * 3);
        size[i] = 0.6 + R() * 1.6;
        seed[i] = R();
      },
      core: 0.25,
    });
    scene.add(dust.points);

    // --- constellation: library of genetics ↔ map of readings ---
    const net = new THREE.Group();
    scene.add(net);
    const NN = opts.mobile ? 46 : 78;
    const nodes: THREE.Vector3[] = [];
    for (let i = 0; i < NN; i++) nodes.push(new THREE.Vector3((R() - 0.5) * 20, (R() - 0.5) * 12, -12 + R() * 13));
    const nodePts = glowPoints({
      count: NN,
      fill(i, pos, col, size, seed) {
        const n = nodes[i]!;
        pos.set([n.x, n.y, n.z], i * 3);
        const yellow = R() < 0.45;
        col.set(yellow ? [1.0, 0.93, 0.25] : [0.55, 0.98, 0.86], i * 3);
        size[i] = 26 + R() * 22;
        seed[i] = R();
      },
      core: 0.2,
      halo: 1.3,
    });
    net.add(nodePts.points);
    const lpos: number[] = [];
    nodes.forEach((a, i) => {
      const near = nodes
        .map((b, j) => ({ j, d: a.distanceTo(b) }))
        .filter((o) => o.j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2);
      near.forEach(({ j, d }) => {
        if (d < 4.5 && j > i) lpos.push(a.x, a.y, a.z, nodes[j]!.x, nodes[j]!.y, nodes[j]!.z);
      });
    });
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute("position", new THREE.Float32BufferAttribute(lpos, 3));
    const lmat = new THREE.LineBasicMaterial({ color: "#cdeee6", transparent: true, opacity: 0.22, depthWrite: false });
    net.add(new THREE.LineSegments(lgeo, lmat));
    // a few thin orbit arcs, as in a star chart
    const arcMat = new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.4, depthWrite: false });
    const arcs: THREE.Line[] = [];
    for (let i = 0; i < 4; i++) {
      const r = 0.5 + R() * 0.8;
      const pts = Array.from({ length: 48 }, (_, k) => {
        const a = (k / 47) * Math.PI * (0.6 + R() * 0.0) * 1.4;
        return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0);
      });
      const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), arcMat);
      const at = nodes[Math.floor(R() * NN)]!;
      arc.position.copy(at);
      arc.rotation.z = R() * 6.28;
      arcs.push(arc);
      net.add(arc);
    }

    // --- golden kernels falling through ---
    const KN = 14;
    const kGeo = kernelGeometry(24);
    const kMat = kernelMaterial();
    const kernels = new THREE.InstancedMesh(kGeo, kMat, KN);
    const kData = Array.from({ length: KN }, () => ({
      x: (R() - 0.5) * 10,
      z: -5 + R() * 6,
      y0: 6 + R() * 6,
      sp: 0.8 + R() * 0.6,
      rx: R() * 6,
      ry: R() * 6,
      s: 0.18 + R() * 0.12,
    }));
    kernels.frustumCulled = false;
    scene.add(kernels);

    // --- seedling in a glass cube of soil ---
    const pot = new THREE.Group();
    scene.add(pot);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: "#2c403b",
      roughness: 0.12,
      metalness: 0,
      transparent: true,
      opacity: 0.42,
      clearcoat: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const cube = (w: number, h: number, d: number) => {
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMat);
      g.add(box);
      g.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
          new THREE.LineBasicMaterial({ color: "#d9efe8", transparent: true, opacity: 0.18 }),
        ),
      );
      return g;
    };
    const main = cube(2.4, 2.0, 2.4);
    pot.add(main);
    // the soil itself: a dark translucent block inside the glass, so the roots read against it
    const soilBlock = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 1.75, 2.3),
      new THREE.MeshStandardMaterial({ color: "#2a211a", roughness: 1, transparent: true, opacity: 0.62, depthWrite: false }),
    );
    soilBlock.position.y = -0.1;
    soilBlock.renderOrder = 1;
    main.add(soilBlock);
    const soilPts = glowPoints({
      count: opts.mobile ? 700 : 1400,
      fill(i, pos, col, size, seed) {
        pos.set([(R() - 0.5) * 2.3, -1 + R() * 1.8, (R() - 0.5) * 2.3], i * 3);
        const b = 0.25 + R() * 0.35;
        col.set([b * 0.9, b * 0.75, b * 0.6], i * 3);
        size[i] = 4 + R() * 5;
        seed[i] = R();
      },
      additive: false,
      core: 0.7,
    });
    soilPts.mat.uniforms.uAlpha!.value = 0.7;
    soilPts.points.renderOrder = 2;
    main.add(soilPts.points);
    // roots: branching random walks from the seed downward
    const rootPos: number[] = [];
    const rootS: number[] = [];
    const walk = (x: number, y: number, z: number, dx: number, dz: number, len: number, depth: number, s0: number) => {
      let px = x, py = y, pz = z;
      const steps = Math.floor(len * 18);
      for (let i = 0; i < steps; i++) {
        const nx = px + dx * 0.05 + (R() - 0.5) * 0.04;
        const ny = py - 0.055 - R() * 0.02;
        const nz = pz + dz * 0.05 + (R() - 0.5) * 0.04;
        if (ny < -0.95) break;
        rootPos.push(px, py, pz, nx, ny, nz);
        const s = s0 + (i / steps) * (1 - s0);
        rootS.push(s, s);
        px = nx; py = ny; pz = nz;
        if (depth < 2 && R() < 0.05) walk(px, py, pz, dx + (R() - 0.5) * 1.6, dz + (R() - 0.5) * 1.6, len * 0.5, depth + 1, s);
      }
    };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.28;
      walk(0, 0.78, 0, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 1.6 + R() * 0.6, 0, 0);
    }
    const rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute("position", new THREE.Float32BufferAttribute(rootPos, 3));
    rgeo.setAttribute("aS", new THREE.Float32BufferAttribute(rootS, 1));
    const rmat = new THREE.ShaderMaterial({
      uniforms: { uGrow: { value: 0 } },
      vertexShader: /* glsl */ `attribute float aS; varying float vS; void main(){ vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `uniform float uGrow; varying float vS; void main(){ if (vS > uGrow) discard; float a = 0.75*(1.0 - vS*0.5); gl_FragColor = vec4(vec3(0.98,0.95,0.85)*a, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const roots = new THREE.LineSegments(rgeo, rmat);
    roots.renderOrder = 3;
    main.add(roots);
    const seed = new THREE.Mesh(kGeo, kMat);
    seed.scale.setScalar(0.17);
    seed.position.set(0, 0.86, 0);
    seed.rotation.z = Math.PI * 0.55;
    main.add(seed);
    const sprout = makeSprout(wind);
    sprout.position.set(0, 0.95, 0);
    main.add(sprout);
    // out-of-focus cubes behind
    const back1 = cube(2.4, 2.0, 2.4);
    back1.position.set(4.8, 2.8, -11);
    const back2 = cube(2.4, 2.0, 2.4);
    back2.position.set(3.6, 0.4, -7);
    pot.add(back1, back2);

    const uRise = { t: 0 };
    const ch: Chapter = {
      scene,
      camera,
      clear: new THREE.Color("#141412"),
      backdrop: bd,
      update(p, t) {
        const phase = span(p, 0.08, 0.6);
        uPhase.value = phase;
        uSoil.value = 1 - span(p, 0.12, 0.3) * 0.75;
        fmat.uniforms.uTime!.value = t;
        dust.mat.uniforms.uTime!.value = t;
        uRise.t = t;
        dust.mat.uniforms.uRise!.value = t * 0.15 + p * 30;
        dust.mat.uniforms.uAlpha!.value = 0.55 + 0.25 * span(p, 0.1, 0.2);

        // helix rides up with the card, holds while it turns, then leaves through the top
        const hIn = span(p, 0.06, 0.2);
        const hOut = span(p, 0.22, 0.38);
        helix.position.y = -2.2 + ease(hIn) * 2.2 + ease(hOut) * 14;
        helix.position.x = opts.mobile ? 0 : -0.2 + ease(hOut) * 2.6;
        helix.rotation.y = t * 0.12 + p * 9;
        helix.rotation.z = 0.12;
        helix.rotation.x = 0.18 - hIn * 0.1;
        fmat.uniforms.uGrow!.value = 0.35 + 0.65 * easeOut(span(p, 0.06, 0.16));
        fmat.uniforms.uAlpha!.value = 1 - span(p, 0.36, 0.42);
        halo.mat.uniforms.uAlpha!.value = 0.09 * (1 - span(p, 0.36, 0.42)) * easeOut(span(p, 0.06, 0.16));
        halo.mat.uniforms.uTime!.value = t;
        helix.visible = p < 0.43;

        // constellation drifts in toward the camera
        const nIn = span(p, 0.26, 0.34);
        const nOut = span(p, 0.46, 0.53);
        const na = nIn * (1 - nOut);
        net.visible = na > 0.001;
        nodePts.mat.uniforms.uAlpha!.value = na;
        nodePts.mat.uniforms.uTime!.value = t;
        lmat.opacity = 0.22 * na;
        arcMat.opacity = 0.4 * na;
        net.position.z = -2 + span(p, 0.26, 0.52) * 9;
        net.position.y = -1.5 + span(p, 0.26, 0.5) * 3;
        net.rotation.y = Math.sin(t * 0.07) * 0.08;
        arcs.forEach((a, i) => (a.rotation.z += 0.002 * (i % 2 ? 1 : -1)));

        // kernels fall through the constellation into the seedling scene
        const kf = span(p, 0.4, 0.53);
        kernels.visible = kf > 0 && kf < 1;
        if (kernels.visible) {
          const m = new THREE.Matrix4();
          const q = new THREE.Quaternion();
          const e = new THREE.Euler();
          const v = new THREE.Vector3();
          const s = new THREE.Vector3();
          kData.forEach((k, i) => {
            e.set(k.rx + t * 0.6 * k.sp, k.ry + t * 0.4, 0);
            q.setFromEuler(e);
            v.set(k.x, k.y0 - kf * 22 * k.sp, k.z);
            s.setScalar(k.s);
            m.compose(v, q, s);
            kernels.setMatrixAt(i, m);
          });
          kernels.instanceMatrix.needsUpdate = true;
        }

        // the seedling cube rises into place and the sprout grows
        const pIn = span(p, 0.44, 0.52);
        pot.visible = pIn > 0;
        pot.position.set(opts.mobile ? 0 : 1.9, -9 + ease(pIn) * 8.6 - (opts.mobile ? 1.4 : 0), 0);
        main.rotation.y = 0.6 + p * 3 + Math.sin(t * 0.3) * 0.05;
        main.rotation.x = 0.28;
        const grow = easeOut(span(p, 0.47, 0.57));
        rmat.uniforms.uGrow!.value = grow;
        sprout.scale.setScalar(Math.max(0.001, grow * 1.25));
        soilPts.mat.uniforms.uTime!.value = t;
      },
    };
    return ch;
  })();

  /* ---------------------------- field ----------------------------- */

  const field = (() => {
    const scene = new THREE.Scene();
    scene.environment = env;
    scene.environmentIntensity = 0.5;
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.6, 10);
    lights(scene, "#fff3d6", 2.4, "#c8f2d8", 1.8);

    const tex = loader.load(opts.fieldImage);
    tex.colorSpace = THREE.SRGBColorSpace;
    track(tex);
    const uImgAspect = { value: 16 / 9 };
    const uZoom = { value: 1 };
    const img = new Image();
    img.onload = () => (uImgAspect.value = img.width / img.height);
    img.src = opts.fieldImage;
    const bd = backdrop(
      /* glsl */ `
      uniform sampler2D uTex; uniform float uImgAspect, uZoom;
      vec3 tap(vec2 uv){ return texture2D(uTex, uv, 3.5).rgb; }
      void main(){
        float va = uRes.x/uRes.y;
        vec2 uv = vUv - 0.5;
        if (va > uImgAspect) uv.y *= uImgAspect/va; else uv.x *= va/uImgAspect;
        uv = uv / uZoom + vec2(0.5, 0.42);
        vec2 px = 1.0/vec2(256.0, 256.0/uImgAspect) * 2.5;
        vec3 c = tap(uv)*0.2 + (tap(uv+vec2(px.x,0.0)) + tap(uv-vec2(px.x,0.0)) + tap(uv+vec2(0.0,px.y)) + tap(uv-vec2(0.0,px.y)))*0.12
               + (tap(uv+px) + tap(uv-px) + tap(uv+vec2(px.x,-px.y)) + tap(uv+vec2(-px.x,px.y)))*0.08;
        c = mix(c, vec3(0.08, 0.2, 0.14), 0.42) * 0.72;
        vec2 q = vUv - 0.5; q.x *= va;
        c *= 1.0 - 0.5*smoothstep(0.25, 1.0, length(q));
        c += (hash21(vUv*uRes + uTime) - 0.5) * 0.025;
        gl_FragColor = vec4(c, 1.0);
      }`,
      { uTex: { value: tex }, uImgAspect, uZoom },
    );
    scene.add(bd);

    const plant = makePlant(wind, 6.2, 4);
    plant.position.set(0.9, -4.4, 0);
    scene.add(plant);
    const R = rng(21);
    const bokeh = glowPoints({
      count: 34,
      fill(i, pos, col, size, seed) {
        pos.set([(R() - 0.5) * 18, (R() - 0.5) * 10, -6 + R() * 4], i * 3);
        col.set([1, 0.92, 0.7], i * 3);
        size[i] = 30 + R() * 50;
        seed[i] = R();
      },
      core: 0.9,
    });
    bokeh.mat.uniforms.uAlpha!.value = 0.12;
    scene.add(bokeh.points);

    const ch: Chapter = {
      scene,
      camera,
      clear: new THREE.Color("#132a20"),
      backdrop: bd,
      update(p, t) {
        const u = span(p, 0.55, 0.8);
        uZoom.value = 1.05 + u * 0.12;
        plant.rotation.y = -0.6 + u * 1.6;
        plant.position.y = -4.6 + u * 0.6;
        plant.position.x = opts.mobile ? 0.2 : 1.0;
        bokeh.mat.uniforms.uTime!.value = t;
      },
    };
    return ch;
  })();

  /* ---------------------------- plots ----------------------------- */

  const plots = (() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

    // glyph atlas: 8x8 cells of characters
    const atlas = document.createElement("canvas");
    atlas.width = atlas.height = 512;
    {
      const g = atlas.getContext("2d")!;
      g.fillStyle = "#fff";
      g.font = "bold 48px 'JetBrains Mono', ui-monospace, monospace";
      g.textAlign = "center";
      g.textBaseline = "middle";
      const chars = "#%&@$*+=-:;/\\|()[]{}<>01234567ABXZWMNKH?!^~▓▒░█▄▀■□●◆";
      for (let i = 0; i < 64; i++) g.fillText(chars[i % chars.length]!, (i % 8) * 64 + 32, Math.floor(i / 8) * 64 + 34);
    }
    const atlasTex = new THREE.CanvasTexture(atlas);
    track(atlasTex);
    const colTex = loader.load(opts.plotsImage);
    colTex.colorSpace = THREE.SRGBColorSpace;
    track(colTex);

    const bd = backdrop(
      /* glsl */ `
      void main(){ gl_FragColor = vec4(vec3(0.03,0.06,0.05), 1.0); }`,
      {},
    );
    scene.add(bd);

    const uTime = { value: 0 };
    const uReveal = { value: 0 };
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 24),
      new THREE.ShaderMaterial({
        uniforms: {
          uAtlas: { value: atlasTex },
          uCol: { value: colTex },
          uTime,
          uReveal,
          uPlots: { value: new THREE.Vector2(20, 13) },
          uGlyphs: { value: new THREE.Vector2(20 * 15, 13 * 15) },
        },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uAtlas, uCol; uniform float uTime, uReveal; uniform vec2 uPlots, uGlyphs; varying vec2 vUv;
          ${NOISE}
          void main(){
            vec2 g = vUv * uPlots; vec2 cell = floor(g); vec2 f = fract(g);
            float gut = step(0.05, f.x) * step(f.x, 0.95) * step(0.07, f.y) * step(f.y, 0.93);
            float h = hash21(cell);
            vec3 src = texture2D(uCol, (cell + 0.5)/uPlots).rgb;
            vec3 pal = h < 0.3 ? vec3(0.36,0.62,0.22) : h < 0.55 ? vec3(0.55,0.68,0.2) : h < 0.72 ? vec3(0.27,0.48,0.2) : h < 0.86 ? vec3(0.72,0.66,0.2) : h < 0.94 ? vec3(0.2,0.36,0.18) : vec3(0.85,0.45,0.15);
            vec3 pc = mix(pal, src*1.6, 0.35);
            vec2 gg = vUv * uGlyphs; vec2 gc = floor(gg); vec2 gf = fract(gg);
            float rate = 0.5 + hash21(gc + 7.0) * 3.0;
            float id = floor(hash21(gc + floor(uTime*rate + hash21(gc)*10.0)) * 64.0);
            vec2 auv = (vec2(mod(id, 8.0), 7.0 - floor(id/8.0)) + gf) / 8.0;
            float a = texture2D(uAtlas, auv).a;
            float shade = 0.55 + 0.6*hash21(gc + 3.0) + 0.25*sin(uTime*2.0 + h*30.0);
            // plots switch on one by one, roughly from the near edge to the far one
            float th = hash21(cell + 11.0) * 0.6 + (1.0 - vUv.y) * 0.4;
            float vis = smoothstep(th, th + 0.08, uReveal * 1.1);
            vec3 c = pc * a * shade * gut * vis * 1.7;
            gl_FragColor = vec4(c, 1.0);
          }
        `,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    const ch: Chapter = {
      scene,
      camera,
      clear: new THREE.Color("#08100d"),
      backdrop: bd,
      update(p, t) {
        const u = span(p, 0.72, 0.95);
        uTime.value = t;
        uReveal.value = span(p, 0.71, 0.8);
        camera.position.set(-1 + u * 2, 12 - u * 3.5, 6.5 - u * 1.5);
        camera.lookAt(0.5 * u, 0, -1.5);
      },
    };
    return ch;
  })();

  /* ---------------------------- outro ----------------------------- */

  const outro = (() => {
    const scene = new THREE.Scene();
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    lights(scene, "#fff0c8", 3, "#a0fff0", 2);
    const bd = backdrop(
      /* glsl */ `
      void main(){
        vec2 q = vUv - vec2(0.5, 0.75); q.x *= uRes.x/uRes.y;
        vec3 c = mix(vec3(0.15,0.37,0.33), vec3(0.07,0.2,0.18), smoothstep(0.0, 1.1, length(q)));
        c *= 0.92 + 0.12*fbm(vUv*4.0 + uTime*0.02);
        c += (hash21(vUv*uRes + uTime) - 0.5) * 0.02;
        gl_FragColor = vec4(c, 1.0);
      }`,
      {},
    );
    scene.add(bd);
    const kernel = new THREE.Mesh(kernelGeometry(64), kernelMaterial());
    kernel.scale.setScalar(1.15);
    scene.add(kernel);
    const R = rng(31);
    const sparks = glowPoints({
      count: 160,
      fill(i, pos, col, size, seed) {
        const a = R() * 6.28, r = 0.6 + R() * 1.4;
        pos.set([Math.cos(a) * r, -0.5 - R() * 3, Math.sin(a) * r * 0.6], i * 3);
        col.set([1, 0.85, 0.5], i * 3);
        size[i] = 0.8 + R() * 1.8;
        seed[i] = R();
      },
      core: 0.3,
    });
    kernel.add(sparks.points);

    const ch: Chapter = {
      scene,
      camera,
      clear: new THREE.Color("#163f39"),
      backdrop: bd,
      update(p, t) {
        // camera half-height at z=10, fov 34 ≈ 3.06: park the kernel just over the top edge
        kernel.position.set(0, 3.35 - (1 - span(p, 0.88, 1)) * 0.6, 0);
        kernel.rotation.set(0.2 + Math.sin(t * 0.4) * 0.1, t * 0.35, Math.PI + 0.25);
        sparks.mat.uniforms.uTime!.value = t;
        sparks.mat.uniforms.uRise!.value = -t * 0.3;
      },
    };
    return ch;
  })();

  const chapters: Chapter[] = [hero, under, field, plots, outro];

  /* ---------------------------- frame ----------------------------- */

  // glowPoints sizes are in CSS px scaled by device pixels
  const setPx = (o: THREE.Object3D) =>
    o.traverse((x) => {
      const m = (x as THREE.Points).material as THREE.ShaderMaterial | undefined;
      if (m?.uniforms?.uPx) m.uniforms.uPx.value = dpr;
    });

  const resize = () => {
    W = Math.max(1, window.innerWidth);
    H = Math.max(1, window.innerHeight);
    // the device pixel ratio changes when the window moves between screens or the page zooms
    dpr = pickDpr();
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    chapters.forEach((c) => setPx(c.scene));
    for (const ch of chapters) {
      ch.camera.aspect = W / H;
      ch.camera.updateProjectionMatrix();
      (ch.backdrop.material as THREE.ShaderMaterial).uniforms.uRes!.value.set(W, H);
      if (ch.overlay) {
        const c = ch.overlay.camera;
        c.left = -W / 2;
        c.right = W / 2;
        c.top = H / 2;
        c.bottom = -H / 2;
        c.updateProjectionMatrix();
      }
    }
    // narrow screens: pull the hero camera back so the ear still fits
    hero.camera.position.z = W / H < 0.8 ? 17 : 12.5;
    hero.buildTitle();
  };
  resize();

  let lastT = -1;
  const frame = (p: number, timeMs: number) => {
    const t = timeMs / 1000;
    const dt = lastT < 0 ? 0.016 : Math.min(0.1, t - lastT);
    lastT = t;
    wind.uTime.value = t;
    pointerSm.lerp(pointerN, 1 - Math.pow(0.02, dt));

    const cv = covers(p);
    let first = 0;
    cv.forEach((c, i) => {
      if (c >= 1) first = i;
    });
    renderer.setScissorTest(true);
    for (let i = first; i < chapters.length; i++) {
      const c = cv[i]!;
      if (c <= 0) continue;
      const ch = chapters[i]!;
      // the card's content travels with it; the hero also drifts up a little as it's covered
      const offY = i === 0 ? (cv[1] ?? 0) * 0.22 * H : -(1 - c) * H;
      ch.update(p, t, dt);
      (ch.backdrop.material as THREE.ShaderMaterial).uniforms.uOffY!.value = offY;
      (ch.backdrop.material as THREE.ShaderMaterial).uniforms.uTime!.value = t;
      ch.camera.setViewOffset(W, H, 0, offY, W, H);
      renderer.setScissor(0, 0, W, Math.ceil(c * H));
      renderer.setClearColor(ch.clear, 1);
      renderer.clear(true, true, false);
      renderer.render(ch.scene, ch.camera);
      if (ch.overlay) {
        ch.overlay.camera.setViewOffset(W, H, 0, offY, W, H);
        renderer.clearDepth();
        renderer.render(ch.overlay.scene, ch.overlay.camera);
      }
    }
    renderer.setScissorTest(false);
  };

  return {
    frame,
    pointer(x, y) {
      pointerPx.set(x, y);
      pointerN.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
      lastPointerMove = performance.now() / 1000;
      hero.pushTrail(x - W / 2, H / 2 - y, 1, performance.now());
    },
    resize,
    dispose() {
      disposables.forEach((d) => d.dispose());
      chapters.forEach((c) =>
        c.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose?.();
          const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
          mats.forEach((mm) => mm.dispose());
        }),
      );
      env.dispose();
      renderer.dispose();
    },
  };
}
