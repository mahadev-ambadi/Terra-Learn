// A still-frame film as a WebGL texture. Adapted from landing/frameFilm.ts (same streaming and
// decoding strategy), but it draws into a fixed-size offscreen canvas at the frames' own
// resolution and hands that over as a CanvasTexture; the shader does the cover-fit.
//
// Frames stream coarse-to-fine (every 32nd, 16th, …) so the whole range is usable early, and are
// decoded off the main thread with createImageBitmap. Only a window around the playhead plus a
// sparse resident set stays decoded. Between two frames the film crossfades.
import * as THREE from "three";

export type FilmSet = "d" | "m";

export type Film = {
  texture: THREE.CanvasTexture;
  /** native frame aspect (w / h), known once the first frame has decoded */
  aspect: () => number;
  /** true once at least one frame can be shown */
  ready: () => boolean;
  load: () => void;
  /** t: 0–1 through the film; settle: 0 while moving, 1 at rest (snaps to the nearer frame) */
  draw: (t: number, settle?: number) => void;
  dispose: () => void;
};

const FETCHES = 4;
const DECODES = 3;
const WINDOW = 8;
const RESIDENT = 12;

export function createFilm(count: number, url: (set: FilmSet, i: number) => string, set: FilmSet): Film {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 2;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const texture = new THREE.CanvasTexture(canvas);
  // the backdrop shaders write their result straight to the (sRGB) canvas without re-encoding,
  // so the frames are sampled as stored rather than decoded to linear light (which darkens them)
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const blobs: (Blob | null)[] = new Array(count).fill(null);
  const bitmaps = new Map<number, ImageBitmap>();
  const pending = new Set<number>();
  let started = false, disposed = false, dirty = true;
  let centre = 0, lastPos = 0, dir: 1 | -1 = 1;
  let last = { a: -1, b: -1, alpha: -1 };
  let aspect = 16 / 9;

  const order: number[] = [];
  const seen = new Set<number>();
  for (let stride = 32; stride >= 1; stride >>= 1)
    for (let i = 0; i < count; i += stride) if (!seen.has(i)) (seen.add(i), order.push(i));
  if (!seen.has(count - 1)) order.push(count - 1);

  const keep = (i: number) => i % RESIDENT === 0 || i === count - 1 || Math.abs(i - centre) <= WINDOW;

  const warm = () => {
    if (disposed || typeof createImageBitmap !== "function") return;
    for (const [i, bm] of bitmaps) if (!keep(i)) (bm.close(), bitmaps.delete(i));
    const want: number[] = [];
    for (let d = 0; d <= WINDOW; d++) for (const i of d ? [centre + d * dir, centre - d * dir] : [centre]) if (i >= 0 && i < count) want.push(i);
    for (let i = 0; i < count; i += RESIDENT) want.push(i);
    for (const i of want) {
      if (pending.size >= DECODES) break;
      const blob = blobs[i];
      if (!blob || bitmaps.has(i) || pending.has(i)) continue;
      pending.add(i);
      createImageBitmap(blob)
        .then((bm) => {
          pending.delete(i);
          if (disposed || !keep(i)) return bm.close();
          if (canvas.width !== bm.width || canvas.height !== bm.height) {
            canvas.width = bm.width;
            canvas.height = bm.height;
            aspect = bm.width / bm.height;
            texture.dispose(); // the GPU copy must be reallocated at the new size
          }
          bitmaps.set(i, bm);
          dirty = true;
        })
        .catch(() => pending.delete(i))
        .finally(() => warm());
    }
  };

  const load = () => {
    if (started) return;
    started = true;
    let next = 0;
    const pump = () => {
      if (disposed || next >= order.length) return;
      const i = order[next++]!;
      fetch(url(set, i), { priority: "low" } as RequestInit)
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => {
          if (b && !disposed) (blobs[i] = b), warm();
        })
        .catch(() => {})
        .finally(pump);
    };
    for (let k = 0; k < FETCHES; k++) pump();
  };

  const nearest = (i: number, step: -1 | 1) => {
    for (let j = i; j >= 0 && j < count; j += step) if (bitmaps.has(j)) return j;
    return -1;
  };

  const draw = (t: number, settle = 0) => {
    const pos = Math.min(1, Math.max(0, t)) * (count - 1);
    const i0 = Math.floor(pos), fr = pos - i0;
    if (pos !== lastPos) dir = pos > lastPos ? 1 : -1;
    lastPos = pos;
    const want = Math.min(count - 1, Math.max(0, Math.round(pos + dir * 3)));
    if (want !== centre) (centre = want), warm();
    let a = nearest(i0, -1), b = nearest(Math.min(count - 1, i0 + 1), 1);
    if (a < 0 && b < 0) return;
    if (a < 0) a = b;
    if (b < 0) b = a;
    let alpha = 0;
    if (b === a + 1) alpha = fr + (Math.round(fr) - fr) * settle;
    else if (Math.abs(pos - b) < Math.abs(pos - a)) a = b;
    alpha = Math.round(alpha * 64) / 64;
    if (!dirty && a === last.a && b === last.b && alpha === last.alpha) return;
    dirty = false;
    last = { a, b, alpha };
    const A = bitmaps.get(a), B = bitmaps.get(b);
    if (!A) return;
    ctx.globalAlpha = 1;
    ctx.drawImage(A, 0, 0, canvas.width, canvas.height);
    if (B && alpha > 0 && a !== b) {
      ctx.globalAlpha = alpha;
      ctx.drawImage(B, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
    texture.needsUpdate = true;
  };

  return {
    texture,
    aspect: () => aspect,
    ready: () => bitmaps.size > 0 && last.a >= 0,
    load,
    draw,
    dispose: () => {
      disposed = true;
      blobs.fill(null);
      bitmaps.forEach((bm) => bm.close());
      bitmaps.clear();
      texture.dispose();
    },
  };
}
