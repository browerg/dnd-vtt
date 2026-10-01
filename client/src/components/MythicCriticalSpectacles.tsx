import type { CSSProperties } from "react";
import "./MythicCriticalSpectacles.css";

const timing = (i: number) => ({ "--i": i } as CSSProperties);

/** The three scenes have independent silhouettes and 5.2 second timelines.
 * SVG artwork stays deterministic; only bounded transforms/opacity animate. */
export function SilverRequiemSpectacle() {
  return <div className="mythic-scene silver-requiem-scene" aria-hidden="true">
    <div className="requiem-moon" />
    <div className="requiem-horizon" />
    <svg className="mythic-stage requiem-stage" viewBox="0 0 1000 700">
      <defs>
        <linearGradient id="requiem-silver" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#505a77" /><stop offset=".5" stopColor="#d7dcea" /><stop offset="1" stopColor="#fff" /></linearGradient>
        <linearGradient id="requiem-metal"><stop stopColor="#64112b" /><stop offset=".45" stopColor="#d33150" /><stop offset=".52" stopColor="#f27b86" /><stop offset="1" stopColor="#911530" /></linearGradient>
      </defs>
      <g className="requiem-wings">
        {[-1, 1].map(side => <g key={side} transform={`translate(500 320) scale(${side} 1)`}>
          {Array.from({ length: 9 }, (_, i) => <path key={i} className="requiem-feather" style={timing(i)}
            d={`M${16 + i * 7} ${36 + i * 6} Q${120 + i * 16} ${-95 + i * 26} ${338 - i * 19} ${-155 + i * 39} Q${192 - i * 7} ${55 + i * 11} ${24 + i * 6} ${58 + i * 6}Z`} />)}
        </g>)}
      </g>
      <g className="requiem-scythe">
        <path d="M345 595 560 140" stroke="#090c16" strokeWidth="20" />
        <path d="M345 595 560 140" stroke="#c6cbd5" strokeWidth="8" />
        <path d="m419 443 18 8 29-63-18-8Z" fill="#b92046" />
        <path d="m525 152 40-57 57 18-19 27C733 148 800 249 800 348 746 251 666 225 567 228l-34-21Z" fill="url(#requiem-metal)" stroke="#f4667e" strokeWidth="2" />
        <path d="M603 140c129 8 198 109 197 208-31-52-62-85-100-107 56 15 73 44 83 54-25-79-79-124-180-132Z" fill="#e7e8ee" />
        <path d="m544 156 54 14-15 49-43-18Z" fill="#171722" />
        <path d="m551 168 32 9-5 13-32-10Z" fill="#ff5a72" />
        <circle cx="558" cy="202" r="9" fill="#151821" stroke="#d4d9e4" strokeWidth="3" />
        <path d="m583 129 13 3m-20 7 13 3m-20 7 13 3M614 179q78 1 127 51" fill="none" stroke="#3c1025" strokeWidth="5" />
        <path d="m544 183-14-4m48 28 15 4M380 525l13 6m-17 4 13 6m-17 4 13 6" fill="none" stroke="#eef0f8" strokeWidth="2" />
      </g>
      <path className="requiem-cut" d="M105 568Q210 108 886 172" fill="none" stroke="#f7dde6" strokeWidth="7" pathLength="1" />
      <g className="requiem-eye">
        <path d="M325 290Q500 155 675 290Q500 400 325 290Z" fill="#101018" stroke="#e5eaf3" strokeWidth="3" />
        <circle cx="500" cy="282" r="48" fill="#d8dfed" /><circle cx="500" cy="282" r="17" fill="#202332" />
        <path d="M486 263h28M500 249v28" stroke="white" strokeWidth="3" />
      </g>
      <g className="mythic-number requiem-number"><text x="500" y="402">20</text></g>
      <g className="requiem-petals">
        {Array.from({ length: 32 }, (_, i) => <g key={i} transform={`translate(${100 + (i * 149) % 810} ${80 + (i * 73) % 485}) rotate(${i * 47})`}>
          <path style={timing(i)} d="M0 0C-19-23-30 9-7 26 3 17 13 10 0 0Z" fill={i % 3 ? "#b82046" : "#ee5978"} />
        </g>)}
      </g>
    </svg>
    <div className="mythic-scene-title">Silver-Eyed Requiem</div>
  </div>;
}

function Glyph({ radius }: { radius: number }) {
  return <>
    <circle r={radius} /><circle r={radius - 15} strokeDasharray="2 9" /><circle r={radius - 33} />
    {Array.from({ length: 12 }, (_, i) => <g key={i} transform={`rotate(${i * 30})`}>
      <path d={`M0 ${-radius + 4}v23m-6-15 6 7 6-7M-9 ${-radius + 38} 0 ${-radius + 52} 9 ${-radius + 38}`} />
    </g>)}
    <path d={`M0 ${-radius + 62} ${radius - 62} 0 0 ${radius - 62} ${-radius + 62} 0Z`} />
    <path d={`M0 ${-radius + 62}V${radius - 62}M${-radius + 62} 0H${radius - 62}`} />
  </>;
}

export function WinterVerdictSpectacle() {
  return <div className="mythic-scene winter-verdict-scene" aria-hidden="true">
    <div className="winter-frost-edge" />
    <svg className="mythic-stage winter-stage" viewBox="0 0 1000 700">
      <defs><linearGradient id="winter-steel"><stop stopColor="#254875" /><stop offset=".47" stopColor="#98dcec" /><stop offset=".5" stopColor="#fff" /><stop offset=".54" stopColor="#5e9bd4" /><stop offset="1" stopColor="#273c66" /></linearGradient></defs>
      <g className="winter-arches" fill="none" stroke="#86bfd3">
        {[-1, 1].map(side => <g key={side} transform={`translate(500 0) scale(${side} 1)`}>
          <path d="M175 560V170q0-72 80-128 80 56 80 128v390M188 560V176q0-61 67-113 67 52 67 113v384M220 180v325M290 180v325" />
          <path d="M175 215h160M175 495h160" />
        </g>)}
      </g>
      <g transform="translate(500 490) scale(1 .29)"><g className="winter-floor"><Glyph radius={320} /></g></g>
      <g transform="translate(500 268)"><g className="winter-glyph outer"><Glyph radius={208} /></g><g className="winter-glyph inner"><Glyph radius={142} /></g></g>
      <g className="winter-sword">
        <path d="m500 100-16 19 5 78h22l5-78Z" fill="#e8faff" />
        <path d="m500 98 10-15-10-15-10 15Z" fill="#98d6ff" />
        <path d="m420 182 36-12 44 22 44-22 36 12-52 24h-56Z" fill="#d4f4ff" stroke="#5e94d2" strokeWidth="3" />
        <path d="m480 206 20 16 20-16-7 224-13 42-13-42Z" fill="url(#winter-steel)" stroke="#f4feff" strokeWidth="2" />
        <path d="M494 235v175" stroke="#fff" strokeWidth="3" />
        <path d="m500 240-5 10 5 10 5-10Zm0 48-5 10 5 10 5-10Z" fill="#f2feff" />
        <path d="m493 124 14 5m-14 6 14 5m-14 6 14 5m-14 6 14 5m-14 6 14 5M479 191l21 10 21-10" stroke="#4879ac" fill="none" strokeWidth="2" />
        <path d="m500 183 8 10-8 10-8-10Z" fill="#eeeaff" stroke="#85bbef" />
      </g>
      <g className="winter-fracture" fill="none" stroke="#d0f6ff" strokeWidth="2">
        <path d="M500 490 397 530 326 509 251 552 78 573M397 530 370 582 242 618M500 490 576 526 658 515 737 562 921 577M576 526 610 581 742 613M500 490 480 581 523 663" pathLength="1" />
      </g>
      <g className="winter-shards">
        {Array.from({ length: 18 }, (_, i) => <g key={i} transform={`translate(${165 + i * 39} ${470 + (i % 3) * 29})`}>
          <path style={timing(i)} d={`M0 0 ${10 + i % 8} -${40 + i % 5 * 13} 24 6 7 20Z`} fill={i % 2 ? "#a1d9eb" : "#4b78b2"} stroke="#d7f9ff" />
        </g>)}
      </g>
      <g className="mythic-number winter-number"><text x="500" y="417">20</text></g>
      <g className="winter-snow" fill="#d7f9ff">{Array.from({ length: 24 }, (_, i) => <circle key={i} cx={90 + i * 37} cy={70 + (i * 43) % 450} r={i % 3 + 1} style={timing(i)} />)}</g>
    </svg>
    <div className="mythic-scene-title">Winter’s Verdict</div>
  </div>;
}

function Gauntlet() {
  return <g stroke="#1e1217" strokeWidth="5" strokeLinejoin="round">
    <path d="m-65 80 12-125 28-28h52l30 28 12 125-29 38h-80Z" fill="url(#emberheart-metal)" />
    <path d="m-53-37 20-19h65l20 19-7 57h-91Z" fill="url(#emberheart-metal)" />
    {[-30, -10, 10, 30].map(x => <path key={x} d={`m${x - 8}-50h16v42h-16Z`} fill="#ffd978" />)}
    <path d="m-43 25 86 0 7 49-24 21h-51l-24-21Z" fill="#513128" />
    <path d="M-26 32h52v46h-52Z" fill="#efad32" />
    <path d="M-53 88h106l-12 29h-82Z" fill="#edd3a0" />
    <path d="M-65-10h-17v61h23M65-10h17v61H59" fill="#342733" />
    <circle cx="-73" cy="1" r="7" fill="#fce6b0" /><circle cx="73" cy="1" r="7" fill="#fce6b0" />
    <path d="m-10 40 16 4-12 12 12 4-18 15 4-17-10-3Z" fill="#fff0b2" stroke="none" />
    <path d="M-48 29v41m8-41v49M48 29v41m-8-41v49" stroke="#ffda7e" strokeWidth="2" />
    {[-37, 37].map(x => <g key={x}><circle cx={x} cy="5" r="3" fill="#fff1c4" strokeWidth="1" /><circle cx={x} cy="103" r="3" fill="#fff1c4" strokeWidth="1" /></g>)}
  </g>;
}

export function EmberheartSpectacle() {
  return <div className="mythic-scene emberheart-scene" aria-hidden="true">
    <div className="emberheart-heat" />
    <svg className="mythic-stage emberheart-stage" viewBox="0 0 1000 700">
      <defs>
        <linearGradient id="emberheart-metal"><stop stopColor="#8a481a" /><stop offset=".16" stopColor="#e5a231" /><stop offset=".45" stopColor="#ffe295" /><stop offset=".5" stopColor="#d99b2d" /><stop offset="1" stopColor="#9d531d" /></linearGradient>
        <linearGradient id="emberheart-fire" x1="0" y1="1" x2="0" y2="0"><stop stopColor="#fff2be" /><stop offset=".35" stopColor="#ffce4c" /><stop offset=".7" stopColor="#ed6427" /><stop offset="1" stopColor="#8c2639" /></linearGradient>
      </defs>
      <g className="emberheart-shield" fill="none" stroke="#e9ac46" strokeWidth="2">
        {Array.from({ length: 5 }, (_, row) => Array.from({ length: 7 }, (_, col) => {
          const x = 285 + col * 72 + (row % 2) * 36, y = 155 + row * 62;
          return <path key={`${row}-${col}`} style={timing(row * 7 + col)} d={`M${x} ${y - 40}l35 20v40l-35 20-35-20v-40Z`} />;
        }))}
      </g>
      <g className="emberheart-flare" fill="url(#emberheart-fire)">
        <path d="M500 447c-149 6-195-90-154-176-3 69 36 62 22 13-32-85 52-97 22-177 126 64 51 127 100 158-18-111 60-103 69-195 128 92 28 179 63 218 18-23 32-39 21-77 123 137 17 257-143 236Z" />
        <path d="M500 447c-76-13-105-73-58-139-1 42 26 53 27 9 1-66 55-73 64-117 61 104-28 110 7 169 34-12 39-27 39-46 57 75 7 118-79 124Z" fill="#fff0b5" />
      </g>
      <g transform="translate(288 330) rotate(-24)"><g className="emberheart-left"><Gauntlet /></g></g>
      <g transform="translate(712 330) rotate(24)"><g className="emberheart-right"><Gauntlet /></g></g>
      <g className="emberheart-recoil" fill="none" stroke="#ffebbc" strokeWidth="5"><path d="m193 315-83 80m98-59-50 108m648-129 84 80m-99-59 50 108" /></g>
      <g className="emberheart-impact" fill="none" stroke="#ffcf6c">
        <path d="m500 324-78-57-51 5-90-76M422 267l-17-69-57-54M500 324l83-88 81-11 81-95M583 236l-4-67 41-78M500 324l112 24 52 64 144 43M612 348l70-8 83 24M500 324l-58 79-62 18-53 89M442 403l10 77-30 82" strokeWidth="4" pathLength="1" />
        <ellipse cx="500" cy="327" rx="220" ry="155" strokeWidth="3" />
      </g>
      <g className="emberheart-finisher" transform="translate(500 320)"><g><Gauntlet /></g></g>
      <g className="mythic-number emberheart-number"><text x="500" y="422">20</text></g>
      <g className="emberheart-casings" fill="#dba54f" stroke="#ffe0a1">{Array.from({ length: 8 }, (_, i) => <g key={i} transform={`translate(${i % 2 ? 700 : 300} 345)`}><rect x="0" y="0" width="11" height="25" rx="2" style={timing(i)} /></g>)}</g>
    </svg>
    <div className="mythic-scene-title">Emberheart Overdrive</div>
  </div>;
}
