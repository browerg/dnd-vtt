import { useEffect, useRef } from "react";
import type { RollPayload } from "../api";

const VISIBILITY_TAGS: Record<string, string> = {
  private: "only you",
  dm: "you + DM",
  blind: "blind",
};

// Natural 20 / natural 1 on a single d20 gets the fanfare it deserves.
function natD20(roll: RollPayload): 20 | 1 | null {
  const groups = roll.detail?.kept.groups;
  if (!groups || groups.length !== 1) return null;
  const g = groups[0];
  if (g.sides !== 20 || g.count !== 1) return null;
  return g.results[0] === 20 ? 20 : g.results[0] === 1 ? 1 : null;
}

function breakdown(roll: RollPayload): string {
  const kept = roll.detail?.kept;
  if (!kept) return "";
  const parts = kept.groups.map((g) => `${g.count}d${g.sides} [${g.results.join(", ")}]`);
  let text = parts.join(" + ");
  if (kept.modifier) text += ` ${kept.modifier > 0 ? "+" : "−"} ${Math.abs(kept.modifier)}`;
  return text;
}

export default function RollFeed({ rolls }: { rolls: RollPayload[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [rolls.length]);

  return (
    <div className="roll-feed">
      {rolls.length === 0 && <p className="muted">No rolls yet. Make history.</p>}
      {rolls.map((roll) => {
        const nat = natD20(roll);
        return (
          <div key={roll.id} className={`roll-item${nat === 20 ? " nat20" : nat === 1 ? " nat1" : ""}`}>
            <div className="roll-head">
              <strong>{roll.userName}</strong>
              {roll.label && <span className="muted"> · {roll.label}</span>}
              {roll.mode !== "normal" && (
                <span className="badge mode-badge">{roll.mode === "advantage" ? "ADV" : "DIS"}</span>
              )}
              {VISIBILITY_TAGS[roll.visibility] && (
                <span className="badge vis-badge">{VISIBILITY_TAGS[roll.visibility]}</span>
              )}
            </div>
            {roll.detail ? (
              <div className="roll-body">
                <span className="roll-breakdown">
                  🎲 {breakdown(roll)}
                  {roll.detail.dropped && (
                    <span className="muted dropped"> (dropped {roll.detail.dropped.total})</span>
                  )}
                </span>
                <span className="roll-total">{roll.total}</span>
              </div>
            ) : (
              <div className="roll-body">
                <span className="roll-breakdown muted">
                  🎲 rolled {roll.formula} blind — only the DM sees the result
                </span>
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
