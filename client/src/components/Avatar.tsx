// A person's account avatar: their uploaded image, or a stable colored initial.
// Account/out-of-character identity only — never used for characters.
const COLORS = ["#b5462f", "#2f6db5", "#7a4bb5", "#b58a2f", "#2f9d7a", "#b52f77", "#4b6b2f"];

function colorFor(seed: string | number): string {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function Avatar({
  name,
  src,
  id,
  size = 32,
}: {
  name: string;
  src?: string;
  id?: number;
  size?: number;
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const box = { width: size, height: size, fontSize: Math.round(size * 0.45) };
  if (src) {
    return <img className="avatar" src={src} alt={name} style={box} />;
  }
  return (
    <span className="avatar avatar-initial" style={{ ...box, background: colorFor(id ?? name) }}>
      {initial}
    </span>
  );
}
