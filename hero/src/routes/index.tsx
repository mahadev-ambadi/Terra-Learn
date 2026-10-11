import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { loadModel } from "@/lib/loadModel";
import { TerraLanding } from "@/landing/TerraLanding";
import { Loader } from "@/landing/Loader";
import {
  Sprout,
  Wheat,
  Droplets,
  Droplet,
  Wind,
  CloudSun,
  Sunrise,
  Mountain,
  TreeDeciduous,
  Bird,
  Bug,
  Leaf,
  ShieldCheck,
  Store,
  TrendingUp,
  Users,
  Recycle,
  Share2,
  Satellite,
  Map as MapIcon,
  Layers,
  MessageSquare,
  Mic,
  Send,
  Zap,
  Waves,
  Languages,
  FileText,
  Thermometer,
  Truck,
  Sun,
  type LucideIcon,
} from "lucide-react";

// registered once, client-side only — ScrollTrigger touches browser APIs at registration
// time, which SSR frameworks like this one need guarded against running on the server
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export const Route = createFileRoute("/")({
  component: Landing,
});

/* ------------------------------------------------------------------ */
/*  PEEL — scroll tears hype off reality to reach honest ground.       */
/* ------------------------------------------------------------------ */

type Chip = "READING" | "ESTIMATE" | "GAP";

type Band = {
  file: string;
  index: string;
  kicker: string;
  status: "LIVE" | "VISION";
  title: string;
  body: string;
  points: string[];
  chip: Chip;
  diagram: string;
  cooler?: boolean;
};

const BANDS: Band[] = [
  {
    file: "band-01-yield",
    index: "01",
    kicker: "Yield",
    status: "LIVE",
    title: "Predict the harvest before you plant it.",
    body: "An agronomic model reads temperature, growing degree days and soil pH match to project outcomes for your plot.",
    points: ["Crop yield simulator", "5-year climate & air-quality trends"],
    chip: "ESTIMATE",
    diagram: "curve",
  },
  {
    file: "band-02-honesty",
    index: "02",
    kicker: "Honesty",
    status: "LIVE",
    title: "Reading, estimate, or gap. Never a silent guess.",
    body: "Every number carries its provenance. When the data isn't there, the platform says so instead of filling the hole quietly.",
    points: ["Data honesty policy", "No silent fallbacks"],
    chip: "GAP",
    diagram: "provenance",
  },
  {
    file: "band-03-market",
    index: "03",
    kicker: "Market",
    status: "LIVE",
    title: "Real mandi prices, not distress sales.",
    body: "Agmarknet history and live buyer demand sit side by side, so the selling decision is made with the market in view.",
    points: ["Agmarknet price history", "Live buyer demand"],
    chip: "READING",
    diagram: "bars",
  },
  {
    file: "band-04-saath",
    index: "04",
    kicker: "Saath",
    status: "LIVE",
    title: "One farm's waste is the next farm's input.",
    body: "A hyperlocal feed for equipment, labour and resources — with circular-agriculture matches drawn between neighbouring plots.",
    points: ["Cooperative exchange feed", "IFS loop matching", "Trust from completed exchanges"],
    chip: "READING",
    diagram: "network",
  },
  {
    file: "band-05-groundtruth",
    index: "05",
    kicker: "Ground truth",
    status: "LIVE",
    title: "Your land, from orbit.",
    body: "Satellite imagery with toggleable layers for IFS loops and neighbouring farms, across every plot you manage.",
    points: ["Satellite mapping layers", "Multi-farm switching", "Role-based access"],
    chip: "READING",
    diagram: "plots",
  },
  {
    file: "band-06-assistant",
    index: "06",
    kicker: "Assistant",
    status: "LIVE",
    title: "Advice that remembers your field.",
    body: "A memory-aware agent that speaks plainly, knows your land and network, and drafts messages you must confirm before they send.",
    points: ["Persistent AI assistant", "Draft-and-confirm messaging"],
    chip: "READING",
    diagram: "chat",
  },
  {
    file: "band-07-cascade",
    index: "07",
    kicker: "Next",
    status: "VISION",
    title: "One shock, mapped across eight factors.",
    body: "The cascade engine models the farm as a dependency graph — a power cut becomes a visible chain of downstream risk.",
    points: ["FarmRisk cascade engine", "Flood & drought early warning", "Leaf disease scanner"],
    chip: "ESTIMATE",
    diagram: "cascade",
    cooler: true,
  },
  {
    file: "band-08-soil",
    index: "08",
    kicker: "Next",
    status: "VISION",
    title: "In the language the farmer already speaks.",
    body: "Voice in, voice out across major Indian languages, AgriStack land records, insurance claim help and a traceable crop ledger.",
    points: ["Multilingual voice", "AgriStack auto-fill", "Traceable provenance"],
    chip: "GAP",
    diagram: "wave",
  },
];

const SKIN = "band-00-skin";

// Scroll layout: the fake skin + 8 honest layers peel; the last (soil) stays for the finale.
const PEEL_LAYERS = BANDS.length; // skin + first 7 honest layers peel away; soil holds
const PEEL_END = 0.8; // fraction of scroll spent peeling; rest is the soil finale

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (n: number) => 1 - Math.pow(1 - clamp01(n), 3);
const easeInOut = (n: number) =>
  clamp01(n) < 0.5 ? 2 * n * n : 1 - Math.pow(-2 * n + 2, 2) / 2;

// feature-icon badges that bloom into each band's reveal — each one carries a short label
// explaining what it represents, shown on hover instead of leaving the icon unexplained
type Badge = { icon: LucideIcon; label: string };
const BAND_BADGES: Record<string, Badge[]> = {
  "01": [
    { icon: Sprout, label: "Crop growth stage" },
    { icon: Wheat, label: "Yield forecast curve" },
    { icon: Droplets, label: "Soil moisture signal" },
    { icon: CloudSun, label: "Regional climate data" },
    { icon: Leaf, label: "Crop health index" },
  ],
  "02": [
    { icon: ShieldCheck, label: "Verified reading" },
    { icon: Droplet, label: "Raw data source" },
    { icon: Wind, label: "Model estimate" },
    { icon: Leaf, label: "Field-level accuracy" },
    { icon: Sun, label: "No silent fallback" },
  ],
  "03": [
    { icon: Wheat, label: "Agmarknet price history" },
    { icon: Store, label: "Local mandi listings" },
    { icon: TrendingUp, label: "Live demand trend" },
    { icon: Users, label: "Buyer network" },
    { icon: Sunrise, label: "Market-wide view" },
  ],
  "04": [
    { icon: Users, label: "Neighbouring farmers" },
    { icon: Recycle, label: "Circular resource loop" },
    { icon: Share2, label: "Shared equipment feed" },
    { icon: Leaf, label: "Waste-to-input match" },
    { icon: Sprout, label: "Trust from exchanges" },
  ],
  "05": [
    { icon: Satellite, label: "Satellite imagery" },
    { icon: MapIcon, label: "Plot boundary map" },
    { icon: Layers, label: "Toggleable data layers" },
    { icon: Mountain, label: "Multi-farm view" },
    { icon: TreeDeciduous, label: "IFS loop overlay" },
  ],
  "06": [
    { icon: MessageSquare, label: "Plain-language chat" },
    { icon: Mic, label: "Voice input" },
    { icon: Send, label: "Draft-and-confirm send" },
    { icon: Bird, label: "Memory-aware agent" },
    { icon: Users, label: "Knows your network" },
  ],
  // the cascade chapter maps one shock across all eight downstream factors — every one gets a badge
  "07": [
    { icon: Zap, label: "Power-cut trigger" },
    { icon: Droplets, label: "Irrigation pump failure" },
    { icon: Thermometer, label: "Cold-storage spoilage" },
    { icon: Truck, label: "Market delivery delay" },
    { icon: Users, label: "Labour turnout gap" },
    { icon: Waves, label: "Flood early warning" },
    { icon: Sun, label: "Drought stress signal" },
    { icon: Bug, label: "Leaf disease scanner" },
  ],
  "08": [
    { icon: Languages, label: "Multilingual voice" },
    { icon: Mic, label: "Speak, don't type" },
    { icon: FileText, label: "AgriStack auto-fill" },
    { icon: Sprout, label: "Traceable crop ledger" },
    { icon: ShieldCheck, label: "Insurance claim help" },
  ],
};

// each chapter's badges bloom in a different petal silhouette — never a plain circle by default
type PetalShape = "leaf" | "petal" | "drop" | "bud";
const PETAL_SHAPE: Record<string, PetalShape> = {
  "01": "leaf",
  "02": "petal",
  "03": "drop",
  "04": "bud",
  "05": "leaf",
  "06": "petal",
  "07": "drop",
  "08": "bud",
};

/** the visual shell for one badge — an organic blob silhouette that sways gently and
 * brightens like sunlit foliage on hover, instead of a rigid geometric tech panel */
function PetalShell({ shape, children }: { shape: PetalShape; children: JSX.Element }) {
  const base =
    "organic-sway flex size-full items-center justify-center border border-bone/15 bg-background/70 backdrop-blur-sm transition-all duration-300 group-hover:border-soil group-hover:bg-background/95 group-hover:shadow-[0_0_26px_-2px_var(--color-soil)] group-hover:[filter:brightness(1.3)]";
  const shadow = { boxShadow: "0 10px 30px -12px oklch(0 0 0 / 0.7)" };
  return (
    <div className={`${base} petal-${shape}`} style={shadow}>
      {children}
    </div>
  );
}

// where each badge sits around the ring (deg from +x axis, y down); rounded so SSR == client.
// 8 slots so a chapter with all eight factors (cascade) can show every one without overlap —
// the first five match the original 5-badge layout exactly, so no other chapter's badges move.
const BADGE_ANGLES = [-158, -116, -74, -32, 26, 70, 114, 158];
const badgePos = (deg: number, r = 44) => ({
  left: `${(50 + r * Math.cos((deg * Math.PI) / 180)).toFixed(2)}%`,
  top: `${(50 + r * Math.sin((deg * Math.PI) / 180)).toFixed(2)}%`,
});

// shared polar helper for the rotating ring housing below (200x200 viewBox, centered 100,100)
const polar = (r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: 100 + r * Math.cos(rad), y: 100 + r * Math.sin(rad) };
};
const fx = (n: number) => n.toFixed(2);

/** shared backing bed every glyph sits on, for contrast against bright footage — a soft leaf
 * silhouette instead of a rigid rounded rect */
function GlyphBed({ tint = "var(--soil)" }: { tint?: string }) {
  return (
    <ellipse cx="100" cy="100" rx="46" ry="44" fill="oklch(0.05 0.01 150 / 0.66)" stroke={tint} strokeOpacity="0.4" strokeWidth="1" />
  );
}

/** the wreath framing every chapter — two vine rings drifting at different, slow speeds, leaves
 * and buds instead of tick marks and mechanical dashes */
function GrowthRing() {
  const leaves = Array.from({ length: 18 }, (_, i) => i);
  const buds = Array.from({ length: 10 }, (_, i) => i);
  return (
    <>
      <svg viewBox="0 0 200 200" className="bloom-spin-a absolute inset-0 size-full">
        <circle cx="100" cy="100" r="90" fill="none" stroke="var(--soil)" strokeOpacity="0.3" strokeWidth="0.7" strokeDasharray="1 5" />
        {leaves.map((i) => {
          const a = (i / leaves.length) * 360;
          const p = polar(88, a);
          return (
            <ellipse
              key={i}
              cx={fx(p.x)}
              cy={fx(p.y)}
              rx="5.5"
              ry="2.6"
              fill={i % 3 === 0 ? "var(--foliage)" : "var(--soil)"}
              fillOpacity={i % 2 === 0 ? 0.75 : 0.45}
              transform={`rotate(${fx(a + 90)} ${fx(p.x)} ${fx(p.y)})`}
            />
          );
        })}
      </svg>
      <svg viewBox="0 0 200 200" className="bloom-spin-b absolute inset-0 size-full">
        <circle cx="100" cy="100" r="66" fill="none" stroke="var(--soil)" strokeOpacity="0.35" strokeWidth="0.9" strokeDasharray="3 7" strokeLinecap="round" />
        {buds.map((i) => {
          const a = (i / buds.length) * 360;
          const p = polar(66, a);
          return <circle key={i} cx={fx(p.x)} cy={fx(p.y)} r="2.2" fill="var(--bone)" fillOpacity="0.5" />;
        })}
      </svg>
    </>
  );
}

/** per-chapter signature glyph — a distinct botanical scene, static so it stays readable while the wreath drifts */
const NATURE_GLYPHS: Record<string, () => JSX.Element> = {
  // 01 · Yield — a climbing stem with leaves growing larger as it rises (the forecast, literalised)
  "01": () => (
    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
      <GlyphBed />
      <path d="M100 134 C98 118 102 108 99 94 C96 80 101 70 100 62" fill="none" stroke="var(--soil)" strokeWidth="2.2" strokeLinecap="round" />
      {[
        { cx: 88, cy: 120, rx: 9, ry: 5, rot: -25 },
        { cx: 111, cy: 106, rx: 10, ry: 5.5, rot: 20 },
        { cx: 87, cy: 92, rx: 11, ry: 6, rot: -22 },
        { cx: 112, cy: 78, rx: 12, ry: 6.5, rot: 24 },
        { cx: 100, cy: 62, rx: 8, ry: 12, rot: 0 },
      ].map((l, i) => (
        <ellipse key={i} cx={l.cx} cy={l.cy} rx={l.rx} ry={l.ry} fill="var(--foliage)" fillOpacity={0.55 + i * 0.09} transform={`rotate(${l.rot} ${l.cx} ${l.cy})`} />
      ))}
      <circle cx="100" cy="134" r="3" fill="var(--soil)" />
    </svg>
  ),
  // 02 · Honesty — three leaves in three states of provenance (solid reading, soft estimate, bare-outline gap)
  "02": () => (
    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
      <GlyphBed />
      <ellipse cx="78" cy="78" rx="13" ry="7" fill="var(--soil)" transform="rotate(-18 78 78)" />
      <ellipse cx="78" cy="100" rx="13" ry="7" fill="var(--foliage)" fillOpacity="0.6" transform="rotate(-18 78 100)" />
      <ellipse cx="78" cy="122" rx="13" ry="7" fill="none" stroke="var(--bone)" strokeOpacity="0.55" strokeWidth="1.4" strokeDasharray="3 3" transform="rotate(-18 78 122)" />
      {[78, 100, 122].map((y, i) => (
        <path key={i} d={`M92 ${y} Q118 ${y - 2} 132 ${y}`} fill="none" stroke="var(--bone)" strokeOpacity={0.4 - i * 0.1} strokeWidth="1" strokeDasharray={i === 2 ? "2 3" : undefined} />
      ))}
    </svg>
  ),
  // 03 · Market — wheat stalks of varying height on a furrow line
  "03": () => (
    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
      <GlyphBed />
      <line x1="64" y1="128" x2="136" y2="128" stroke="var(--bone)" strokeOpacity="0.3" strokeWidth="0.9" />
      {[14, 26, 18, 34, 22, 30].map((h, i) => {
        const x = 68 + i * 11;
        return (
          <g key={i}>
            <path d={`M${x} 128 Q${x + (i % 2 ? 3 : -3)} ${128 - h * 0.6} ${x} ${128 - h}`} fill="none" stroke="var(--soil)" strokeWidth="1.6" strokeLinecap="round" />
            <ellipse cx={x} cy={128 - h} rx="3.4" ry="6" fill="var(--foliage)" fillOpacity={i === 3 ? 0.95 : 0.7} />
          </g>
        );
      })}
    </svg>
  ),
  // 04 · Saath — a root network linking neighbouring plots, curved instead of straight
  "04": () => (
    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
      <GlyphBed />
      <path d="M100 68 Q88 82 78 94" fill="none" stroke="var(--soil)" strokeOpacity="0.75" strokeWidth="1.4" />
      <path d="M100 68 Q112 82 122 94" fill="none" stroke="var(--soil)" strokeOpacity="0.75" strokeWidth="1.4" />
      <path d="M78 94 Q70 108 66 120" fill="none" stroke="var(--foliage)" strokeOpacity="0.65" strokeWidth="1.1" />
      <path d="M78 94 Q84 110 90 122" fill="none" stroke="var(--foliage)" strokeOpacity="0.65" strokeWidth="1.1" />
      <path d="M122 94 Q116 110 110 122" fill="none" stroke="var(--foliage)" strokeOpacity="0.65" strokeWidth="1.1" />
      <path d="M122 94 Q130 108 134 120" fill="none" stroke="var(--foliage)" strokeOpacity="0.65" strokeWidth="1.1" />
      <circle cx="100" cy="68" r="4.4" fill="var(--soil)" />
      <circle cx="78" cy="94" r="3.6" fill="var(--soil)" opacity="0.95" />
      <circle cx="122" cy="94" r="3.6" fill="var(--soil)" opacity="0.95" />
      {[[66, 120], [90, 122], [110, 122], [134, 120]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="4" ry="3" fill="var(--foliage)" />
      ))}
    </svg>
  ),
  // 05 · Ground truth — a leaf-shaped plot outline with a dew-drop location pin
  "05": () => (
    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
      <GlyphBed />
      <path
        d="M100 66 C122 72 136 90 130 112 C124 132 106 140 100 140 C94 140 76 132 70 112 C64 90 78 72 100 66 Z"
        fill="var(--soil)"
        fillOpacity="0.14"
        stroke="var(--soil)"
        strokeOpacity="0.85"
        strokeWidth="1.6"
      />
      <path d="M100 66 L100 140" stroke="var(--soil)" strokeOpacity="0.4" strokeWidth="1" />
      <circle cx="106" cy="94" r="6.4" fill="none" stroke="var(--soil)" strokeWidth="2" />
      <circle cx="106" cy="94" r="2.4" fill="var(--soil)" />
      <path d="M106 100 Q106 110 106 116" stroke="var(--soil)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  // 06 · Assistant — a leaf-shaped speech bubble with a gentle vine waveform inside
  "06": () => (
    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
      <GlyphBed tint="var(--foliage)" />
      <path
        d="M70 96 C70 82 84 74 100 74 C116 74 130 82 130 96 C130 110 116 118 100 118 C96 118 92 117 89 116 L78 128 L80 114 C73 110 70 104 70 96 Z"
        fill="oklch(0.05 0.01 150 / 0.4)"
        stroke="var(--foliage)"
        strokeOpacity="0.7"
        strokeWidth="1.5"
      />
      <path d="M80 96 Q86 84 92 96 T104 96 T116 96" fill="none" stroke="var(--soil)" strokeOpacity="0.95" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  // 07 · Cascade — one raindrop trigger, roots branching to all eight downstream factors
  "07": () => {
    const branchX = [67, 89, 111, 133];
    const leafPairs: [number, number][] = [
      [62, 73],
      [84, 95],
      [106, 117],
      [128, 139],
    ];
    return (
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
        <GlyphBed tint="var(--foliage)" />
        <path d="M100 62 Q100 70 100 78" fill="none" stroke="var(--foliage)" strokeOpacity="0.75" strokeWidth="1.3" />
        <path d="M67 78 Q100 86 133 78" fill="none" stroke="var(--foliage)" strokeOpacity="0.55" strokeWidth="1" />
        {branchX.map((x) => (
          <path key={`s${x}`} d={`M${x} 78 Q${x} 85 ${x} 92`} fill="none" stroke="var(--foliage)" strokeOpacity="0.65" strokeWidth="1" />
        ))}
        {branchX.map((bx, i) =>
          leafPairs[i].map((lx) => (
            <path key={`l${bx}-${lx}`} d={`M${bx} 92 Q${(bx + lx) / 2} 100 ${lx} 108`} fill="none" stroke="var(--soil)" strokeOpacity="0.55" strokeWidth="0.9" />
          )),
        )}
        <path d="M100 54 C104 58 104 64 100 66 C96 64 96 58 100 54 Z" fill="var(--soil)" />
        {branchX.map((x) => (
          <circle key={`b${x}`} cx={x} cy="78" r="3" fill="var(--foliage)" opacity="0.85" />
        ))}
        {leafPairs.flat().map((x) => (
          <ellipse key={`f${x}`} cx={x} cy="108" rx="3.2" ry="2.4" fill="var(--soil)" opacity="0.9" />
        ))}
      </svg>
    );
  },
  // 08 · Soil / voice — blades of grass at varying height, seeds drifting up into the finale glow
  "08": () => (
    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
      <GlyphBed />
      {Array.from({ length: 13 }, (_, i) => i).map((i) => {
        const x = 62 + i * 6.2;
        const h = 6 + 22 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.31));
        const lean = i % 2 === 0 ? 3 : -3;
        return (
          <path
            key={i}
            d={`M${x} ${100 + h / 2} Q${x + lean} ${100} ${x} ${100 - h / 2}`}
            fill="none"
            stroke="var(--soil)"
            strokeOpacity="0.9"
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      })}
      <circle cx="118" cy="70" r="1.8" fill="var(--soil)" opacity="0.85" />
      <circle cx="128" cy="62" r="1.4" fill="var(--soil)" opacity="0.6" />
      <circle cx="136" cy="56" r="1.1" fill="var(--soil)" opacity="0.4" />
    </svg>
  ),
};

/** the field of ambient seeds/pollen drifting up through a chapter's visual, purely decorative —
 * a handful of small dots with staggered, randomised-looking (but deterministic) drift timing */
function SeedDrift({ count = 7 }: { count?: number }) {
  const seeds = Array.from({ length: count }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {seeds.map((i) => {
        const left = 8 + ((i * 37) % 84);
        const size = 3 + (i % 3);
        const dur = 7 + (i % 5) * 1.6;
        const delay = -(i * 1.3);
        const driftX = i % 2 === 0 ? 14 + i * 2 : -(10 + i * 2);
        return (
          <span
            key={i}
            className="drift-seed"
            style={{
              left: `${left}%`,
              bottom: "8%",
              width: size,
              height: size,
              opacity: i % 4 === 0 ? 0.35 : 0.55,
              ["--drift-x" as string]: `${driftX}px`,
              ["--drift-dur" as string]: `${dur}s`,
              ["--drift-delay" as string]: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}

/** A living growth ring — a slowly drifting vine wreath framing a static, per-chapter botanical glyph. */
function BloomRing({ variant }: { variant: string }) {
  const Glyph = NATURE_GLYPHS[variant] ?? NATURE_GLYPHS["01"];
  return (
    <div className="absolute inset-0">
      <GrowthRing />
      <Glyph />
      <SeedDrift />
      {/* static center bud */}
      <div className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-soil shadow-[0_0_20px_var(--color-soil)]" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(38% 38% at 50% 50%, oklch(0.72 0.11 75 / 0.22), transparent 70%)" }}
      />
    </div>
  );
}

/** a cursor-following spotlight that reveals a grid of tile squares near the pointer and fades
 * them out with distance. pure CSS mask compositing — no canvas, no per-frame React updates,
 * just two CSS vars written on mousemove. off entirely on touch devices and reduced-motion. */
function CursorGrid() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(hover: none), (prefers-reduced-motion: reduce)").matches) return;

    let idleTimer = 0;
    const onMove = (e: MouseEvent) => {
      el.style.setProperty("--cx", `${e.clientX}px`);
      el.style.setProperty("--cy", `${e.clientY}px`);
      el.style.opacity = "1";
      // only visible while the cursor is actually moving — fade out the instant it stops
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        el.style.opacity = "0";
      }, 160);
    };
    const onLeave = () => {
      window.clearTimeout(idleTimer);
      el.style.opacity = "0";
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.clearTimeout(idleTimer);
    };
  }, []);

  return <div ref={ref} className="cursor-grid" aria-hidden="true" />;
}

/** Lenis smooth-scroll, driven by GSAP's own ticker (not its own internal rAF) and feeding
 * every frame back into ScrollTrigger.update — the canonical Lenis+ScrollTrigger sync
 * pattern, so every scrub animation in the page reads the smoothed position instead of the
 * raw, jumpy native scroll event. Skipped under prefers-reduced-motion: smoothing adds
 * scroll momentum a motion-sensitive visitor didn't ask for, so native scroll is left alone. */
function useLenis() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // lerp rather than a fixed 1 s ease: the page glides, but follows the wheel closely enough
    // that the scroll-driven film and pinned sections never feel like they trail the hand
    const lenis = new Lenis({
      lerp: 0.14,
      smoothWheel: true,
    });
    lenis.on("scroll", ScrollTrigger.update);

    const onTick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
      lenis.destroy();
    };
  }, []);
}

export function Landing() {
  useLenis();
  // the chaptered farm landing is the default; the original scroll-film landing is kept at ?classic
  const [classic, setClassic] = useState(false);
  useEffect(() => { setClassic(new URLSearchParams(window.location.search).has("classic")); }, []);
  return (
    <main className="relative bg-background">
      <Loader />
      {classic ? (
        <>
          <CursorGrid />
          <Header />
          <Peel />
          <Footer />
        </>
      ) : (
        <TerraLanding />
      )}
    </main>
  );
}

function Header() {
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const ctx = gsap.context(() => {
      // the fixed nav picks up a backing plate as soon as the page moves at all — scrubbed
      // 1:1 against the first 220px of scroll, so it's back to fully transparent the instant
      // you're at the very top again
      gsap.fromTo(
        header,
        { backgroundColor: "oklch(0.06 0.01 150 / 0)", backdropFilter: "blur(0px)" },
        {
          backgroundColor: "oklch(0.06 0.01 150 / 0.72)",
          backdropFilter: "blur(10px)",
          ease: "none",
          scrollTrigger: { trigger: document.body, start: "top top", end: "+=220", scrub: true },
        },
      );
    }, headerRef);
    return () => ctx.revert();
  }, []);

  return (
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-[60] px-6 py-5 sm:px-10">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <span className="size-2.5 rotate-45 border border-soil bg-soil/30" />
          <span className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-bone">
            TerraLearn
          </span>
        </a>
        <a
          href="/sign-up"
          className="rounded-full border border-bone/20 bg-bone/5 px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-bone backdrop-blur-md transition-colors hover:border-soil hover:bg-soil/10 hover:text-soil"
        >
          Enter TerraLearn
        </a>
      </div>
    </header>
  );
}

// ------------------------------------------------------------------
// Scene3D — a custom, hand-built Three.js scene: a soil bed, a growing
// plant, drifting dust motes, a holographic HUD dial, and one distinct
// 3D glyph per chapter, all driven by the same 0..1 scroll progress the
// text/HUD layer already uses. No 3D asset files — every mesh here is
// built procedurally from primitives at runtime.
// ------------------------------------------------------------------

const SOIL_HEX = 0xd8a24a;
const FOLIAGE_HEX = 0x7c9a5e;
const BONE_HEX = 0xf1ead8;

/** a simple pointed-oval leaf outline, built from bezier curves — no texture needed */
function leafShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.16, 0.22, 0.11, 0.52);
  s.quadraticCurveTo(0.06, 0.74, 0, 0.92);
  s.quadraticCurveTo(-0.06, 0.74, -0.11, 0.52);
  s.quadraticCurveTo(-0.16, 0.22, 0, 0);
  return s;
}

/** the growing seedling — a curved stem (TubeGeometry) with a handful of leaf planes */
function buildPlant(): THREE.Group {
  const plant = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -1.1, 0),
    new THREE.Vector3(0.04, -0.55, 0.02),
    new THREE.Vector3(-0.03, 0.05, 0),
    new THREE.Vector3(0.02, 0.65, -0.02),
  ]);
  const stem = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 32, 0.032, 8, false),
    new THREE.MeshStandardMaterial({ color: FOLIAGE_HEX, roughness: 0.55, metalness: 0.05 }),
  );
  plant.add(stem);

  const leafGeo = new THREE.ShapeGeometry(leafShape(), 10);
  const leafMat = new THREE.MeshStandardMaterial({
    color: FOLIAGE_HEX,
    roughness: 0.4,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const leafDefs: { pos: [number, number, number]; rot: [number, number, number]; scale: number }[] = [
    { pos: [0.08, 0.1, 0], rot: [0.1, 0.3, -0.7], scale: 0.6 },
    { pos: [-0.1, 0.28, 0.04], rot: [0.1, -0.4, 0.75], scale: 0.75 },
    { pos: [0.06, 0.48, -0.04], rot: [0.15, 0.25, -0.5], scale: 0.9 },
    { pos: [-0.05, 0.63, 0.02], rot: [0.1, -0.2, 0.4], scale: 1 },
  ];
  const leaves = leafDefs.map((d) => {
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(...d.pos);
    leaf.rotation.set(...d.rot);
    leaf.scale.setScalar(d.scale);
    plant.add(leaf);
    return leaf;
  });
  (plant as THREE.Group & { leaves: THREE.Mesh[] }).leaves = leaves;
  return plant;
}

/** the holographic HUD dial — three rings turning on three different axes, same
 * "gyroscope" language as the preloader mark, just rebuilt in real 3D this time */
function buildHudRings(): THREE.Group {
  const group = new THREE.Group();
  const specs: { r: number; tube: number; color: number; opacity: number }[] = [
    { r: 1.05, tube: 0.006, color: SOIL_HEX, opacity: 0.55 },
    { r: 0.8, tube: 0.006, color: SOIL_HEX, opacity: 0.4 },
    { r: 0.56, tube: 0.005, color: BONE_HEX, opacity: 0.3 },
  ];
  specs.forEach((s) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(s.r, s.tube, 8, 96),
      new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: s.opacity }),
    );
    group.add(ring);
  });
  return group;
}

const smallBoxMat = (color: number, opacity = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1, transparent: true, opacity });
const thinLineMat = (color: number, opacity = 0.5) =>
  new THREE.LineBasicMaterial({ color, transparent: true, opacity });

/** one distinct 3D glyph per chapter's `diagram` key — matches the 2D HUD glyph vocabulary
 * already established elsewhere in the site (line chart, bars, tree, map+pin, chat, cascade,
 * equalizer), just built from real geometry instead of SVG this time. */
function buildGlyph(kind: string): THREE.Group {
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, color: number, opacity = 0.85) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), smallBoxMat(color, opacity));
    return m;
  };
  const sphere = (r: number, color: number) =>
    new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), smallBoxMat(color, 0.95));

  switch (kind) {
    case "curve": {
      // ascending line chart: a zigzag line with a sphere at each vertex
      const pts = [
        new THREE.Vector3(-0.6, -0.35, 0),
        new THREE.Vector3(-0.25, -0.1, 0),
        new THREE.Vector3(0.05, -0.2, 0),
        new THREE.Vector3(0.35, 0.15, 0),
        new THREE.Vector3(0.6, 0.4, 0),
      ];
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), thinLineMat(SOIL_HEX, 0.8)));
      pts.forEach((p) => {
        const s = sphere(0.035, SOIL_HEX);
        s.position.copy(p);
        g.add(s);
      });
      break;
    }
    case "provenance": {
      // three stacked status bars: reading / estimate / gap
      const colors = [SOIL_HEX, FOLIAGE_HEX, 0x555f4d];
      colors.forEach((c, i) => {
        const b = box(0.5 - i * 0.08, 0.07, 0.07, c, i === 2 ? 0.35 : 0.85);
        b.position.set(-0.1 + i * 0.04, 0.25 - i * 0.22, 0);
        g.add(b);
      });
      break;
    }
    case "bars": {
      // a small vertical bar chart
      const heights = [0.2, 0.45, 0.3, 0.6, 0.38];
      heights.forEach((h, i) => {
        const b = box(0.09, h, 0.09, SOIL_HEX, i === 3 ? 1 : 0.7);
        b.position.set(-0.4 + i * 0.2, h / 2 - 0.3, 0);
        g.add(b);
      });
      break;
    }
    case "network": {
      // a small node graph: spheres linked by thin lines
      const nodes = [
        new THREE.Vector3(0, 0.35, 0),
        new THREE.Vector3(-0.35, 0, 0.1),
        new THREE.Vector3(0.35, 0, -0.1),
        new THREE.Vector3(-0.2, -0.35, 0),
        new THREE.Vector3(0.25, -0.35, 0.05),
      ];
      const edges: [number, number][] = [[0, 1], [0, 2], [1, 3], [2, 4]];
      edges.forEach(([a, b]) => {
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([nodes[a], nodes[b]]), thinLineMat(FOLIAGE_HEX, 0.6)));
      });
      nodes.forEach((p) => {
        const s = sphere(0.045, SOIL_HEX);
        s.position.copy(p);
        g.add(s);
      });
      break;
    }
    case "plots": {
      // a flat wireframe field grid + one orbiting satellite dot
      const grid = new THREE.GridHelper(1.1, 8, FOLIAGE_HEX, FOLIAGE_HEX);
      (grid.material as THREE.Material & { transparent: boolean; opacity: number }).transparent = true;
      (grid.material as THREE.Material & { transparent: boolean; opacity: number }).opacity = 0.35;
      g.add(grid);
      const sat = sphere(0.045, SOIL_HEX);
      sat.position.set(0.5, 0.2, 0);
      sat.name = "orbitSat";
      g.add(sat);
      break;
    }
    case "chat": {
      // a rounded chat bubble (box) with a small waveform in front
      const bubble = box(0.7, 0.4, 0.05, FOLIAGE_HEX, 0.25);
      g.add(bubble);
      for (let i = 0; i < 7; i++) {
        const h = 0.06 + Math.abs(Math.sin(i * 1.1)) * 0.2;
        const bar = box(0.04, h, 0.04, SOIL_HEX, 0.9);
        bar.position.set(-0.24 + i * 0.08, 0, 0.06);
        g.add(bar);
      }
      break;
    }
    case "cascade": {
      // a small branching fault-tree: one trunk splitting into two branches
      const mat = thinLineMat(FOLIAGE_HEX, 0.65);
      const root = new THREE.Vector3(0, 0.4, 0);
      const mid = new THREE.Vector3(0, 0.05, 0);
      const left = new THREE.Vector3(-0.3, -0.35, 0);
      const right = new THREE.Vector3(0.3, -0.35, 0);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([root, mid]), mat));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([mid, left]), mat));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([mid, right]), mat));
      [root, mid, left, right].forEach((p) => {
        const oct = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), smallBoxMat(SOIL_HEX, 0.9));
        oct.position.copy(p);
        g.add(oct);
      });
      break;
    }
    case "wave": {
      // a ring of thin bars — an equalizer, many languages speaking at once
      const count = 20;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const h = 0.06 + Math.abs(Math.sin(i * 0.9)) * 0.14;
        const bar = box(0.02, h, 0.02, SOIL_HEX, 0.8);
        bar.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0);
        bar.rotation.z = a;
        g.add(bar);
      }
      break;
    }
    default:
      break;
  }
  return g;
}

type Waypoint = { pos: THREE.Vector3; look: THREE.Vector3; fog: THREE.Color; key: number };

/** touch device with a narrow viewport, or a machine reporting few CPU cores — used to skip
 * shadows/DOF and cap resolution rather than making a mobile visitor's fan spin up */
function isLowPower(): boolean {
  if (typeof window === "undefined") return false;
  const touch = window.matchMedia?.("(hover: none), (pointer: coarse)").matches;
  const narrow = window.innerWidth < 820;
  const weakCpu = (navigator.hardwareConcurrency ?? 8) <= 4;
  return Boolean((touch && narrow) || weakCpu);
}

/** set once a real .glb lands in /public/models — until then Scene3D falls back to the
 * procedural plant below. loadModel() (src/lib/loadModel.ts) is already fully wired with
 * DRACO + Meshopt decoding, so dropping a compressed asset in and setting this is the only
 * step needed to swap the placeholder for a real agricultural/terrain/plant model. */
const PLANT_MODEL_URL: string | null = null;

function Scene3D({ progressRef, bands }: { progressRef: RefObject<number>; bands: Band[] }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const lowPower = isLowPower();
    let alive = true;

    const renderer = new THREE.WebGLRenderer({ antialias: !lowPower, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.25 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    // physically-based shadows — skipped entirely on low-power devices, where a shadow map
    // is one of the more expensive things to ask a mobile GPU to do every frame
    renderer.shadowMap.enabled = !lowPower;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const bgColor = new THREE.Color(0x070a06);
    scene.background = bgColor;
    scene.fog = new THREE.FogExp2(0x070a06, 0.16);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);

    // environment lighting — a procedural room lit scene (no external HDR file to host or
    // ship) baked through PMREMGenerator, so the PBR ground/plant materials get real
    // reflection/ambient response instead of flat ambient-only shading
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmrem.dispose();

    const ambient = new THREE.AmbientLight(0x1c2417, 0.6);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffcf8a, 2.4);
    key.position.set(3, 5, 4);
    key.castShadow = !lowPower;
    if (!lowPower) {
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 14;
      key.shadow.camera.left = -4;
      key.shadow.camera.right = 4;
      key.shadow.camera.top = 4;
      key.shadow.camera.bottom = -4;
      key.shadow.bias = -0.0015;
    }
    scene.add(key);
    const rim = new THREE.PointLight(FOLIAGE_HEX, 2.4, 14);
    rim.position.set(-2.4, 1.6, -2.2);
    scene.add(rim);

    // soil ground — a large plane with cheap layered-sine displacement for unevenness
    const groundGeo = new THREE.PlaneGeometry(30, 30, 80, 80);
    const gPos = groundGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < gPos.count; i++) {
      const x = gPos.getX(i);
      const y = gPos.getY(i);
      const h = Math.sin(x * 1.4) * Math.cos(y * 1.7) * 0.05 + Math.sin(x * 4.2 + y * 2.1) * 0.018;
      gPos.setZ(i, h);
    }
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 0.95, metalness: 0.03 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.35;
    ground.receiveShadow = !lowPower;
    scene.add(ground);

    // drifting soil-dust motes — fewer of them on reduced-motion or low-power devices
    const pCount = reduced || lowPower ? 130 : 420;
    const pPos = new Float32Array(pCount * 3);
    const pSpeed = new Float32Array(pCount);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 9;
      pPos[i * 3 + 1] = Math.random() * 4.5 - 1.2;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 7;
      pSpeed[i] = 0.05 + Math.random() * 0.1;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const particles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({
        color: SOIL_HEX,
        size: 0.022,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    scene.add(particles);

    const plant = buildPlant();
    plant.position.y = -1.3;
    plant.traverse((obj) => {
      const mesh = obj as THREE.Mesh & { isMesh?: boolean };
      if (mesh.isMesh) mesh.castShadow = !lowPower;
    });
    scene.add(plant);

    // reusable GLTF/DRACO/Meshopt loading architecture (src/lib/loadModel.ts) — wired and
    // ready, but with no .glb shipped yet, PLANT_MODEL_URL stays null and the procedural
    // plant above is what actually renders. Setting that constant to a real asset path is
    // the only change needed later; the placeholder never disappears if the fetch fails.
    let disposeModel: (() => void) | null = null;
    if (PLANT_MODEL_URL) {
      loadModel(PLANT_MODEL_URL)
        .then(({ scene: modelScene, dispose }) => {
          if (!alive) {
            dispose();
            return;
          }
          plant.visible = false;
          modelScene.position.copy(plant.position);
          scene.add(modelScene);
          disposeModel = () => {
            scene.remove(modelScene);
            dispose();
          };
        })
        .catch(() => {
          /* stays on the procedural placeholder */
        });
    }

    const hud = buildHudRings();
    hud.position.set(0.85, 0.25, -0.4);
    scene.add(hud);

    const glyphs = bands.map((b) => {
      const glyph = buildGlyph(b.diagram);
      glyph.position.set(0.85, 0.25, -0.4);
      glyph.visible = false;
      scene.add(glyph);
      return glyph;
    });

    // camera waypoints: index 0 = the fake-ad hero, 1..N = each honest chapter, then finale
    const warmSky = new THREE.Color(0x3a2c12);
    const dusk = new THREE.Color(0x120e0a);
    const cool = new THREE.Color(0x0a0d12);
    const amber = new THREE.Color(0x241708);
    const waypoints: Waypoint[] = [
      { pos: new THREE.Vector3(0, 0.35, 4.4), look: new THREE.Vector3(0, -0.1, 0), fog: warmSky, key: 0 },
      ...bands.map((b, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        const fog = b.cooler ? cool : i === bands.length - 1 ? amber : dusk;
        return {
          pos: new THREE.Vector3(0.5 * side, 0.15 + (i % 3) * 0.25, 3.2 - i * 0.06),
          look: new THREE.Vector3(-0.15 * side, 0, 0),
          fog,
          key: i + 1,
        };
      }),
    ];
    const finalePos = new THREE.Vector3(0, -0.15, 1.7);
    const finaleLook = new THREE.Vector3(0, -0.6, 0);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.5, 0.72);
    composer.addPass(bloom);
    // depth of field — a light cinematic focus falloff. this is the single costliest pass
    // available here (effectively a second scene render per frame), so low-power devices
    // and reduced-motion skip it entirely rather than keeping every effect regardless of
    // cost; ambient occlusion (SSAO/GTAO) was evaluated and deliberately left out too — this
    // scene is mostly one open soil plane with a handful of small objects on it, so AO would
    // add real per-frame cost for very little visible contact-shadow benefit here.
    const bokeh = !lowPower && !reduced
      ? new BokehPass(scene, camera, { focus: 3.2, aperture: 0.00028, maxblur: 0.006 })
      : null;
    if (bokeh) composer.addPass(bokeh);
    composer.addPass(new OutputPass());

    const resize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      if (bokeh) bokeh.uniforms.aspect.value = w / h;
    };
    resize();
    window.addEventListener("resize", resize);

    const seg = PEEL_END / PEEL_LAYERS;
    const tmpFog = new THREE.Color();
    const tmpPos = new THREE.Vector3();
    const tmpLook = new THREE.Vector3();
    let raf = 0;

    const render = () => {
      if (!alive) return;
      const p = progressRef.current ?? 0;
      const finaleT = clamp01((p - PEEL_END) / (1 - PEEL_END));
      const segF = clamp01(p / PEEL_END) * (waypoints.length - 1);
      const wpIndex = Math.min(waypoints.length - 2, Math.floor(segF));
      const wpT = easeInOut(clamp01(segF - wpIndex));
      const a = waypoints[wpIndex];
      const b = waypoints[wpIndex + 1] ?? a;

      tmpPos.lerpVectors(a.pos, b.pos, wpT);
      tmpLook.lerpVectors(a.look, b.look, wpT);
      tmpFog.lerpColors(a.fog, b.fog, wpT);
      if (finaleT > 0) {
        tmpPos.lerp(finalePos, easeOut(finaleT));
        tmpLook.lerp(finaleLook, easeOut(finaleT));
        tmpFog.lerp(amber, easeOut(finaleT));
      }
      camera.position.copy(tmpPos);
      camera.lookAt(tmpLook);
      (scene.fog as THREE.FogExp2).color.copy(tmpFog);
      scene.background = tmpFog;
      bloom.strength = 0.45 + finaleT * 0.5;
      // rack focus in toward the subject as the finale approaches, rather than a static
      // depth-of-field setting for the whole scroll
      if (bokeh) bokeh.uniforms.focus.value = THREE.MathUtils.lerp(3.2, 1.7, finaleT);

      // active chapter index (0 = hero, 1..N = bands) drives which glyph shows and how
      // grown the plant is — same segment math the text/HUD layer already uses
      const active = p < PEEL_END ? Math.min(bands.length, Math.floor(p / seg)) : bands.length;
      glyphs.forEach((g, i) => (g.visible = i === active - 1));
      hud.visible = active >= 1;

      const growT = active >= 1 ? clamp01((p - seg) / (seg * 0.7) + (active - 1)) : 0;
      const grow = clamp01(growT);
      plant.scale.setScalar(0.15 + easeOut(grow) * 0.85);
      (plant as THREE.Group & { leaves?: THREE.Mesh[] }).leaves?.forEach((leaf, i) => {
        const t = clamp01(grow * 4 - i);
        leaf.scale.setScalar(t);
      });

      const time = performance.now() / 1000;
      hud.children[0]?.rotateOnAxis(new THREE.Vector3(1, 0, 0).normalize(), reduced ? 0 : 0.004);
      hud.children[1]?.rotateOnAxis(new THREE.Vector3(0, 1, 0).normalize(), reduced ? 0 : -0.003);
      hud.children[2]?.rotateOnAxis(new THREE.Vector3(1, 1, 0).normalize(), reduced ? 0 : 0.005);

      const activeGlyph = glyphs[active - 1];
      const sat = activeGlyph?.getObjectByName("orbitSat");
      if (sat) {
        sat.position.set(Math.cos(time * 0.6) * 0.5, Math.sin(time * 0.6) * 0.5, 0);
      }

      if (!reduced) {
        const posAttr = particleGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pCount; i++) {
          let y = posAttr.getY(i) + pSpeed[i] * 0.01;
          if (y > 3.3) y = -1.2;
          posAttr.setY(i, y);
        }
        posAttr.needsUpdate = true;
      }

      composer.render();
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      disposeModel?.();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      });
      envTexture.dispose();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [bands]);

  return <div ref={mountRef} className="absolute inset-0" style={{ zIndex: 5 }} />;
}

function Peel() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tickRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const hudLabelRef = useRef<HTMLSpanElement>(null);
  const hudPctRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const finaleWrapRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const finaleTextRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  // the smoothed 0..1 scroll progress, shared with Scene3D so its own render loop can read
  // it every frame without needing a React re-render
  const progressRef = useRef(0);

  const layers: { key: string; render: () => JSX.Element }[] = [
    { key: SKIN, render: () => <SkinContent /> },
    ...BANDS.map((b) => ({
      key: b.file,
      render: () => <BandContent band={b} />,
    })),
  ];
  const N = layers.length;

  // Everything animates imperatively via refs — no React re-render during scroll. A single
  // ScrollTrigger owns progress, scrubbed 1:1 (scrub: true, not a numeric duration) so every
  // visual here — including the Three.js camera, which reads progressRef every frame — stays
  // strictly tied to where the scrollbar actually is, with no autoplay/timer-based easing of
  // its own. When the user stops scrolling, GSAP stops calling onUpdate and nothing moves.
  // gsap.context() scopes every ScrollTrigger/tween created inside it to this component, so
  // a single ctx.revert() on unmount tears all of it down correctly.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const ctx = gsap.context(() => {
      const seg = PEEL_END / PEEL_LAYERS;
      let activeNow = -1;

      const setActive = (active: number) => {
        if (active === activeNow) return;
        activeNow = active;
        tickRefs.current.forEach((t, i) => {
          if (!t) return;
          gsap.set(t, {
            width: i === active ? 34 : 16,
            backgroundColor: i === active ? "var(--soil)" : "oklch(1 0 0 / 22%)",
          });
        });
      };

      const apply = (p: number) => {
        progressRef.current = p;
        const finaleT = clamp01((p - PEEL_END) / (1 - PEEL_END));
        const active = p < PEEL_END ? Math.min(N - 1, Math.floor(p / seg)) : N - 1;
        setActive(active);

        // the holographic reveal (text slide + HUD spin-in + badges orbit) is CSS-driven; the
        // 3D scene behind it reads progressRef directly in its own render loop, so all this
        // loop needs to do is mark the active band revealed and fade the text group with the finale
        for (let i = 0; i < N; i++) {
          const isSoil = i === N - 1;
          const segStart = i * seg;
          const u = clamp01((p - segStart) / seg);

          const cont = contentRefs.current[i];
          if (cont) {
            const isActive = i === active;
            // band 0 (the hero skin) is revealed from the very first frame — nothing to scroll for yet
            const revealMin = i === 0 ? 0 : 0.12;
            const reveal = isActive && u >= revealMin && (isSoil ? finaleT < 0.35 : u < 0.9);
            cont.classList.toggle("is-revealed", reveal);
            const groupOp = isSoil ? clamp01(1 - (finaleT - 0.12) / 0.2) : 1;
            gsap.set(cont, {
              opacity: isActive ? groupOp : 0,
              visibility: isActive ? "visible" : "hidden",
              pointerEvents: isActive && groupOp > 0.6 ? "auto" : "none",
            });
          }
        }

        if (hudPctRef.current)
          hudPctRef.current.textContent = String(Math.round(p * 100)).padStart(2, "0") + "%";
        if (hudLabelRef.current) hudLabelRef.current.textContent = p < seg ? "Scroll" : "Turn";
        if (barRef.current) gsap.set(barRef.current, { width: `${p * 100}%` });

        // finale
        const fWrap = finaleWrapRef.current;
        if (fWrap) {
          gsap.set(fWrap, { visibility: finaleT <= 0.001 ? "hidden" : "visible" });
          const show = easeOut(clamp01((finaleT - 0.15) / 0.55));
          const ctaIn = easeOut(clamp01((finaleT - 0.45) / 0.4));
          if (glowRef.current) gsap.set(glowRef.current, { opacity: 0.12 + show * 0.28 });
          if (gridRef.current) gsap.set(gridRef.current, { opacity: show * 0.5 });
          if (finaleTextRef.current) {
            gsap.set(finaleTextRef.current, { opacity: show, y: (1 - show) * 30 });
          }
          if (ctaRef.current) {
            gsap.set(ctaRef.current, {
              opacity: ctaIn,
              y: (1 - ctaIn) * 20,
              pointerEvents: ctaIn > 0.5 ? "auto" : "none",
            });
          }
        }
      };

      const trigger = ScrollTrigger.create({
        trigger: wrap,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => apply(self.progress),
        onRefresh: (self) => apply(self.progress),
      });

      apply(trigger.progress);
    }, wrapRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={wrapRef}
      className="relative"
      style={{ height: `${(PEEL_LAYERS + 3) * 100}vh` }}
    >
      <div
        className="sticky top-0 h-screen w-full overflow-hidden bg-background"
        style={{ perspective: "1600px", perspectiveOrigin: "50% 50%" }}
      >
        {/* soft void the card turns within */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            zIndex: 0,
            background:
              "radial-gradient(60% 55% at 50% 45%, oklch(0.13 0.02 150) 0%, oklch(0.055 0.01 150) 70%)",
          }}
        />
        {/* ---- 3D scene ---- */}
        <Scene3D progressRef={progressRef} bands={BANDS} />
        {/* vignette so the text stack stays legible over the 3D scene regardless of which
            side it's on — the scene's own fog is already dark, so this just needs to hold
            the edges and bottom down a little further, not fight a bright sky like the old
            video footage did */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            zIndex: 10,
            background: "radial-gradient(120% 100% at 50% 55%, transparent 45%, oklch(0.04 0.01 150 / 0.55) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{ zIndex: 10, background: "linear-gradient(to top, oklch(0.04 0.01 150 / 0.7), transparent)" }}
        />

        {/* ---- stable text stack ---- */}
        {layers.map((layer, i) => (
          <div
            key={`c-${layer.key}`}
            ref={(el) => {
              contentRefs.current[i] = el;
            }}
            className="absolute inset-0 flex items-center px-6 sm:px-10"
            style={{ zIndex: 30, opacity: 0, visibility: "hidden", willChange: "transform, opacity" }}
          >
            <div className="mx-auto w-full max-w-[1400px]">{layer.render()}</div>
          </div>
        ))}

        {/* ---- soil finale ---- */}
        <div ref={finaleWrapRef} className="pointer-events-none absolute inset-0 z-40" style={{ visibility: "hidden" }}>
          <div
            ref={glowRef}
            className="absolute inset-0"
            style={{
              background: "radial-gradient(70% 55% at 50% 78%, var(--soil) 0%, transparent 60%)",
              opacity: 0,
              mixBlendMode: "screen",
            }}
          />
          <div
            ref={gridRef}
            className="absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background:
                "repeating-linear-gradient(90deg, transparent 0 46px, oklch(0.72 0.11 75 / 18%) 46px 47px)",
              opacity: 0,
              maskImage: "linear-gradient(to top, black, transparent)",
              WebkitMaskImage: "linear-gradient(to top, black, transparent)",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div ref={finaleTextRef} className="relative mx-auto max-w-[1400px] text-center" style={{ opacity: 0 }}>
              <p className="eyebrow mb-5 text-soil">The whole point</p>
              <h2 className="text-balance-tight font-display text-[2.6rem] font-semibold text-bone sm:text-[4.5rem]">
                For the ground <span className="text-soil">under it.</span>
              </h2>
              <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-bone/65">
                Everyone else sells you a perfect picture. TerraLearn shows you the real ground —
                readings, honest gaps, and the network already there.
              </p>
              <div ref={ctaRef} className="mt-10" style={{ opacity: 0 }}>
                <a
                  href="/sign-up"
                  className="group inline-flex items-center gap-2 rounded-full bg-soil px-8 py-4 text-sm font-semibold text-primary-foreground transition-shadow hover:shadow-[0_0_50px_-10px_var(--color-soil)]"
                >
                  Enter TerraLearn
                  <svg className="size-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* HUD */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 px-6 pb-8 sm:px-10">
          <div className="mx-auto flex max-w-[1400px] items-end justify-between">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-bone/45">
              <span ref={hudLabelRef}>Scroll</span>
              <span
                className="h-6 w-px bg-soil/70"
                style={{ animation: "terra-drift 2.6s ease-in-out infinite" }}
              />
              <span ref={hudPctRef}>00%</span>
            </div>
            <div className="hidden items-center gap-1.5 sm:flex">
              {layers.map((_, i) => (
                <span
                  key={i}
                  ref={(el) => {
                    tickRefs.current[i] = el;
                  }}
                  className="h-px transition-all duration-300"
                  style={{
                    width: i === 0 ? 34 : 16,
                    background: i === 0 ? "var(--soil)" : "oklch(1 0 0 / 22%)",
                  }}
                />
              ))}
            </div>
          </div>
          <div className="mx-auto mt-5 h-px max-w-[1400px] bg-hairline">
            <div ref={barRef} className="h-px bg-soil" style={{ width: "0%" }} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----- the fake marketing "skin" that gets torn off ----- */
function SkinContent() {
  return (
    <div className="text-center sm:text-left">
      <p className="eyebrow mb-5 text-emerald-900/70">Sponsored · the fantasy</p>
      <h1
        className="text-balance-tight font-display text-[3rem] font-bold text-emerald-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.5)] sm:text-[5.5rem]"
        style={{ textShadow: "0 2px 30px rgba(255,255,255,0.35)" }}
      >
        The perfect harvest.™
      </h1>
      <p className="mt-6 max-w-xl text-lg font-semibold text-emerald-950/80">
        Guaranteed yields. Flawless soil. Zero risk. Every season, effortlessly.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {["+34% YIELD ✓", "PERFECT SOIL ✓", "PRICE GUARANTEED ✓"].map((b) => (
          <span
            key={b}
            className="rounded-full border border-emerald-900/20 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-wide text-emerald-800 shadow-sm backdrop-blur"
          >
            {b}
          </span>
        ))}
      </div>
      <p className="mt-10 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-emerald-950/60">
        Scroll — tear it off
        <span className="inline-block" style={{ animation: "terra-bob 1.8s ease-in-out infinite" }}>
          ↓
        </span>
      </p>
    </div>
  );
}

/* ----- botanical feature reveal for each band ----- */
function BandContent({ band }: { band: Band }) {
  const isHero = band.index === "01";
  const badges = BAND_BADGES[band.index] ?? BAND_BADGES["01"];
  const shape = PETAL_SHAPE[band.index] ?? "leaf";
  // alternate which side the text sits on per chapter — the hero always opens on the left,
  // then every even chapter mirrors so the page never reads as one column repeated eight times
  const isRight = Number(band.index) % 2 === 0;
  // market's text arrives with a focus-pull (scale + blur) instead of the slide every other
  // chapter uses — pairs with that chapter's video wipe so the whole handoff reads as distinct
  const zoomReveal = band.index === "03";
  return (
    <div
      className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)]"
      style={isRight ? { direction: "rtl" } : undefined}
    >
      {/* each block cascades in on its own delay — never one slab moving together */}
      <div
        className={`reveal-text max-w-2xl ${isRight ? "reveal-text-right" : ""} ${zoomReveal ? "reveal-text-zoom" : ""}`}
        style={isRight ? { direction: "ltr" } : undefined}
      >
        {isHero && (
          <div className="reveal-stagger" style={{ transitionDelay: "0.05s" }}>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-soil">
              For the ground under it
            </p>
            <h1 className="text-balance-tight mb-8 font-display text-[3.1rem] font-semibold text-bone sm:text-[4.8rem]">
              Real data.
              <br />
              Honest ground.
              <br />
              <span className="text-foliage">One pocket.</span>
            </h1>
          </div>
        )}

        <div className="reveal-stagger mb-5 flex flex-wrap items-center gap-4" style={{ transitionDelay: isHero ? "0.22s" : "0.05s" }}>
          <span className="font-mono text-[13px] tracking-[0.22em] text-soil">{band.index}</span>
          <span className="h-px w-11 bg-soil/60" />
          <span className="font-mono text-[13px] uppercase tracking-[0.22em] text-bone/60">
            {band.kicker}
          </span>
          <StatusTag status={band.status} />
          <ProvenanceChip chip={band.chip} />
        </div>

        <h2
          className="reveal-stagger text-balance-tight font-display text-[2.2rem] font-semibold text-bone drop-shadow-[0_2px_16px_rgba(0,0,0,0.55)] sm:text-[3.4rem]"
          style={{ transitionDelay: isHero ? "0.3s" : "0.13s" }}
        >
          {band.title}
        </h2>

        <p
          className="reveal-stagger mt-6 max-w-lg text-[17px] leading-relaxed text-bone/80 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] sm:text-[18px]"
          style={{ transitionDelay: isHero ? "0.38s" : "0.21s" }}
        >
          {band.body}
        </p>

        <ul className="mt-7 space-y-2.5">
          {band.points.map((pt, i) => (
            <li
              key={pt}
              className="reveal-stagger flex items-center gap-3 text-[15px] text-bone/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]"
              style={{ transitionDelay: `${(isHero ? 0.46 : 0.29) + i * 0.07}s` }}
            >
              <span
                className={`size-1.5 rotate-45 ${band.status === "LIVE" ? "bg-soil" : "bg-foliage"}`}
              />
              {pt}
            </li>
          ))}
        </ul>
      </div>

      {/* drifting growth ring with feature petals blooming in */}
      <div
        className="relative mx-auto hidden aspect-square w-full max-w-[540px] lg:block"
        style={isRight ? { direction: "ltr" } : undefined}
      >
        <div className="bloom-wrap absolute inset-[8%]">
          <BloomRing variant={band.index} />
        </div>
        {badges.map(({ icon: Icon, label }, i) => {
          const pos = badgePos(BADGE_ANGLES[i % BADGE_ANGLES.length]);
          return (
            <div
              key={i}
              className="orbit-badge group absolute size-14 hover:z-30"
              style={{ left: pos.left, top: pos.top, transitionDelay: `${0.15 + i * 0.09}s`, animationDelay: `${i * 0.4}s` }}
            >
              <PetalShell shape={shape}>
                <Icon className="size-6 text-soil transition-transform duration-300 group-hover:scale-110" strokeWidth={1.6} />
              </PetalShell>
              <div className="badge-tip pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-soil/40 bg-background/95 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-bone opacity-0 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)] transition-all duration-200 group-hover:opacity-100 group-hover:-translate-y-1">
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProvenanceChip({ chip }: { chip: Chip }) {
  const map: Record<Chip, string> = {
    READING: "border-soil/40 bg-soil/10 text-soil",
    ESTIMATE: "border-foliage/40 bg-foliage/10 text-foliage",
    GAP: "border-bone/25 bg-bone/5 text-bone/55",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] font-mono text-[9px] tracking-[0.18em] ${map[chip]}`}
    >
      {chip === "GAP" ? "GAP — NO SILENT GUESS" : chip}
    </span>
  );
}

function StatusTag({ status }: { status: "LIVE" | "VISION" }) {
  const live = status === "LIVE";
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] font-mono text-[9px] tracking-[0.18em]",
        live ? "border-soil/40 bg-soil/10 text-soil" : "border-foliage/40 bg-foliage/10 text-foliage",
      ].join(" ")}
    >
      <span className={`size-1 rounded-full ${live ? "bg-soil" : "bg-foliage"}`} />
      {status}
    </span>
  );
}

/* ----- the payoff: data glowing out of honest ground ----- */
function Footer() {
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        footer,
        { opacity: 0.4, y: 36 },
        {
          opacity: 1,
          y: 0,
          ease: "none",
          scrollTrigger: { trigger: footer, start: "top 92%", end: "top 55%", scrub: true },
        },
      );
    }, footerRef);
    return () => ctx.revert();
  }, []);

  return (
    <footer ref={footerRef} className="relative z-10 border-t border-hairline bg-background px-6 py-14 sm:px-10">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="size-2.5 rotate-45 border border-soil bg-soil/30" />
            <span className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-bone">
              TerraLearn
            </span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Real readings, honest gaps, and a network that already exists on the ground.
          </p>
        </div>
        <a
          href="/sign-up"
          className="group inline-flex items-center gap-2 self-start rounded-full bg-soil px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-shadow hover:shadow-[0_0_40px_-12px_var(--color-soil)]"
        >
          Enter TerraLearn
          <svg
            className="size-4 transition-transform group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </a>
      </div>
    </footer>
  );
}
