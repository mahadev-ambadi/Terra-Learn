// Water variant of ThreeUI "Elemental Marks" (raw WebGL2): ping-pong wave equation +
// gradient refraction of a mark's signed-distance field + contour particles. Shader, sim and
// particle code follow the authored source; the only changes are the mark — the TerraLearn
// plant photo cutout (silhouette → SDF, pixels → colour) instead of the OpenAI path — and the
// lifecycle, packaged as createWaterMark() with a dispose().

const SDF_SIZE = 512;
const SDF_SPREAD = 128; // px each side of the edge
const D_RANGE = (SDF_SPREAD * 2) / SDF_SIZE; // decoded sdf span in mask-uv units
const SIM_RES = 512;

/** the TerraLearn plant photo (hero/public/plant-cutout.png, background already removed),
 * fitted and centred in the mask. The RGBA pixels drive both the silhouette (SDF) and the
 * mark's real colours. */
function rasterizeLogo(image: HTMLImageElement): ImageData {
  const c = document.createElement("canvas");
  c.width = c.height = SDF_SIZE;
  const ctx = c.getContext("2d")!;
  const targetH = SDF_SIZE * 0.56;
  const s = targetH / image.naturalHeight;
  const w = image.naturalWidth * s;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, (SDF_SIZE - w) / 2, (SDF_SIZE - targetH) / 2, w, targetH);
  return ctx.getImageData(0, 0, SDF_SIZE, SDF_SIZE);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}


function chamfer(d: Float32Array, w: number, h: number) {
  const D1 = 1, D2 = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + D1);
    if (y > 0) {
      v = Math.min(v, d[i - w] + D1);
      if (x > 0) v = Math.min(v, d[i - w - 1] + D2);
      if (x < w - 1) v = Math.min(v, d[i - w + 1] + D2);
    }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + D1);
    if (y < h - 1) {
      v = Math.min(v, d[i + w] + D1);
      if (x < w - 1) v = Math.min(v, d[i + w + 1] + D2);
      if (x > 0) v = Math.min(v, d[i + w - 1] + D2);
    }
    d[i] = v;
  }
}

function buildSDF(img: ImageData): Uint8Array {
  const n = SDF_SIZE * SDF_SIZE;
  const dOut = new Float32Array(n), dIn = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const inside = img.data[i * 4 + 3] > 127;
    dOut[i] = inside ? 0 : 1e9;
    dIn[i] = inside ? 1e9 : 0;
  }
  chamfer(dOut, SDF_SIZE, SDF_SIZE);
  chamfer(dIn, SDF_SIZE, SDF_SIZE);
  const enc = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const d = dOut[i] - dIn[i]; // + outside, - inside
    enc[i] = Math.max(0, Math.min(255, Math.round((0.5 + (0.5 * d) / SDF_SPREAD) * 255)));
  }
  return enc;
}

/** contour pixels + outward normals, in y-up mask uv */
function edgePoints(img: ImageData): number[] {
  const S = SDF_SIZE, pts: number[] = [];
  const a = (x: number, y: number) => img.data[(y * S + x) * 4 + 3] > 127;
  for (let y = 1; y < S - 1; y++) {
    for (let x = 1; x < S - 1; x++) {
      if (!a(x, y)) continue;
      const l = a(x - 1, y), r = a(x + 1, y), u = a(x, y - 1), dn = a(x, y + 1);
      if (l && r && u && dn) continue;
      const gx = (r ? 1 : 0) - (l ? 1 : 0);
      const gy = (dn ? 1 : 0) - (u ? 1 : 0);
      let nx = -gx, ny = gy; // outward, y flipped to y-up
      const len = Math.hypot(nx, ny);
      if (!len) { nx = 0; ny = 1; } else { nx /= len; ny /= len; }
      pts.push((x + 0.5) / S, 1 - (y + 0.5) / S, nx, ny);
    }
  }
  return pts;
}

function makeParticleData(pts: number[], count: number): Float32Array {
  const data = new Float32Array(count * 5);
  const nPts = pts.length / 4;
  for (let i = 0; i < count; i++) {
    const j = (Math.random() * nPts) | 0;
    data[i * 5] = pts[j * 4];
    data[i * 5 + 1] = pts[j * 4 + 1];
    data[i * 5 + 2] = pts[j * 4 + 2];
    data[i * 5 + 3] = pts[j * 4 + 3];
    data[i * 5 + 4] = Math.random() * 100 + i * 0.618;
  }
  return data;
}

const VERT = `#version 300 es
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const GLSL_COMMON = `
precision highp float;
uniform sampler2D uSDF;
uniform float uTime;
uniform float uAspect;
uniform vec2  uScale;
uniform vec2  uShift;
uniform vec3  uPointer; // uv.xy, active
in vec2 vUv;
out vec4 frag;

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1,0));
  float c = hash21(i + vec2(0,1)), d = hash21(i + vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = r * p * 2.03; a *= 0.5; }
  return v;
}
/* signed distance in mask-uv units; extended analytically past the texture
   border so out-of-range samples keep growing instead of clamping (kills
   the rectangular clamp artifacts) */
float sdf(vec2 uv){
  vec2 m = 0.5 + (uv - 0.5 - uShift) * uScale;
  vec2 mc = clamp(m, 0.0, 1.0);
  float d = (texture(uSDF, vec2(mc.x, 1.0 - mc.y)).r - 0.5) * ${D_RANGE.toFixed(4)};
  return d + length(m - mc);
}
float edgeFade(vec2 uv){
  return smoothstep(0.0, 0.05, uv.x) * smoothstep(1.0, 0.95, uv.x)
       * smoothstep(0.0, 0.05, uv.y) * smoothstep(1.0, 0.95, uv.y);
}
`;

/* water simulation step (ping-pong, r = h, g = h_prev) */
const FRAG_SIM = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec3 uDrop; // sim-uv.xy, strength
in vec2 vUv;
out vec4 frag;
void main(){
  vec2 s = texture(uState, vUv).rg;
  float l = texture(uState, vUv - vec2(uTexel.x, 0.0)).r;
  float r = texture(uState, vUv + vec2(uTexel.x, 0.0)).r;
  float u = texture(uState, vUv + vec2(0.0, uTexel.y)).r;
  float d = texture(uState, vUv - vec2(0.0, uTexel.y)).r;
  float next = (l + r + u + d) * 0.5 - s.g;
  next *= 0.984;
  if (uDrop.z != 0.0){
    float dd = distance(vUv, uDrop.xy);
    next += uDrop.z * exp(-dd * dd * 3800.0);
  }
  frag = vec4(next, s.r, 0.0, 1.0);
}`;

const FRAG_WATER = `#version 300 es
${GLSL_COMMON}
uniform sampler2D uState;
uniform sampler2D uTex; // TerraLearn plant photo (RGBA), same mask-uv mapping as uSDF
uniform vec2 uSimTexel;
vec3 markTex(vec2 uv){
  vec2 m = 0.5 + (uv - 0.5 - uShift) * uScale;
  vec2 mc = clamp(m, 0.0, 1.0);
  return texture(uTex, vec2(mc.x, 1.0 - mc.y)).rgb;
}
/* cover-map panel uv into the square sim so rings stay circular on screen */
vec2 simUV(vec2 uv){
  return 0.5 + (uv - 0.5) * vec2(uAspect, 1.0) / max(uAspect, 1.0);
}
void main(){
  vec2 suv = simUV(vUv);
  float h  = texture(uState, suv).r;
  float hx = texture(uState, suv + vec2(uSimTexel.x, 0.0)).r - texture(uState, suv - vec2(uSimTexel.x, 0.0)).r;
  float hy = texture(uState, suv + vec2(0.0, uSimTexel.y)).r - texture(uState, suv - vec2(0.0, uSimTexel.y)).r;
  vec2 grad = vec2(hx, hy);
  vec3 nrm = normalize(vec3(-grad * 30.0, 1.0));

  vec2 ruv = vUv + grad * 0.07;          // refracted lookup (gentler than the source's 0.22 so the sprout stays legible)
  float d  = sdf(ruv);

  // deep water base
  vec3 col = mix(vec3(0.006, 0.030, 0.055), vec3(0.012, 0.078, 0.125), vUv.y * 0.8 + h * 0.25);
  col += vec3(0.02, 0.10, 0.13) * fbm(vUv * vec2(uAspect, 1.0) * 3.0 + uTime * 0.05) * 0.3;

  // the mark, seen through the surface
  float logo = smoothstep(0.005, -0.005, d);
  float glow = exp(-max(d, 0.0) / 0.09) * 0.26;
  // the plant keeps its photographic colours (lifted a touch so it reads on the dark water)
  vec3 markCol = markTex(ruv) * 1.25;
  col += vec3(0.20, 0.55, 0.18) * glow * 0.8; // soft green halo

  // ripple shading: crests bright, troughs barely darker
  col += vec3(0.09, 0.30, 0.40) * clamp(h * 1.8, -0.06, 1.0);
  col += vec3(0.25, 0.55, 0.65) * pow(clamp(h * 2.6, 0.0, 1.0), 2.0) * 0.5;

  // the mark is composited over the water (not added) so its green stays true; ripples
  // still glint across it
  markCol *= 0.92 + clamp(h * 1.2, -0.15, 0.35);
  col = mix(col, markCol, logo);

  // specular glint
  vec3 L = normalize(vec3(-0.35, 0.55, 0.75));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(nrm, H), 0.0), 150.0);
  col += spec * vec3(0.65, 0.9, 1.0) * 0.9;

  col *= 0.35 + 0.65 * edgeFade(vUv);
  col += (hash21(vUv * 617.0 + uTime) - 0.5) / 128.0;
  frag = vec4(col, 1.0);
}`;

const PART_VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;    // spawn point, y-up mask uv
layout(location=1) in vec2 aNorm;   // outward contour normal
layout(location=2) in float aSeed;
uniform float uTime;
uniform vec2  uScale;
uniform vec2  uShift;
uniform float uDpr;
uniform float uWind;
uniform vec4  uCfgA;  // travel, lifeMin, lifeMax, alongNormal
uniform vec4  uCfgB;  // wiggle, sizeMin, sizeMax, sparse
out float vFade;
out float vMixC;
float h1(float n){ return fract(sin(n) * 43758.5453); }
void main(){
  float hs   = h1(aSeed * 1.31);
  float life = mix(uCfgA.y, uCfgA.z, hs);
  float tt   = uTime / life + aSeed * 13.7;
  float ph   = fract(tt);
  float cyc  = floor(tt);
  float r1 = h1(aSeed + cyc * 0.317);
  float r2 = h1(aSeed * 2.13 + cyc * 0.771);
  float on = step(uCfgB.w, r2);

  vec2 dir = normalize(mix(vec2(0.0, 1.0), aNorm, uCfgA.w) + (vec2(r1, h1(r1 * 7.0)) - 0.5) * 0.8);
  float trav = uCfgA.x * (0.45 + 0.9 * r1);
  vec2 p = aPos + aNorm * 0.004 + dir * trav * ph;
  p.x += sin(ph * 10.0 + r1 * 40.0 + uTime * 0.5) * uCfgB.x * ph;
  p.x += uWind * 0.08 * ph;

  vec2 uv = 0.5 + uShift + (p - 0.5) / uScale;
  vFade = on * smoothstep(0.0, 0.12, ph) * smoothstep(1.0, 0.5, ph) * mix(0.35, 1.0, r2);
  vMixC = h1(aSeed * 3.7 + cyc);
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = mix(uCfgB.y, uCfgB.z, h1(aSeed * 5.11 + cyc)) * uDpr * (1.0 - 0.45 * ph);
}`;

const PART_FRAG = `#version 300 es
precision highp float;
uniform vec3 uColA;
uniform vec3 uColB;
in float vFade;
in float vMixC;
out vec4 frag;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 3.5) * (1.0 - r2);
  frag = vec4(mix(uColA, uColB, vMixC) * a * vFade, 1.0);
}`;

// water panel options from the authored source
const OPTS = {
  zoom: 1.06,
  shift: [0, 0.11] as [number, number], // mark sits above centre, clear of the counter
  particles: {
    count: 160, travel: 0.1, lifeMin: 4.0, lifeMax: 8.0, alongNormal: 0.15,
    wiggle: 0.02, sizeMin: 1.5, sizeMax: 3.5, sparse: 0.5,
    colA: [0.1, 0.24, 0.3], colB: [0.22, 0.4, 0.48],
  },
};

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}
function program(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string) {
  const p = gl.createProgram()!;
  const vs = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return null;
  gl.attachShader(p, vs); gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

export type WaterMark = {
  /** drop a ripple at panel uv (y-up); strength ~0.1–0.9 */
  drop: (x: number, y: number, strength: number) => void;
  dispose: () => void;
};

/** mounts the water mark into `canvas`; pointer events are read from `host`. Resolves null
 * when WebGL2 / float render targets are unavailable (or the image fails) so the caller can
 * fall back. */
export async function createWaterMark(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  imageUrl: string,
): Promise<WaterMark | null> {
  let image: HTMLImageElement;
  try {
    image = await loadImage(imageUrl);
  } catch (e) {
    console.error(e);
    return null;
  }
  const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
  const REDUCED = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) return null;

  const prog = program(gl, VERT, FRAG_WATER);
  const simProg = program(gl, VERT, FRAG_SIM);
  const partProg = program(gl, PART_VERT, PART_FRAG);
  if (!prog || !simProg || !partProg) return null;

  const uni: Record<string, WebGLUniformLocation | null> = {};
  for (const n of ["uSDF", "uTex", "uTime", "uAspect", "uScale", "uShift", "uPointer", "uState", "uSimTexel"])
    uni[n] = gl.getUniformLocation(prog, n);
  const simUni = {
    uState: gl.getUniformLocation(simProg, "uState"),
    uTexel: gl.getUniformLocation(simProg, "uTexel"),
    uDrop: gl.getUniformLocation(simProg, "uDrop"),
  };
  const partUni: Record<string, WebGLUniformLocation | null> = {};
  for (const n of ["uTime", "uScale", "uShift", "uDpr", "uWind", "uCfgA", "uCfgB", "uColA", "uColB"])
    partUni[n] = gl.getUniformLocation(partProg, n);

  const img = rasterizeLogo(image);
  const sdfData = buildSDF(img);
  const edges = edgePoints(img);

  const sdfTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, sdfTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, SDF_SIZE, SDF_SIZE, 0, gl.RED, gl.UNSIGNED_BYTE, sdfData);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const leafTex = gl.createTexture(); // RGBA photo of the plant
  gl.bindTexture(gl.TEXTURE_2D, leafTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, SDF_SIZE, SDF_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const simTex: WebGLTexture[] = [];
  const simFbo: WebGLFramebuffer[] = [];
  for (let i = 0; i < 2; i++) {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, SIM_RES, SIM_RES, 0, gl.RG, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    simTex.push(t); simFbo.push(f);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  let simSrc = 0;

  const P = OPTS.particles;
  const partVao = gl.createVertexArray();
  gl.bindVertexArray(partVao);
  const partBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
  gl.bufferData(gl.ARRAY_BUFFER, makeParticleData(edges, P.count), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 8);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, 16);
  gl.bindVertexArray(null);

  const pointer = { x: 0.5, y: 0.5, active: 0 };
  let wind = 0, windTarget = 0, aspect = 1;
  let nextAutoDrop = 0.6;
  let needsResize = true;
  const dropQueue: { x: number; y: number; s: number }[] = [];

  const resize = () => {
    const r = host.getBoundingClientRect();
    const w = Math.max(2, Math.round(r.width * DPR));
    const h = Math.max(2, Math.round(r.height * DPR));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    aspect = w / h;
  };
  // resize inside the rAF (before drawing), never in the RO callback — RO fires after rAF
  const ro = new ResizeObserver(() => { needsResize = true; });
  ro.observe(host);

  const uvOf = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
  };
  let last: { x: number; y: number } | null = null, lastT = 0;
  const onMove = (e: PointerEvent) => {
    const p = uvOf(e), now = performance.now();
    pointer.x = p.x; pointer.y = p.y; pointer.active = 1;
    if (last) {
      const dt = Math.max(8, now - lastT);
      const dx = p.x - last.x, dy = p.y - last.y;
      const speed = Math.hypot(dx, dy) / (dt / 1000);
      if (speed > 0.05 && dropQueue.length < 6)
        dropQueue.push({ x: p.x, y: p.y, s: Math.min(speed * 0.14, 0.55) });
      windTarget = Math.max(-1, Math.min(1, (dx / (dt / 1000)) * 0.55));
    }
    last = p; lastT = now;
  };
  const onDown = (e: PointerEvent) => {
    const p = uvOf(e);
    dropQueue.push({ x: p.x, y: p.y, s: 0.9 });
    pointer.x = p.x; pointer.y = p.y; pointer.active = 1.6;
  };
  const onUp = () => { pointer.active = 1; };
  const onLeave = () => { pointer.active = 0; last = null; windTarget = 0; };
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointerleave", onLeave);

  const toSimUV = (x: number, y: number) => {
    const m = Math.max(aspect, 1);
    return { x: 0.5 + ((x - 0.5) * aspect) / m, y: 0.5 + (y - 0.5) / m };
  };

  const stepSim = (t: number) => {
    if (t > nextAutoDrop) {
      dropQueue.push({ x: 0.12 + Math.random() * 0.76, y: 0.12 + Math.random() * 0.76, s: 0.12 + Math.random() * 0.3 });
      nextAutoDrop = t + 0.5 + Math.random() * 1.4;
    }
    gl.useProgram(simProg);
    gl.viewport(0, 0, SIM_RES, SIM_RES);
    gl.uniform2f(simUni.uTexel, 1 / SIM_RES, 1 / SIM_RES);
    for (let i = 0; i < 2; i++) {
      const drop = dropQueue.shift();
      if (drop) {
        const s = toSimUV(drop.x, drop.y);
        gl.uniform3f(simUni.uDrop, s.x, s.y, drop.s);
      } else {
        gl.uniform3f(simUni.uDrop, 0, 0, 0);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, simFbo[1 - simSrc]);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, simTex[simSrc]);
      gl.uniform1i(simUni.uState, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      simSrc = 1 - simSrc;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const draw = (t: number) => {
    if (needsResize) { needsResize = false; resize(); }
    stepSim(t);

    wind += (windTarget - wind) * 0.04;
    windTarget *= 0.97;

    gl.useProgram(prog);
    gl.viewport(0, 0, canvas.width, canvas.height);

    const fit = Math.min(aspect, 1);
    const sc = [(aspect / fit) * OPTS.zoom, (1 / fit) * OPTS.zoom];
    gl.uniform1f(uni.uTime, t);
    gl.uniform1f(uni.uAspect, aspect);
    gl.uniform2f(uni.uScale, sc[0], sc[1]);
    gl.uniform2f(uni.uShift, OPTS.shift[0], OPTS.shift[1]);
    gl.uniform3f(uni.uPointer, pointer.x, pointer.y, pointer.active);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sdfTex);
    gl.uniform1i(uni.uSDF, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, simTex[simSrc]);
    gl.uniform1i(uni.uState, 1);
    gl.uniform2f(uni.uSimTexel, 1 / SIM_RES, 1 / SIM_RES);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, leafTex);
    gl.uniform1i(uni.uTex, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(partProg);
    gl.uniform1f(partUni.uTime, t);
    gl.uniform2f(partUni.uScale, sc[0], sc[1]);
    gl.uniform2f(partUni.uShift, OPTS.shift[0], OPTS.shift[1]);
    gl.uniform1f(partUni.uDpr, DPR);
    gl.uniform1f(partUni.uWind, wind);
    gl.uniform4f(partUni.uCfgA, P.travel, P.lifeMin, P.lifeMax, P.alongNormal);
    gl.uniform4f(partUni.uCfgB, P.wiggle, P.sizeMin, P.sizeMax, P.sparse);
    gl.uniform3f(partUni.uColA, P.colA[0], P.colA[1], P.colA[2]);
    gl.uniform3f(partUni.uColB, P.colB[0], P.colB[1], P.colB[2]);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(partVao);
    gl.drawArrays(gl.POINTS, 0, P.count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  };

  const t0 = performance.now();
  let raf = 0;
  let visible = !document.hidden;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (visible) draw((performance.now() - t0) / 1000);
  };
  const onVis = () => { visible = !document.hidden; };
  document.addEventListener("visibilitychange", onVis);
  if (REDUCED) { resize(); draw(0.001); } else raf = requestAnimationFrame(loop);

  return {
    drop: (x, y, strength) => { if (dropQueue.length < 6) dropQueue.push({ x, y, s: strength }); },
    dispose: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointerleave", onLeave);
      gl.deleteTexture(sdfTex);
      gl.deleteTexture(leafTex);
      simTex.forEach((t) => gl.deleteTexture(t));
      simFbo.forEach((f) => gl.deleteFramebuffer(f));
      gl.deleteBuffer(partBuf);
      gl.deleteVertexArray(partVao);
      gl.deleteProgram(prog); gl.deleteProgram(simProg); gl.deleteProgram(partProg);
      // no loseContext(): under StrictMode the effect remounts on the same canvas, and
      // getContext() would hand back the dead context
    },
  };
}
