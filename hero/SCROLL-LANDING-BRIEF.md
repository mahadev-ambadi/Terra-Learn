# BRIEF — TerraLearn cinematic scroll landing page

## 0. The one-line mission
Build a premium, one-page, **cinematic scroll-driven storytelling experience** for TerraLearn —
a real farm-data platform for Indian farmers. The goal is NOT an ecommerce or marketing-brochure
site. The goal is a scroll *film*: a continuous, narrated descent through what the platform does,
where every scroll beat feels inevitable and hand-crafted. It should feel like **an Apple product
launch page crossed with a Nike product story** — restrained, confident, emotional — and it should
show off what's possible with GSAP + modern web animation.

## 1. The feeling
- Apple: generous negative space, one idea per screen, type that commands, motion that is *earned*
  and never decorative-for-its-own-sake, buttery pinned scroll.
- Nike: bold, human, gritty, real ground and real hands, momentum.
- TerraLearn's own soul: **honesty**. The enemy is the "silent guess" — fake, over-produced
  agri-marketing. Our design answer is real footage, real texture, and data shown as *living light*,
  always labelled (reading / estimate / gap). Never fake a number.

Tagline system (use verbatim):
- Kicker: **"For the ground under it"**
- Hero: **"Real data. Honest ground. One pocket."**
- Closing payoff: **"For the ground under it."**

## 2. What it is / isn't
- IS: a single long scroll page, ~9–10 full-viewport beats, pinned and choreographed.
- IS: driven by real AI-generated video clips already produced (see §4).
- ISN'T: a store, a pricing page, a dashboard, or a generic feature grid.
- ISN'T: full of gratuitous parallax — every motion must serve the story.

## 3. Tech stack & integration
- Build **inside the existing `hero/` app** (React 19 + TanStack Start + Vite + Tailwind v4).
  The landing lives at the `/` route (`src/routes/index.tsx`).
- Animation: **GSAP + ScrollTrigger** for scroll choreography and pinning. Add **Lenis** for
  smooth inertial scrolling. (These are the right tools for this; add them as deps.)
- Keep the existing design tokens in `src/styles.css` (see §5). Reuse Outfit / Figtree / JetBrains Mono.
- Must be SSR-safe (guard `window`, register ScrollTrigger client-side only, no hydration
  mismatches — keep any float-computed SVG/positions rounded or client-only).
- Performance is a first-class requirement (see §9). No jank on a mid-range laptop.

## 4. Assets (already generated — use these)
Nine 8-second cinematic clips live in `hero/public/bands/` (1080p, 16:9, muted, loop-friendly):
```
band-00-skin.mp4        the glossy FAKE "perfect harvest" hero (the hype we tear down)
band-01-yield.mp4       real, imperfect crop field
band-02-honesty.mp4     cracked bare earth in raking light
band-03-market.mp4      real rural mandi — grain, sacks, hands
band-04-saath.mp4       neighbouring plots split by a bund + water
band-05-groundtruth.mp4 raw top-down of one real plot   (⚠ 59MB — must be compressed/streamed)
band-06-assistant.mp4   weathered hand + phone glow at dusk
band-07-cascade.mp4     storm light + rain hitting soil (cooler grade)
band-08-soil.mp4        into moist soil + roots, amber data-glow (finale)
```
Treat each clip as a full-bleed background layer. Only 1–2 clips should be decoded/painted at once.

## 5. Design system (locked)
Colors (oklch, already in `styles.css`):
- `--background` deep black-green `oklch(0.06 0.01 150)`
- `--soil` ochre `oklch(0.72 0.11 75)`  (primary accent / "data" light)
- `--foliage` muted green `oklch(0.55 0.07 145)` (secondary / "vision" items)
- `--bone` warm cream `oklch(0.95 0.02 90)` (text)
Type: **Outfit** (display, tight tracking), **Figtree** (body), **JetBrains Mono** (labels/HUD).
Motion principles: long eases (cubic-bezier ~ .2,.7,.2,1), staggered reveals, nothing snaps,
continuous ambient life (a slowly rotating HUD, drifting grain), reduced-motion fully honored.

## 6. THE SIGNATURE TRANSITION — "the holographic reveal"
This is the defining interaction between beats. Reference: the `Demo.mp4` (ventdd site) in
`hero/public/bands/`. For each chapter, as it scrolls into view:
1. **The clip is full-bleed** and slowly zooms (Ken Burns), crossfading from the previous clip
   (never a hard cut, never black gaps — the video is always present, edge to edge).
2. A **holographic circular HUD dial** materialises over the subject on the right — concentric
   rings + tick marks + arcs — and it **rotates continuously** (multiple rings, different speeds
   and directions). This continuous rotation is "the turn."
3. **Round feature-icon badges** (5 per chapter, themed to that capability) **orbit / fan in**
   around the dial, staggered.
4. The **chapter text slides in from the left** (kicker + title + body + bullet points + a
   provenance chip: READING / ESTIMATE / GAP).
On scroll-out, these gracefully reverse/hand off to the next chapter's reveal.
IMPORTANT: do NOT rotate the video plane itself (no card-flip, no revolving-door that goes
edge-on and shows background). The video stays put and full-bleed; the *holographic overlay* is
what animates. The HUD dial's spin is the rotation the user wants.

## 7. Scene-by-scene storyboard
0. **HERO / THE LIE (band-00-skin):** open on the glossy, over-perfect ad — "SPONSORED · THE
   FANTASY", headline "The perfect harvest.™", fake green ✓ badges (+34% YIELD, PERFECT SOIL,
   PRICE GUARANTEED), a "scroll to see the truth" cue. Deliberately too-clean.
1. **REVEAL / HERO TRUTH (band-01-yield):** the hype gives way to the real field + the true hero:
   kicker "For the ground under it", H1 "Real data. Honest ground. One pocket." Then folds into
   chapter 01 · Yield · LIVE · "Predict the harvest before you plant it." Icons: sprout, line-chart,
   droplet, globe, leaf. Chip: ESTIMATE.
2. **HONESTY (band-02-honesty):** 02 · LIVE · "Reading, estimate, or gap. Never a silent guess."
   The honesty manifesto. Chip: GAP — the HUD here can literally show READING/ESTIMATE/GAP states.
3. **MARKET (band-03-market):** 03 · LIVE · "Real mandi prices, not distress sales." Chip: READING.
4. **SAATH (band-04-saath):** 04 · LIVE · "One farm's waste is the next farm's input." Chip: READING.
5. **GROUND TRUTH (band-05-groundtruth):** 05 · LIVE · "Your land, from orbit." Chip: READING.
6. **ASSISTANT (band-06-assistant):** 06 · LIVE · "Advice that remembers your field." Chip: READING.
7. **CASCADE (band-07-cascade):** 07 · VISION · "One shock, mapped across eight factors." Cooler
   grade, tension. Chip: ESTIMATE.
8. **VOICE + FINALE (band-08-soil):** 08 · VISION · "In the language the farmer already speaks."
   Then the payoff: camera settles into the soil, **amber data-contours glow out of the earth**,
   the line "For the ground under it." resolves, and the **"Enter TerraLearn"** CTA lands.
   Below the pinned film: a short real footer (logo, one honest sentence, CTA).

(Full body copy + bullet points for each chapter already exist in `src/routes/index.tsx` — reuse them.)

## 8. Global interactions & chrome
- Fixed slim header: TerraLearn mark (left) + "Enter TerraLearn" pill (right).
- A persistent bottom **HUD**: label ("Scroll" → chapter kicker), a live **percent**, chapter tick
  marks that fill as you pass each beat, and a thin progress line.
- Smooth-scroll (Lenis); scroll is the only driver — no autoplay timeline.
- Subtle custom touches welcome (magnetic CTA, cursor-reactive HUD) but never at the cost of perf.

## 9. Performance & accessibility (hard requirements)
- 60fps scroll on a mid laptop. Drive transforms/opacity on the compositor; avoid per-frame React
  re-renders (imperative refs or GSAP quickSetters). No `backdrop-blur` on moving elements.
- Only decode/play the active clip ±1; pause and (ideally) unload the rest. **Compress
  band-05 (59MB)** and add poster frames; lazy-load clips as they approach.
- Respect `prefers-reduced-motion`: freeze the HUD spin, replace scroll-scrub with simple fades,
  keep everything readable and navigable.
- Fully responsive: on mobile the two-column reveal stacks (HUD dial smaller or hidden), type
  scales, the page never scrolls horizontally.
- SSR-safe, zero hydration mismatches, no console errors.

## 10. Definition of done
- Scrolls as one continuous, pinned cinematic film across all 9 beats + finale + footer.
- The holographic reveal (spinning HUD + orbiting badges + left text slide + clip crossfade) fires
  cleanly on every chapter, with no black gaps and no video-plane flipping.
- Hero "lie → truth" opening reads clearly; soil finale + CTA lands the "for the ground under it" payoff.
- Buttery on desktop, graceful on mobile and reduced-motion, no console errors, clips streamed sensibly.
- Every number on screen is labelled (reading / estimate / gap) — nothing fake, nothing unlabelled.

---
When you build from this brief: load the relevant scroll-animation / design skills, integrate into
the existing `hero/` React app at `/`, and use the 9 clips in `public/bands/` as the beats.
```
```
