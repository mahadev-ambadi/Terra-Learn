import { useEffect, useRef, useState } from "react";
import { createTerraScene } from "./terraScene";
import { ReelSections, Interactions, CHAPTER_IDS } from "./ReelSections";
import plantCutoutUrl from "@/assets/plant-cutout.png";
import soilDiff from "@/assets/landing/soil-diff.jpg";
import soilNor from "@/assets/landing/soil-nor.jpg";
import soilRough from "@/assets/landing/soil-rough.jpg";
import soilDisp from "@/assets/landing/soil-disp.jpg";
import soilAo from "@/assets/landing/soil-ao.jpg";
import grassClumps from "@/assets/landing/grass-clumps.png";
import type { DioramaSource } from "./diorama";
import type { LandscapeSource } from "./landscape";
import type { SaplingSource } from "./sapling";
import saplingMeta from "@/assets/landing/dio/sapling.json";
import sapFrontBg from "@/assets/landing/dio/sapling-front-bg.jpg";
import sapFrontObj from "@/assets/landing/dio/sapling-front-obj.webp";
import sapFrontDepth from "@/assets/landing/dio/sapling-front-depth.png";
import sapBackBg from "@/assets/landing/dio/sapling-back-bg.jpg";
import sapBackObj from "@/assets/landing/dio/sapling-back-obj.webp";
import sapBackDepth from "@/assets/landing/dio/sapling-back-depth.png";
import sapMoss from "@/assets/landing/dio/sapling-moss.webp";
import sapMossMeta from "@/assets/landing/dio/sapling-moss.json";
import fieldMeta from "@/assets/landing/dio/field.json";
import fieldBg from "@/assets/landing/dio/field-bg.jpg";
import fieldWind from "@/assets/landing/dio/field-wind.png";
import terrariumMeta from "@/assets/landing/dio/terrarium.json";
import terrariumBg from "@/assets/landing/dio/terrarium-bg.jpg";
import terrariumObj from "@/assets/landing/dio/terrarium-obj.webp";
import terrariumDepth from "@/assets/landing/dio/terrarium-depth.png";
import terrariumNear from "@/assets/landing/dio/terrarium-near.webp";
import terrariumWind from "@/assets/landing/dio/terrarium-wind.png";
import handsMeta from "@/assets/landing/dio/hands.json";
import handsBg from "@/assets/landing/dio/hands-bg.jpg";
import handsObj from "@/assets/landing/dio/hands-obj.webp";
import handsDepth from "@/assets/landing/dio/hands-depth.png";
import "./terra-landing.css";
import "./reel.css";

// the hero: a photographed cornfield at sunset, rebuilt as 3D ground the camera moves over
const FIELD: LandscapeSource = { meta: fieldMeta as LandscapeSource["meta"], image: fieldBg, wind: fieldWind };

// the scene still builds its photographed sets (the sprout, the terrarium, the hands); the page
// below the hero no longer pins a gallery over them, so they stay parked off-camera
const SAPLING: SaplingSource = {
  meta: saplingMeta as SaplingSource["meta"],
  front: { bg: sapFrontBg, obj: sapFrontObj, depth: sapFrontDepth },
  back: { bg: sapBackBg, obj: sapBackObj, depth: sapBackDepth },
  moss: { atlas: sapMoss, meta: sapMossMeta },
};

const DIORAMAS: DioramaSource[] = [
  { meta: terrariumMeta as DioramaSource["meta"], bg: terrariumBg, obj: terrariumObj, depth: terrariumDepth, near: terrariumNear, bgDepth: [-5, -16], bulge: 0.32,
    wind: { mask: terrariumWind, near: true, bg: true } },
  { meta: handsMeta as DioramaSource["meta"], bg: handsBg, obj: handsObj, depth: handsDepth, bgDepth: [-8, -12], bulge: 0.3 },
];

// the rail and the nav share one chapter list: the hero, then the page's anchored sections
const CHAPTERS: { id: string; name: string }[] = [
  { id: "top", name: "The Ground Truth" },
  ...CHAPTER_IDS,
];
const NAV: [id: string, label: string][] = [["ground", "Ground"], ["fields", "Fields"], ["signals", "Signals"], ["harvest", "Harvest"]];

function Mark({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <line x1="32" y1="50" x2="32" y2="28" stroke="#e9f0df" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 36 C22 30 18 20 22 14 C28 14 34 22 32 36Z" fill="#7fd04a" />
      <path d="M32 30 C42 24 48 14 44 10 C38 10 32 18 32 30Z" fill="#7fd04a" />
      <path d="M32 44 C28 44 24 42 22 38" stroke="#e9f0df" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** post-loader landing: the WebGL field hero, then a paper-and-soil page that slides up over it */
export function TerraLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const glActiveRef = useRef(true);
  const [active, setActive] = useState("top");
  const [stuck, setStuck] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [past, setPast] = useState(false);
  const [noGL, setNoGL] = useState(false);

  useEffect(() => {
    const root = rootRef.current, canvas = canvasRef.current, hero = heroRef.current;
    if (!root || !canvas || !hero) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const vh = () => document.documentElement.clientHeight || window.innerHeight;

    // film grain, generated once
    if (grainRef.current) {
      const g = document.createElement("canvas"); g.width = g.height = 180;
      const x = g.getContext("2d")!, im = x.createImageData(180, 180);
      for (let i = 0; i < 180 * 180; i++) { const v = 110 + Math.random() * 90; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
      x.putImageData(im, 0, 0);
      grainRef.current.style.backgroundImage = `url(${g.toDataURL("image/png")})`;
    }

    // the hero's camera: chapter 0 at the top, easing into chapter 1 (down the furrow, lens
    // tipped to the soil) exactly as the page sheet slides up and covers the canvas
    const progressFor = (y: number) => Math.min(1, Math.max(0, y / Math.max(1, hero.offsetHeight)));

    // built one task later: React StrictMode's throwaway dev mount is cancelled before it pays
    // for a full scene build, and the loader gets a frame on screen first
    let scene: ReturnType<typeof createTerraScene> = null;
    const buildTimer = window.setTimeout(() => {
      scene = createTerraScene(
        canvas,
        {
          plant: plantCutoutUrl, dioramas: DIORAMAS, field: FIELD, sapling: SAPLING,
          soilDiff, soilNor, soilRough, soilDisp, soilAo, grass: grassClumps,
        },
        () => progressRef.current,
        () => 0,
        () => glActiveRef.current,
      );
      if (!scene) {
        setNoGL(true);
        (window as unknown as { __terraReady?: boolean }).__terraReady = true;
      }
    }, 0);

    let last = 0;
    const onScroll = () => {
      const y = window.scrollY;
      progressRef.current = progressFor(y);
      // once the sheet has covered the viewport the canvas is never seen: stop drawing it
      glActiveRef.current = y < hero.offsetHeight + 4;
      setPast(y > hero.offsetHeight * 0.6);
      setStuck(y > 40);
      setHidden(y > last + 4 && y > vh() * 0.8);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // which chapter holds the middle of the viewport: drives the nav underline and the rail
    // (the hero stands in for "top", which names the whole page)
    const chapterEls = CHAPTERS.map((c) => (c.id === "top" ? hero : document.getElementById(c.id))).filter(Boolean) as HTMLElement[];
    const chIo = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) setActive(e.target === hero ? "top" : e.target.id);
    }), { rootMargin: "-45% 0px -54% 0px" });
    chapterEls.forEach((el) => chIo.observe(el));

    // reveals: the hero waits out the preloader, everything else on entering view
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-rv], .tl-mask"));
    const groups = new Map<Element | null, HTMLElement[]>();
    items.forEach((el) => { const k = el.parentElement; groups.set(k, [...(groups.get(k) || []), el]); });
    groups.forEach((arr) => arr.forEach((el, i) => { el.dataset.d = String(i * 60); }));
    const timers: number[] = [];
    const show = (el: HTMLElement, extra = 0) =>
      timers.push(window.setTimeout(() => el.classList.add("rv-in"), reduced ? 0 : extra + Number(el.dataset.d || 0)));
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target); show(e.target as HTMLElement);
    }), { rootMargin: "0px 0px -10% 0px", threshold: 0.04 });
    items.forEach((el) => (el.closest(".tl-hero") ? show(el, reduced ? 0 : 900) : io.observe(el)));

    // layered parallax: each tagged layer drifts at its own rate against the scroll and leans
    // with the pointer. It writes the CSS `translate` property, which composes with (and so
    // never fights) the `transform` the reveal and caption animations own.
    const layers = Array.from(root.querySelectorAll<HTMLElement>("[data-par]")).map((el) => {
      const [sc, mo] = (el.dataset["par"] || "0,0").split(",").map(Number);
      return { el, sc: sc || 0, mo: mo || 0, ref: 0 };
    });
    const measurePar = () => {
      layers.forEach((l) => {
        l.el.style.translate = "";
        const r = l.el.getBoundingClientRect();
        l.ref = Math.max(0, r.top + window.scrollY + r.height / 2 - vh() / 2);
      });
    };
    measurePar();
    const parSettle = window.setTimeout(measurePar, 900);
    window.addEventListener("resize", measurePar, { passive: true });
    const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
    const onPtr = (e: PointerEvent) => {
      ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPtr, { passive: true });
    let parRaf = 0;
    const parLoop = () => {
      parRaf = requestAnimationFrame(parLoop);
      ptr.sx += (ptr.x - ptr.sx) * 0.08;
      ptr.sy += (ptr.y - ptr.sy) * 0.08;
      const y0 = window.scrollY, h = vh();
      for (const l of layers) {
        // only layers near the viewport are worth a style write
        if (Math.abs(y0 - l.ref) > h * 1.6) continue;
        const dy = Math.max(-160, Math.min(160, l.sc * (y0 - l.ref)));
        l.el.style.translate = `${(ptr.sx * l.mo).toFixed(1)}px ${(dy + ptr.sy * l.mo * 0.6).toFixed(1)}px`;
      }
    };
    if (!reduced) parRaf = requestAnimationFrame(parLoop);

    return () => {
      cancelAnimationFrame(parRaf);
      window.clearTimeout(parSettle);
      window.removeEventListener("resize", measurePar);
      window.removeEventListener("pointermove", onPtr);
      window.clearTimeout(buildTimer);
      scene?.dispose();
      (window as unknown as { __terraReady?: boolean }).__terraReady = false;
      io.disconnect(); chIo.disconnect();
      window.removeEventListener("scroll", onScroll);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const goId = (id: string) => (e?: React.MouseEvent) => {
    e?.preventDefault();
    const t = document.getElementById(id);
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (id === "top" || !t) window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
    else window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 20, behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <div ref={rootRef} className={`tl-root${noGL ? " no-webgl" : ""}${past ? " is-past" : ""}`}>
      <canvas ref={canvasRef} className="tl-gl" aria-hidden="true" />
      <div className="tl-vignette" />
      <div ref={grainRef} className="tl-grain" />
      <Interactions />

      <header className={`tl-nav${stuck ? " stuck" : ""}${hidden ? " hide" : ""}`}>
        <a className="tl-brand" href="#top" onClick={goId("top")}>
          <Mark />
          <span><b>TERRALEARN</b><i>PRECISION AGRICULTURE</i></span>
        </a>
        <nav className="tl-links">
          {NAV.map(([id, label]) => (
            <a key={id} className={`tl-link${active === id ? " on" : ""}`} href={`#${id}`} onClick={goId(id)}>{label}</a>
          ))}
        </nav>
        <a className="tl-enter" href="/sign-up">Enter TerraLearn</a>
      </header>

      <div className="tl-page" id="top">
        <section ref={heroRef} className="tl-hero">
          <div className="tl-hero-top" data-par="0.35,14">
            <div className="tl-eyebrow" data-rv="fade"><span className="tl-dot" /> Chapter 00 — The Ground Truth</div>
            <h1 className="tl-display tl-h-hero">
              <span className="tl-mask"><span>Where soil</span></span>
              <span className="tl-mask"><span>meets signal,</span></span>
              <span className="tl-mask"><span>a farm learns.</span></span>
            </h1>
            <p className="tl-hero-sub tl-body" data-rv="up">
              A precision-agriculture simulator built on real climate, real soil and real market prices,
              with an advisor that speaks your language.
            </p>
          </div>
          <div className="tl-hero-spacer" />
          <div className="tl-hero-foot" data-par="0.12,6">
            <div className="tl-cue" data-rv="fade"><span>Scroll to enter</span><span className="track"><i /></span></div>
            <div className="tl-chapters">
              {NAV.map(([id, label], i) => (
                <div key={id} className="tl-chip" data-rv="up" onClick={() => goId(id)()}>
                  <span className="tl-num">{String(i + 1).padStart(2, "0")}</span><b>{label}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="tl-side" data-rv="up"><span data-par="-0.25,-18">TerraLearn</span></div>
        </section>

        <ReelSections />
      </div>

      <div className="tl-rail" aria-label="Chapters">
        {CHAPTERS.map((c) => (
          <button key={c.id} className={active === c.id ? "on" : ""} title={c.name} aria-label={c.name} onClick={() => goId(c.id)()}><i /></button>
        ))}
      </div>
    </div>
  );
}
