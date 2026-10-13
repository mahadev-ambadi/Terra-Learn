// The landing page: a single scroll-driven 3D journey (see engine.ts for the WebGL side and
// timeline.ts for where everything sits on the scroll).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Lenis from "lenis";
import fieldImage from "@/assets/landing/dio/field-bg.jpg";
import { createEngine, type Engine } from "./engine";
import { CHAPTERS, FOOTER_IN, SCREENS, SECTIONS, covers, type Section } from "./timeline";
import "./journey.css";

const TITLE = ["Farming.", "Revolutionized."];
const TITLE_FONT = "Saira, 'Arial Black', sans-serif";
// below the cob in the hero film
const TITLE_Y = 0.76;
const PLOTS_IMAGE = "/media/landing/aerial-sm.webp";

/** real footage as still-frame sequences (public/media/journey/<name>/{d,m}/NNN.webp) */
const film = (name: string, count: number) => ({
  count,
  url: (set: "d" | "m", i: number) => `/media/journey/${name}/${set}/${String(i).padStart(3, "0")}.webp`,
});
const FILMS = { cob: film("cob", 96), seedling: film("seedling", 120), kernel: film("kernel", 72) };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+/<>";

/* ------------------------------------------------------------------ */
/*  scrambled heading                                                  */
/* ------------------------------------------------------------------ */

/** text that decodes in as outlined random glyphs, then settles letter by letter into solid
 * type; leaving reverses it. Updates the DOM directly so it never re-renders React per frame. */
function Scramble({
  text,
  active,
  reduced,
  className,
  delay = 0,
  duration = 1100,
}: {
  text: string;
  active: boolean;
  reduced: boolean;
  className?: string;
  delay?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const lines = useMemo(() => text.split("\n"), [text]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLSpanElement>("[data-c]"));
    const set = (s: HTMLSpanElement, cls: string, ch: string) => {
      if (s.className !== cls) s.className = cls;
      if (s.textContent !== ch) s.textContent = ch;
    };
    if (reduced) {
      spans.forEach((s) => set(s, active ? "sc sc-on" : "sc sc-off", s.dataset.c!));
      return;
    }
    const n = spans.length;
    const at = spans.map((_, i) => (i / n) * 0.5 + Math.random() * 0.35);
    const D = active ? duration : duration * 0.55;
    const t0 = performance.now() + (active ? delay : 0);
    let raf = 0;
    let lastSwap = 0;
    const tick = (now: number) => {
      const k = (now - t0) / D;
      const swap = now - lastSwap > 55;
      if (swap) lastSwap = now;
      const busy = k < 1.2;
      spans.forEach((s, i) => {
        const c = s.dataset.c!;
        if (c === " ") return;
        const o = at[i]!;
        const rnd = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!;
        if (active) {
          if (k < o * 0.5) set(s, "sc sc-off", c);
          else if (k < o + 0.18) set(s, "sc sc-ghost", swap || s.className !== "sc sc-ghost" ? rnd() : s.textContent!);
          else set(s, "sc sc-on", c);
        } else {
          if (k < o * 0.6) set(s, "sc sc-on", c);
          else if (k < o * 0.6 + 0.2) set(s, "sc sc-ghost", swap || s.className !== "sc sc-ghost" ? rnd() : s.textContent!);
          else set(s, "sc sc-off", c);
        }
      });
      if (busy) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduced, delay, duration]);

  return (
    <span ref={ref} className={className}>
      <span className="jr-sr">{text.replace(/\n/g, " ")}</span>
      {lines.map((line, li) => (
        <span key={li} className="sc-line" aria-hidden="true">
          {Array.from(line).map((c, i) => (
            <span key={i} data-c={c} className="sc sc-off">
              {c}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  page                                                               */
/* ------------------------------------------------------------------ */

function SectionBlock({ s, active, reduced }: { s: Section; active: boolean; reduced: boolean }) {
  return (
    <>
      <div className={`jr-sec${active ? " is-on" : ""}`}>
        <h2 className="jr-h">
          <Scramble text={s.title} active={active} reduced={reduced} />
        </h2>
        <p className="jr-body">{s.body}</p>
      </div>
      {s.cta && (
        <a href={s.cta.href} className={`jr-ring jr-ring--${s.cta.place}${active ? " is-on" : ""}`} tabIndex={active ? 0 : -1}>
          <span>{s.cta.label}</span>
        </a>
      )}
    </>
  );
}

const FOOTER_LINKS = [
  { label: "Create your farm profile", href: "/sign-up" },
  { label: "Sign in", href: "/sign-in" },
  { label: "Open Saath", href: "/saath" },
  { label: "Back to the top", href: "#top" },
];

export function Journey() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ringRef = useRef<SVGCircleElement>(null);
  const pillRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [footerOn, setFooterOn] = useState(false);
  const [heroOn, setHeroOn] = useState(false);
  const [menu, setMenu] = useState(false);
  const [noGl, setNoGl] = useState(false);
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const canvas = canvasRef.current!;
    const mobile = window.innerWidth < 768 || window.matchMedia("(pointer: coarse)").matches;
    document.documentElement.classList.add("jr-html");
    window.scrollTo(0, 0);
    const lenis = reduced ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
    lenisRef.current = lenis;

    let engine: Engine | null = null;
    let raf = 0;
    let disposed = false;
    let lastSec = "";
    let lastFooter = false;
    let booted = false;
    const ring = ringRef.current;
    const RING_LEN = 2 * Math.PI * 7;

    const removeBoot = () => {
      const boot = document.getElementById("boot-loader");
      if (!boot) return;
      boot.classList.add("is-done");
      window.setTimeout(() => boot.remove(), 900);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      lenis?.raf(now);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? clamp01(window.scrollY / max) : 0;
      engine?.frame(p, now);
      if (!booted) {
        booted = true;
        removeBoot();
        setHeroOn(true);
      }

      // each chapter's text rides on its card and is hidden by the next card coming up
      const H = window.innerHeight;
      const cv = covers(p);
      layerRefs.current.forEach((el, i) => {
        if (!el) return;
        const c = cv[i]!;
        const next = cv[i + 1] ?? 0;
        const dy = i === 0 ? -(cv[1] ?? 0) * 0.22 * H : (1 - c) * H;
        const top = Math.max(0, (1 - c) * H - dy);
        const bottom = Math.max(0, next * H + dy);
        const visible = c > 0 && next < 1;
        el.style.visibility = visible ? "visible" : "hidden";
        if (!visible) return;
        el.style.transform = `translate3d(0, ${dy.toFixed(1)}px, 0)`;
        el.style.clipPath = `inset(${top.toFixed(1)}px 0 ${bottom.toFixed(1)}px 0)`;
      });

      const sec = SECTIONS.find((s) => p >= s.in && p < s.out);
      const id = sec?.id ?? "";
      if (id !== lastSec) {
        lastSec = id;
        setActive(id || null);
      }
      if (sec && ring) ring.style.strokeDashoffset = String(RING_LEN * (1 - clamp01((p - sec.in) / (sec.out - sec.in))));
      const f = p >= FOOTER_IN;
      if (f !== lastFooter) {
        lastFooter = f;
        setFooterOn(f);
      }
      if (pillRef.current) pillRef.current.style.transform = `scaleX(${Math.max(0.04, p).toFixed(4)})`;
    };

    const start = async () => {
      // the headline is drawn into WebGL from a canvas, so its face must be loaded first
      try {
        await Promise.race([
          document.fonts.load(`800 100px ${TITLE_FONT}`),
          new Promise((r) => setTimeout(r, 2500)),
        ]);
      } catch {
        /* draw with the fallback face */
      }
      if (disposed) return;
      try {
        engine = createEngine(canvas, {
          mobile,
          titleLines: TITLE.map((t) => t.toUpperCase()),
          titleFont: TITLE_FONT,
          titleY: TITLE_Y,
          fieldImage,
          plotsImage: PLOTS_IMAGE,
          films: FILMS,
          onTitleLayout: (bottom, fs) => {
            heroRef.current?.style.setProperty("--jr-title-bottom", `${bottom}px`);
            heroRef.current?.style.setProperty("--jr-title-fs", `${fs}px`);
          },
        });
      } catch (err) {
        console.error("TerraLearn journey: WebGL unavailable", err);
        setNoGl(true);
      }
      raf = requestAnimationFrame(loop);
    };
    void start();

    const onMove = (e: PointerEvent) => engine?.pointer(e.clientX, e.clientY);
    const onResize = () => engine?.resize();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
      lenis?.destroy();
      lenisRef.current = null;
      engine?.dispose();
      document.documentElement.classList.remove("jr-html");
    };
  }, [reduced]);

  const goTo = (p: number) => {
    setMenu(false);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const y = p * max;
    if (lenisRef.current) lenisRef.current.scrollTo(y, { duration: 2.2 });
    else window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
  };

  const activeSection = SECTIONS.find((s) => s.id === active);
  const layer = (i: number) => (el: HTMLDivElement | null) => {
    layerRefs.current[i] = el;
  };

  return (
    <div className={`jr-root${noGl ? " jr-nogl" : ""}`} id="top">
      <canvas ref={canvasRef} className="jr-canvas" aria-hidden="true" />
      <div className="jr-scroll" style={{ height: `${SCREENS * 100}vh` } as CSSProperties} />

      {/* chapter 0 — hero */}
      <div ref={(el) => { layer(0)(el); heroRef.current = el; }} className="jr-layer jr-layer--hero" data-chapter={CHAPTERS[0]}>
        <h1 className="jr-sr">{TITLE.join(" ")}</h1>
        <p className={`jr-hero-sub${heroOn ? " is-on" : ""}`}>
          From soil to sale, it&rsquo;s farm intelligence that will change how India farms.
        </p>
        <p className={`jr-cue${heroOn ? " is-on" : ""}`}>Scroll to discover</p>
      </div>

      {/* chapter 1 — underground: helix, constellation, seedling */}
      <div ref={layer(1)} className="jr-layer" data-chapter={CHAPTERS[1]}>
        <div className="jr-shade" aria-hidden="true" />
        {SECTIONS.filter((s) => s.chapter === 1).map((s) => (
          <SectionBlock key={s.id} s={s} active={active === s.id} reduced={reduced} />
        ))}
      </div>

      {/* chapter 2 — field */}
      <div ref={layer(2)} className="jr-layer" data-chapter={CHAPTERS[2]}>
        <div className="jr-shade" aria-hidden="true" />
        {SECTIONS.filter((s) => s.chapter === 2).map((s) => (
          <SectionBlock key={s.id} s={s} active={active === s.id} reduced={reduced} />
        ))}
      </div>

      {/* chapter 3 — plots */}
      <div ref={layer(3)} className="jr-layer" data-chapter={CHAPTERS[3]}>
        <div className="jr-shade" aria-hidden="true" />
        {SECTIONS.filter((s) => s.chapter === 3).map((s) => (
          <SectionBlock key={s.id} s={s} active={active === s.id} reduced={reduced} />
        ))}
      </div>

      {/* chapter 4 — outro */}
      <div ref={layer(4)} className="jr-layer" data-chapter={CHAPTERS[4]}>
        <nav className={`jr-foot${footerOn ? " is-on" : ""}`} aria-label="Get started">
          {FOOTER_LINKS.map((l, i) => (
            <a
              key={l.label}
              href={l.href}
              tabIndex={footerOn ? 0 : -1}
              onClick={
                l.href === "#top"
                  ? (e) => {
                      e.preventDefault();
                      goTo(0);
                    }
                  : undefined
              }
            >
              <Scramble text={l.label} active={footerOn} reduced={reduced} delay={i * 120} duration={900} />
              <i className="jr-dot" aria-hidden="true" />
            </a>
          ))}
        </nav>
        <div className={`jr-foot-bar${footerOn ? " is-on" : ""}`}>
          <span>TerraLearn · Smart India Hackathon 2026</span>
          <span>Live data, labelled honestly</span>
        </div>
      </div>

      {/* fixed chrome */}
      <header className="jr-nav">
        <button className="jr-burger" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <i />
          <i />
          <i />
        </button>
        <a href="/" className="jr-logo" onClick={(e) => (e.preventDefault(), goTo(0))}>
          <img src="/terralearn-icon.svg" alt="" width={20} height={20} />
          <span>TerraLearn</span>
        </a>
        <a href="/sign-in" className="jr-signin">
          Sign in
        </a>
      </header>

      <div className={`jr-label${activeSection ? " is-on" : ""}`} aria-hidden="true">
        <span>{activeSection?.label ?? ""}</span>
        <svg width="18" height="18" viewBox="0 0 18 18">
          <circle cx="9" cy="9" r="7" className="jr-label-track" />
          <circle ref={ringRef} cx="9" cy="9" r="7" className="jr-label-fill" strokeDasharray={2 * Math.PI * 7} />
        </svg>
      </div>

      <div className="jr-pill" aria-hidden="true">
        <i ref={pillRef} />
      </div>

      <div className={`jr-menu${menu ? " is-open" : ""}`} aria-hidden={!menu}>
        <button className="jr-menu-close" aria-label="Close menu" onClick={() => setMenu(false)} tabIndex={menu ? 0 : -1}>
          ×
        </button>
        <ul>
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <button tabIndex={menu ? 0 : -1} onClick={() => goTo((s.in + s.out) / 2)}>
                <small>0{i + 1}</small>
                {s.label}
              </button>
            </li>
          ))}
          <li>
            <a href="/sign-up" tabIndex={menu ? 0 : -1}>
              <small>→</small>Enter TerraLearn
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
