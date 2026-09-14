# TerraLearn — "PEEL"
## 3D scroll manifesto · Google Flow (Veo 3.1 Quality) generation spec

**Concept:** the scroll gesture strips hype off reality. You open on a glossy fake
agri-marketing "skin"; every scroll **tears a false layer away** to reveal the honest
ground beneath — real soil, real gaps, real numbers. The peels, fake badges, "GAP — NO
READING" labels, data-glow, HUD and CTA are all built in-browser. The 9 Veo clips are just
the real scenes underneath.

**Why Veo 3.1 Quality (discontinuous), NOT Lite/Extend:** the peel transitions live in code,
so clips never need to butt-join. We don't need Extend. We DO need each clip to be
**loop-friendly** (subtle ambient motion, near-zero camera travel) so a section can hold and
loop without a visible jump.

---

## GLOBAL SETTINGS (every clip)
- **Model:** Veo 3.1 (Quality) · **Aspect:** 16:9 · **Res:** 1080p · **Length:** 8s · audio ignored.
- Optimise for **seamless looping**: subtle ambient motion only (breeze, dust, heat shimmer,
  flowing water), minimal camera travel, start and end framing similar.

### Style suffix — PASTE AT END OF EVERY PROMPT **except C0**
```
Photorealistic, ultra-detailed, cinematic, shot on film with fine grain, warm ochre and deep
forest-green earthy color grade, golden-hour light, shallow depth of field, very slow subtle
ambient motion only, minimal camera travel so the shot loops seamlessly, 16:9, no on-screen
text, no captions, no numbers, no watermark, no UI, no logos.
```

### Negative prompt (if exposed)
```
text, captions, subtitles, numbers, watermark, logo, UI, distorted faces, deformed hands,
extra fingers, cartoon, illustration, big camera movement, whip pan, jump cut, flicker, strobe
```

### Export + naming — save to `hero/public/bands/`
```
band-00-skin.mp4        band-03-market.mp4        band-06-assistant.mp4
band-01-yield.mp4       band-04-saath.mp4         band-07-cascade.mp4
band-02-honesty.mp4     band-05-groundtruth.mp4   band-08-soil.mp4
```

---

## THE 9 PROMPTS

### C0 — THE SKIN (the lie · gets torn away) — use its OWN grade, not the suffix
```
A glossy, over-saturated television-commercial shot of a flawless field of perfect emerald
green crops under a dreamy, too-perfect golden sky. Everything is unnaturally pristine, vivid
and idealised, gently swaying in a light breeze with soft lens bloom and sparkles of light —
the fantasy version of farming in an advertisement. Slow, smooth, hypnotic motion.
Hyper-saturated, glossy, high-key, dreamy perfect commercial look, seamless loop-friendly,
16:9, no text, no captions, no numbers, no watermark, no UI.
```

### C1 — YIELD (the honest field beneath)
```
Photoreal low, close view across a real crop field that is honest and imperfect — some healthy
green, some dry yellowing patches, uneven growth, bare soil showing between the rows, dust and
a light breeze moving the leaves in warm low sun. Gritty, authentic, documentary, unretouched.
```

### C2 — HONESTY (bare honest ground · the concept hero)
```
Extreme detailed macro of cracked, dry, honest earth in raking golden sidelight — deep
fissures, crumbs of real soil, a few dry broken stalks, tiny particles of dust drifting slowly
through the light. Brutally real and textured, nothing hidden or beautified. Almost still.
```

### C3 — MARKET (real mandi)
```
Photoreal close, lived-in shots inside a real rural Indian grain market: mounds of golden
grain, rough jute sacks, a worn metal weighing scale, weathered hands slowly sifting grain,
dust hanging in warm shafts of light. Authentic and unglossy, only ambient motion of grain
and dust.
```

### C4 — SAATH (the real cooperative)
```
Photoreal ground-level view of two adjacent farm plots divided by a low earthen bund with a
thin channel of water glinting between them, a shared hand-tool resting on the ridge, different
crops on each side, a gentle breeze and slowly flowing water. Warm, human, cooperative.
```

### C5 — GROUND TRUTH (raw top-down of a real plot)
```
Photoreal top-down aerial held steady over one real rectangular farm plot, its true irregular
texture visible — patches of moisture, varied crop density, footpaths and boundaries — honest
and unretouched, faint heat shimmer, almost no camera movement. Raw ground truth, not a slick
render.
```

### C6 — ASSISTANT (hand + phone at dusk)
```
Photoreal intimate macro of a weathered farmer's hand holding a smartphone in a field at dusk,
warm screen glow lighting the fingertips and floating dust, blurred crops behind in shallow
focus, gentle ambient movement. Quiet and personal. The screen shows only a soft warm glow,
no readable text.
```

### C7 — CASCADE (risk · storm) — cooler grade allowed
```
Photoreal moody shot of storm light moving over a darkened field at dusk, wind bending the
crops, the first heavy raindrops striking dry soil and beginning to pool, a distant lightning
glow, tension in the air. Cold blue shadows against warm residual light, ambient wind and rain
motion, minimal camera travel.
```

### C8 — SOIL / FINALE (data living in the ground)
```
Photoreal extreme macro just under the surface, inside dark moist rich soil and a tangle of
fine plant roots, tiny particles and moisture droplets catching light. Faint delicate threads
of warm amber light glow softly from deep within the earth among the roots, as if living data
rests inside the ground, then everything settles into stillness.
```

---

## HANDOVER
Drop the 9 mp4s into `hero/public/bands/`. Then I build the PEEL page:
1. Pinned scroll stage; each band a layer, torn-edge mask reveal driven by scroll (GSAP).
2. Fake "✓ +34%" badges that rip off; honest "GAP — NO READING" labels underneath.
3. Keep all existing copy, chapters, palette, HUD, "Enter TerraLearn" CTA.
4. Soil-finale amber data-glow + CTA landing beat.
5. Poster-image + reduced-motion fallback.
