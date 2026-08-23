import type { CSSProperties } from "react";
import "./TurnStartEffect.css";

export type TurnStartEffectStyle =
  | "none"
  | "aura"
  | "ember"
  | "frost"
  | "shadow"
  | "lightning"
  | "rose";

interface TurnStartEffectProps {
  effect: string;
  preview?: boolean;
  staticPreview?: boolean;
}

const EFFECT_ART: Partial<Record<TurnStartEffectStyle, string>> = {
  aura: "/assets/dice-vfx/aura_magic.png",
  ember: "/assets/dice-vfx/ember_fire.png",
  frost: "/assets/dice-vfx/frost_glow.png",
  shadow: "/assets/dice-vfx/shadow_smoke_large.png",
  lightning: "/assets/dice-vfx/lightning_arc.png",
};

function normalizeEffect(effect: string): TurnStartEffectStyle {
  if (
    effect === "aura" ||
    effect === "ember" ||
    effect === "frost" ||
    effect === "shadow" ||
    effect === "lightning" ||
    effect === "rose"
  ) {
    return effect;
  }
  return "none";
}

export default function TurnStartEffect({
  effect,
  preview = false,
  staticPreview = false,
}: TurnStartEffectProps) {
  const style = normalizeEffect(effect);
  if (style === "none") return null;

  return (
    <span
      className={`turn-start-effect turn-start-${style}${preview ? " turn-start-preview-mode" : ""}${staticPreview ? " turn-start-static-preview" : ""}`}
      aria-hidden="true"
    >
      <span className="turn-start-flash" />
      <span className="turn-start-ring turn-start-ring-a" />
      <span className="turn-start-ring turn-start-ring-b" />
      <span className="turn-start-beam" />

      {EFFECT_ART[style] && (
        <>
          <img className="turn-start-art turn-start-art-main" src={EFFECT_ART[style]} alt="" />
          <img className="turn-start-art turn-start-art-ghost" src={EFFECT_ART[style]} alt="" />
        </>
      )}

      <span className="turn-start-particles">
        {Array.from({ length: 12 }, (_, index) => (
          <i key={index} style={{ "--turn-particle": index } as CSSProperties} />
        ))}
      </span>

      {style === "rose" && (
        <span className="turn-start-petals">
          {Array.from({ length: 14 }, (_, index) => (
            <i key={index} style={{ "--turn-petal": index } as CSSProperties} />
          ))}
        </span>
      )}
    </span>
  );
}
