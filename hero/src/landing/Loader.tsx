import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./loader.css";

/* The landing's loader: a seed grown on a dial. As the page loads, gold ticks light around the
   dial, the seed cracks on the soil line, roots spread beneath it, the stem draws up and two
   leaves unfurl; the wordmark fills letter by letter and the counter fills with gold from the
   bottom. At 100% the leaves bloom, then the loader opens as an iris from the sprout onto the
   hero field.

   Timing: it picks up from the instant boot screen in index.html (window.__bootPct), eases
   toward 94% on its own clock, holds there until the WebGL field has drawn a real frame
   (window.__terraReady) so the hero is never revealed onto an empty canvas, then finishes.
   Every per-frame change is a CSS variable or a text node — no React renders while it runs. */

const TICKS = 60;
const WORD = "TerraLearn";
const PHRASES = ["Reading the soil", "Checking the sky", "Pulling mandi prices", "Waking the advisor", "Pinning your farm"];
/** the dial's centre, as a share of the viewport: the iris opens from here */
const IRIS_Y = "42%";
const MIN_SHOW_MS = 1700;
const MAX_WAIT_MS = 9000;

// the roots grow in turn, each over its own stretch of the progress
const ROOTS: [d: string, from: number, to: number][] = [
  ["M200 266 C 198 290, 204 312, 200 344", 0.06, 0.55],
  ["M200 284 C 186 293, 172 299, 158 318", 0.14, 0.5],
  ["M201 295 C 218 304, 231 313, 240 334", 0.2, 0.58],
  ["M199 312 C 188 322, 181 333, 174 350", 0.3, 0.66],
  ["M200 322 C 211 331, 216 341, 224 354", 0.36, 0.72],
];

export function Loader() {
  const root = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"load" | "done" | "exit" | "gone">("load");

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";

    const w = window as unknown as { __bootPct?: number; __terraReady?: boolean };
    const boot = Math.min(0.4, (w.__bootPct ?? 0) / 100);
    document.getElementById("boot-loader")?.remove();

    const ticks = Array.from(el.querySelectorAll<SVGLineElement>(".ld-tick"));
    const counts = Array.from(el.querySelectorAll<HTMLElement>(".ld-count span"));
    const phrase = el.querySelector<HTMLElement>(".ld-phrase");
    const start = performance.now();
    let prev = start, shown = boot, finishAt = 0, lit = 0, pi = 0, nextPhrase = start + 950;
    let raf = 0;
    const timers: number[] = [];

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const t = now - start;
      const expectsScene = !!document.querySelector(".tl-gl");
      const ready = (!expectsScene || !!w.__terraReady || t > MAX_WAIT_MS) && t > (reduced ? 150 : MIN_SHOW_MS);
      if (ready && !finishAt) finishAt = now;
      // an asymptotic approach while loading, then a quick run to the end once the field is ready
      const target = finishAt ? 1 : boot + (0.94 - boot) * (1 - Math.exp(-t / 1300));
      shown += (target - shown) * Math.min(1, dt * (finishAt ? 7 : 5));
      if (finishAt && shown > 0.997) shown = 1;

      el.style.setProperty("--p", shown.toFixed(4));
      const n = Math.round(shown * TICKS);
      for (; lit < n; lit++) ticks[lit]?.classList.add("on");
      const pct = String(Math.round(shown * 100)).padStart(2, "0");
      for (const c of counts) if (c.textContent !== pct) c.textContent = pct;
      if (phrase && now > nextPhrase && shown < 1) {
        nextPhrase = now + 950;
        pi = (pi + 1) % PHRASES.length;
        phrase.classList.remove("swap");
        void phrase.offsetWidth; // restart the swap animation
        phrase.textContent = PHRASES[pi]!;
        phrase.classList.add("swap");
      }

      if (shown < 1) { raf = requestAnimationFrame(tick); return; }
      // bloom, then open the iris onto the field
      setPhase("done");
      timers.push(window.setTimeout(() => {
        setPhase("exit");
        html.style.overflow = prevOverflow;
        timers.push(window.setTimeout(() => setPhase("gone"), reduced ? 250 : 1150));
      }, reduced ? 60 : 520));
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
      html.style.overflow = prevOverflow;
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div ref={root} className={`ld ld-${phase}`} style={{ "--p": 0, "--cy": IRIS_Y } as CSSProperties} role="status" aria-live="polite" aria-label="Loading TerraLearn">
      <div className="ld-aurora" aria-hidden="true"><i /><i /><i /></div>
      <div className="ld-grain" aria-hidden="true" />
      <div className="ld-corner tl" aria-hidden="true">TerraLearn · Precision agriculture</div>
      <div className="ld-corner tr" aria-hidden="true">Chapter 00 — The ground truth</div>

      <div className="ld-stage" aria-hidden="true">
        <svg className="ld-dial" viewBox="0 0 400 400">
          <defs>
            <radialGradient id="ld-glow" cx="50%" cy="45%" r="50%">
              <stop offset="0" stopColor="#7dff9a" stopOpacity="0.42" />
              <stop offset="0.55" stopColor="#00c9a7" stopOpacity="0.14" />
              <stop offset="1" stopColor="#00c9a7" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="ld-soil-line" x1="0" x2="1">
              <stop offset="0" stopColor="#00e0b0" stopOpacity="0" />
              <stop offset="0.5" stopColor="#b6ff5c" stopOpacity="0.95" />
              <stop offset="1" stopColor="#00e0b0" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="ld-earth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0b3a28" stopOpacity="0.95" />
              <stop offset="1" stopColor="#03120c" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="ld-root" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffd166" />
              <stop offset="1" stopColor="#00e0b0" />
            </linearGradient>
            <linearGradient id="ld-leafgrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#d8ff7a" />
              <stop offset="1" stopColor="#1fbf6a" />
            </linearGradient>
            <radialGradient id="ld-seedgrad" cx="40%" cy="35%" r="70%">
              <stop offset="0" stopColor="#fff1b8" />
              <stop offset="1" stopColor="#e0a526" />
            </radialGradient>
            <clipPath id="ld-disc"><circle cx="200" cy="200" r="158" /></clipPath>
          </defs>

          {/* the dial: 60 ticks, lit in gold as the page loads */}
          {Array.from({ length: TICKS }, (_, i) => {
            const a = ((-90 + i * (360 / TICKS)) * Math.PI) / 180;
            const r1 = 168, r2 = i % 5 === 0 ? 188 : 180;
            return <line key={i} className="ld-tick" style={{ "--i": i } as CSSProperties} x1={200 + Math.cos(a) * r1} y1={200 + Math.sin(a) * r1} x2={200 + Math.cos(a) * r2} y2={200 + Math.sin(a) * r2} />;
          })}

          <g clipPath="url(#ld-disc)">
            <circle className="ld-glow" cx="200" cy="170" r="150" fill="url(#ld-glow)" />
            <rect x="40" y="262" width="320" height="140" fill="url(#ld-earth)" />
            {ROOTS.map(([d, a, b], i) => (
              <path key={i} className="ld-root" d={d} pathLength={1} style={{ "--a": a, "--b": b } as CSSProperties} />
            ))}
          </g>
          <line x1="40" x2="360" y1="262" y2="262" stroke="url(#ld-soil-line)" strokeWidth="1.2" />

          {/* the seed, splitting as the shoot pushes out */}
          <g className="ld-seed">
            <ellipse cx="200" cy="263" rx="12" ry="7.5" />
            <path className="ld-crack" d="M191 262 Q 200 257 209 262" pathLength={1} />
          </g>
          <path className="ld-stem" d="M200 260 C 200 232, 188 208, 196 184 S 205 144, 200 122" pathLength={1} />
          <g className="ld-leaf left">
            <path d="M200 124 C 182 118 164 102 158 82 C 180 80 197 97 200 124 Z" />
            <path className="vein" d="M200 124 C 188 108 176 96 162 86" />
          </g>
          <g className="ld-leaf right">
            <path d="M200 124 C 214 112 236 104 248 86 C 226 82 205 97 200 124 Z" />
            <path className="vein" d="M200 124 C 214 108 228 98 244 90" />
          </g>
        </svg>
        <span className="ld-pollen">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--k": i } as CSSProperties} />)}</span>
      </div>

      <div className="ld-word" aria-hidden="true">
        <span className="ghost">{WORD}</span>
        <span className="fill">{WORD}</span>
      </div>

      <div className="ld-foot" aria-hidden="true">
        <p className="ld-phrase-wrap"><span className="ld-phrase">{PHRASES[0]}</span><span className="ld-dots"><i /><i /><i /></span></p>
        <p className="ld-count"><span className="ghost">00</span><span className="fill">00</span><em>%</em></p>
      </div>
    </div>
  );
}
