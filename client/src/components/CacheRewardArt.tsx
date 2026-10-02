/** Shared reel/reveal art. Mystery dice retain their concealed appearance. */
export default function CacheRewardArt({ id }: { id: string }) {
  if (id === "relic-first-flame") return <img className="cache-reward-art cache-relic-art" src="/assets/bundles/first-flame.webp" alt="" />;
  const mystery = ["event-horizon", "chronos-engine", "prismatic-echo"].includes(id);
  return <svg className={`cache-reward-art art-${id}`} viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    {id === "aura-break" ? <>
      <path d="m60 9 39 17v31c0 25-20 41-39 53-19-12-39-28-39-53V26Z" fill="#412c58" stroke="#d2a7ee" strokeWidth="2" />
      <path d="m62 15-10 27 16 13-17 21 10 29M51 76 25 58m43-3 26-13" stroke="#fff0c6" strokeWidth="3" />
      <path d="m12 61 6 7-6 14-5-9m94-51 8-8 4 17-8 5" fill="#b891d8" />
    </> : id === "nevermore" ? <>
      <path d="m56 51-16-26L7 14l12 21-12-3 21 27-10-3 30 27m16-32 16-26 33-11-12 21 12-3-21 27 10-3-30 27" fill="#292432" stroke="#988497" />
      <path d="m60 25-17 13-6 25 23 39 23-39-6-25Z" fill="#d9d0bf" stroke="#292432" />
      <path d="m45 53 10 4-5 6m25-10-10 4 5 6" stroke="#c52d4c" strokeWidth="4" /><path d="m60 63-6 10 6 24 6-24Z" fill="#211b2a" />
    </> : id === "shadow-snare" ? <>
      <text x="60" y="90" textAnchor="middle" fill="#eee2f6" stroke="none" fontFamily="Cinzel, Georgia, serif" fontSize="83">1</text>
      <path d="M91 24C18-7 1 57 42 72s71-22 46-38M28 56q49-26 61 14L43 80l-9 27m26-35 22 32" stroke="#8b6ba7" strokeWidth="7" />
      <path d="m94 10 8 4-3 33-10 16 2-28Z" fill="#c9bfd9" />
    </> : id === "silver-requiem" ? <>
      <circle cx="60" cy="51" r="37" fill="#64162e" stroke="none" />
      <path d="M60 73 17 27l9 32-14-8 24 32-12-2 27 18M60 73l43-46-9 32 14-8-24 32 12-2-27 18" fill="#d9dfed" stroke="#fff" />
      <path d="m41 104 34-78M66 27 82 16c20 5 29 19 29 37-15-20-25-22-43-18" stroke="#ea5274" strokeWidth="4" />
      <text x="60" y="83" textAnchor="middle" fill="#fff" stroke="#101321" strokeWidth="1.5" fontFamily="Cinzel, Georgia, serif" fontWeight="700" fontSize="36">20</text>
    </> : id === "winter-verdict" ? <>
      <circle cx="60" cy="53" r="40" stroke="#a2d9f8" /><circle cx="60" cy="53" r="32" stroke="#779cdb" strokeDasharray="2 4" />
      <path d="m60 9 39 44-39 43-39-43Z" stroke="#b6eaf8" />
      <path d="M57 13h6v22l17-5-7 10-10 2v46l-3 15-3-15V42l-10-2-7-10 17 5Z" fill="#e5f9ff" stroke="#5d8ac1" />
      <ellipse cx="60" cy="104" rx="44" ry="8" stroke="#b6eaf8" />
    </> : id === "emberheart" ? <>
      <path d="M60 105C10 96 10 63 31 35c-5 24 9 21 12 9C46 26 61 21 61 9c32 25 16 44 22 53 7-8 10-16 8-22 36 37 7 65-31 65Z" fill="#fa922c" stroke="none" />
      <path d="m42 84-4-38 7-11h30l7 11-4 38-9 13H51Z" fill="#efb541" stroke="#24151b" strokeWidth="3" />
      <path d="M47 40v21m9-21v21m9-21v21m9-21v21M44 68h32M52 77h16v11H52Z" stroke="#654022" strokeWidth="3" />
    </> : id === "first-flame" ? <>
      <path d="m13 94 22-21 8-17 21-4 12-24 28-16" stroke="#ff972b" strokeWidth="9" opacity=".3" />
      <path d="m13 94 22-21 8-17 21-4 12-24 28-16" stroke="#ffe6a0" strokeWidth="2.5" />
      <path d="m17 59 14-18 18-4-9 17-8 12Zm39 17 16-18 17-3-4 19-19 13ZM63 20l8-13 13 2-10 17" fill="#130d18" stroke="#c27d38" />
      <path d="M49 73c-15-12-6-21-1-27-2 9 3 10 4 12 4-6 7-12 6-23 17 21 7 35-9 38Z" fill="#ff982c" />
      <path d="M50 72c-6-7 1-12 3-19 7 12 4 16-3 19Z" fill="#fff1af" />
      <path d="m31 23 2-6m61 35 2-5M14 79l-2-5" stroke="#ffdf85" strokeWidth="2" />
    </> : id === "main-character" ? <>
      <rect x="0" y="0" width="120" height="120" fill="#d7122a" stroke="none" />
      <path d="M-5 30 125 14v26L-5 56Z" fill="#0b0b0b" stroke="none" />
      <path d="M60 58l6 16 17-6-10 14 14 10-17 1 1 17-11-13-12 13 1-17-17-1 14-10-10-14 17 6Z" fill="#fff" stroke="none" />
      <text x="62" y="90" textAnchor="middle" fill="#fff" stroke="#0b0b0b" strokeWidth="1.5" fontFamily="Arial Black, sans-serif" fontStyle="italic" fontWeight="900" fontSize="24">20</text>
      <path d="M8 42h40" stroke="#fff" strokeWidth="5" />
    </> : id === "jackpot" ? <>
      <rect x="8" y="34" width="104" height="52" rx="9" fill="#c98f28" stroke="#fff0b0" strokeWidth="2" />
      {[18, 48, 78].map(x => <rect key={x} x={x} y="44" width="24" height="32" rx="3" fill="#fffdf6" stroke="#3b2405" />)}
      {[30, 60, 90].map(x => <text key={x} x={x} y="67" textAnchor="middle" fill="#b47414" stroke="none" fontFamily="Cinzel, Georgia, serif" fontWeight="700" fontSize="15">20</text>)}
      <text x="60" y="26" textAnchor="middle" fill="#fff4fb" stroke="#ff5ec8" strokeWidth=".8" fontFamily="Arial Black, sans-serif" fontStyle="italic" fontSize="15">JACKPOT</text>
      {[[20, 100], [40, 108], [84, 104], [102, 96]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="6" fill="#ffd35a" stroke="#9a6010" />)}
    </> : id === "legend-forged" ? <>
      <circle cx="60" cy="62" r="44" stroke="#ffd27a" strokeDasharray="3 4" />
      <text x="60" y="78" textAnchor="middle" fill="#fff1c8" stroke="#ff8a2e" strokeWidth="1" fontFamily="Cinzel, Georgia, serif" fontWeight="700" fontSize="40">20</text>
      <g transform="rotate(-50 96 94)"><rect x="92" y="30" width="7" height="64" rx="3" fill="#5a3517" stroke="none" /><rect x="80" y="22" width="32" height="16" rx="3" fill="#3c3f47" stroke="#9aa2ad" /></g>
      {[[44, 30], [36, 40], [52, 24], [30, 34]].map(([x, y]) => <path key={x} d={`M${x} ${y}l-5-6`} stroke="#ffb347" strokeWidth="2" />)}
    </> : id === "mimic" ? <>
      <path d="M14 30h92v22H14Z" fill="#4d2e15" stroke="#f0c668" />
      <path d="M14 76h92v22H14Z" fill="#4d2e15" stroke="#f0c668" />
      <rect x="54" y="38" width="12" height="14" rx="3" fill="#f0c668" stroke="none" />
      <path d="M14 52h92M14 76h92" stroke="#b3283c" strokeWidth="3" />
      <path d="M16 53l6 11 6-11 6 13 6-13 6 10 6-10 6 13 6-13 6 10 6-10 6 13 6-13 6 11 6-11" fill="#fffbe9" stroke="#a88c55" strokeWidth="1" />
      <path d="M16 75l6-10 6 10 6-12 6 12 6-9 6 9 6-12 6 12 6-9 6 9 6-12 6 12 6-10 6 10" fill="#fffbe9" stroke="#a88c55" strokeWidth="1" />
      <path d="M40 66v9M80 66v12" stroke="#d7ebff" strokeWidth="1.5" opacity=".8" />
    </> : id === "abyssal-gaze" ? <>
      <path d="M8 60C30 30 90 30 112 60 90 90 30 90 8 60Z" fill="#e9dfc4" stroke="#b98cff" strokeWidth="2" />
      <circle cx="60" cy="60" r="22" fill="#6fd12e" stroke="#0a1a03" strokeWidth="2" />
      <ellipse cx="60" cy="60" rx="3.5" ry="19" fill="#000" stroke="none" />
      <circle cx="52" cy="52" r="3" fill="#fff" stroke="none" opacity=".8" />
      <path d="M4 20c10 4 14 0 20 8M116 22c-10 4-12 0-20 8M8 104c10-6 14-2 22-10M112 102c-8-4-12 0-20-8" stroke="#9b4dff" />
    </> : id === "severed-fate" ? <>
      <path d="M8 88 112 32" stroke="#ff4a5c" strokeWidth="9" opacity=".25" />
      <path d="M8 88 112 32" stroke="#ffd6c4" strokeWidth="1.5" />
      <path d="M8 64 C30 63 50 62 60 62" stroke="#f1c46b" strokeWidth="3" />
      <path d="M72 58 C86 60 100 66 112 72" stroke="#ff5b6c" strokeWidth="3" />
      <path d="M84 14 A46 46 0 0 1 58 104 A40 43 0 0 0 84 14Z" fill="#f4eaff" stroke="none" opacity=".85" />
      {[ [66,50],[70,68],[54,52],[78,56] ].map(([x,y]) => <circle key={x+"-"+y} cx={x} cy={y} r="1.8" fill="#ffc24f" stroke="none" />)}
    </> : id === "void-collapse" ? <><circle cx="60" cy="60" r="27" fill="#080310" stroke="#c49aff" /><ellipse cx="60" cy="60" rx="50" ry="16" stroke="#9affe0" transform="rotate(-30 60 60)" /><ellipse cx="60" cy="60" rx="46" ry="19" stroke="#c49aff" transform="rotate(40 60 60)" /></> : id === "heavens-lance" ? <><path d="M60 8v95m-8-16 8 17 8-17M60 40 15 24l19 29-23-7 36 30M60 40l45-16-19 29 23-7-36 30" stroke="#ffe3a5" strokeWidth="3" /><path d="m60 22 33 38-33 38-33-38Z" stroke="#c4f3ff" /></> : id === "chronobreak" ? <><circle cx="60" cy="60" r="40" stroke="#94ffda" strokeDasharray="17 5" /><path d="M60 28v32l22 13M15 15l12 8-5 13M96 81l11 15-17 8" stroke="#ffdf9f" strokeWidth="3" /></> : id === "riftwake" ? <>
      <ellipse cx="60" cy="60" rx="23" ry="43" stroke="#ca9bff" strokeWidth="3" transform="rotate(-25 60 60)" />
      <ellipse cx="60" cy="60" rx="34" ry="47" stroke="#77ffe0" strokeDasharray="30 12 4 12" transform="rotate(25 60 60)" />
      <path d="m60 8 3 9M16 58l10 2M93 90l9 6" stroke="#eee1ff" />
    </> : id === "astral-script" ? <>
      <path d="M60 24v72M37 38l46 44M37 82l46-44" stroke="#ffe19c" strokeWidth="3" />
      <path d="m17 27 15 4M87 90l16 6M23 89l-4-14M99 26l-9 10" stroke="#92dfff" />
      {[ [17,27],[23,89],[99,26],[103,96] ].map(([x,y]) => <circle key={x} cx={x} cy={y} r="3" fill="#d1f5ff" stroke="none" />)}
    </> : id === "prism-shatter" ? <>
      <path d="m62 13 23 48-27 47-26-46Z" fill="#787cff" fillOpacity=".4" stroke="#b3eaff" />
      <path d="m62 13-4 95M32 62l53-1" stroke="#fdc0ff" />
      <path d="m19 25 10 14-12 22-6-17Z" fill="#6fffe2" fillOpacity=".6" />
      <path d="m102 69 9 10-10 25-10-13Z" fill="#ff83ce" fillOpacity=".6" />
    </> : mystery ? <>
      <path d="M60 9 104 34 104 86 60 111 16 86 16 34Z" fill="#09080e" />
      <path d="m60 9 22 34 22-9M82 43l6 37 16 6M88 80l-28 31-28-31-16 6M32 80l6-37-22-9M38 43 60 9M38 43h44l6 37H32Z" opacity=".3" />
      <text x="60" y="81" textAnchor="middle" stroke="none" fill="currentColor" fontFamily="Cinzel, Georgia, serif" fontSize="51">?</text>
    </> : id === "frost" ? <g strokeWidth="3">
      <path d="M60 19v82M24 39l72 42M24 81l72-42M49 27l11 12 11-12M49 93l11-12 11 12M27 53l16-3-4-16M81 86l-4-16 16-3M39 86l4-16-16-3M93 53l-16-3 4-16" />
    </g> : id === "lightning" || id === "storm" ? <>
      <path d="m69 12-40 54h27l-9 42 44-60H65Z" fill="currentColor" opacity=".9" stroke="none" />
      <path d="M20 34 12 47l9 4-7 15M100 51l8 10-9 9 7 13" opacity=".55" />
    </> : id === "shadow" ? <>
      <path d="M77 18a43 43 0 1 0 25 71A45 45 0 0 1 77 18Z" fill="currentColor" opacity=".65" />
      <circle cx="85" cy="37" r="3" fill="currentColor" /><circle cx="98" cy="58" r="2" fill="currentColor" />
    </> : id === "rose" ? <>
      {[0, 60, 120, 180, 240, 300].map(angle => <path key={angle} transform={`rotate(${angle} 60 60)`} d="M60 60C28 43 44 13 60 22c18-8 29 23 0 38Z" fill="currentColor" fillOpacity=".25" />)}
      <circle cx="60" cy="60" r="10" fill="currentColor" />
    </> : <>
      <path d="M64 12c6 29 35 36 31 66-3 22-22 30-37 27-36-8-36-42-17-61-1 14 5 17 10 20 12-16 13-34 13-52Z" fill="currentColor" fillOpacity=".8" />
      <path d="M63 56c0 20-21 26-9 43 19 5 30-17 9-43Z" fill="#151019" stroke="none" />
    </>}
  </svg>;
}
