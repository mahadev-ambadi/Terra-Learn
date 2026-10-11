import { memo, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Recycle, ShieldCheck, Store, TrendingUp } from "lucide-react";
import { createFrameFilm } from "./frameFilm";
import { FeatureArt } from "./featureArt";

/* The page below the hero: a paper sheet that slides up over the WebGL field, alternating light
   paper and deep soil sections. Its grammar (ticker band, condensed display type with a script
   accent, arch imagery, card rails, wave dividers, a swap-the-look viewer, a pinned horizontal
   gallery, crossfading chapters, a closing call) follows the reference reel, told in the
   language of the farm. */

/* ------------------------------------------------------------------ media */

// stills and hover loops cut from the project's band films and scene photographs (public/)
const M = "/media/landing";
const still = (n: string, small = false) => `${M}/${n}${small ? "-sm" : ""}.webp`;
const CLIPS = new Set(["golden", "parched", "cracked", "grain", "canal", "plots", "phone", "storm", "roots"]);

export const CHAPTER_IDS = [
  { id: "ground", name: "Six signals" },
  { id: "fields", name: "In the field" },
  { id: "saath", name: "Saath" },
  { id: "signals", name: "Change the field" },
  { id: "harvest", name: "Harvest" },
];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const COARSE = () => typeof window !== "undefined" && !!window.matchMedia?.("(hover: none)").matches;

/**
 * Runs cb every frame while el is near the viewport. p is progress through a pinned run: 0 when
 * the element's top meets the viewport top, 1 when its bottom meets the viewport bottom. enter is
 * 0 when its top is at the viewport bottom, 1 once it reaches the top.
 */
function usePinned(ref: RefObject<HTMLElement | null>, cb: (p: number, enter: number, dt: number) => void) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0, on = false, prev = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      cbRef.current(clamp01(-r.top / Math.max(1, r.height - vh)), clamp01(1 - r.top / vh), dt);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting && !on) { on = true; prev = performance.now(); raf = requestAnimationFrame(loop); }
      else if (!e?.isIntersecting && on) { on = false; cancelAnimationFrame(raf); }
    }, { rootMargin: "40% 0px" });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [ref]);
}

/**
 * A still that turns into its loop while the card around it ([data-hover]) is hovered — or, on
 * touch screens, while it sits well inside the viewport. The loop only downloads on first use.
 */
function Media({ name, alt, small = false, eager = false }: { name: string; alt: string; small?: boolean; eager?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);
  const hasClip = CLIPS.has(name);
  useEffect(() => {
    const el = wrap.current, v = video.current;
    if (!el || !v || !hasClip) return;
    const host = (el.closest("[data-hover]") as HTMLElement | null) ?? el;
    const play = () => { v.play().then(() => setLive(true)).catch(() => {}); };
    const stop = () => { v.pause(); setLive(false); };
    if (COARSE()) {
      const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? play() : stop()), { threshold: 0.65 });
      io.observe(el);
      return () => io.disconnect();
    }
    host.addEventListener("pointerenter", play);
    host.addEventListener("pointerleave", stop);
    return () => { host.removeEventListener("pointerenter", play); host.removeEventListener("pointerleave", stop); };
  }, [hasClip]);
  return (
    <div ref={wrap} className={`rl-media${live ? " live" : ""}`}>
      <img src={still(name, small)} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} />
      {hasClip && <video ref={video} src={`${M}/${name}.mp4`} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />}
    </div>
  );
}

/** display heading: condensed caps with a gold script word laid across it */
function Display({ children, script, className = "" }: { children: ReactNode; script?: string; className?: string }) {
  return (
    <h2 className={`rl-display ${className}`} data-rv="up">
      <span>{children}</span>
      {script && <em className="rl-script">{script}</em>}
    </h2>
  );
}

function Kicker({ children, tone = "" }: { children: ReactNode; tone?: string }) {
  return <span className={`rl-kicker ${tone}`} data-rv="fade"><i />{children}</span>;
}

function Wave({ flip = false, className = "" }: { flip?: boolean; className?: string }) {
  return (
    <svg className={`rl-wave${flip ? " flip" : ""} ${className}`} viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true">
      <path className="back" d="M0,52 C180,18 360,82 560,54 C760,26 920,70 1110,46 C1260,28 1360,44 1440,36 L1440,90 L0,90 Z" />
      <path d="M0,60 C220,28 400,86 620,60 C840,34 1010,78 1200,56 C1320,42 1390,50 1440,48 L1440,90 L0,90 Z" />
    </svg>
  );
}

/* ------------------------------------------------------------- interactions */

/**
 * Page-wide micro-interactions by delegation: a trailing cursor ring that swells and labels
 * itself over [data-cursor] targets, magnetic [data-magnet] controls, and [data-tilt] cards that
 * lean toward the pointer. Fine pointers only; nothing here runs on touch or reduced motion.
 */
export const Interactions = memo(function Interactions() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (COARSE() || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const el = ring.current, d = dot.current;
    if (!el || !d) return;
    // the pointer itself becomes a small circle: the arrow is hidden only now that one is drawn
    document.documentElement.classList.add("rl-cursor-on");
    const p = { x: -100, y: -100, sx: -100, sy: -100 };
    let raf = 0, big = false, shown = false;
    let magnet: HTMLElement | null = null, tilt: HTMLElement | null = null;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      p.sx += (p.x - p.sx) * 0.2; p.sy += (p.y - p.sy) * 0.2;
      el.style.transform = `translate3d(${p.sx.toFixed(1)}px, ${p.sy.toFixed(1)}px, 0)`;
    };
    raf = requestAnimationFrame(loop);
    const onMove = (e: PointerEvent) => {
      p.x = e.clientX; p.y = e.clientY;
      // the dot sits exactly on the pointer (no easing); the ring trails around it
      d.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      if (!shown) { shown = true; el.classList.add("on"); d.classList.add("on"); }
      const t = e.target as HTMLElement;
      const c = t.closest<HTMLElement>("[data-cursor]");
      const want = c?.dataset["cursor"] ?? "";
      if (!!c !== big || want !== label) { big = !!c; el.classList.toggle("big", big); d.classList.toggle("hide", big); setLabel(want); }
      el.classList.toggle("dark", !!t.closest(".rl-dark"));
      // magnets pull a fraction of the way toward the pointer
      const m = t.closest<HTMLElement>("[data-magnet]");
      if (magnet && magnet !== m) magnet.style.translate = "";
      magnet = m;
      if (m) {
        const r = m.getBoundingClientRect();
        m.style.translate = `${((e.clientX - r.left - r.width / 2) * 0.28).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1)}px`;
      }
      const k = t.closest<HTMLElement>("[data-tilt]");
      if (tilt && tilt !== k) { tilt.style.removeProperty("--rx"); tilt.style.removeProperty("--ry"); }
      tilt = k;
      if (k) {
        const r = k.getBoundingClientRect();
        k.style.setProperty("--ry", `${(((e.clientX - r.left) / r.width - 0.5) * 10).toFixed(2)}deg`);
        k.style.setProperty("--rx", `${(-((e.clientY - r.top) / r.height - 0.5) * 8).toFixed(2)}deg`);
      }
    };
    const onLeave = () => { shown = false; el.classList.remove("on"); d.classList.remove("on"); };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("rl-cursor-on");
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
    // the label is read inside the handler only to skip redundant state writes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <div ref={ring} className="rl-cursor" aria-hidden="true"><span>{label}</span></div>
      <div ref={dot} className="rl-cursor-dot" aria-hidden="true" />
    </>
  );
});

/* ------------------------------------------------------------------ 1 · ticker */

function Ticker({ items, tone = "" }: { items: string[]; tone?: string }) {
  const row = [...items, ...items];
  return (
    <div className={`rl-ticker ${tone}`} aria-label={items.join(", ")}>
      <div className="rl-ticker-track" aria-hidden="true">
        {row.map((t, i) => <span key={i}>{t}<i>✦</i></span>)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- 2 · six signals */

const SIGNALS = [
  { name: "Climate", note: "Open-Meteo trends", media: "storm" },
  { name: "Soil", note: "ISRIC SoilGrids", media: "roots" },
  { name: "Market", note: "Agmarknet mandi prices", media: "grain" },
  { name: "Crop health", note: "Leaf scanner · next", media: "rice" },
  { name: "From orbit", note: "Satellite plot layers", media: "satellite" },
  { name: "Advisor", note: "Answers in your language", media: "phone" },
];

function SixSignals() {
  return (
    <section className="rl-sec rl-signals" id="ground">
      <header className="rl-head center">
        <Kicker>The Terra signals</Kicker>
        <Display script="one quiet decision">Six signals.</Display>
        <p className="rl-lead" data-rv="up">
          Climate, soil, price, crop health, the view from orbit and an advisor — read together for the
          pin you drop on your own farm.
        </p>
      </header>
      <ul className="rl-orbs">
        {SIGNALS.map((s, i) => (
          <li key={s.name} className="rl-orb" data-hover data-cursor="Play" data-rv="up" style={{ "--i": i } as React.CSSProperties}>
            <div className="rl-orb-ring"><Media name={s.media} alt={s.name} small /></div>
            <b>{s.name}</b>
            <span>{s.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------- 3 · trusted */

const PROMISE = [
  { chip: "Reading", tone: "leaf", title: "Measured", media: "plots", body: "Pulled from a named source for your pin — Open-Meteo, SoilGrids or Agmarknet — and labelled with it." },
  { chip: "Estimate", tone: "gold", title: "Modelled", media: "gold-contour", body: "A seeded or modelled value, flagged as one, with the reason it isn't a reading yet." },
  { chip: "Gap", tone: "ember", title: "No coverage", media: "cracked", body: "Where the data ends, the page says so. No quiet fallback fills the hole." },
];

function Trusted() {
  return (
    <section className="rl-sec rl-trust">
      <header className="rl-head split">
        <div>
          <Kicker>The Terra promise</Kicker>
          <h2 className="rl-serif" data-rv="up">Measured to be <em className="rl-script">Trusted</em></h2>
        </div>
        <p className="rl-lead" data-rv="up">
          Every number on TerraLearn carries where it came from. It is a reading, an estimate or an honest
          gap — and it is never silently guessed.
        </p>
      </header>
      <div className="rl-trust-grid">
        {PROMISE.map((c) => (
          <article key={c.chip} className="rl-trust-card" data-tilt data-hover data-rv="up">
            <div className="rl-trust-img"><Media name={c.media} alt={c.title} small /></div>
            <span className={`rl-chip ${c.tone}`}>{c.chip}</span>
            <h3>{c.title}</h3>
            <p>{c.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 4 · rails */

type Feature = { title: string; meta: string; body: string; art: string; live: boolean };

const LIVE: Feature[] = [
  { title: "Yield simulator", meta: "Temperature · GDD · pH match", body: "Grow the season here before you sow it, against your own pin.", art: "yield", live: true },
  { title: "Crop suggestion", meta: "Seasonal alignment", body: "The recommended crop is the default path — scored and explained.", art: "suggest", live: true },
  { title: "Market signal", meta: "Agmarknet · buyer demand", body: "Mandi price history beside live demand, before you sell.", art: "market", live: true },
  { title: "Saath exchange", meta: "Equipment · labour · inputs", body: "One farm's waste is the next farm's input, matched nearby.", art: "exchange", live: true },
  { title: "Ground truth", meta: "Satellite layers · multi-farm", body: "Every plot you manage, from orbit, with toggleable layers.", art: "orbit", live: true },
  { title: "AI advisor", meta: "Memory-aware · cites sources", body: "Advice in plain language that remembers your field.", art: "advisor", live: true },
  { title: "Data honesty", meta: "Reading · estimate · gap", body: "Provenance on every number. No silent fallbacks.", art: "honesty", live: true },
];

const NEXT: Feature[] = [
  { title: "Cascade engine", meta: "FarmRisk · 8 factors", body: "One shock, mapped as a chain of downstream risk.", art: "cascade", live: false },
  { title: "Flood & drought warning", meta: "Early warning", body: "Watch for the water — too much or too little — before it lands.", art: "water", live: false },
  { title: "Leaf disease scanner", meta: "Crop health", body: "Point at a spotted leaf; learn what it is and what to do.", art: "leaf", live: false },
  { title: "Multilingual voice", meta: "Voice in · voice out", body: "The advisor, spoken, in the language the farmer already uses.", art: "voice", live: false },
  { title: "AgriStack auto-fill", meta: "Land records", body: "Your land record fills the forms so you don't have to.", art: "records", live: false },
  { title: "Traceable ledger", meta: "Crop provenance", body: "From field to mandi, a record a buyer can trust.", art: "ledger", live: false },
];

function Card({ f, n }: { f: Feature; n: number }) {
  const [pinned, setPinned] = useState(false);
  return (
    <article className={`rl-card ${f.live ? "live" : "next"}`} data-cursor="View">
      <div className="rl-card-art">
        {/* hover fills the card like a jar: a translucent tide with a rolling wave on its surface */}
        <span className="rl-card-fill" aria-hidden="true">
          <svg viewBox="0 0 640 24" preserveAspectRatio="none"><path d="M0 12 Q 40 0 80 12 T 160 12 T 240 12 T 320 12 T 400 12 T 480 12 T 560 12 T 640 12 V24 H0 Z" /></svg>
        </span>
        <FeatureArt art={f.art} />
        <span className="rl-card-n" aria-hidden="true">{String(n).padStart(2, "0")}</span>
        <span className={`rl-badge ${f.live ? "live" : "next"}`}>{f.live ? "Live" : "Next"}</span>
        <button
          type="button"
          className={`rl-pin${pinned ? " on" : ""}`}
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin ${f.title}` : `Pin ${f.title}`}
          onClick={() => setPinned((v) => !v)}
        >
          <Bookmark size={15} strokeWidth={1.8} />
        </button>
        <span className="rl-card-go" aria-hidden="true"><ArrowUpRight size={18} /></span>
      </div>
      <h3>{f.title}</h3>
      <span className="rl-card-meta">{f.meta}</span>
      <p>{f.body}</p>
    </article>
  );
}

/** a horizontal card rail: native scroll with snap, mouse drag, arrow controls and a progress rule */
function Rail({ items }: { items: Feature[] }) {
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const t = track.current;
    if (!t) return;
    // the card illustrations only animate while their rail is on screen
    const vis = new IntersectionObserver(([e]) => t.classList.toggle("inview", !!e?.isIntersecting), { rootMargin: "10% 0px" });
    vis.observe(t);
    const paint = () => {
      const max = Math.max(1, t.scrollWidth - t.clientWidth);
      if (bar.current) bar.current.style.transform = `scaleX(${(0.12 + 0.88 * (t.scrollLeft / max)).toFixed(3)})`;
    };
    // drag to scroll with a mouse; touch keeps its own native swipe
    let down = false, sx = 0, sl = 0, moved = false;
    const onDown = (e: PointerEvent) => { if (e.pointerType !== "mouse") return; down = true; moved = false; sx = e.clientX; sl = t.scrollLeft; t.classList.add("drag"); };
    const onMove = (e: PointerEvent) => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 4) moved = true; t.scrollLeft = sl - dx; };
    const onUp = () => { down = false; t.classList.remove("drag"); };
    const onClick = (e: MouseEvent) => { if (moved) { e.preventDefault(); e.stopPropagation(); } };
    t.addEventListener("scroll", paint, { passive: true });
    t.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    t.addEventListener("click", onClick, true);
    paint();
    return () => {
      vis.disconnect();
      t.removeEventListener("scroll", paint);
      t.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      t.removeEventListener("click", onClick, true);
    };
  }, []);
  const step = (dir: number) => {
    const t = track.current;
    if (t) t.scrollBy({ left: dir * t.clientWidth * 0.8, behavior: "smooth" });
  };
  return (
    <div className="rl-rail">
      <div ref={track} className="rl-rail-track" data-cursor="Drag">
        {items.map((f, i) => <Card key={f.title} f={f} n={i + 1} />)}
      </div>
      <div className="rl-rail-foot">
        <span className="rl-rail-bar"><i ref={bar} /></span>
        <div className="rl-rail-btns">
          <button type="button" data-magnet aria-label="Previous" onClick={() => step(-1)}><ArrowLeft size={18} /></button>
          <button type="button" data-magnet aria-label="Next" onClick={() => step(1)}><ArrowRight size={18} /></button>
        </div>
      </div>
    </div>
  );
}

function Rails() {
  return (
    <section className="rl-sec rl-rails" id="fields">
      <header className="rl-head split">
        <div>
          <Kicker>Growing on TerraLearn</Kicker>
          <h2 className="rl-serif" data-rv="up">In the field <em className="rl-script">today</em></h2>
        </div>
        <p className="rl-lead" data-rv="up">Live now for every farmer who pins a plot.</p>
      </header>
      <Rail items={LIVE} />
      <header className="rl-head split rl-head-gap">
        <div>
          <Kicker tone="gold">Sown, not yet grown</Kicker>
          <h2 className="rl-serif" data-rv="up">On the <em className="rl-script">horizon</em></h2>
        </div>
        <p className="rl-lead" data-rv="up">What the team is building next — marked as vision, never sold as live.</p>
      </header>
      <Rail items={NEXT} />
    </section>
  );
}

/* ---------------------------------------------------------------- 5 · saath */

const SAATH_TILES = [
  { icon: Store, title: "Listings", body: "Equipment, labour and inputs, posted by farmers within reach." },
  { icon: TrendingUp, title: "Buyer demand", body: "What nearby buyers are asking for, beside the mandi price." },
  { icon: Recycle, title: "IFS loops", body: "Circular matches: one plot's residue is the next plot's input." },
  { icon: ShieldCheck, title: "Trust", body: "Earned from completed exchanges, not claimed in a profile." },
];

// the drone shot: 96 stills (every other frame of the 8 s, 24 fps clip), cropped so the farmer
// stands right of centre and the words can sit on the open field
const FILM_FRAMES = 96, FILM_SECONDS = 8;
const filmFrameUrl = (set: "d" | "m", i: number) => `/media/saath-drone/${set}/${String(i).padStart(3, "0")}.webp`;
const FILM_LINES: [number, number][] = [[0.06, 0.3], [0.3, 0.54]];

/** the Saath drone film: pinned, irised open as it rises into view, its playhead the scroll */
function SaathFilm() {
  const sec = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reel = useRef<ReturnType<typeof createFrameFilm> | null>(null);
  const k = useRef(0);
  const movedAt = useRef(0);
  useEffect(() => {
    const c = canvas.current, s = sec.current;
    if (!c || !s) return;
    const film = createFrameFilm(c, { count: FILM_FRAMES, url: filmFrameUrl, focusX: 0.62, focusY: 0.4 });
    reel.current = film;
    // frames stream in the background as soon as the page is idle, so they are in memory long
    // before the visitor scrolls down here; getting close first just starts them sooner
    const idle = (cb: () => void) =>
      typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(cb, { timeout: 2500 }) : setTimeout(cb, 1200);
    const onLoad = () => idle(() => film.load());
    if (document.readyState === "complete") onLoad(); else window.addEventListener("load", onLoad, { once: true });
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) film.load(); }, { rootMargin: "200% 0px" });
    io.observe(s);
    const onResize = () => film.resize();
    window.addEventListener("resize", onResize, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("load", onLoad); window.removeEventListener("resize", onResize); film.dispose(); reel.current = null; };
  }, []);
  usePinned(sec, (p, enter) => {
    const st = stage.current, film = reel.current;
    if (!st || !film) return;
    const iris = ease(seg(enter, 0.15, 1));
    st.style.setProperty("--iris", `${(iris * 78).toFixed(2)}%`);
    // fully open, the circle clips nothing: drop it so the compositor has one less mask per frame
    st.classList.toggle("open", iris > 0.999);
    // the playhead is the scroll itself (the page's smooth scroll already glides); between two
    // frames it blends while moving and settles onto the nearer one ~0.1 s after it stops
    const vp = seg(p, 0, 0.94), now = performance.now();
    if (Math.abs(vp - k.current) > 1e-5) movedAt.current = now;
    k.current = vp;
    film.draw(vp, clamp01((now - movedAt.current - 90) / 140));
    st.querySelectorAll<HTMLElement>(".rl-film-line").forEach((el, i) => {
      const w = FILM_LINES[i];
      if (!w) return;
      const a = seg(p, w[0], w[0] + 0.06), b = seg(p, w[1] - 0.05, w[1]);
      el.style.opacity = (a * (1 - b)).toFixed(3);
      el.style.transform = `translate3d(0, ${((1 - a) * 18 - b * 14).toFixed(1)}px, 0)`;
      const blur = (1 - a) * 8 + b * 6;
      el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : "";
    });
    const cap = st.querySelector<HTMLElement>(".rl-film-cap");
    if (cap) {
      const a = seg(p, 0.58, 0.7);
      cap.style.opacity = a.toFixed(3);
      cap.style.transform = `translate3d(0, ${((1 - a) * 30).toFixed(1)}px, 0)`;
    }
    st.style.setProperty("--scrim", seg(p, 0.5, 0.66).toFixed(3));
    const t = k.current * FILM_SECONDS;
    const tc = st.querySelector<HTMLElement>(".rl-film-tc");
    if (tc) tc.textContent = `${t.toFixed(1).padStart(4, "0")} / ${FILM_SECONDS.toFixed(1)}`;
    const bar = st.querySelector<HTMLElement>(".rl-film-hud b");
    if (bar) bar.style.transform = `scaleX(${k.current.toFixed(4)})`;
  });
  return (
    <section ref={sec} className="rl-film" aria-label="Saath: a drone flies in to a farmer standing in his field">
      <div ref={stage} className="rl-film-stage">
        <div className="rl-film-clip"><canvas ref={canvas} /><div className="rl-film-scrim" /></div>
        <div className="rl-film-lines" aria-hidden="true">
          <p className="rl-film-line">Every field has a neighbour.</p>
          <p className="rl-film-line">Every surplus, a buyer<br />a few villages away.</p>
        </div>
        <div className="rl-film-cap">
          <span className="rl-kicker gold"><i />Saath · साथ</span>
          <h3>Farmers helping farmers nearby.</h3>
          <p>Listings, buyer demand and integrated-farming loops — with a human always pressing send.</p>
          <a className="rl-pill light" href="/sign-up" data-magnet data-cursor="Open">Open Saath <ArrowUpRight size={16} /></a>
        </div>
        <div className="rl-film-hud" aria-hidden="true">
          <span><i className="rec" /> Saath · Field 03</span>
          <span className="rl-film-tc">00.0 / 8.0</span>
          <em><b /></em>
        </div>
      </div>
    </section>
  );
}

function Saath() {
  return (
    <section className="rl-dark rl-saath" id="saath">
      <Wave className="top" />
      <div className="rl-sec">
        <header className="rl-head split">
          <div>
            <Kicker tone="gold">The cooperative layer</Kicker>
            <h2 className="rl-serif" data-rv="up">The Saath <em className="rl-script">circle</em></h2>
          </div>
          <p className="rl-lead" data-rv="up">
            A hyperlocal exchange for the things farms already share — machines, hands, water and
            residue — drawn between neighbouring plots.
          </p>
        </header>
        <div className="rl-saath-grid">
          <figure className="rl-saath-photo" data-rv="up" data-hover data-cursor="Saath">
            <Media name="exchange" alt="Two farmers in a village lane trading a hand pump for sacks of compost" />
            <figcaption>
              <span className="rl-chip gold">Matched nearby</span>
              <b>A hand pump, for a trailer of compost.</b>
              <span>Two farms, one loop closed.</span>
            </figcaption>
          </figure>
          <div className="rl-tiles">
            {SAATH_TILES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rl-tile" data-rv="up" data-tilt>
                <span className="rl-tile-ico"><Icon size={20} strokeWidth={1.6} /></span>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SaathFilm />
      <Wave flip className="bottom" />
    </section>
  );
}

/* --------------------------------------------------------- 6 · change the field */

type Point = [text: string, live: boolean];
const CONDITIONS: { name: string; line: string; media: string; points: Point[] }[] = [
  { name: "Healthy canopy", line: "The season is on course.", media: "golden", points: [
    ["Yield projection tracks growing degree days for your pin", true],
    ["Climate trend confirms the sowing window held", true],
    ["Market signal shows where prices sit before harvest", true],
  ] },
  { name: "Dry spell", line: "A dry spell, read early.", media: "parched", points: [
    ["Five-year rainfall and temperature trend for your pin", true],
    ["The advisor talks irrigation timing in plain language", true],
    ["Drought early warning", false],
  ] },
  { name: "Waterlogged", line: "Too much water, too fast.", media: "monsoon", points: [
    ["Find a pump or a pair of hands nearby on Saath", true],
    ["Flood early warning", false],
    ["Cascade engine: what a flooded field knocks on to", false],
  ] },
  { name: "Leaf disease", line: "Spots on the leaf.", media: "leaf", points: [
    ["Describe it to the advisor and get next steps", true],
    ["See whether neighbours reported the same on Saath", true],
    ["Leaf disease scanner", false],
  ] },
];

function ChangeField() {
  const [cur, setCur] = useState(0);
  const [hold, setHold] = useState(false);
  const root = useRef<HTMLElement>(null);
  // cycles on its own while in view and untouched, like a lookbook left open
  useEffect(() => {
    const el = root.current;
    if (!el || hold) return;
    let id = 0, on = false;
    const io = new IntersectionObserver(([e]) => {
      on = !!e?.isIntersecting;
      window.clearInterval(id);
      if (on) id = window.setInterval(() => setCur((c) => (c + 1) % CONDITIONS.length), 5200);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); window.clearInterval(id); };
  }, [hold]);
  const c = CONDITIONS[cur]!;
  return (
    <section ref={root} className="rl-sec rl-change" id="signals" onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)}>
      <header className="rl-head split">
        <div>
          <Kicker>Four conditions, one page</Kicker>
          <h2 className="rl-serif" data-rv="up">Change the <em className="rl-script">field</em></h2>
        </div>
        <p className="rl-lead" data-rv="up">Pick what your crop is going through. See what TerraLearn does about it today — and what is still coming.</p>
      </header>
      <div className="rl-change-grid">
        <div className="rl-change-thumbs" role="tablist" aria-label="Field condition">
          {CONDITIONS.map((x, i) => (
            <button
              key={x.name}
              type="button"
              role="tab"
              aria-selected={i === cur}
              className={i === cur ? "on" : ""}
              onPointerEnter={() => setCur(i)}
              onFocus={() => setCur(i)}
              onClick={() => setCur(i)}
            >
              <img src={still(x.media, true)} alt="" loading="lazy" />
              <span>{x.name}</span>
            </button>
          ))}
        </div>
        <div className="rl-change-stage" data-rv="up">
          {CONDITIONS.map((x, i) => (
            <img key={x.name} src={still(x.media)} alt={x.name} className={i === cur ? "on" : ""} loading="lazy" />
          ))}
          <span className="rl-change-count">{String(cur + 1).padStart(2, "0")} / {String(CONDITIONS.length).padStart(2, "0")}</span>
        </div>
        <div className="rl-change-info" key={cur}>
          <span className="rl-kicker"><i />Condition {String(cur + 1).padStart(2, "0")}</span>
          <h3>{c.name}</h3>
          <p className="rl-change-line">{c.line}</p>
          <ul>
            {c.points.map(([t, live]) => (
              <li key={t}><span className={`rl-chip ${live ? "leaf" : "gold"}`}>{live ? "Live" : "Next"}</span>{t}</li>
            ))}
          </ul>
          <a className="rl-pill" href="/sign-up" data-magnet data-cursor="Try">Check your field <ArrowUpRight size={16} /></a>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 7 · seasons */

const SEASONS = [
  { name: "Kharif", tag: "Sown with the monsoon.", window: "Sown Jun – Jul · harvested Sep – Oct", media: "river", crops: ["Rice", "Cotton", "Maize", "Soybean", "Groundnut", "Bajra"] },
  { name: "Rabi", tag: "Grown through the cool, dry winter.", window: "Sown Oct – Dec · harvested Mar – Apr", media: "dawn", crops: ["Wheat", "Mustard", "Chickpea", "Barley", "Peas"] },
  { name: "Zaid", tag: "The short summer window between.", window: "Sown Mar – Apr · harvested Jun", media: "canal", crops: ["Moong", "Watermelon", "Cucumber", "Muskmelon", "Fodder"] },
];

/** pinned: scrolling down walks the farming year, Kharif → Rabi → Zaid; the ring turns with it */
function Seasons() {
  const sec = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(0);
  const curRef = useRef(0);
  usePinned(sec, (p) => {
    const i = Math.min(SEASONS.length - 1, Math.floor(p * SEASONS.length));
    if (i !== curRef.current) { curRef.current = i; setCur(i); }
    const st = stage.current;
    if (!st) return;
    st.style.setProperty("--spin", `${(p * 220).toFixed(2)}deg`);
    st.querySelectorAll<HTMLElement>(".rl-season-steps b").forEach((b, k) => {
      b.style.transform = `scaleX(${clamp01(p * SEASONS.length - k).toFixed(3)})`;
    });
  });
  // a pill scrolls to the middle of its season's stretch of the pin
  const go = (i: number) => {
    const el = sec.current;
    if (!el) return;
    const run = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + ((i + 0.5) / SEASONS.length) * run, behavior: "smooth" });
  };
  const s = SEASONS[cur]!;
  return (
    <section ref={sec} className="rl-seasons">
      <div ref={stage} className="rl-season-stage">
        <header className="rl-head center">
          <Kicker>The farming year</Kicker>
          <h2 className="rl-serif" data-rv="up">Kharif · Rabi · <em className="rl-script">Zaid</em></h2>
        </header>
        <div className="rl-season-pills" role="tablist" aria-label="Season" data-rv="up">
          {SEASONS.map((x, i) => (
            <button key={x.name} type="button" role="tab" aria-selected={i === cur} className={i === cur ? "on" : ""} onClick={() => go(i)}>{x.name}</button>
          ))}
        </div>
        <div className="rl-season" data-rv="up">
          <div className="rl-season-orb">
            <div className="rl-season-clip">
              {SEASONS.map((x, i) => (
                <img key={x.name} src={still(x.media)} alt={x.name} className={i === cur ? "on" : ""} loading="lazy" />
              ))}
            </div>
            <svg viewBox="0 0 200 200" className="rl-season-ring" aria-hidden="true">
              <defs><path id="rl-ring-path" d="M100,100 m-86,0 a86,86 0 1,1 172,0 a86,86 0 1,1 -172,0" /></defs>
              <text><textPath href="#rl-ring-path">Sow · Grow · Harvest · Sell · Sow · Grow · Harvest · Sell ·</textPath></text>
            </svg>
            <span className="rl-season-count">{String(cur + 1).padStart(2, "0")} / {String(SEASONS.length).padStart(2, "0")}</span>
          </div>
          <div className="rl-season-info" key={cur}>
            <span className="rl-season-name">{s.name}</span>
            <h3>{s.tag}</h3>
            <span className="rl-season-window">{s.window}</span>
            <div className="rl-crops">{s.crops.map((c, k) => <span key={c} style={{ animationDelay: `${0.15 + k * 0.06}s` }}>{c}</span>)}</div>
            <p>TerraLearn's crop suggestion ranks what fits your pin this season — and says why.</p>
            <a className="rl-round" href="/sign-up" data-magnet data-cursor="Simulate" aria-label={`Simulate a ${s.name} season`}><ArrowRight size={22} /></a>
          </div>
        </div>
        <div className="rl-season-steps" aria-hidden="true">{SEASONS.map((x) => <i key={x.name}><b /></i>)}</div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- 10 · chapters */

// each chapter is a small layered set: the sprout lifted off its moss, the terrarium's tree between
// its background and the foreground leaves (layers from the offline split), the mandi a single
// plate. Boxes are [left, top, width] in % of the set, which keeps the source's aspect ratio;
// zoom enlarges the set when only its centre was ever meant to fill the frame.
// shift slides a set sideways (in vw) to clear the chapter title on the left; a shifted set is
// zoomed enough that it still covers the frame edge to edge
// leaves: a transparent loop of the same cutout in which only the canopy stirs (a slow lean at
// the crown plus a faint flutter; trunk, glass and soil stay still), laid exactly over it
type ChLayer = { src: string; depth: number; box: [number, number, number]; sway?: string; leaves?: string };
const CHAPTERS: { n: string; line: string; aspect: number; zoom: number; shift: number; layers: ChLayer[] }[] = [
  // oversized (zoom) so the shift that moves the sprout clear of the title never bares an edge
  { n: "Ground", line: "Start with what the soil actually says.", aspect: 1586 / 992, zoom: 1.32, shift: 12, layers: [
    { src: "ch-sprout", depth: 0.5, box: [0, 0, 100], sway: "breathe" },
  ] },
  { n: "Growth", line: "Grow the season here before you sow it.", aspect: 2800 / 1575, zoom: 1.4583, shift: 10, layers: [
    { src: "ch-terr-bg", depth: 0.2, box: [0, 0, 100] },
    { src: "ch-terr-obj", depth: 0.75, box: [37.179, 27.175, 25.893], leaves: "ch-terr-leaves" },
    // the foreground leaves, enlarged about the centre so they overhang every edge of the frame
    { src: "ch-terr-near", depth: 1.5, box: [7.14, 7.14, 85.72], sway: "near" },
  ] },
  { n: "Harvest", line: "Sell with the market in view.", aspect: 1672 / 941, zoom: 1, shift: 0, layers: [
    { src: "ch-harvest", depth: 0.6, box: [0, 0, 100], sway: "glide" },
  ] },
];

type Mote = { x: number; y: number; r: number; v: number; ph: number; a: number };

// WebKit (Safari, and every browser on iOS) cannot draw transparent WebM: there the tree simply
// stays still rather than risk a black box over it. Decided after mount, so the server render
// and the first client render agree.
const supportsAlphaVideo = () => !/iPad|iPhone|iPod/.test(navigator.userAgent)
  && !/^((?!chrome|chromium|android|edg|firefox).)*safari/i.test(navigator.userAgent);

/** pinned full-bleed chapters that crossfade as the scroll passes through; inside each, the
 *  layers part in depth with the scroll and the pointer, and warm dust drifts through the light */
function Chapters() {
  const sec = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const dust = useRef<HTMLCanvasElement>(null);
  const motes = useRef<Mote[]>([]);
  const ptr = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
  const [alphaVideo, setAlphaVideo] = useState(false);
  useEffect(() => { setAlphaVideo(supportsAlphaVideo()); }, []);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      ptr.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  usePinned(sec, (p, _enter, dt) => {
    const st = stage.current;
    if (!st) return;
    const pt = ptr.current;
    pt.sx += (pt.x - pt.sx) * Math.min(1, dt * 3);
    pt.sy += (pt.y - pt.sy) * Math.min(1, dt * 3);
    const n = CHAPTERS.length;
    st.querySelectorAll<HTMLElement>(".rl-ch-layer").forEach((el, i) => {
      // chapter i owns [i/n, (i+1)/n], crossfading across the boundaries
      const a = i === 0 ? 1 : seg(p, i / n - 0.07, i / n + 0.03);
      const b = i === n - 1 ? 0 : seg(p, (i + 1) / n - 0.07, (i + 1) / n + 0.03);
      const vis = a * (1 - b);
      el.style.opacity = vis.toFixed(3);
      el.style.visibility = vis > 0.001 ? "visible" : "hidden";
      // the wind loop plays only while its chapter is on screen
      const wind = el.querySelector<HTMLVideoElement>("video");
      if (wind) {
        if (vis > 0.001 && wind.paused) wind.play().catch(() => {});
        else if (vis <= 0.001 && !wind.paused) wind.pause();
      }
      if (vis <= 0.001) return;
      const local = seg(p, i / n - 0.1, (i + 1) / n + 0.1);
      const scene = el.querySelector<HTMLElement>(".rl-ch-scene");
      if (scene) scene.style.transform = `translate(calc(-50% + ${scene.dataset["shift"]}vw), -50%) scale(${(1.1 - 0.08 * local).toFixed(4)})`;
      el.querySelectorAll<HTMLElement>(".rl-ch-l").forEach((l) => {
        const d = Number(l.dataset["depth"] || 0);
        l.style.transform = `translate3d(${(-pt.sx * d * 16).toFixed(1)}px, ${((0.5 - local) * d * 64 - pt.sy * d * 9).toFixed(1)}px, 0)`;
      });
      const txt = el.querySelector<HTMLElement>(".rl-ch-text");
      if (txt) txt.style.transform = `translate3d(0, ${((1 - vis) * 40).toFixed(1)}px, 0)`;
      const h = el.querySelector<HTMLElement>(".rl-ch-text h2");
      if (h) h.style.clipPath = `inset(-10% ${((1 - ease(vis)) * 100).toFixed(1)}% -10% 0)`;
    });
    const bar = st.querySelector<HTMLElement>(".rl-ch-bar b");
    if (bar) bar.style.transform = `scaleY(${p.toFixed(4)})`;
    // dust in the light: a few dozen warm motes rising slowly, twinkling as they turn
    const c = dust.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const W = Math.round(c.clientWidth), H = Math.round(c.clientHeight);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    if (!motes.current.length) {
      motes.current = Array.from({ length: 48 }, () => ({
        x: Math.random() * W, y: Math.random() * H, r: 0.8 + Math.random() * 2.2,
        v: 6 + Math.random() * 16, ph: Math.random() * 6.28, a: 0.25 + Math.random() * 0.55,
      }));
    }
    ctx.clearRect(0, 0, W, H);
    const t = performance.now() / 1000;
    ctx.fillStyle = "#ffdca0";
    for (const m of motes.current) {
      m.y -= m.v * dt;
      m.x += Math.sin(t * 0.6 + m.ph) * 8 * dt - pt.sx * m.r * 3 * dt;
      if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
      if (m.x < -10) m.x = W + 10; else if (m.x > W + 10) m.x = -10;
      ctx.globalAlpha = m.a * (0.55 + 0.45 * Math.sin(t * 1.3 + m.ph * 3));
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  return (
    <section ref={sec} className="rl-chapters rl-dark" id="harvest">
      <div ref={stage} className="rl-ch-stage">
        {CHAPTERS.map((c, i) => (
          <div key={c.n} className="rl-ch-layer" style={{ opacity: i === 0 ? 1 : 0 }}>
            <div className="rl-ch-scene" data-shift={c.shift} style={{ "--ar": c.aspect, "--zoom": c.zoom, transform: `translate(calc(-50% + ${c.shift}vw), -50%)` } as React.CSSProperties}>
              {c.layers.map((l) => (
                <div key={l.src} className={`rl-ch-l${l.sway ? ` sway-${l.sway}` : ""}`} data-depth={l.depth} style={{ left: `${l.box[0]}%`, top: `${l.box[1]}%`, width: `${l.box[2]}%` }}>
                  <img src={`${M}/${l.src}.webp`} alt="" loading="lazy" draggable={false} />
                  {l.leaves && alphaVideo && (
                    <video className="rl-ch-leaves" src={`${M}/${l.leaves}.webm`} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />
                  )}
                </div>
              ))}
            </div>
            <div className="rl-ch-tint" />
            <div className="rl-ch-text">
              <span>{String(i + 1).padStart(2, "0")} — Chapter</span>
              <h2>{c.n}</h2>
              <p>{c.line}</p>
            </div>
          </div>
        ))}
        <canvas ref={dust} className="rl-ch-dust" aria-hidden="true" />
        <span className="rl-ch-bar" aria-hidden="true"><b /></span>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 11 · begin */

function Begin() {
  return (
    <section className="rl-sec rl-begin">
      <div className="rl-begin-grid">
        <div>
          <Kicker>Your season starts here</Kicker>
          <h2 className="rl-begin-word" data-rv="up">Begin<span>.</span></h2>
          <p className="rl-lead" data-rv="up">
            Decide with evidence, then walk the field knowing why. The season is short. The proof does
            not have to be.
          </p>
          <div className="rl-begin-ctas" data-rv="up">
            <a className="rl-pill solid" href="/sign-up" data-magnet data-cursor="Enter">Enter TerraLearn <ArrowUpRight size={16} /></a>
            <a className="rl-pill" href="/sign-in" data-magnet>Sign in</a>
          </div>
        </div>
        <div className="rl-begin-arch" data-rv="up" data-par="0.08,8">
          <img src={still("sunrise-farmer")} alt="A young farmer at the edge of a wheat field at sunrise, phone in hand" loading="lazy" />
          <span className="rl-begin-stamp">Pin · Read · Decide</span>
        </div>
      </div>
    </section>
  );
}

/** the wordmark types itself in, letter by letter, the first time it scrolls into view; one
 *  green-to-white gradient runs across the whole word, so it fills as the letters arrive */
function FootWord({ word }: { word: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [typed, setTyped] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setTyped(true); io.disconnect(); } }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <p ref={ref} className={`rl-foot-word${typed ? " typed" : ""}`} aria-label={word}>
      {[...word].map((ch, i) => (
        <span key={i} className={`ch${i === word.length - 1 ? " last" : ""}`} style={{ "--i": i } as React.CSSProperties} aria-hidden="true">{ch}</span>
      ))}
    </p>
  );
}

function Footer() {
  return (
    <footer className="rl-foot rl-dark">
      <div className="rl-foot-top">
        <FootWord word="TerraLearn" />
        <p>A precision-agriculture simulator for farmers, grounded in data you can trace.</p>
      </div>
      <div className="rl-foot-base">
        <span>© 2026 TerraLearn</span>
        <span>Open-Meteo · SoilGrids · Agmarknet</span>
        <span>WebGL · Three.js</span>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------- the page */

const TICKER = [
  "Real climate from Open-Meteo",
  "Soil from ISRIC SoilGrids",
  "Mandi prices from Agmarknet",
  "Advice in your language",
  "Every number carries its provenance",
  "A human always presses send",
];

/** memoised: the landing's nav state (stuck / hidden on scroll) changes often and must never
 *  re-render this whole page of sections, which take no props */
export const ReelSections = memo(function ReelSections() {
  return (
    <div className="rl-sheet">
      <Ticker items={TICKER} />
      <SixSignals />
      <Trusted />
      <Rails />
      <Saath />
      <ChangeField />
      <Seasons />
      <Chapters />
      <Begin />
      <Footer />
    </div>
  );
});
