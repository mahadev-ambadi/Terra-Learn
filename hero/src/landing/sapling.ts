// The sapling: a full orbit, front view to back view, built from two photographs.
//
// Two photographs of the same sprout from opposite sides are treated as two calibrated cameras
// ("projectors") facing each other across the plant. From them:
//
//   · the sapling itself is a solid — its front half raised from the front photo, its back half
//     from the back photo, each surface rounded from the plant's own outline (the stem becomes a
//     tube, the seed pods plump, the leaf stays thin). Seen from anywhere on the orbit it is one
//     consistent object, never two cards swapping.
//   · the world around it is a real set — a moss floor running out to a distant wall of bokeh —
//     textured by projecting both photographs (with the sapling removed) back onto it. Each
//     surface point takes its colour from whichever photograph saw it from the most similar
//     direction, blending smoothly between them, so as the camera travels round, the environment
//     genuinely turns behind the subject.
//
// At the two ends of the orbit the render reproduces each photograph exactly: the camera and
// lens (focal length, principal point) are interpolated between the two calibrated views.
import * as THREE from "three";

type View = { W: number; H: number; f: number; cx: number; cy: number; box: [number, number, number, number]; depthPx: number };
export type SaplingMeta = { front: View; back: View; hcRc: number };
export type SaplingSource = {
  meta: SaplingMeta;
  front: { bg: string; obj: string; depth: string };
  back: { bg: string; obj: string; depth: string };
  /** real moss clumps cut from both photographs (an atlas), planted around the sprout */
  moss: { atlas: string; meta: { cols: number; rows: number; count: number; aspect: number; tile: number[]; gutter: number[] } };
};

const RC = 6; // orbit radius

/** normalized intrinsics: focal / height, principal point / size, aspect */
const intr = (v: View) => new THREE.Vector4(v.f / v.H, v.cx / v.W, v.cy / v.H, v.W / v.H);

const ENV_VERT = /* glsl */ `
  uniform vec3 uOrigin; varying vec3 vP;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vP = w.xyz - uOrigin;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const ENV_FRAG = /* glsl */ `
  uniform sampler2D uBgF, uBgB; uniform vec4 uKF, uKB; uniform float uRc, uHc, uYaw, uMossVis; uniform vec3 uOrigin;
  varying vec3 vP;
  // colour a surface point as the photograph taken from side s (+1 front, -1 back) saw it
  vec4 look(sampler2D T, vec4 k, float s) {
    vec3 c = vec3(s * vP.x, vP.y - uHc, s * vP.z - uRc);
    float depth = -c.z;
    // behind this photograph's camera it saw nothing: fade out gradually (an abrupt cut here
    // draws a seam across the far wall at the side views)
    float behind = smoothstep(0.0, 6.0, depth);
    if (behind <= 0.0) return vec4(0.0);
    depth = max(depth, 0.05);
    float u = k.y + c.x / depth * k.x / k.w;
    float vt = k.z - c.y / depth * k.x;
    float e = min(min(u, 1.0 - u), min(vt, 1.0 - vt));
    // pick the mip from how stretched the projection is on screen (grazing moss would otherwise
    // smear into streaks), and blur further outside the photograph, where the edge is stretched
    vec2 uv = vec2(u, 1.0 - vt);
    vec2 ts = vec2(textureSize(T, 0));
    float fp = max(length(dFdx(uv) * ts), length(dFdy(uv) * ts));
    vec2 cuv = clamp(uv, 0.002, 0.998);
    // full detail only where we look from close to this photograph's own viewpoint; further round,
    // a softened version of it (projected texture would otherwise smear along the projector's rays)
    vec3 proj = uOrigin + vec3(0.0, uHc, s * uRc), P = vP + uOrigin;
    float agree = dot(normalize(proj - P), normalize(cameraPosition - P));
    float detail = smoothstep(0.94, 0.995, agree);
    // the sharp sample uses true screen gradients: anisotropic, trilinear-correct — the photograph's
    // own crispness, not a mip level softer
    vec3 sharp = textureGrad(T, cuv, dFdx(uv), dFdy(uv)).rgb;
    vec3 inside = mix(textureLod(T, cuv, 5.0).rgb, sharp, detail);
    // beyond the photograph: that row's own average colour (moss low down, bokeh higher up) —
    // continuous with the image, and with no edge to stretch into streaks
    vec3 around = textureLod(T, vec2(0.5, clamp(uv.y, 0.03, 0.97)), 8.0).rgb;
    vec3 col = mix(around, inside, smoothstep(-0.08, 0.26, e));
    // at the two photographs the floor *is* the photograph; mid-orbit, the moss clumps carry the
    // ground and the floor beneath them is only the shaded mat
    if (vP.y < 0.02) col = mix(col, around * 0.8, uMossVis);
    return vec4(col, (0.06 + smoothstep(-0.15, 0.15, e)) * behind);
  }
  void main() {
    vec4 a = look(uBgF, uKF, 1.0), b = look(uBgB, uKB, -1.0);
    float wf = a.a * pow(cos(uYaw * 0.5), 2.0), wb = b.a * pow(sin(uYaw * 0.5), 2.0);
    gl_FragColor = vec4((a.rgb * wf + b.rgb * wb) / max(wf + wb, 1e-4), 1.0);
  }`;

const MOSS_VERT = /* glsl */ `
  attribute vec4 aInst;   // x, z, height, atlas tile
  attribute vec2 aVar;    // mirror (±1), brightness
  uniform vec3 uOrigin; uniform float uAspect, uCols, uTime, uGust, uFocus, uLens;
  uniform vec4 uTile; uniform vec2 uGut;
  varying vec2 vUv; varying float vB; varying float vLod;
  void main() {
    vec3 camL = cameraPosition - uOrigin;
    vec2 to = normalize(camL.xz - aInst.xy);
    vec3 right = vec3(to.y, 0.0, -to.x);          // each clump turns to face the lens
    float h = aInst.z, w = h * uAspect;
    float bend = position.y * position.y;
    float sway = sin(uTime * 1.1 + aInst.x * 3.1 + aInst.y * 2.3) * 0.035 * uGust * bend * h;
    vec3 p = vec3(aInst.x, 0.0, aInst.y) + right * (position.x * w + sway) + vec3(0.0, position.y * h - h * 0.14, 0.0);
    float tile = aInst.w, col = mod(tile, uCols), row = floor(tile / uCols);
    float u = aVar.x > 0.0 ? uv.x : 1.0 - uv.x;
    // the tile inside its gutter (image rows run downward; the texture's v runs up)
    float x = col * uTile.z + uGut.x + u * uTile.x;
    float yTop = row * uTile.w + uGut.y + (1.0 - uv.y) * uTile.y;
    vUv = vec2(x, 1.0 - yTop);
    vB = aVar.y * mix(0.62, 1.0, smoothstep(0.0, 0.85, uv.y));
    vec4 mv = viewMatrix * vec4(p + uOrigin, 1.0);
    // a real lens: clumps away from the focus plane are drawn from blurrier mip levels, the way the
    // photographs' own foreground moss melts into soft light
    float coc = abs(1.0 - uFocus / max(-mv.z, 0.05)) * uLens;
    vLod = clamp(log2(1.0 + coc), 0.0, 5.0);
    gl_Position = projectionMatrix * mv;
  }`;
const MOSS_FRAG = /* glsl */ `
  uniform sampler2D uMap; uniform float uVis; varying vec2 vUv; varying float vB; varying float vLod;
  void main() {
    vec4 c = textureLod(uMap, vUv, vLod);
    float a = c.a * uVis;
    if (a < 0.01) discard;
    gl_FragColor = vec4(c.rgb * vB, a);
  }`;

const OBJ_VERT = /* glsl */ `
  uniform vec4 uBox; uniform float uF, uCx, uCy, uRc, uHc, uS, uBulge, uTime, uGust;
  uniform sampler2D uDepth;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float px = mix(uBox.x, uBox.z, uv.x), py = mix(uBox.w, uBox.y, uv.y);
    float bz = textureLod(uDepth, uv, 0.0).r * uBulge;
    float d = uRc - bz;                                   // out along the pixel's own ray
    vec3 p = vec3(uS * (px - uCx) / uF * d, uHc + (uCy - py) / uF * d, uS * bz);
    // the sprout nods in the breeze, pivoting where it leaves the moss
    float hgt = max(p.y, 0.0);
    p.x += sin(uTime * 0.8 + 1.3) * 0.018 * hgt * hgt * uGust;
    p.z += cos(uTime * 0.6) * 0.012 * hgt * hgt * uGust;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const OBJ_FRAG = /* glsl */ `
  uniform sampler2D uMap; varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    if (c.a < 0.03) discard;
    gl_FragColor = vec4(c.rgb, c.a);                    // the photograph's own soft edge
  }`;

export type Sapling = {
  group: THREE.Group;
  pivot: THREE.Vector3;
  depthOfSubject: number;
  load: (loader: THREE.TextureLoader) => void;
  /** places the camera on the orbit: `e` 0 = the front photograph, 1 = the back photograph;
   *  `pull` 0 = on the orbit, 1 = low and close in the moss (the entrance) */
  pose: (cam: THREE.PerspectiveCamera, e: number, pull: number, px: number, py: number, aspect: number) => void;
  dispose: () => void;
};

export function makeSapling(src: SaplingSource, at: THREE.Vector3, shared: { uTime: THREE.IUniform<number>; uGust: THREE.IUniform<number> }): Sapling {
  const { front, back, hcRc } = src.meta;
  const HC = hcRc * RC;
  const kF = intr(front), kB = intr(back);
  const group = new THREE.Group();
  group.position.copy(at);
  const blank = new THREE.DataTexture(new Uint8Array([60, 110, 40, 255]), 1, 1);
  blank.needsUpdate = true;
  const texs: THREE.Texture[] = [blank];
  const mats: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];

  // the set: a moss floor and a far wall, both projection-textured from the two photographs
  const envU = {
    uOrigin: { value: at.clone() }, uBgF: { value: blank as THREE.Texture }, uBgB: { value: blank as THREE.Texture },
    uKF: { value: kF }, uKB: { value: kB }, uRc: { value: RC }, uHc: { value: HC }, uYaw: { value: 0 }, uMossVis: { value: 0 },
  };
  const envMat = new THREE.ShaderMaterial({ vertexShader: ENV_VERT, fragmentShader: ENV_FRAG, uniforms: envU, side: THREE.DoubleSide, fog: false });
  const floorGeo = new THREE.CircleGeometry(34, 96, 0, Math.PI * 2);
  floorGeo.rotateX(-Math.PI / 2);
  const wallGeo = new THREE.CylinderGeometry(34, 34, 60, 128, 1, true);
  wallGeo.translate(0, 30, 0);
  group.add(new THREE.Mesh(floorGeo, envMat), new THREE.Mesh(wallGeo, envMat));
  mats.push(envMat); geos.push(floorGeo, wallGeo);

  // the sapling: two shells, each raised from its photograph along that camera's rays
  const shell = (v: View, s: number) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: OBJ_VERT, fragmentShader: OBJ_FRAG, side: THREE.DoubleSide, fog: false, transparent: true,
      uniforms: {
        uBox: { value: new THREE.Vector4(...v.box) }, uF: { value: v.f }, uCx: { value: v.cx }, uCy: { value: v.cy },
        uRc: { value: RC }, uHc: { value: HC }, uS: { value: s }, uBulge: { value: (v.depthPx / v.f) * RC },
        uDepth: { value: blank }, uMap: { value: blank }, uTime: shared.uTime, uGust: shared.uGust,
      },
    });
    const geo = new THREE.PlaneGeometry(1, 1, 180, 140);
    geo.translate(0.5, 0.5, 0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    group.add(mesh);
    mats.push(mat); geos.push(geo);
    return mesh;
  };
  // drawn before the moss (so moss in front of the stem covers it), the far shell first
  const frontMesh = shell(front, 1), backMesh = shell(back, -1);
  const frontMat = frontMesh.material as THREE.ShaderMaterial, backMat = backMesh.material as THREE.ShaderMaterial;

  // moss: the photographs' own clumps, planted all round the sprout. Densest at the stem (lower
  // there, so the seed pods stay clear, as in the photographs), thinning outward, and kept off the
  // path the camera travels.
  const mm = src.moss.meta;
  const mossMat = new THREE.ShaderMaterial({
    vertexShader: MOSS_VERT, fragmentShader: MOSS_FRAG, fog: false, transparent: true, depthWrite: false,
    uniforms: {
      uOrigin: { value: at.clone() }, uAspect: { value: mm.aspect }, uCols: { value: mm.cols },
      uTile: { value: new THREE.Vector4(mm.tile[0], mm.tile[1], mm.tile[2], mm.tile[3]) },
      uGut: { value: new THREE.Vector2(mm.gutter[0], mm.gutter[1]) },
      uFocus: { value: RC }, uLens: { value: 5 }, uVis: { value: 0 },
      uMap: { value: blank }, uTime: shared.uTime, uGust: shared.uGust,
    },
  });
  let mossMesh: THREE.Mesh | null = null;
  let mossInst = new Float32Array(0), mossVars = new Float32Array(0);
  let lastSortYaw = 1e9;
  {
    let seed = 1234;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const offPath = (x: number, z: number) => {
      // the orbit (x ≥ 0 half circle, radius RC) and the entrance run in along +z
      const r = Math.hypot(x, z);
      if (x > -0.5 && Math.abs(r - RC) < 0.55) return false;
      if (Math.abs(x) < 0.55 && z > 2.9 && z < RC + 0.6) return false;
      return true;
    };
    const inst: number[] = [], vars: number[] = [];
    for (let tries = 0; inst.length / 4 < 4600 && tries < 40000; tries++) {
      const r = 0.12 + 19 * Math.pow(rnd(), 1.9), a = rnd() * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!offPath(x, z)) continue;
      const nearStem = r < 1.4;
      // close to the lens the clumps are short: a soft foreground, as in the photographs
      const nearPath = (x > -1 && Math.abs(r - RC) < 1.5) || (Math.abs(x) < 1.4 && z > 2.4);
      const h = nearStem ? 0.2 + rnd() * 0.1 : nearPath ? 0.12 + rnd() * 0.1 : 0.34 + rnd() * 0.22;
      inst.push(x, z, h, Math.floor(rnd() * mm.count));
      vars.push(rnd() < 0.5 ? -1 : 1, 0.82 + rnd() * 0.3);
    }
    // a dense carpet of short clumps along the camera's own path: the soft, out-of-focus
    // foreground the photographs have (and no bare floor under the lens)
    for (let i = 0; i < 1600; i++) {
      const onOrbit = rnd() < 0.72;
      let x: number, z: number;
      if (onOrbit) {
        const a = rnd() * Math.PI * 1.1 - 0.05, r = RC - 2.2 + rnd() * 3.4;
        x = Math.sin(a) * r; z = Math.cos(a) * r;
      } else { x = (rnd() - 0.5) * 2.4; z = 2.4 + rnd() * 4.6; }
      if (!offPath(x, z)) continue;
      inst.push(x, z, 0.1 + rnd() * 0.09, Math.floor(rnd() * mm.count));
      vars.push(rnd() < 0.5 ? -1 : 1, 0.82 + rnd() * 0.3);
    }
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1, 1, 3);
    base.translate(0, 0.5, 0);
    g.index = base.index;
    g.setAttribute("position", base.getAttribute("position"));
    g.setAttribute("uv", base.getAttribute("uv"));
    mossInst = new Float32Array(inst); mossVars = new Float32Array(vars);
    g.setAttribute("aInst", new THREE.InstancedBufferAttribute(new Float32Array(inst), 4));
    g.setAttribute("aVar", new THREE.InstancedBufferAttribute(new Float32Array(vars), 2));
    g.instanceCount = inst.length / 4;
    const mesh = new THREE.Mesh(g, mossMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    mossMesh = mesh;
    group.add(mesh);
    mats.push(mossMat); geos.push(g, base);
  }

  // subject centre (world): the middle of the pods, a little above the moss
  const midY = HC + (front.cy - (front.box[1] + front.box[3]) / 2) / front.f * RC;
  const midX = ((front.box[0] + front.box[2]) / 2 - front.cx) / front.f * RC;
  const pivot = new THREE.Vector3(midX, midY, 0).add(at);

  const proj = new THREE.Vector4();
  let loaded = false;
  return {
    group, pivot, depthOfSubject: (front.depthPx / front.f) * RC,
    load(loader) {
      if (loaded) return;
      loaded = true;
      const tex = (url: string, srgb: boolean, set: (t: THREE.Texture) => void) =>
        loader.load(url, (t) => {
          t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          t.anisotropy = 8;
          texs.push(t); set(t);
        });
      tex(src.front.bg, true, (t) => { envU.uBgF.value = t; });
      tex(src.back.bg, true, (t) => { envU.uBgB.value = t; });
      tex(src.front.obj, true, (t) => { frontMat.uniforms.uMap!.value = t; });
      tex(src.back.obj, true, (t) => { backMat.uniforms.uMap!.value = t; });
      tex(src.front.depth, false, (t) => { frontMat.uniforms.uDepth!.value = t; });
      tex(src.back.depth, false, (t) => { backMat.uniforms.uDepth!.value = t; });
      tex(src.moss.atlas, true, (t) => { mossMat.uniforms.uMap!.value = t; });
    },
    pose(cam, e, pull, px, py, aspect) {
      const yaw = Math.PI * e + px * 0.06;
      envU.uYaw.value = Math.PI * e;
      // the lens slides between the two calibrated cameras as the orbit carries it round
      const w = (1 - Math.cos(Math.PI * e)) / 2;
      proj.copy(kF).lerp(kB, w);
      const [fn, pxn, pyn, A] = [proj.x, proj.y, proj.z, proj.w];
      // the entrance: start a little low and close, then settle back to the photograph's view
      // (never so close that the plant is magnified beyond the photograph's own resolution)
      const r = RC - pull * 1.1, h = HC - pull * 0.12 + py * 0.05;
      cam.position.set(Math.sin(yaw) * r, h, Math.cos(yaw) * r).add(at);
      cam.quaternion.setFromEuler(new THREE.Euler(0, yaw, 0, "YXZ"));
      // moss clumps only where no photograph covers the view: absent at both ends of the orbit
      const vis = THREE.MathUtils.smoothstep(Math.sin(Math.PI * e), 0.03, 0.3);
      envU.uMossVis.value = vis;
      mossMat.uniforms.uVis!.value = vis;
      if (mossMesh) mossMesh.visible = vis > 0.002;
      mossMat.uniforms.uFocus!.value = cam.position.distanceTo(pivot);
      frontMesh.renderOrder = e < 0.5 ? 3 : 2;
      backMesh.renderOrder = e < 0.5 ? 2 : 3;
      // soft-edged clumps must be drawn back to front: re-sort as the camera travels round
      if (mossMesh && vis > 0.002 && Math.abs(yaw - lastSortYaw) > 0.03) {
        lastSortYaw = yaw;
        const n = mossInst.length / 4, cx = cam.position.x - at.x, cz = cam.position.z - at.z;
        const d = new Float32Array(n), order = new Uint32Array(n);
        for (let i = 0; i < n; i++) {
          const dx = mossInst[i * 4]! - cx, dz = mossInst[i * 4 + 1]! - cz;
          d[i] = dx * dx + dz * dz; order[i] = i;
        }
        order.sort((a, b) => d[b]! - d[a]!);
        const g = mossMesh.geometry;
        const ia = g.getAttribute("aInst") as THREE.InstancedBufferAttribute;
        const va = g.getAttribute("aVar") as THREE.InstancedBufferAttribute;
        const iarr = ia.array as Float32Array, varr = va.array as Float32Array;
        for (let j = 0; j < n; j++) {
          const i = order[j]!;
          iarr.set(mossInst.subarray(i * 4, i * 4 + 4), j * 4);
          varr.set(mossVars.subarray(i * 2, i * 2 + 2), j * 2);
        }
        ia.needsUpdate = true; va.needsUpdate = true;
      }
      // off-axis frustum reproducing the photograph's framing, cover-fitted to the viewport
      const n = cam.near;
      let u0 = 0, u1 = 1, v0 = 0, v1 = 1;                    // photo window (v from the top)
      if (aspect > A) { const hh = A / aspect; v0 = 0.5 - hh / 2; v1 = 0.5 + hh / 2; }
      else { const ww = aspect / A; u0 = 0.5 - ww / 2; u1 = 0.5 + ww / 2; }
      const left = ((u0 - pxn) * A / fn) * n, right = ((u1 - pxn) * A / fn) * n;
      const top = ((pyn - v0) / fn) * n, bottom = ((pyn - v1) / fn) * n;
      cam.projectionMatrix.makePerspective(left, right, top, bottom, n, cam.far);
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      cam.aspect = aspect;
      // an honest fov figure for anything that sizes points by it; offset so the next
      // updateProjectionMatrix() elsewhere is never skipped
      cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan((v1 - v0) / (2 * fn))) + 0.01;
    },
    dispose() {
      mats.forEach((m) => m.dispose());
      geos.forEach((g) => g.dispose());
      texs.forEach((t) => t.dispose());
    },
  };
}
