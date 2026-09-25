/** Shared reel/reveal art. Mystery dice retain their concealed appearance. */
export default function CacheRewardArt({ id }: { id: string }) {
  if (id === "relic-first-flame") return <img className="cache-reward-art cache-relic-art" src="/assets/bundles/first-flame.webp" alt="" />;
  const mystery = ["event-horizon", "chronos-engine", "prismatic-echo"].includes(id);
  return <svg className={`cache-reward-art art-${id}`} viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    {mystery ? <>
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
