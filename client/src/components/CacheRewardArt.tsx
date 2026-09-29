/** Shared reel/reveal art. Mystery dice retain their concealed appearance. */
export default function CacheRewardArt({ id }: { id: string }) {
  if (id === "relic-first-flame") return <img className="cache-reward-art cache-relic-art" src="/assets/bundles/first-flame.webp" alt="" />;
  const mystery = ["event-horizon", "chronos-engine", "prismatic-echo"].includes(id);
  return <svg className={`cache-reward-art art-${id}`} viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    {id === "first-flame" ? <>
      <path d="m13 94 22-21 8-17 21-4 12-24 28-16" stroke="#ff972b" strokeWidth="9" opacity=".3" />
      <path d="m13 94 22-21 8-17 21-4 12-24 28-16" stroke="#ffe6a0" strokeWidth="2.5" />
      <path d="m17 59 14-18 18-4-9 17-8 12Zm39 17 16-18 17-3-4 19-19 13ZM63 20l8-13 13 2-10 17" fill="#130d18" stroke="#c27d38" />
      <path d="M49 73c-15-12-6-21-1-27-2 9 3 10 4 12 4-6 7-12 6-23 17 21 7 35-9 38Z" fill="#ff982c" />
      <path d="M50 72c-6-7 1-12 3-19 7 12 4 16-3 19Z" fill="#fff1af" />
      <path d="m31 23 2-6m61 35 2-5M14 79l-2-5" stroke="#ffdf85" strokeWidth="2" />
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
