import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Sprout,
  LineChart,
  Droplets,
  Globe,
  Leaf,
  ShieldCheck,
  Database,
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
  Bot,
  Zap,
  Waves,
  Languages,
  FileText,
  Thermometer,
  Truck,
  Sun,
  type LucideIcon,
} from "lucide-react";

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
const VID = (name: string) => `/bands/${name}.mp4`;

// Scroll layout: the fake skin + 8 honest layers peel; the last (soil) stays for the finale.
const PEEL_LAYERS = BANDS.length; // skin + first 7 honest layers peel away; soil holds
const PEEL_END = 0.8; // fraction of scroll spent peeling; rest is the soil finale

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (n: number) => 1 - Math.pow(1 - clamp01(n), 3);
const easeInOut = (n: number) =>
  clamp01(n) < 0.5 ? 2 * n * n : 1 - Math.pow(-2 * n + 2, 2) / 2;

// feature-icon badges that orbit into each band's holographic reveal — each one carries a
// short label explaining what it represents, shown on hover instead of leaving the icon unexplained
type Badge = { icon: LucideIcon; label: string };
const BAND_BADGES: Record<string, Badge[]> = {
  "01": [
    { icon: Sprout, label: "Crop growth stage" },
    { icon: LineChart, label: "Yield forecast curve" },
    { icon: Droplets, label: "Soil moisture signal" },
    { icon: Globe, label: "Regional climate data" },
    { icon: Leaf, label: "Crop health index" },
  ],
  "02": [
    { icon: ShieldCheck, label: "Verified reading" },
    { icon: Database, label: "Raw data source" },
    { icon: LineChart, label: "Model estimate" },
    { icon: Leaf, label: "Field-level accuracy" },
    { icon: Globe, label: "No silent fallback" },
  ],
  "03": [
    { icon: LineChart, label: "Agmarknet price history" },
    { icon: Store, label: "Local mandi listings" },
    { icon: TrendingUp, label: "Live demand trend" },
    { icon: Users, label: "Buyer network" },
    { icon: Globe, label: "Market-wide view" },
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
    { icon: Globe, label: "Multi-farm view" },
    { icon: Leaf, label: "IFS loop overlay" },
  ],
  "06": [
    { icon: MessageSquare, label: "Plain-language chat" },
    { icon: Mic, label: "Voice input" },
    { icon: Send, label: "Draft-and-confirm send" },
    { icon: Bot, label: "Memory-aware agent" },
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
    { icon: Leaf, label: "Leaf disease scanner" },
  ],
  "08": [
    { icon: Languages, label: "Multilingual voice" },
    { icon: Mic, label: "Speak, don't type" },
    { icon: FileText, label: "AgriStack auto-fill" },
    { icon: Sprout, label: "Traceable crop ledger" },
    { icon: Leaf, label: "Insurance claim help" },
  ],
};

// each chapter's badges use a different container silhouette — never a plain circle by default
type BadgeShape = "tile" | "pill" | "hex" | "diamond" | "map" | "bubble" | "shield" | "drop";
const BADGE_SHAPE: Record<string, BadgeShape> = {
  "01": "tile",
  "02": "pill",
  "03": "hex",
  "04": "diamond",
  "05": "map",
  "06": "bubble",
  "07": "shield",
  "08": "drop",
};
const badgeOuterSize = (shape: BadgeShape) => (shape === "pill" ? "h-12 w-20" : "size-14");

/** the visual shell for one badge — shape varies per chapter, brightens and glows on hover */
function BadgeShell({ shape, children }: { shape: BadgeShape; children: JSX.Element }) {
  const base =
    "flex size-full items-center justify-center border border-bone/15 bg-background/70 backdrop-blur-sm transition-all duration-300 group-hover:border-soil group-hover:bg-background/95 group-hover:shadow-[0_0_26px_-2px_var(--color-soil)] group-hover:[filter:brightness(1.3)]";
  const shadow = { boxShadow: "0 10px 30px -12px oklch(0 0 0 / 0.7)" };
  switch (shape) {
    case "pill":
    case "map":
      return <div className={`${base} ${shape === "map" ? "rounded-[10%]" : "rounded-full"}`} style={shadow}>{children}</div>;
    case "hex":
      return <div className={`${base} badge-hex`} style={shadow}>{children}</div>;
    case "shield":
      return <div className={`${base} badge-shield`} style={shadow}>{children}</div>;
    case "bubble":
      return <div className={base} style={{ ...shadow, borderRadius: "18px 18px 18px 4px" }}>{children}</div>;
    case "diamond":
      return (
        <div className="size-full rotate-45" style={shadow}>
          <div className={`${base} rounded-md`}>
            <div className="-rotate-45">{children}</div>
          </div>
        </div>
      );
    case "drop":
      return (
        <div className="size-full -rotate-45" style={shadow}>
          <div className={base} style={{ borderRadius: "42% 42% 42% 4%" }}>
            <div className="rotate-45">{children}</div>
          </div>
        </div>
      );
    default:
      return <div className={`${base} rounded-[26%]`} style={shadow}>{children}</div>;
  }
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

/** shared backing panel every glyph sits on, for contrast against bright footage */
function GlyphPanel({ tint = "var(--soil)" }: { tint?: string }) {
  return <rect x="56" y="56" width="88" height="88" rx="12" fill="oklch(0.05 0.01 150 / 0.68)" stroke={tint} strokeOpacity="0.45" strokeWidth="1" />;
}

/** the rotating holographic housing shared by every chapter — three rings, three speeds, boosted for visibility */
function DialHousing() {
  const ticks = Array.from({ length: 60 }, (_, i) => i);
  return (
    <>
      <svg viewBox="0 0 200 200" className="hud-spin-a absolute inset-0 size-full">
        <circle cx="100" cy="100" r="92" fill="none" stroke="var(--soil)" strokeOpacity="0.65" strokeWidth="0.8" />
        <circle cx="100" cy="100" r="86" fill="none" stroke="var(--bone)" strokeOpacity="0.22" strokeWidth="0.6" />
        {ticks.map((i) => {
          const a = (i / 60) * 360;
          const long = i % 5 === 0;
          const p1 = polar(long ? 78 : 82, a);
          const p2 = polar(86, a);
          return (
            <line
              key={i}
              x1={fx(p1.x)}
              y1={fx(p1.y)}
              x2={fx(p2.x)}
              y2={fx(p2.y)}
              stroke="var(--soil)"
              strokeOpacity={long ? 0.85 : 0.5}
              strokeWidth={long ? 1.1 : 0.7}
            />
          );
        })}
      </svg>
      <svg viewBox="0 0 200 200" className="hud-spin-b absolute inset-0 size-full">
        <circle cx="100" cy="100" r="66" fill="none" stroke="var(--soil)" strokeOpacity="0.4" strokeWidth="0.9" strokeDasharray="2 4" />
      </svg>
    </>
  );
}

/** per-chapter signature glyph — a distinct chart/diagram shape, static so it stays readable while the housing spins */
const HUD_GLYPHS: Record<string, () => JSX.Element> = {
  // 01 · Yield — an ascending line chart with area fill
  "01": () => (
    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
      <GlyphPanel />
      <line x1="64" y1="72" x2="136" y2="72" stroke="var(--bone)" strokeOpacity="0.15" strokeWidth="0.6" />
      <line x1="64" y1="96" x2="136" y2="96" stroke="var(--bone)" strokeOpacity="0.15" strokeWidth="0.6" />
      <line x1="64" y1="120" x2="136" y2="120" stroke="var(--bone)" strokeOpacity="0.15" strokeWidth="0.6" />
      <path d="M64 122 L86 106 L104 110 L122 84 L138 66 L138 132 L64 132 Z" fill="var(--soil)" opacity="0.18" />
      <path d="M64 122 L86 106 L104 110 L122 84 L138 66" fill="none" stroke="var(--soil)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      {[[64, 122], [86, 106], [104, 110], [122, 84], [138, 66]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.8" fill="var(--soil)" />
      ))}
    </svg>
  ),
  // 02 · Honesty — three status bars, one per provenance state (reading / estimate / gap)
  "02": () => (
    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
      <GlyphPanel />
      <circle cx="68" cy="76" r="3.2" fill="var(--soil)" />
      <rect x="78" y="72" width="56" height="8" rx="4" fill="var(--soil)" opacity="0.9" />
      <circle cx="68" cy="100" r="3.2" fill="var(--foliage)" />
      <rect x="78" y="96" width="40" height="8" rx="4" fill="var(--foliage)" opacity="0.85" />
      <circle cx="68" cy="124" r="3.2" fill="var(--bone)" opacity="0.6" />
      <rect x="78" y="120" width="56" height="8" rx="4" fill="none" stroke="var(--bone)" strokeOpacity="0.55" strokeWidth="1.4" strokeDasharray="3 3" />
    </svg>
  ),
  // 03 · Market — a vertical bar chart on a baseline
  "03": () => (
    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
      <GlyphPanel />
      <line x1="64" y1="128" x2="136" y2="128" stroke="var(--bone)" strokeOpacity="0.3" strokeWidth="0.9" />
      {[14, 26, 18, 34, 22, 30].map((h, i) => {
        const x = 68 + i * 11;
        return <rect key={i} x={x} y={128 - h} width="6" height={h} rx="1.5" fill="var(--soil)" opacity={i === 3 ? 0.95 : 0.75} />;
      })}
    </svg>
  ),
  // 04 · Saath — a small linked tree, neighbouring plots trading with each other
  "04": () => (
    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
      <GlyphPanel />
      <line x1="100" y1="68" x2="78" y2="94" stroke="var(--soil)" strokeOpacity="0.75" strokeWidth="1.3" />
      <line x1="100" y1="68" x2="122" y2="94" stroke="var(--soil)" strokeOpacity="0.75" strokeWidth="1.3" />
      <line x1="78" y1="94" x2="66" y2="120" stroke="var(--foliage)" strokeOpacity="0.65" strokeWidth="1.1" />
      <line x1="78" y1="94" x2="90" y2="122" stroke="var(--foliage)" strokeOpacity="0.65" strokeWidth="1.1" />
      <line x1="122" y1="94" x2="110" y2="122" stroke="var(--foliage)" strokeOpacity="0.65" strokeWidth="1.1" />
      <line x1="122" y1="94" x2="134" y2="120" stroke="var(--foliage)" strokeOpacity="0.65" strokeWidth="1.1" />
      <circle cx="100" cy="68" r="4.2" fill="var(--soil)" />
      <circle cx="78" cy="94" r="3.4" fill="var(--soil)" opacity="0.95" />
      <circle cx="122" cy="94" r="3.4" fill="var(--soil)" opacity="0.95" />
      {[[66, 120], [90, 122], [110, 122], [134, 120]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.8" fill="var(--foliage)" />
      ))}
    </svg>
  ),
  // 05 · Ground truth — a mapped plot boundary with a location pin
  "05": () => (
    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
      <GlyphPanel />
      <line x1="100" y1="60" x2="100" y2="140" stroke="var(--bone)" strokeOpacity="0.12" strokeWidth="0.6" />
      <line x1="60" y1="100" x2="140" y2="100" stroke="var(--bone)" strokeOpacity="0.12" strokeWidth="0.6" />
      <polygon points="70,116 92,70 132,84 116,132" fill="var(--soil)" fillOpacity="0.14" stroke="var(--soil)" strokeOpacity="0.85" strokeWidth="1.6" />
      <circle cx="106" cy="90" r="7" fill="none" stroke="var(--soil)" strokeWidth="2" />
      <circle cx="106" cy="90" r="2.6" fill="var(--soil)" />
      <line x1="106" y1="97" x2="106" y2="116" stroke="var(--soil)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  // 06 · Assistant — a chat bubble with a voice waveform inside it
  "06": () => (
    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
      <GlyphPanel tint="var(--foliage)" />
      <rect x="64" y="76" width="72" height="40" rx="14" fill="oklch(0.05 0.01 150 / 0.4)" stroke="var(--foliage)" strokeOpacity="0.7" strokeWidth="1.5" />
      <path d="M76 116 L76 128 L90 116 Z" fill="oklch(0.05 0.01 150 / 0.4)" stroke="var(--foliage)" strokeOpacity="0.7" strokeWidth="1.5" strokeLinejoin="round" />
      {Array.from({ length: 9 }, (_, i) => i).map((i) => {
        const x = 74 + i * 7;
        const h = 4 + 12 * Math.abs(Math.sin(i * 1.1));
        return <line key={i} x1={x} y1={96 - h / 2} x2={x} y2={96 + h / 2} stroke="var(--soil)" strokeOpacity="0.95" strokeWidth="2.2" strokeLinecap="round" />;
      })}
    </svg>
  ),
  // 07 · Cascade — one shock (the root) fans out through 4 branches into all 8 downstream factors
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
        <GlyphPanel tint="var(--foliage)" />
        {/* root -> branch spine */}
        <path d="M100 62 L100 78" fill="none" stroke="var(--foliage)" strokeOpacity="0.75" strokeWidth="1.3" />
        <path d="M67 78 L133 78" fill="none" stroke="var(--foliage)" strokeOpacity="0.55" strokeWidth="1" />
        {branchX.map((x) => (
          <line key={`s${x}`} x1={x} y1="78" x2={x} y2="92" stroke="var(--foliage)" strokeOpacity="0.65" strokeWidth="1" />
        ))}
        {/* branch -> each of its 2 factor leaves */}
        {branchX.map((bx, i) =>
          leafPairs[i].map((lx) => (
            <line key={`l${bx}-${lx}`} x1={bx} y1="92" x2={lx} y2="108" stroke="var(--soil)" strokeOpacity="0.55" strokeWidth="0.9" />
          )),
        )}
        {/* the one shock */}
        <rect x="96" y="58" width="8" height="8" fill="var(--soil)" transform="rotate(45 100 62)" />
        {/* 4 branch nodes */}
        {branchX.map((x) => (
          <rect key={`b${x}`} x={x - 3} y="75" width="6" height="6" fill="var(--foliage)" opacity="0.85" transform={`rotate(45 ${x} 78)`} />
        ))}
        {/* all 8 downstream factors */}
        {leafPairs.flat().map((x) => (
          <rect key={`f${x}`} x={x - 2.6} y="105.4" width="5.2" height="5.2" fill="var(--soil)" opacity="0.9" transform={`rotate(45 ${x} 108)`} />
        ))}
      </svg>
    );
  },
  // 08 · Soil / voice — a horizontal equalizer, many languages speaking, rising into the finale glow
  "08": () => (
    <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
      <GlyphPanel />
      {Array.from({ length: 13 }, (_, i) => i).map((i) => {
        const x = 62 + i * 6.2;
        const h = 6 + 22 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.31));
        return <line key={i} x1={x} y1={100 - h / 2} x2={x} y2={100 + h / 2} stroke="var(--soil)" strokeOpacity="0.9" strokeWidth="2.2" strokeLinecap="round" />;
      })}
      <circle cx="118" cy="70" r="1.8" fill="var(--soil)" opacity="0.85" />
      <circle cx="128" cy="62" r="1.4" fill="var(--soil)" opacity="0.6" />
      <circle cx="136" cy="56" r="1.1" fill="var(--soil)" opacity="0.4" />
    </svg>
  ),
};

/** A holographic tech dial — a rotating ring housing framing a static, per-chapter chart glyph. */
function HudRing({ variant }: { variant: string }) {
  const Glyph = HUD_GLYPHS[variant] ?? HUD_GLYPHS["01"];
  return (
    <div className="absolute inset-0">
      <DialHousing />
      <Glyph />
      {/* static center */}
      <div className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-soil shadow-[0_0_20px_var(--color-soil)]" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(38% 38% at 50% 50%, oklch(0.72 0.11 75 / 0.22), transparent 70%)" }}
      />
    </div>
  );
}

function Landing() {
  return (
    <main className="relative bg-background">
      <Preloader />
      <Header />
      <Peel />
      <Footer />
    </main>
  );
}

// seeds fling outward from the rings as they spin, staggered so they never fire in unison
const SEED_SPECS: { angle: number; r0: number; delay: number; color: "soil" | "foliage" }[] = [
  { angle: -100, r0: 20, delay: 0.0, color: "soil" },
  { angle: -40, r0: 34, delay: 0.25, color: "foliage" },
  { angle: 10, r0: 44, delay: 0.5, color: "soil" },
  { angle: 60, r0: 20, delay: 0.75, color: "soil" },
  { angle: 120, r0: 34, delay: 1.0, color: "foliage" },
  { angle: 170, r0: 44, delay: 1.25, color: "soil" },
  { angle: -150, r0: 34, delay: 1.5, color: "soil" },
];

function PreloaderSeeds() {
  return (
    <>
      {SEED_SPECS.map((s, i) => {
        const rad = (s.angle * Math.PI) / 180;
        const x0 = Math.cos(rad) * s.r0;
        const y0 = Math.sin(rad) * s.r0;
        const x1 = Math.cos(rad) * (s.r0 + 34);
        const y1 = Math.sin(rad) * (s.r0 + 34);
        return (
          <span
            key={i}
            className={`preloader-seed absolute left-1/2 top-1/2 block size-1.5 rounded-full ${s.color === "soil" ? "bg-soil" : "bg-foliage"}`}
            style={{
              "--seed-x0": `${x0.toFixed(1)}px`,
              "--seed-y0": `${y0.toFixed(1)}px`,
              "--seed-x1": `${x1.toFixed(1)}px`,
              "--seed-y1": `${y1.toFixed(1)}px`,
              animationDelay: `${s.delay.toFixed(2)}s`,
              boxShadow: `0 0 6px ${s.color === "soil" ? "var(--color-soil)" : "var(--color-foliage)"}`,
            } as CSSProperties}
          />
        );
      })}
    </>
  );
}

/** boot screen — counts up while the first clip warms up, then fades to reveal the film */
function Preloader() {
  const [percent, setPercent] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const duration = reduced ? 350 : 1500;
    const start = performance.now();
    let raf = 0;
    let doneTimer = 0;
    let goneTimer = 0;

    const tick = (now: number) => {
      const t = clamp01((now - start) / duration);
      setPercent(Math.round(easeOut(t) * 100));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        doneTimer = window.setTimeout(() => {
          setHidden(true);
          document.documentElement.style.overflow = prevOverflow;
          goneTimer = window.setTimeout(() => setGone(true), 700);
        }, 200);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(doneTimer);
      window.clearTimeout(goneTimer);
      document.documentElement.style.overflow = prevOverflow;
    };
  }, []);

  if (gone) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-700 ease-out"
      style={{ opacity: hidden ? 0 : 1, pointerEvents: hidden ? "none" : "auto" }}
    >
      <div className="relative size-24" style={{ perspective: "600px" }}>
        <div className="preloader-ring-a absolute inset-0 rounded-full border-2 border-soil/60" />
        <div className="preloader-ring-b absolute inset-2 rounded-full border-2 border-soil/50" />
        <div className="preloader-ring-c absolute inset-6 rounded-full border-2 border-bone/40" />
        <PreloaderSeeds />
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="transition-transform duration-300 ease-out"
            style={{ transform: `scale(${(0.82 + (percent / 100) * 0.22).toFixed(3)})` }}
          >
            <span className="preloader-mark block size-3 border border-soil bg-soil/40" />
          </span>
        </div>
      </div>
      <p className="mt-7 font-display text-sm font-semibold uppercase tracking-[0.3em] text-bone">TerraLearn</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-bone/45">Loading honest ground</p>
      <div className="mt-6 h-px w-40 bg-hairline">
        <div className="h-px bg-soil transition-[width] duration-150 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-3 font-mono text-[11px] tracking-[0.2em] text-soil">{String(percent).padStart(2, "0")}%</p>
    </div>
  );
}

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-[60] px-6 py-5 sm:px-10">
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

function Peel() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const tickRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const hudLabelRef = useRef<HTMLSpanElement>(null);
  const hudPctRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const finaleWrapRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const finaleTextRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const layers: { key: string; video: string; render: () => JSX.Element }[] = [
    { key: SKIN, video: VID(SKIN), render: () => <SkinContent /> },
    ...BANDS.map((b) => ({
      key: b.file,
      video: VID(b.file),
      render: () => <BandContent band={b} />,
    })),
  ];
  const N = layers.length;

  // Everything animates imperatively via refs — no React re-render during scroll.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const seg = PEEL_END / PEEL_LAYERS;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const lerp = reduced ? 1 : 0.14;

    let raf = 0;
    let target = 0;
    let current = -1;
    let activeNow = -1;

    const setActive = (active: number) => {
      if (active === activeNow) return;
      activeNow = active;
      videoRefs.current.forEach((v, i) => {
        if (!v) return;
        if (i >= active - 1 && i <= active + 1) v.play?.().catch(() => {});
        else v.pause?.();
      });
      tickRefs.current.forEach((t, i) => {
        if (!t) return;
        t.style.width = i === active ? "34px" : "16px";
        t.style.background = i === active ? "var(--soil)" : "oklch(1 0 0 / 22%)";
      });
    };

    const apply = (p: number) => {
      const finaleT = clamp01((p - PEEL_END) / (1 - PEEL_END));
      const active = p < PEEL_END ? Math.min(N - 1, Math.floor(p / seg)) : N - 1;
      setActive(active);

      for (let i = 0; i < N; i++) {
        const isSoil = i === N - 1;
        const segStart = i * seg;
        const u = clamp01((p - segStart) / seg);

        // video crossfades in/out at the segment edges and zooms slowly through (Ken Burns).
        // band 0 has no predecessor to crossfade from, so it's opaque from the first frame.
        const vIn = i === 0 ? 1 : easeInOut(clamp01(u / 0.14));
        const vOut = isSoil ? 1 : 1 - easeInOut(clamp01((u - 0.86) / 0.14));
        const vOp = Math.min(vIn, vOut);
        const zoom = 1.06 + u * 0.1 + (isSoil ? finaleT * 0.05 : 0);

        const scene = sceneRefs.current[i];
        if (scene) {
          scene.style.opacity = String(vOp);
          scene.style.visibility = vOp < 0.01 ? "hidden" : "visible";
          if (vOp >= 0.01) scene.style.transform = `scale(${zoom.toFixed(3)})`;
        }

        // the holographic reveal (text slide + HUD spin-in + badges orbit) is CSS-driven;
        // we just mark the active band revealed and fade the group with the finale.
        const cont = contentRefs.current[i];
        if (cont) {
          const isActive = i === active;
          // band 0 (the hero skin) is revealed from the very first frame — nothing to scroll for yet
          const revealMin = i === 0 ? 0 : 0.12;
          const reveal = isActive && u >= revealMin && (isSoil ? finaleT < 0.35 : u < 0.9);
          cont.classList.toggle("is-revealed", reveal);
          const groupOp = isSoil ? clamp01(1 - (finaleT - 0.12) / 0.2) : 1;
          cont.style.opacity = String(isActive ? groupOp : 0);
          cont.style.visibility = isActive ? "visible" : "hidden";
          cont.style.pointerEvents = isActive && groupOp > 0.6 ? "auto" : "none";
        }
      }

      if (hudPctRef.current)
        hudPctRef.current.textContent = String(Math.round(p * 100)).padStart(2, "0") + "%";
      if (hudLabelRef.current) hudLabelRef.current.textContent = p < seg ? "Scroll" : "Turn";
      if (barRef.current) barRef.current.style.width = `${p * 100}%`;

      // finale
      const fWrap = finaleWrapRef.current;
      if (fWrap) {
        fWrap.style.visibility = finaleT <= 0.001 ? "hidden" : "visible";
        const show = easeOut(clamp01((finaleT - 0.15) / 0.55));
        const ctaIn = easeOut(clamp01((finaleT - 0.45) / 0.4));
        if (glowRef.current) glowRef.current.style.opacity = String(0.12 + show * 0.28);
        if (gridRef.current) gridRef.current.style.opacity = String(show * 0.5);
        if (finaleTextRef.current) {
          finaleTextRef.current.style.opacity = String(show);
          finaleTextRef.current.style.transform = `translate3d(0, ${(1 - show) * 30}px, 0)`;
        }
        if (ctaRef.current) {
          ctaRef.current.style.opacity = String(ctaIn);
          ctaRef.current.style.transform = `translate3d(0, ${(1 - ctaIn) * 20}px, 0)`;
          ctaRef.current.style.pointerEvents = ctaIn > 0.5 ? "auto" : "none";
        }
      }
    };

    const tick = () => {
      raf = 0;
      current += (target - current) * lerp;
      if (Math.abs(target - current) < 0.0002) current = target;
      apply(current);
      if (current !== target) raf = requestAnimationFrame(tick);
    };

    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      const track = rect.height - window.innerHeight;
      target = track > 0 ? clamp01(-rect.top / track) : 0;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    measure();
    current = target;
    apply(current);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {/* ---- 3D scene stack ---- */}
        {layers.map((layer, i) => {
          const cooler = i > 0 && (BANDS[i - 1]?.cooler ?? false);
          // the darkening scrim must sit behind wherever the text actually is — mirrored
          // chapters put their text on the right, so the scrim has to flip with them
          const scrimRight = i > 0 && Number(BANDS[i - 1]?.index) % 2 === 0;
          return (
            <div
              key={layer.key}
              ref={(el) => {
                sceneRefs.current[i] = el;
              }}
              className="absolute inset-0"
              style={{
                zIndex: N - i,
                transformOrigin: "50% 50%",
                overflow: "hidden",
                willChange: "transform",
              }}
            >
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                muted
                loop
                playsInline
                preload={i <= 1 ? "auto" : "metadata"}
                disablePictureInPicture
                className="absolute inset-0 size-full object-cover"
              >
                <source src={layer.video} type="video/mp4" />
              </video>

              {i === 0 ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/40 via-transparent to-yellow-100/10" />
                  <div className="ad-sheen pointer-events-none absolute inset-0 opacity-40 mix-blend-screen" />
                </>
              ) : (
                <>
                  <div
                    className="absolute inset-0"
                    style={{
                      background: scrimRight
                        ? "linear-gradient(to left, oklch(0.06 0.01 150 / 0.78) 0%, oklch(0.06 0.01 150 / 0.26) 42%, transparent 70%)"
                        : "linear-gradient(to right, oklch(0.06 0.01 150 / 0.78) 0%, oklch(0.06 0.01 150 / 0.26) 42%, transparent 70%)",
                    }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-2/5"
                    style={{
                      background:
                        "linear-gradient(to top, oklch(0.06 0.01 150 / 0.65), transparent)",
                    }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(135% 105% at 50% 48%, transparent 60%, oklch(0.04 0.01 150 / 0.5) 100%)",
                    }}
                  />
                  {cooler && (
                    <div className="absolute inset-0 bg-gradient-to-t from-background/45 via-transparent to-background/10" />
                  )}
                </>
              )}
            </div>
          );
        })}

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

/* ----- holographic feature reveal for each band ----- */
function BandContent({ band }: { band: Band }) {
  const isHero = band.index === "01";
  const badges = BAND_BADGES[band.index] ?? BAND_BADGES["01"];
  const shape = BADGE_SHAPE[band.index] ?? "tile";
  // alternate which side the text sits on per chapter — the hero always opens on the left,
  // then every even chapter mirrors so the page never reads as one column repeated eight times
  const isRight = Number(band.index) % 2 === 0;
  return (
    <div
      className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)]"
      style={isRight ? { direction: "rtl" } : undefined}
    >
      {/* each block cascades in on its own delay — never one slab moving together */}
      <div className={`reveal-text max-w-2xl ${isRight ? "reveal-text-right" : ""}`} style={isRight ? { direction: "ltr" } : undefined}>
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

      {/* spinning HUD dial with feature badges orbiting in */}
      <div
        className="relative mx-auto hidden aspect-square w-full max-w-[540px] lg:block"
        style={isRight ? { direction: "ltr" } : undefined}
      >
        <div className="hud-wrap absolute inset-[8%]">
          <HudRing variant={band.index} />
        </div>
        {badges.map(({ icon: Icon, label }, i) => {
          const pos = badgePos(BADGE_ANGLES[i % BADGE_ANGLES.length]);
          return (
            <div
              key={i}
              className={`orbit-badge group absolute hover:z-30 ${badgeOuterSize(shape)}`}
              style={{ left: pos.left, top: pos.top, transitionDelay: `${0.15 + i * 0.09}s` }}
            >
              <BadgeShell shape={shape}>
                <Icon className="size-6 text-soil transition-transform duration-300 group-hover:scale-110" strokeWidth={1.6} />
              </BadgeShell>
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
  return (
    <footer className="relative z-10 border-t border-hairline bg-background px-6 py-14 sm:px-10">
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
