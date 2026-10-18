import { useState } from "react";
import type { RemnantData, SemblanceCompanion, SemblanceEffect } from "../remnant";
import { SEMBLANCE_PRESETS } from "../semblancePresets";
import "./SemblanceEffects.css";

interface Props {
  name: string;
  d: RemnantData;
  ro: boolean;
  update: (patch: Partial<RemnantData>) => void;
  /** The Semblance's own activation cost, from the sheet's cost rules. */
  activationCost: number;
  /** Tell the table which effect was used (OOC chat). */
  announce?: (text: string) => void;
  /** GM only: add a companion to the campaign as an NPC. */
  onAddCompanion?: (companion: SemblanceCompanion, aura: number) => Promise<void>;
}

const BLANK: SemblanceEffect = { name: "", target: "", extraCost: 0, upkeep: 0, text: "", flavor: "" };
const n = (value: string) => Math.max(0, parseInt(value, 10) || 0);

/** A menu of effects to pick from when activating a Semblance, plus ready-made presets. */
export default function SemblanceEffects({ name, d, ro, update, activationCost, announce, onAddCompanion }: Props) {
  const effects = d.semblance.effects ?? [];
  const [editing, setEditing] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const setSemblance = (patch: Partial<RemnantData["semblance"]>) => update({ semblance: { ...d.semblance, ...patch } });
  const setEffect = (index: number, patch: Partial<SemblanceEffect>) =>
    setSemblance({ effects: effects.map((effect, i) => (i === index ? { ...effect, ...patch } : effect)) });
  const running = effects.find((effect) => effect.name === d.semblance.activeEffect && effect.upkeep > 0);

  const use = (effect: SemblanceEffect) => {
    const total = activationCost + effect.extraCost;
    if (d.aura <= 0 || d.aura < total) return;
    const nextAura = d.aura - total;
    const sustains = effect.upkeep > 0 && nextAura > 0;
    update({
      aura: nextAura,
      semblance: {
        ...d.semblance,
        ...(sustains ? { active: true, activeEffect: effect.name, maintainedRounds: 0 } : {}),
      },
    });
    announce?.(`${name} used ${effect.name} (−${total} Aura).`);
    setNotice(`Used ${effect.name}: −${total} Aura.`);
  };
  const endRunning = () => setSemblance({ active: false, activeEffect: undefined, maintainedRounds: 0 });
  const maintain = () => {
    if (!running) return;
    const nextAura = Math.max(0, d.aura - running.upkeep);
    update({
      aura: nextAura,
      semblance: {
        ...d.semblance,
        maintainedRounds: (d.semblance.maintainedRounds ?? 0) + 1,
        ...(nextAura > 0 ? {} : { active: false, activeEffect: undefined }),
      },
    });
  };
  const loadPreset = (id: string) => {
    const preset = SEMBLANCE_PRESETS.find((entry) => entry.id === id);
    if (!preset) return;
    if ((effects.length || d.semblance.description.trim()) && !window.confirm(`Replace this Semblance's setup with ${preset.label}? Its name stays.`)) return;
    // Keep anything the preset leaves blank (type, limitation…).
    const filled = Object.fromEntries(Object.entries(preset.semblance).filter(([, value]) => value !== ""));
    setSemblance({ ...filled, effects: preset.semblance.effects.map((effect) => ({ ...effect })), activeEffect: undefined, active: false });
    setNotice(`Loaded ${preset.label}.`);
  };

  if (ro && !effects.length) return null;
  return (
    <section className="semblance-effects" aria-label="Semblance effects">
      <div className="semblance-effects-head">
        <strong>Effects</strong>
        <span className="muted small">Pick one when activating · base cost {activationCost} Aura</span>
        {!ro && (
          <select value="" onChange={(event) => loadPreset(event.target.value)} aria-label="Load a preset Semblance">
            <option value="">Load a preset…</option>
            {SEMBLANCE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
          </select>
        )}
      </div>

      {running && (
        <div className="semblance-sustained-panel">
          <div className="semblance-sustained-status">
            <span className="semblance-active-pip" aria-hidden="true" />
            <span>
              <strong>{running.name} is active</strong>
              <small>Maintained {d.semblance.maintainedRounds ?? 0} {(d.semblance.maintainedRounds ?? 0) === 1 ? "round" : "rounds"}</small>
            </span>
            <span className="semblance-upkeep">−{running.upkeep} Aura / round</span>
          </div>
          {!ro && (
            <div className="semblance-sustained-actions">
              <button type="button" className="primary mini" disabled={d.aura <= 0} onClick={maintain}>Maintain this round (−{running.upkeep})</button>
              <button type="button" className="ghost mini" onClick={endRunning}>End {running.name}</button>
            </div>
          )}
        </div>
      )}
      {d.semblance.activeEffect && d.aura <= 0 && (
        <div className="semblance-ended-banner">
          Aura Broken: {d.semblance.activeEffect} has ended.
          {!ro && <button type="button" className="ghost mini" onClick={endRunning}>Clear</button>}
        </div>
      )}
      {notice && <p className="muted small" role="status">{notice}</p>}

      <div className="semblance-effect-list">
        {effects.map((effect, i) => {
          const total = activationCost + effect.extraCost;
          const short = d.aura <= 0 ? "Aura Broken: Semblance locked" : d.aura < total ? "Not enough Aura" : "";
          if (editing === i && !ro) {
            return (
              <div key={i} className="semblance-effect is-editing">
                <input value={effect.name} placeholder="Effect name" aria-label="Effect name" onChange={(e) => setEffect(i, { name: e.target.value })} />
                <input value={effect.target} placeholder="Target, e.g. Self or another ally" aria-label="Target" onChange={(e) => setEffect(i, { target: e.target.value })} />
                <div className="semblance-effect-numbers">
                  <label>Extra Aura <input type="number" min={0} value={effect.extraCost} onChange={(e) => setEffect(i, { extraCost: n(e.target.value) })} /></label>
                  <label>Sustained Aura/round <input type="number" min={0} value={effect.upkeep} onChange={(e) => setEffect(i, { upkeep: n(e.target.value) })} /></label>
                  <label className="semblance-effect-flag"><input type="checkbox" checked={!!effect.finalFlareOnly} onChange={(e) => setEffect(i, { finalFlareOnly: e.target.checked })} /> Final Flare only</label>
                </div>
                <textarea rows={3} value={effect.text} placeholder="What it does" aria-label="What it does" onChange={(e) => setEffect(i, { text: e.target.value })} />
                <textarea rows={2} value={effect.flavor ?? ""} placeholder="Flavor (optional)" aria-label="Flavor" onChange={(e) => setEffect(i, { flavor: e.target.value })} />
                <div className="semblance-effect-actions">
                  <button type="button" className="primary mini" onClick={() => setEditing(null)}>Done</button>
                  <button type="button" className="ghost mini danger" onClick={() => {
                    if (!window.confirm(`Remove ${effect.name || "this effect"}?`)) return;
                    setSemblance({ effects: effects.filter((_, n2) => n2 !== i) });
                    setEditing(null);
                  }}>Remove</button>
                </div>
              </div>
            );
          }
          const companion = effect.companion;
          const companionAura = companion ? companion.auraBase + d.attributes.aura * companion.auraPerSummonerDie : 0;
          return (
            <details key={i} className={`semblance-effect${running?.name === effect.name ? " is-running" : ""}`}>
              <summary>
                <span className="semblance-effect-name">{effect.name || "Unnamed effect"}</span>
                <span className="semblance-effect-badges">
                  {effect.extraCost > 0 && <span className="badge">+{effect.extraCost} Aura</span>}
                  {effect.upkeep > 0 && <span className="badge">Sustained +{effect.upkeep}/rd</span>}
                  {effect.finalFlareOnly && <span className="badge semblance-flare">Final Flare only</span>}
                </span>
              </summary>
              <p className="semblance-effect-target"><strong>Target:</strong> {effect.target || "—"}</p>
              <p className="semblance-effect-text">{effect.text}</p>
              {effect.flavor && <p className="semblance-effect-flavor">{effect.flavor}</p>}
              {companion && (
                <div className="semblance-companion">
                  <strong>{companion.name}</strong>
                  <span className="muted small">{companion.description}</span>
                  <span className="small">
                    {Object.entries(companion.attributes).map(([key, die]) => `${key[0].toUpperCase()}${key.slice(1)} d${die}`).join(" · ")}
                  </span>
                  <span className="small">Aura {companionAura} ({companion.auraBase} + Aura die d{d.attributes.aura} × {companion.auraPerSummonerDie}) · HP {companion.hp}</span>
                  <span className="small">{companion.weapon.name}: {companion.weapon.special} · {companion.weapon.range} range</span>
                  {onAddCompanion && (
                    <button type="button" className="ghost mini" onClick={async () => {
                      try { await onAddCompanion(companion, companionAura); setNotice(`${companion.name} was added to the campaign's NPCs.`); }
                      catch (cause) { setNotice(cause instanceof Error ? cause.message : "Couldn't add the NPC."); }
                    }}>
                      Add {companion.name} as an NPC
                    </button>
                  )}
                </div>
              )}
              {!ro && (
                <div className="semblance-effect-actions">
                  <button type="button" className="primary mini" disabled={!!short} title={short || `Spend ${total} Aura`} onClick={() => use(effect)}>
                    ✨ Use (−{total})
                  </button>
                  <button type="button" className="ghost mini" onClick={() => setEditing(i)}>Edit</button>
                </div>
              )}
            </details>
          );
        })}
      </div>
      {!ro && (
        <button type="button" className="ghost mini semblance-add-effect" onClick={() => { setSemblance({ effects: [...effects, { ...BLANK }] }); setEditing(effects.length); }}>
          + Add effect
        </button>
      )}
    </section>
  );
}
