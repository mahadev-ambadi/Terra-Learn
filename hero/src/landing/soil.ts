// Macro-realistic soil for the landing scene, all rendered live (no footage):
//  · a height field — hoed ridges plus clumpy low-frequency mounding — shared by the ground
//    mesh, the clods and every plant, so nothing floats or sinks
//  · the photoscanned soil set with parallax occlusion mapping from its own height map, so
//    grains and crumbs have real depth at grazing angles
//  · per-grain glints: a hashed field of mineral facets that flash when the sun, the facet and
//    the eye line up, and twinkle as the camera moves — what makes the reference soil sparkle
//  · half-buried 3D clods and pebbles, dust hanging in the low sun, and a depth-of-field pass
//    fed by the real depth buffer so alpha-tested leaves blur correctly
import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/* ------------------------------------------------------------ height field */
function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const ROW = 1.15;
/** ground height (metres) at world x, z */
export function groundHeight(x: number, z: number) {
  const ridge = Math.pow(0.5 + 0.5 * Math.cos((x * Math.PI * 2) / ROW), 1.6) * 0.16;
  // clumps: three octaves of value noise, strongest in the furrows where the soil is loose
  const lump = (vnoise(x * 1.3, z * 1.1) - 0.5) * 0.07 + (vnoise(x * 3.1 + 7, z * 2.7) - 0.5) * 0.035
    + (vnoise(x * 7.3 + 3, z * 6.9 + 1) - 0.5) * 0.016;
  return ridge + lump + Math.sin(z * 0.9 + x * 0.3) * 0.02;
}

/* ------------------------------------------------------------ soil material */
export type SoilUniforms = {
  uTime: THREE.IUniform<number>;
  uSunDir: THREE.IUniform<THREE.Vector3>;
  uSunCol: THREE.IUniform<THREE.Color>;
};

const SOIL_GLSL = /* glsl */ `
uniform sampler2D uHeight;
uniform float uPomScale;
uniform int uPomSteps; // a uniform bound keeps D3D's compiler from unrolling (and crawling over) the loop
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
varying vec3 vWPos;
float sHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// steep parallax with a linear refinement; textureGrad keeps mip selection stable inside the loop
vec2 pomUv(vec2 uv, vec3 Vt, float fade) {
  if (fade <= 0.0) return uv;
  vec2 gx = dFdx(uv), gy = dFdy(uv);
  float n = mix(float(uPomSteps), 5.0, clamp(Vt.z, 0.0, 1.0));
  float layer = 1.0 / n;
  vec2 d = (Vt.xy / max(Vt.z, 0.15)) * uPomScale * fade / n;
  vec2 cur = uv; float depth = 0.0;
  float h = 1.0 - textureGrad(uHeight, cur, gx, gy).r;
  for (int i = 0; i < uPomSteps; i++) {
    if (float(i) >= n || depth >= h) break;
    cur -= d; depth += layer;
    h = 1.0 - textureGrad(uHeight, cur, gx, gy).r;
  }
  vec2 prev = cur + d;
  float after = h - depth;
  float before = (1.0 - textureGrad(uHeight, prev, gx, gy).r) - depth + layer;
  return mix(cur, prev, clamp(after / (after - before), 0.0, 1.0));
}
// one octave of mineral glints: a sparse set of tiny facets, each with its own tilt
vec3 glints(vec2 uv, float scale, float density, vec3 V, vec3 L, float gain) {
  vec2 g = uv * scale; vec2 id = floor(g); vec2 f = fract(g);
  float px = max(length(fwidth(g)), 1e-4);
  float lod = 1.0 - smoothstep(0.35, 0.9, px);          // fade when a grain is under a pixel
  if (lod <= 0.0 || sHash(id) > density) return vec3(0.0);
  vec2 c = vec2(sHash(id + 13.1), sHash(id + 71.7)) * 0.6 + 0.2;
  float spot = 1.0 - smoothstep(0.0, max(0.24, px * 0.9), length(f - c));
  vec3 n = normalize(vec3((sHash(id + 3.3) - 0.5) * 2.6, 1.0, (sHash(id + 9.1) - 0.5) * 2.6));
  vec3 H = normalize(L + V);
  float s = pow(max(dot(n, H), 0.0), 140.0);
  float tw = 0.75 + 0.25 * sin(uTime * (2.0 + sHash(id + 5.0) * 4.0) + sHash(id) * 40.0);
  return vec3(s * spot * lod * tw * gain);
}
`;

function chunk(name: keyof typeof THREE.ShaderChunk) {
  return THREE.ShaderChunk[name] as string;
}

/** photoscanned soil with parallax depth and grain glints */
export function makeSoilMaterial(
  maps: { diff: THREE.Texture; nor: THREE.Texture; rough: THREE.Texture; ao: THREE.Texture; height: THREE.Texture },
  U: SoilUniforms,
  opts: { color?: number; pomScale?: number; glint?: number } = {},
) {
  const mat = new THREE.MeshStandardMaterial({
    map: maps.diff, normalMap: maps.nor, roughnessMap: maps.rough, aoMap: maps.ao, aoMapIntensity: 1.0,
    normalScale: new THREE.Vector2(1.35, 1.35), roughness: 1, metalness: 0, color: opts.color ?? 0xb4906c,
  });
  const glintGain = opts.glint ?? 1;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHeight = { value: maps.height };
    sh.uniforms.uPomScale = { value: opts.pomScale ?? 0.022 };
    sh.uniforms.uPomSteps = { value: 12 };
    sh.uniforms.uTime = U.uTime;
    sh.uniforms.uSunDir = U.uSunDir;
    sh.uniforms.uSunCol = U.uSunCol;
    sh.vertexShader = "varying vec3 vWPos;\n" + sh.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;",
    );
    sh.fragmentShader = SOIL_GLSL + sh.fragmentShader
      .replace("void main() {", `void main() {
        vec3 Vw = normalize(cameraPosition - vWPos);
        float camDist = length(cameraPosition - vWPos);
        // tangent frame of the (near-flat) field: u along +x, v along -z
        vec3 Vt = vec3(Vw.x, -Vw.z, Vw.y);
        vec2 pUv = pomUv(vMapUv, Vt, 1.0 - smoothstep(6.0, 16.0, camDist));
        float soilH = texture2D(uHeight, pUv).r;`)
      .replace("#include <map_fragment>", chunk("map_fragment").split("vMapUv").join("pUv")
        + "\n diffuseColor.rgb *= mix(0.6, 1.12, smoothstep(0.1, 0.75, soilH)); // crevices hold shadow")
      .replace("#include <roughnessmap_fragment>", chunk("roughnessmap_fragment").split("vRoughnessMapUv").join("pUv"))
      .replace("#include <normal_fragment_maps>", chunk("normal_fragment_maps").split("vNormalMapUv").join("pUv"))
      .replace("#include <aomap_fragment>", chunk("aomap_fragment").split("vAoMapUv").join("pUv"))
      .replace("#include <opaque_fragment>", `
        {
          vec3 L = normalize(uSunDir);
          float lit = clamp(dot(normal, (viewMatrix * vec4(L, 0.0)).xyz) * 3.0, 0.0, 1.0);
          float crest = smoothstep(0.2, 0.7, soilH);
          // three octaves, fine to coarse: the coarse ones stay a few pixels wide at distance and
          // survive the lens blur as the little bokeh sparks the reference soil is full of
          vec3 gl = glints(pUv, 160.0, 0.5, Vw, L, 16.0) + glints(pUv + 0.71, 38.0, 0.4, Vw, L, 12.0)
                  + glints(pUv + 0.13, 14.0, 0.45, Vw, L, 5.0);
          outgoingLight += gl * uSunCol * lit * crest * ${glintGain.toFixed(2)};
        }
        #include <opaque_fragment>`);
  };
  return mat;
}

/* ------------------------------------------------------------ clods + pebbles */
export function makeClods(
  maps: { diff: THREE.Texture; nor: THREE.Texture },
  count: number,
  area: (rnd: () => number) => [number, number] | null,
  rnd: () => number,
) {
  // 80 tris, welded so the shading is smooth: crumbs, not cut gems
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 1).deleteAttribute("normal").deleteAttribute("uv"));
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { // lumpy, not spherical
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.72 + 0.5 * vnoise(x * 2.3 + 5, y * 2.1 + z * 1.7);
    p.setXYZ(i, x * k, y * k * 0.72, z * k);
  }
  geo.computeVertexNormals();
  { // spherical uv so the soil texture wraps each crumb
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      uv[i * 2] = (Math.atan2(p.getZ(i), p.getX(i)) / (Math.PI * 2) + 0.5) * 0.35;
      uv[i * 2 + 1] = (p.getY(i) * 0.5 + 0.5) * 0.35;
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  }
  // Lambert: crumbs this size read the same, and the program compiles in a fraction of the time
  const mat = new THREE.MeshLambertMaterial({ map: maps.diff, normalMap: maps.nor, normalScale: new THREE.Vector2(1.6, 1.6) });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  let n = 0;
  for (let tries = 0; n < count && tries < count * 4; tries++) {
    const at = area(rnd);
    if (!at) continue;
    const [x, z] = at;
    const pebble = rnd() < 0.12;
    const s = pebble ? 0.015 + rnd() * 0.04 : 0.006 + Math.pow(rnd(), 2.4) * 0.05;
    e.set(rnd() * Math.PI, rnd() * Math.PI * 2, rnd() * Math.PI);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, groundHeight(x, z) - s * 0.3, z), q, new THREE.Vector3(s * (0.8 + rnd() * 0.5), s, s * (0.8 + rnd() * 0.5)));
    mesh.setMatrixAt(n, m);
    if (pebble) col.setHSL(0.08 + rnd() * 0.04, 0.08 + rnd() * 0.1, 0.55 + rnd() * 0.25);
    else col.setHSL(0.07 + rnd() * 0.03, 0.3 + rnd() * 0.2, 0.42 + rnd() * 0.22);
    mesh.setColorAt(n, col);
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/* ------------------------------------------------------------ dust in the sun */
export function makeDust(count: number, U: SoilUniforms, glow: THREE.Texture, rnd: () => number) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() - 0.5) * 22;
    pos[i * 3 + 1] = Math.pow(rnd(), 2.2) * 2.6 + 0.03;
    pos[i * 3 + 2] = 10 - rnd() * 24;
    seed[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: U.uTime, uTex: { value: glow }, uSunCol: U.uSunCol, uPx: { value: 800 } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * (0.11 + aSeed * 0.2) + aSeed * 40.0) * 0.5;
        p.y += sin(uTime * (0.07 + aSeed * 0.1) + aSeed * 17.0) * 0.18;
        p.z += cos(uTime * (0.09 + aSeed * 0.15) + aSeed * 23.0) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = (0.35 + 0.65 * aSeed) * (0.6 + 0.4 * sin(uTime * (1.0 + aSeed * 3.0) + aSeed * 50.0));
        vA *= smoothstep(0.3, 1.2, -mv.z);
        gl_PointSize = uPx * (0.006 + aSeed * 0.012) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex; uniform vec3 uSunCol; varying float vA;
      void main() { vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(uSunCol * t.rgb * 1.6, t.a * vA); }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}

/* ------------------------------------------------------------ depth of field */
/** single-pass scatter-as-gather bokeh on the scene's own depth buffer */
export class DofPass extends Pass {
  private quad: FullScreenQuad;
  readonly uniforms: Record<string, THREE.IUniform>;
  constructor(camera: THREE.PerspectiveCamera) {
    super();
    this.uniforms = {
      tDiffuse: { value: null }, tDepth: { value: null },
      uNear: { value: camera.near }, uFar: { value: camera.far },
      uFocus: { value: 10 }, uAperture: { value: 3 }, uMaxCoC: { value: 11 }, uTaps: { value: 24 }, uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    };
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse, tDepth; uniform float uNear, uFar, uFocus, uAperture, uMaxCoC; uniform vec2 uTexel;
        uniform int uTaps;
        varying vec2 vUv;
        float lin(vec2 uv) { float d = textureLod(tDepth, uv, 0.0).r * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - d * (uFar - uNear)); }
        float coc(float z) { return clamp(uAperture * abs(1.0 - uFocus / z), 0.0, uMaxCoC); }
        void main() {
          float zc = lin(vUv); float cc = coc(zc);
          vec3 col = texture2D(tDiffuse, vUv).rgb; float tot = 1.0;
          float radius = 1.6;
          for (int i = 0; i < uTaps; i++) {
            if (radius >= uMaxCoC) break;
            float ang = float(i) * 2.39996323;
            vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uTexel * radius;
            vec3 sc = textureLod(tDiffuse, tc, 0.0).rgb;
            float zs = lin(tc); float cs = coc(zs);
            if (zs > zc) cs = clamp(cs, 0.0, cc * 2.0); // background can't bleed over a sharp foreground
            float m = smoothstep(radius - 0.5, radius + 0.5, cs);
            col += mix(col / tot, sc, m); tot += 1.0;
            radius += 2.8 / radius;
          }
          gl_FragColor = vec4(col / tot, 1.0);
        }`,
    }));
  }
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    this.uniforms.tDiffuse!.value = readBuffer.texture;
    this.uniforms.tDepth!.value = readBuffer.depthTexture;
    (this.uniforms.uTexel!.value as THREE.Vector2).set(1 / readBuffer.width, 1 / readBuffer.height);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() {
    (this.quad.material as THREE.Material).dispose();
    this.quad.dispose();
  }
}
