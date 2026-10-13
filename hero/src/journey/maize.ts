// Procedural maize for the scroll journey: leaf ribbons, a young plant and single kernels.
// (The hero cob, the germinating seedling and the outro kernel are real footage — see filmTexture.ts.)
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  random                                                             */
/* ------------------------------------------------------------------ */

/** small seeded PRNG so every load builds the same plant */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/*  leaf                                                               */
/* ------------------------------------------------------------------ */

type LeafColors = { base: string; mid: string; tip: string; rib: string };

const leafTextures = new Map<string, THREE.CanvasTexture>();

/** blade texture: base→tip gradient, a pale midrib and fine parallel veins (u across, v along) */
export function leafTexture(c: LeafColors): THREE.CanvasTexture {
  const key = `${c.base}|${c.mid}|${c.tip}|${c.rib}`;
  const hit = leafTextures.get(key);
  if (hit) return hit;
  const W = 128, H = 512;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  const grad = g.createLinearGradient(0, H, 0, 0);
  grad.addColorStop(0, c.base);
  grad.addColorStop(0.45, c.mid);
  grad.addColorStop(1, c.tip);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // parallel veins
  for (let x = 2; x < W; x += 3) {
    const d = Math.abs(x - W / 2) / (W / 2);
    g.fillStyle = `rgba(0,0,0,${0.05 + 0.08 * Math.random()})`;
    g.fillRect(x, 0, 1, H);
    if (Math.random() < 0.35) {
      g.fillStyle = `rgba(255,255,230,${0.04 + 0.05 * (1 - d)})`;
      g.fillRect(x + 1, 0, 1, H);
    }
  }
  // darker margins
  const edge = g.createLinearGradient(0, 0, W, 0);
  edge.addColorStop(0, "rgba(0,0,0,0.35)");
  edge.addColorStop(0.12, "rgba(0,0,0,0)");
  edge.addColorStop(0.88, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.35)");
  g.fillStyle = edge;
  g.fillRect(0, 0, W, H);
  // midrib
  const rib = g.createLinearGradient(W / 2 - 7, 0, W / 2 + 7, 0);
  rib.addColorStop(0, "rgba(0,0,0,0)");
  rib.addColorStop(0.5, c.rib);
  rib.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = rib;
  g.fillRect(W / 2 - 7, 0, 14, H);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  leafTextures.set(key, tex);
  return tex;
}

export type RibbonOpts = {
  length: number;
  width: number;
  /** total bend of the centreline (radians), toward +X */
  bend: number;
  /** where along the blade the bend starts (0..1) */
  bendStart?: number;
  /** rotation of the blade around its own centreline over its length (radians) */
  twist?: number;
  /** depth of the V fold along the midrib, as a fraction of width */
  fold?: number;
  /** amplitude of the wavy margins, as a fraction of width */
  wave?: number;
  /** how quickly the blade reaches full width; higher = blunter base */
  base?: number;
  segs?: number;
  cols?: number;
};

/** a grass-type blade as a strip around a bending centreline. Starts at the origin heading +Y,
 * bends toward +X; the blade's width lies along Z, so an arching leaf shows its face upward. */
export function ribbonGeometry(o: RibbonOpts): THREE.BufferGeometry {
  const segs = o.segs ?? 48;
  const cols = o.cols ?? 7;
  const bendStart = o.bendStart ?? 0.1;
  const fold = o.fold ?? 0.12;
  const wave = o.wave ?? 0.05;
  const twist = o.twist ?? 0;
  const baseK = o.base ?? 0.18;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const dir = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const ds = o.length / segs;
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;
    const k = THREE.MathUtils.smoothstep(s, bendStart, 1);
    const a = o.bend * Math.pow(k, 1.4);
    dir.set(Math.sin(a), Math.cos(a), 0);
    // in-plane normal of the centreline (points "up" off the blade face when arched)
    nrm.set(-dir.y, dir.x, 0);
    const tw = twist * s;
    side.set(0, 0, 1).applyAxisAngle(dir, tw);
    const n2 = nrm.clone().applyAxisAngle(dir, tw);
    // blade width: quick swell from the base, long taper to a point
    const w = o.width * Math.min(1, s / baseK) ** 0.6 * (1 - Math.pow(s, 2.2)) * (1 - 0.1 * s);
    for (let j = 0; j <= cols; j++) {
      const u = j / cols;
      const off = (u - 0.5) * w;
      const au = Math.abs(u - 0.5) * 2;
      const lift = -fold * w * au + wave * w * au * au * Math.sin(s * 38 + u * 3);
      const x = p.x + side.x * off + n2.x * lift;
      const y = p.y + side.y * off + n2.y * lift;
      const z = p.z + side.z * off + n2.z * lift;
      pos.push(x, y, z);
      uv.push(u, s);
    }
    p.addScaledVector(dir, ds);
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j;
      const b = a + cols + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** shared wind uniform so every leaf in a scene sways together */
export type Wind = { uTime: THREE.IUniform<number>; uWind: THREE.IUniform<number> };
export const makeWind = (): Wind => ({ uTime: { value: 0 }, uWind: { value: 1 } });

/** leaf material: textured, double-sided, with a soft sway that grows toward the tip */
export function leafMaterial(colors: LeafColors, wind?: Wind, opts: { roughness?: number; sheen?: number } = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: leafTexture(colors),
    side: THREE.DoubleSide,
    roughness: opts.roughness ?? 0.55,
    metalness: 0,
  });
  if (wind) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = wind.uTime;
      sh.uniforms.uWind = wind.uWind;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime; uniform float uWind;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           float sway = uv.y * uv.y * uWind;
           vec4 wp = modelMatrix * vec4(position, 1.0);
           transformed.x += sin(uTime * 1.3 + wp.x * 0.6 + wp.z * 0.4) * 0.05 * sway;
           transformed.z += cos(uTime * 1.1 + wp.x * 0.5) * 0.04 * sway;
           transformed.y += sin(uTime * 1.7 + wp.z) * 0.02 * sway;`,
        );
    };
  }
  return m;
}

export const LEAF_GREEN: LeafColors = { base: "#7f9a3c", mid: "#4f7a2a", tip: "#3d6324", rib: "rgba(235,245,200,0.55)" };
export const LEAF_DARK: LeafColors = { base: "#3c5a26", mid: "#2c4a1f", tip: "#22391a", rib: "rgba(200,220,170,0.35)" };

/* ------------------------------------------------------------------ */
/*  kernels                                                            */
/* ------------------------------------------------------------------ */

/** a lone maize kernel: wide rounded crown, pinched tip cap, flattened front to back. ~2 tall. */
export function kernelGeometry(detail = 40): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, detail, Math.round(detail * 0.8));
  const a = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) {
    let x = a.getX(i), y = a.getY(i), z = a.getZ(i);
    const t = (y + 1) / 2;
    const w = 0.3 + 0.7 * Math.pow(t, 0.5);
    x *= w * 0.8;
    z *= w * 0.46;
    if (y > 0.55) y = 0.55 + (y - 0.55) * 0.5;
    // slight dent in the crown
    y -= 0.07 * Math.exp(-(x * x + z * z) * 14) * THREE.MathUtils.smoothstep(t, 0.7, 1);
    a.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

export function kernelMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: "#e99a1a",
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.2,
    sheen: 0.6,
    sheenColor: new THREE.Color("#ffdf8a"),
    emissive: new THREE.Color("#7a3600"),
    emissiveIntensity: 0.35,
  });
}

/* ------------------------------------------------------------------ */
/*  plant                                                              */
/* ------------------------------------------------------------------ */

/** a young maize plant (V6-ish): a tapered stem with alternating arching blades. Base at origin. */
export function makePlant(wind: Wind, height = 4.2, seed = 3, colors: LeafColors = LEAF_GREEN): THREE.Group {
  const R = rng(seed);
  const group = new THREE.Group();
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.03, height * 0.35, 0.02),
    new THREE.Vector3(-0.02, height * 0.7, -0.01),
    new THREE.Vector3(0.02, height, 0),
  ]);
  const stemGeo = new THREE.TubeGeometry(stemCurve, 40, 0.09, 10, false);
  {
    // taper toward the top
    const a = stemGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < a.count; i++) {
      const y = a.getY(i);
      const t = y / height;
      const c = stemCurve.getPointAt(Math.min(1, Math.max(0, t)));
      const k = 1 - 0.65 * t;
      a.setX(i, c.x + (a.getX(i) - c.x) * k);
      a.setZ(i, c.z + (a.getZ(i) - c.z) * k);
    }
    stemGeo.computeVertexNormals();
  }
  group.add(new THREE.Mesh(stemGeo, leafMaterial(colors, wind, { roughness: 0.5 })));

  const mat = leafMaterial(colors, wind);
  const leaves = 8;
  for (let i = 0; i < leaves; i++) {
    const t = 0.12 + (i / leaves) * 0.8;
    const top = i / (leaves - 1);
    const len = height * (0.75 + 0.35 * Math.sin(Math.PI * (0.25 + top * 0.6))) * (1 - top * 0.35);
    const geo = ribbonGeometry({
      length: len,
      width: 0.36 - top * 0.08,
      bend: 1.2 + R() * 0.8 - top * 0.5,
      bendStart: 0.12,
      fold: 0.18,
      wave: 0.08,
      twist: (R() - 0.5) * 1.0,
    });
    const leaf = new THREE.Mesh(geo, mat);
    const az = (i % 2 ? Math.PI : 0) + (R() - 0.5) * 0.7;
    leaf.position.copy(stemCurve.getPointAt(t));
    leaf.rotation.y = -az;
    leaf.rotateZ(-0.25 - R() * 0.25);
    group.add(leaf);
  }
  // furled whorl at the top
  for (let i = 0; i < 2; i++) {
    const geo = ribbonGeometry({ length: height * 0.25, width: 0.16, bend: 0.25, bendStart: 0.4, fold: 0.5, twist: 1.4 });
    const leaf = new THREE.Mesh(geo, mat);
    leaf.position.copy(stemCurve.getPointAt(0.97));
    leaf.rotation.y = i * Math.PI;
    group.add(leaf);
  }
  return group;
}
