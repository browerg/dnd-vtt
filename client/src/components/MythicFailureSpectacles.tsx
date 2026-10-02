import type { CSSProperties } from "react";
import "./MythicFailureSpectacles.css";

const index = (i: number) => ({ "--i": i } as CSSProperties);

export function AuraBreakSpectacle() {
  return <div className="mythic-failure-scene aura-break-scene" aria-hidden="true">
    <svg className="mythic-stage" viewBox="0 0 1000 700">
      <defs>
        <linearGradient id="aura-glass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffe6a0" stopOpacity=".3" /><stop offset=".6" stopColor="#a678e8" stopOpacity=".08" /><stop offset="1" stopColor="#9875c7" stopOpacity=".4" /></linearGradient>
      </defs>
      <g className="aura-shell" fill="none" stroke="#dfbcfa">
        <path d="M500 67 720 162v165c0 116-108 197-220 253-112-56-220-137-220-253V162Z" fill="url(#aura-glass)" strokeWidth="3" />
        <path d="m500 89 199 86v150c0 103-98 182-199 232-101-50-199-129-199-232V175Z" strokeWidth="1" />
        <path d="m500 106 35 46-35 46-35-46Zm0 35v23" stroke="#ffe1a3" strokeWidth="2" />
        {Array.from({ length: 4 }, (_, row) => Array.from({ length: 5 }, (_, col) => {
          const x = 358 + col * 67 + (row % 2) * 32, y = 230 + row * 57;
          return <path key={`${row}-${col}`} className="aura-cell" style={index(row * 5 + col)} d={`M${x} ${y - 35}l30 17v35l-30 18-30-18v-35Z`} />;
        }))}
      </g>
      <g className="aura-hit first" transform="translate(355 240)"><circle r="58" /><path d="m-80-30 42 16m82 30 40 15M-30-75l16 38m30 80 15 39" /></g>
      <g className="aura-hit second" transform="translate(650 290)"><circle r="67" /><path d="m-87-32 40 15m94 35 40 15M-33-87l15 40m36 94 15 40" /></g>
      <g className="aura-hit third" transform="translate(500 350)"><circle r="95" /><path d="m-110-70 53 34m114 72 53 34M-70-110l34 53m72 114 34 53" /></g>
      <path className="aura-fault" d="m500 160-21 78 43 32-38 72 45 44-37 87 8 80M484 342l-88-19-93-98m226 161 76-28 91 53" fill="none" stroke="#fff1cc" strokeWidth="4" pathLength="1" />
      <g className="aura-falling-shards">
        {Array.from({ length: 16 }, (_, i) => <g key={i} transform={`translate(${320 + i % 5 * 79} ${200 + Math.floor(i / 5) * 100})`}>
          <path style={index(i)} d="M-22-36 31-11 14 38-35 16Z" fill="url(#aura-glass)" stroke="#c89ddc" strokeWidth="1.5" />
        </g>)}
      </g>
      <g className="aura-meter" transform="translate(350 614)">
        <path d="M0 0h300v10H0Z" fill="#221c2c" stroke="#61506f" />
        <path className="aura-reserve" d="M0 0h300v10H0Z" fill="#e5bdff" />
        <text x="150" y="38" textAnchor="middle">AURA DEPLETED</text>
      </g>
      <g className="mythic-number aura-failure-number"><text x="500" y="428">1</text><path d="m488 290 17 30-14 31 20 25-19 48" fill="none" stroke="#221527" strokeWidth="4" /></g>
    </svg>
    <div className="mythic-scene-title">Aura Break</div>
  </div>;
}

export function NevermoreSpectacle() {
  return <div className="mythic-failure-scene nevermore-scene" aria-hidden="true">
    <div className="nevermore-moon" />
    <svg className="mythic-stage nevermore-stage" viewBox="0 0 1000 700">
      <defs><linearGradient id="nevermore-bone"><stop stopColor="#787886" /><stop offset=".45" stopColor="#f0e8d7" /><stop offset="1" stopColor="#b0a7a1" /></linearGradient></defs>
      <g className="nevermore-bird">
        {[-1, 1].map(side => <g key={side} transform={`translate(500 300) scale(${side} 1)`}>
          <g className="nevermore-wing">
            <path d="M10 45 77-75 177-132 405-200 343-126 275-93 353-107 278-29 186-11 274-21 197 64 121 81 174 87 100 146 25 130Z" fill="#111322" stroke="#6d657b" strokeWidth="2" />
            {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${40 + i * 10} ${40 + i * 7} Q${110 + i * 10} ${-65 + i * 20} ${350 - i * 35} ${-165 + i * 48}`} fill="none" stroke="#373245" strokeWidth="3" />)}
            <path d="M17 45 79-62 167-106 212-109 149-52 104 15 54 91Z" fill="#d1c5bc" stroke="#211c2b" strokeWidth="3" />
            <path d="m79-62 17 31m71-75-8 33m-55 88-30-6" stroke="#9c3045" strokeWidth="5" />
          </g>
        </g>)}
        <g className="nevermore-mask">
          <path d="m500 177-61 44-27 75 43 50 45 85 45-85 43-50-27-75Z" fill="url(#nevermore-bone)" stroke="#201b28" strokeWidth="4" />
          <path d="m500 210-16 42 16 44 16-44ZM429 273l57 13-18 28-29-12Zm142 0-57 13 18 28 29-12Z" fill="#211c2b" />
          <path className="nevermore-eyes" d="m440 286 33 5-10 12-19-9m116-8-33 5 10 12 19-9" stroke="#ff4860" strokeWidth="5" fill="#de2446" />
          <path d="m500 311-23 32 23 76 23-76Z" fill="#28222f" /><path d="M500 319v80" stroke="#a398a2" strokeWidth="2" />
          <path d="m453 240 18-10m58 0 18 10M482 202l18 16 18-16" fill="none" stroke="#9b2541" strokeWidth="4" />
        </g>
      </g>
      <g className="nevermore-feathers" fill="#211b2c" stroke="#63516f">
        {Array.from({ length: 14 }, (_, i) => <g key={i} transform={`translate(${110 + i * 60} ${125 + (i * 83) % 310}) rotate(${i * 39})`}>
          <path style={index(i)} d="M0-38Q24-8 4 31L0 46-4 25Q-23-6 0-38Z" />
        </g>)}
      </g>
      <g className="mythic-number nevermore-number"><text x="500" y="435">1</text></g>
      <g className="nevermore-last-feather">
        <path d="M592 331c40 83-37 161-127 175 24-18 37-41 47-63-13 0-22 5-32 13 9-42 57-108 112-125Z" fill="url(#nevermore-bone)" />
        <path d="M587 348q-16 94-131 166m110-99-28 6m11 24-24 0" stroke="#4a3b4d" strokeWidth="2" fill="none" />
      </g>
    </svg>
    <div className="mythic-scene-title">Nevermore’s Omen</div>
  </div>;
}

function ShadowFigure() {
  return <g>
    <path d="m481 167 3-23 17 15 18-12-1 24c21 24 9 58-12 65l-4 14 34 20 27 95-28-24 18 96-30 11-14-73-5 171h-24l-7-174-28 72-27-13 26-114-27 28 28-83 24-20-2-17c-28-13-30-40-18-61Z" />
    <path d="M476 253Q396 303 337 481l115-60 41-143M518 252q70 41 135 220l-115-55-30-141Z" />
  </g>;
}

export function ShadowSnareSpectacle() {
  return <div className="mythic-failure-scene shadow-snare-scene" aria-hidden="true">
    <svg className="mythic-stage" viewBox="0 0 1000 700">
      <defs><linearGradient id="shadow-steel"><stop stopColor="#494456" /><stop offset=".48" stopColor="#e6e0ef" /><stop offset=".52" stopColor="#7f738e" /><stop offset="1" stopColor="#211a2e" /></linearGradient></defs>
      <ellipse className="shadow-pool" cx="500" cy="552" rx="220" ry="34" fill="#05040a" stroke="#65527e" />
      <g className="shadow-original" fill="#12101f" stroke="#9678b4" strokeWidth="2"><ShadowFigure /></g>
      <g className="shadow-decoy" fill="#554567" stroke="#a892c7" strokeWidth="1"><ShadowFigure /></g>
      <g className="shadow-dissolve" fill="#716180">
        {Array.from({ length: 24 }, (_, i) => <g key={i} transform={`translate(${436 + i % 5 * 30} ${178 + Math.floor(i / 5) * 63})`}>
          <path style={index(i)} d="m0-17 12 10-5 27-13 10-10-27Z" />
        </g>)}
      </g>
      <g className="shadow-weapon">
        <path d="m677 258 14-16 21 11-6 114-32 89-3-63Z" fill="url(#shadow-steel)" stroke="#c3b7d6" strokeWidth="2" />
        <path d="m668 310 46 5-3 16-46-5Z" fill="#342443" stroke="#ad95c3" />
        <path d="m682 249 15 5-3 40-15-4Z" fill="#2c203c" /><path d="m681 260 13 4m-14 6 13 4m-14 6 13 4" stroke="#9683ac" />
      </g>
      <g className="mythic-number shadow-number"><text x="500" y="433">1</text></g>
      <path className="shadow-ribbon back" d="M688 327C820 255 707 101 543 161S206 320 388 415 701 560 774 466" fill="none" stroke="#21192e" strokeWidth="23" pathLength="1" />
      <path className="shadow-ribbon edge" d="M688 327C820 255 707 101 543 161S206 320 388 415 701 560 774 466" fill="none" stroke="#ad8fcb" strokeWidth="2" pathLength="1" />
      <g className="shadow-knot" fill="none">
        <path d="M400 337q106-77 189 15-99 77-184 36 69-56 192 23" stroke="#32233f" strokeWidth="22" />
        <path d="M400 328q106-77 189 15m-184 36q69-56 192 23" stroke="#c5a7df" strokeWidth="2" />
        <path d="m503 363-33 120-54 29m96-141 61 114 84 19" stroke="#382842" strokeWidth="14" />
      </g>
    </svg>
    <div className="mythic-scene-title">Shadow Snare</div>
  </div>;
}
