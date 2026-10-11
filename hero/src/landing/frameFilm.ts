/**
 * A scroll-scrubbed film as a still-frame sequence drawn to a canvas. Showing any moment is a
 * draw, not a decoder seek, so the picture tracks the scroll with no latency in either direction.
 *
 * Frames arrive as compressed blobs, streamed coarse-to-fine (every 32nd, then every 16th, …) so
 * the whole range is scrubbable within the first few. Only decoded bitmaps are ever drawn, and
 * they are decoded from those blobs with createImageBitmap(blob), which runs off the main thread
 * (decoding from an <img> would not: Chrome does that synchronously, and it stalls the page).
 * Decoded frames are kept for a window that leads the playhead in its direction of travel, plus a
 * sparse resident set so even a long jump lands on a nearby frame at once; the rest are released.
 * Between two frames the film crossfades while moving and settles onto the nearer one at rest.
 */
export type FrameFilmOptions = {
  count: number;
  /** frame url for a resolution set: "d" desktop, "m" small screens */
  url: (set: "d" | "m", i: number) => string;
  /** where the crop anchors when the screen's aspect differs from the frames' (like object-position) */
  focusX: number;
  focusY: number;
};

export type FrameFilm = {
  load(): void;
  /** t: 0–1 through the film; settle: 0 while scrolling, 1 at rest */
  draw(t: number, settle: number): void;
  resize(): void;
  dispose(): void;
};

const FETCHES = 6;
/** decodes in flight at once: enough to keep ahead of a scroll, few enough never to crowd it */
const DECODES = 3;
/** frames kept decoded around the playhead (~6 MB each at 1600×900, ~2 MB at 960×540) */
const WINDOW = 8;
/** every Nth frame stays decoded for the whole visit, so a jump always has a neighbour ready */
const RESIDENT = 12;
/** the frames are 1600 px wide: a larger backing store only adds pixels to fill, not detail */
const MAX_BACKING = 1600;

export function createFrameFilm(canvas: HTMLCanvasElement, o: FrameFilmOptions): FrameFilm {
  const ctx = canvas.getContext("2d", { alpha: false });
  const blobs: (Blob | null)[] = new Array(o.count).fill(null);
  const bitmaps = new Map<number, ImageBitmap>();
  const pending = new Set<number>();
  let started = false, disposed = false, dirty = true;
  let centre = 0, lastPos = 0, dir: 1 | -1 = 1;
  let last = { a: -1, b: -1, alpha: -1 };

  // coarse-to-fine download order
  const order: number[] = [];
  const seen = new Set<number>();
  for (let stride = 32; stride >= 1; stride >>= 1)
    for (let i = 0; i < o.count; i += stride) if (!seen.has(i)) { seen.add(i); order.push(i); }
  if (!seen.has(o.count - 1)) order.push(o.count - 1);

  const pickSet = (): "d" | "m" =>
    canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2) > 1100 ? "d" : "m";

  const keep = (i: number) => i % RESIDENT === 0 || i === o.count - 1 || Math.abs(i - centre) <= WINDOW;

  /** decode what should be resident, nearest the playhead first; release what should not */
  const warm = () => {
    if (disposed || typeof createImageBitmap !== "function") return;
    for (const [i, bm] of bitmaps) if (!keep(i)) { bm.close(); bitmaps.delete(i); }
    const want: number[] = [];
    for (let d = 0; d <= WINDOW; d++) for (const i of d ? [centre + d * dir, centre - d * dir] : [centre]) if (i >= 0 && i < o.count) want.push(i);
    for (let i = 0; i < o.count; i += RESIDENT) want.push(i);
    for (const i of want) {
      if (pending.size >= DECODES) break;
      const blob = blobs[i];
      if (!blob || bitmaps.has(i) || pending.has(i)) continue;
      pending.add(i);
      createImageBitmap(blob)
        .then((bm) => {
          pending.delete(i);
          if (disposed || !keep(i)) { bm.close(); return; }
          bitmaps.set(i, bm); dirty = true;
        })
        .catch(() => pending.delete(i))
        .finally(() => warm());
    }
  };

  const load = () => {
    if (started) return;
    started = true;
    const set = pickSet();
    let next = 0;
    const pump = () => {
      if (disposed || next >= order.length) return;
      const i = order[next++]!;
      // a background preload: it must never compete with what the visitor is looking at
      fetch(o.url(set, i), { priority: "low" } as RequestInit)
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => { if (b && !disposed) { blobs[i] = b; warm(); } })
        .catch(() => {})
        .finally(pump);
    };
    for (let k = 0; k < FETCHES; k++) pump();
  };

  const nearest = (i: number, step: -1 | 1) => {
    for (let j = i; j >= 0 && j < o.count; j += step) if (bitmaps.has(j)) return j;
    return -1;
  };

  const resize = () => {
    const cw = Math.max(1, canvas.clientWidth), ch = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2, MAX_BACKING / cw);
    const w = Math.round(cw * dpr), h = Math.round(ch * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; dirty = true; }
  };

  const blit = (i: number, alpha: number) => {
    const bm = bitmaps.get(i);
    if (!ctx || !bm) return;
    const W = canvas.width, H = canvas.height;
    const s = Math.max(W / bm.width, H / bm.height), dw = bm.width * s, dh = bm.height * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(bm, (W - dw) * o.focusX, (H - dh) * o.focusY, dw, dh);
  };

  const draw = (t: number, settle: number) => {
    if (!ctx) return;
    const pos = Math.min(1, Math.max(0, t)) * (o.count - 1);
    const i0 = Math.floor(pos), fr = pos - i0;
    // the decoded window leads the playhead in the direction of travel
    if (pos !== lastPos) dir = pos > lastPos ? 1 : -1;
    lastPos = pos;
    const want = Math.min(o.count - 1, Math.max(0, Math.round(pos + dir * 3)));
    if (want !== centre) { centre = want; warm(); }
    let a = nearest(i0, -1), b = nearest(Math.min(o.count - 1, i0 + 1), 1);
    if (a < 0 && b < 0) return; // nothing decoded yet: the page's ground colour shows through
    if (a < 0) a = b;
    if (b < 0) b = a;
    // blend only between true neighbours; across a gap still decoding, show the nearer frame
    let alpha = 0;
    if (b === a + 1) alpha = fr + (Math.round(fr) - fr) * settle;
    else if (Math.abs(pos - b) < Math.abs(pos - a)) a = b;
    alpha = Math.round(alpha * 64) / 64; // skip redraws for invisible changes
    if (!dirty && a === last.a && b === last.b && alpha === last.alpha) return;
    dirty = false;
    last = { a, b, alpha };
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    blit(a, 1);
    if (alpha > 0 && a !== b) blit(b, alpha);
    ctx.globalAlpha = 1;
  };

  resize();
  return {
    load,
    draw,
    resize,
    dispose: () => {
      disposed = true;
      blobs.fill(null);
      bitmaps.forEach((bm) => bm.close());
      bitmaps.clear();
    },
  };
}
