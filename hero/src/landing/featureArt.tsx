/* Card art for the feature rails: one small animated illustration per feature, drawn in the
   landing's palette (cream line, gold and leaf accents on deep field-green or soil). Each shows
   what the feature does rather than a stock photograph, so no picture on the page repeats.
   Motion lives in reel.css under .fa; it idles gently and pauses while its rail is off screen.
   Everything is illustrative — no numbers here pretend to be data. */

import type { ComponentType } from "react";

const C = { line: "rgba(243, 236, 220, 0.9)", dim: "rgba(243, 236, 220, 0.16)", faint: "rgba(243, 236, 220, 0.08)", gold: "#e3b454", leaf: "#a6d86e", ember: "#e07a45" };

function Grid() {
  return (
    <g stroke={C.faint} strokeWidth="1">
      {[80, 130, 180, 230, 280, 330].map((y) => <line key={y} x1="24" x2="296" y1={y} y2={y} />)}
    </g>
  );
}

/* ---------------------------------------------------------------- live */

function Yield() {
  const bars = [34, 46, 58, 70, 84, 98, 110, 120, 128, 134];
  return (
    <>
      <Grid />
      {bars.map((h, i) => (
        <rect key={i} className="fa-rise" style={{ animationDelay: `${i * 0.12}s` }} x={34 + i * 26} y={330 - h * 0.55} width="14" height={h * 0.55} rx="3" fill={C.dim} />
      ))}
      <path className="fa-draw" d="M30 300 C 110 298, 130 160, 200 136 S 278 114, 292 110" fill="none" stroke={C.gold} strokeWidth="3" strokeLinecap="round" pathLength={1} />
      <circle className="fa-pulse" cx="292" cy="110" r="7" fill={C.gold} />
      <g transform="translate(248 58)" stroke={C.leaf} strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path className="fa-sway" d="M14 40 V14" />
        <path className="fa-sway" d="M14 24 C4 20 2 10 6 6 C12 6 16 14 14 24Z" fill={C.leaf} />
        <path className="fa-sway" d="M14 18 C24 14 28 6 24 2 C18 2 14 10 14 18Z" fill={C.leaf} />
      </g>
      <text x="30" y="362" className="fa-t">GDD · pH · TEMP</text>
    </>
  );
}

function Suggest() {
  return (
    <>
      <circle cx="160" cy="170" r="84" fill="none" stroke={C.dim} strokeWidth="10" />
      <circle className="fa-gauge" cx="160" cy="170" r="84" fill="none" stroke={C.gold} strokeWidth="10" strokeLinecap="round" pathLength={1} transform="rotate(-90 160 170)" />
      <g transform="translate(160 172)" stroke={C.leaf} strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M0 46 V-44" />
        {[-34, -18, -2, 14].map((y, i) => (
          <g key={y} className="fa-pop" style={{ animationDelay: `${0.2 + i * 0.18}s` }}>
            <ellipse cx="-11" cy={y} rx="9" ry="5" transform={`rotate(-35 -11 ${y})`} fill={C.leaf} />
            <ellipse cx="11" cy={y} rx="9" ry="5" transform={`rotate(35 11 ${y})`} fill={C.leaf} />
          </g>
        ))}
      </g>
      {["SEASONAL", "SCORED", "EXPLAINED"].map((t, i) => (
        <g key={t} className="fa-fade" style={{ animationDelay: `${0.6 + i * 0.4}s` }}>
          <rect x={30 + i * 90} y="296" width="82" height="28" rx="14" fill="none" stroke={i === 0 ? C.gold : C.dim} />
          <text x={71 + i * 90} y="314" textAnchor="middle" className="fa-t">{t}</text>
        </g>
      ))}
    </>
  );
}

function Market() {
  const pts = [300, 262, 276, 228, 244, 196, 214, 170, 188, 150, 162, 128];
  const d = pts.map((y, i) => `${i ? "L" : "M"}${30 + i * 24} ${y - 40}`).join(" ");
  return (
    <>
      <Grid />
      <defs>
        <linearGradient id="fa-mk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.gold} stopOpacity="0.35" /><stop offset="1" stopColor={C.gold} stopOpacity="0" /></linearGradient>
      </defs>
      <path d={`${d} L294 300 L30 300 Z`} fill="url(#fa-mk)" />
      <path className="fa-draw" d={d} fill="none" stroke={C.gold} strokeWidth="2.6" strokeLinejoin="round" pathLength={1} />
      {pts.map((_, i) => (
        <rect key={i} className="fa-rise" style={{ animationDelay: `${i * 0.08}s` }} x={24 + i * 24} y={316 - (8 + ((i * 37) % 26))} width="12" height={8 + ((i * 37) % 26)} fill={C.dim} rx="2" />
      ))}
      <g className="fa-scan-x">
        <line x1="0" x2="0" y1="70" y2="316" stroke={C.leaf} strokeDasharray="3 5" />
        <circle cx="0" cy="70" r="5" fill={C.leaf} />
      </g>
      <text x="30" y="352" className="fa-t">MANDI · DEMAND</text>
    </>
  );
}

const NET = [[160, 96], [70, 150], [250, 150], [100, 260], [220, 262], [160, 190], [160, 330]] as const;
const LINKS = [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [3, 6], [4, 6], [1, 3], [2, 4]] as const;
function Exchange() {
  return (
    <>
      {LINKS.map(([a, b], i) => <line key={i} x1={NET[a][0]} y1={NET[a][1]} x2={NET[b][0]} y2={NET[b][1]} stroke={C.dim} strokeWidth="1.4" />)}
      {([[1, 5, 4], [2, 5, 3], [3, 6, 4]] as const).map(([a, b, c], i) => (
        <circle key={i} r="4.5" fill={C.gold}>
          <animateMotion dur={`${3.4 + i * 0.7}s`} repeatCount="indefinite" begin={`${i * 0.9}s`}
            path={`M${NET[a][0]} ${NET[a][1]} L${NET[b][0]} ${NET[b][1]} L${NET[c][0]} ${NET[c][1]}`} />
        </circle>
      ))}
      {NET.map(([x, y], i) => (
        <g key={i}>
          <circle className="fa-halo" style={{ animationDelay: `${i * 0.35}s` }} cx={x} cy={y} r="16" fill="none" stroke={i === 5 ? C.gold : C.leaf} />
          <circle cx={x} cy={y} r={i === 5 ? 11 : 8} fill={i === 5 ? C.gold : "#1d3a24"} stroke={i === 5 ? C.gold : C.leaf} strokeWidth="2" />
        </g>
      ))}
    </>
  );
}

function Orbit() {
  const cells = Array.from({ length: 30 }, (_, i) => i);
  const tone = (i: number) => ["#1f4a2a", "#2b5c33", "#35683a", "#244f2d", "#3f7440"][(i * 7) % 5];
  return (
    <>
      <g transform="translate(40 70)">
        {cells.map((i) => <rect key={i} x={(i % 5) * 48} y={Math.floor(i / 5) * 44} width="44" height="40" rx="3" fill={tone(i)} />)}
        <rect className="fa-march" x="96" y="88" width="92" height="84" rx="4" fill="none" stroke={C.gold} strokeWidth="2.4" strokeDasharray="8 6" />
        <circle className="fa-pulse" cx="142" cy="130" r="6" fill={C.gold} />
      </g>
      <rect className="fa-scan-y" x="40" y="70" width="240" height="26" fill="url(#fa-scan)" />
      <defs>
        <linearGradient id="fa-scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.leaf} stopOpacity="0" /><stop offset="1" stopColor={C.leaf} stopOpacity="0.45" /></linearGradient>
      </defs>
      <text x="40" y="358" className="fa-t">LAYERS · PLOTS · NEIGHBOURS</text>
    </>
  );
}

function Advisor() {
  return (
    <>
      <g className="fa-seq" style={{ animationDelay: "0s" }}>
        <rect x="30" y="80" width="190" height="58" rx="18" fill="rgba(243,236,220,0.1)" />
        <rect x="48" y="98" width="130" height="7" rx="3.5" fill={C.dim} /><rect x="48" y="113" width="90" height="7" rx="3.5" fill={C.dim} />
      </g>
      <g className="fa-seq" style={{ animationDelay: "1.1s" }}>
        <rect x="100" y="160" width="190" height="78" rx="18" fill={C.gold} fillOpacity="0.92" />
        <rect x="118" y="178" width="150" height="7" rx="3.5" fill="#2a1a08" fillOpacity="0.45" />
        <rect x="118" y="193" width="126" height="7" rx="3.5" fill="#2a1a08" fillOpacity="0.45" />
        <rect x="118" y="208" width="80" height="7" rx="3.5" fill="#2a1a08" fillOpacity="0.45" />
      </g>
      <g className="fa-seq" style={{ animationDelay: "2.2s" }}>
        <rect x="30" y="262" width="96" height="40" rx="18" fill="rgba(243,236,220,0.1)" />
        {[0, 1, 2].map((i) => <circle key={i} className="fa-dot" style={{ animationDelay: `${i * 0.18}s` }} cx={58 + i * 20} cy="282" r="5" fill={C.line} />)}
      </g>
      <text x="30" y="352" className="fa-t">REMEMBERS YOUR FIELD</text>
    </>
  );
}

function Honesty() {
  const rows = [
    { t: "READING", c: C.leaf, w: 170, dash: "" },
    { t: "ESTIMATE", c: C.gold, w: 120, dash: "6 5" },
    { t: "GAP", c: C.ember, w: 60, dash: "2 6" },
  ];
  return (
    <>
      <path d="M160 58 L236 86 V160 C236 214 204 246 160 262 C116 246 84 214 84 160 V86 Z" fill="none" stroke={C.faint} strokeWidth="2" />
      <path className="fa-draw" d="M128 160 L152 184 L196 136" fill="none" stroke={C.leaf} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
      {rows.map((r, i) => (
        <g key={r.t} transform={`translate(40 ${290 + i * 26})`}>
          <circle cx="6" cy="0" r="5" fill={i === 2 ? "none" : r.c} stroke={r.c} strokeWidth="2" />
          <text x="20" y="4" className="fa-t">{r.t}</text>
          <line className="fa-grow" style={{ animationDelay: `${0.4 + i * 0.3}s` }} x1="100" x2={100 + r.w} y1="0" y2="0" stroke={r.c} strokeWidth="4" strokeLinecap="round" strokeDasharray={r.dash || undefined} />
        </g>
      ))}
    </>
  );
}

/* ---------------------------------------------------------------- next */

const CASCADE = [[60, 90, "POWER"], [160, 90, "PUMP"], [260, 90, "WATER"], [110, 190, "CROP"], [210, 190, "LABOUR"], [160, 290, "INCOME"]] as const;
const CEDGES = [[0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [4, 5]] as const;
function Cascade() {
  return (
    <>
      {CEDGES.map(([a, b], i) => (
        <line key={i} className="fa-flow" style={{ animationDelay: `${i * 0.35}s` }} x1={CASCADE[a][0]} y1={CASCADE[a][1]} x2={CASCADE[b][0]} y2={CASCADE[b][1]} stroke={C.gold} strokeWidth="2" pathLength={1} />
      ))}
      {CASCADE.map(([x, y, t], i) => (
        <g key={t}>
          <circle className="fa-light" style={{ animationDelay: `${i * 0.35}s` }} cx={x} cy={y} r="22" fill="#3a2414" stroke={C.gold} strokeWidth="2" />
          <text x={x} y={y + 40} textAnchor="middle" className="fa-t">{t}</text>
        </g>
      ))}
      <path d="M60 78 l-6 12 h8 l-4 12" fill="none" stroke={C.gold} strokeWidth="2.4" strokeLinejoin="round" />
    </>
  );
}

function Water() {
  return (
    <>
      {Array.from({ length: 16 }, (_, i) => (
        <line key={i} className="fa-rain" style={{ animationDelay: `${(i * 0.23) % 1.6}s` }} x1={36 + i * 16} x2={30 + i * 16} y1="40" y2="62" stroke="rgba(170, 210, 240, 0.7)" strokeWidth="2" strokeLinecap="round" />
      ))}
      <g className="fa-tide">
        <path className="fa-wave" d="M-40 260 Q 0 244 40 260 T 120 260 T 200 260 T 280 260 T 360 260 T 440 260 V400 H-40 Z" fill="rgba(90, 160, 210, 0.35)" />
        <path className="fa-wave2" d="M-40 272 Q 0 258 40 272 T 120 272 T 200 272 T 280 272 T 360 272 T 440 272 V400 H-40 Z" fill="rgba(90, 160, 210, 0.3)" />
      </g>
      <rect x="276" y="96" width="14" height="210" rx="7" fill="none" stroke={C.dim} strokeWidth="2" />
      <rect className="fa-level" x="279" y="99" width="8" height="204" rx="4" fill={C.gold} />
      {["HIGH", "LOW"].map((t, i) => <text key={t} x="268" y={110 + i * 190} textAnchor="end" className="fa-t">{t}</text>)}
    </>
  );
}

function Leaf() {
  return (
    <>
      <g stroke={C.gold} strokeWidth="2.4" fill="none" strokeLinecap="round">
        {([[36, 60, 1, 1], [284, 60, -1, 1], [36, 340, 1, -1], [284, 340, -1, -1]] as const).map(([x, y, sx, sy], i) => (
          <path key={i} d={`M${x} ${y + 26 * sy} V${y} H${x + 26 * sx}`} />
        ))}
      </g>
      <path d="M160 70 C 240 110 250 250 160 330 C 70 250 80 110 160 70 Z" fill="rgba(166, 216, 110, 0.18)" stroke={C.leaf} strokeWidth="2.4" />
      <path d="M160 86 V318" stroke={C.leaf} strokeWidth="2" />
      {[130, 170, 210, 250].map((y) => (
        <g key={y} stroke={C.leaf} strokeWidth="1.4" fill="none"><path d={`M160 ${y} Q 190 ${y - 18} 214 ${y - 30}`} /><path d={`M160 ${y} Q 130 ${y - 18} 106 ${y - 30}`} /></g>
      ))}
      {[[196, 150], [124, 214], [184, 262]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="7" fill={C.ember} fillOpacity="0.8" />
          <circle className="fa-ring" style={{ animationDelay: `${0.6 + i * 0.5}s` }} cx={x} cy={y} r="15" fill="none" stroke={C.ember} strokeWidth="2" />
        </g>
      ))}
      <rect className="fa-scan-leaf" x="56" y="70" width="208" height="3" fill={C.gold} />
    </>
  );
}

function Voice() {
  return (
    <>
      <g transform="translate(160 150)">
        {["अ", "ਅ", "அ", "A"].map((g, i) => (
          <text key={g} className="fa-glyph" style={{ animationDelay: `${i * 1.5}s` }} x="0" y="22" textAnchor="middle" fontSize="84" fill={C.gold}>{g}</text>
        ))}
      </g>
      {Array.from({ length: 22 }, (_, i) => (
        <rect key={i} className="fa-wave-bar" style={{ animationDelay: `${(i * 0.09) % 0.9}s` }} x={36 + i * 11.4} y="236" width="6" height="60" rx="3" fill={i % 3 ? C.dim : C.leaf} />
      ))}
      <text x="160" y="346" textAnchor="middle" className="fa-t">VOICE IN · VOICE OUT</text>
    </>
  );
}

function Records() {
  return (
    <>
      <rect x="62" y="56" width="196" height="264" rx="14" fill="rgba(243,236,220,0.07)" stroke={C.dim} />
      <rect x="84" y="78" width="80" height="10" rx="5" fill={C.gold} fillOpacity="0.8" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(84 ${116 + i * 34})`}>
          <rect width="152" height="20" rx="6" fill="none" stroke={C.faint} />
          <rect className="fa-type" style={{ animationDelay: `${i * 0.45}s` }} x="6" y="6" width={[110, 84, 128, 70, 96][i]} height="8" rx="4" fill={C.line} fillOpacity="0.55" />
        </g>
      ))}
      <g className="fa-stamp" transform="translate(222 292)">
        <circle r="26" fill="none" stroke={C.leaf} strokeWidth="2.4" strokeDasharray="4 3" />
        <path d="M-10 0 L-3 8 L11 -8" fill="none" stroke={C.leaf} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  );
}

const BLOCKS = [[48, 80], [148, 150], [70, 232], [178, 300]] as const;
function Ledger() {
  const path = BLOCKS.map(([x, y], i) => `${i ? "L" : "M"}${x + 47} ${y + 26}`).join(" ");
  return (
    <>
      <path d={path} fill="none" stroke={C.dim} strokeWidth="2" strokeDasharray="5 5" />
      {BLOCKS.map(([x, y], i) => (
        <g key={i}>
          <rect className="fa-light-b" style={{ animationDelay: `${i * 0.8}s` }} x={x} y={y} width="94" height="52" rx="10" fill="#3a2414" stroke={C.gold} strokeWidth="1.6" />
          <rect x={x + 14} y={y + 14} width="46" height="6" rx="3" fill={C.dim} />
          <rect x={x + 14} y={y + 28} width="30" height="6" rx="3" fill={C.dim} />
          <text x={x + 80} y={y + 22} textAnchor="end" className="fa-t">{["FIELD", "WEIGH", "MANDI", "BUYER"][i]}</text>
        </g>
      ))}
      <circle r="6" fill={C.gold}>
        <animateMotion dur="3.2s" repeatCount="indefinite" path={path} />
      </circle>
    </>
  );
}

const ART: Record<string, ComponentType> = {
  yield: Yield, suggest: Suggest, market: Market, exchange: Exchange, orbit: Orbit, advisor: Advisor, honesty: Honesty,
  cascade: Cascade, water: Water, leaf: Leaf, voice: Voice, records: Records, ledger: Ledger,
};
export function FeatureArt({ art }: { art: string }) {
  const Art = ART[art];
  return (
    <svg className={`fa fa-${art}`} viewBox="0 0 320 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {Art ? <Art /> : null}
    </svg>
  );
}
