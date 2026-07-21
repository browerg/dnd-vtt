import { useMemo, useRef, useState } from "react";
import { REMNANT_ATTRIBUTES, REMNANT_SKILLS } from "../remnant";

const DICE = [4, 6, 8, 10, 12];
const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
const ROLL_MODES = ["normal", "edge", "setback"];
const ACTION_KINDS = ["Attack", "Ability", "Reaction", "Passive", "Aura", "Dust", "Transformation"];

const csv = (value: string) => value.split(",").map((entry) => entry.trim()).filter(Boolean);
const join = (value: string[] | undefined) => (value ?? []).join(", ");

export function RemnantMonsterStatblock({ monster }: { monster: any }) {
  const actions = monster.actions ?? [];
  const attrs = monster.attributes ?? {};
  return (
    <div className="monster-sheet-view">
      <div className="monster-sheet-hero">
        <div className="monster-sheet-art">
          {monster.portraitUrl || monster.tokenImageUrl ? (
            <img src={monster.portraitUrl || monster.tokenImageUrl} alt="" />
          ) : (
            <span>No artwork</span>
          )}
        </div>
        <div>
          <p className="eyebrow">{monster.category || monster.type || "Creature"}</p>
          <h3>{monster.name}</h3>
          {monster.subtitle && <p className="muted">{monster.subtitle}</p>}
          <p className="muted small">{monster.size} · Threat {monster.threat} · {(monster.tags ?? []).join(" · ")}</p>
        </div>
      </div>

      <div className="monster-stat-ribbon">
        <span><small>HP</small><strong>{monster.hit_points}</strong></span>
        <span><small>Aura</small><strong>{monster.aura ?? 0}</strong></span>
        <span><small>Defense</small><strong>{monster.defense ?? 8}</strong></span>
        <span><small>Armor</small><strong>{monster.armor ?? 0}</strong></span>
        <span><small>Move</small><strong>{monster.movement ?? 30}</strong></span>
      </div>

      <div className="monster-attribute-grid">
        {REMNANT_ATTRIBUTES.map((attribute) => (
          <span key={attribute.key} className={monster.mainAttribute === attribute.key ? "is-main" : ""}>
            <small>{attribute.name}</small><strong>d{attrs[attribute.key] ?? 6}</strong>
          </span>
        ))}
      </div>

      {monster.description && <p className="monster-description">{monster.description}</p>}
      {(monster.resistances ?? []).length > 0 && <p className="small"><strong>Resistances:</strong> {(monster.resistances ?? []).join(", ")}</p>}
      {(monster.immunities ?? []).length > 0 && <p className="small"><strong>Immunities:</strong> {(monster.immunities ?? []).join(", ")}</p>}
      {(monster.vulnerabilities ?? []).length > 0 && <p className="small"><strong>Vulnerabilities:</strong> {(monster.vulnerabilities ?? []).join(", ")}</p>}
      {(monster.conditionImmunities ?? []).length > 0 && <p className="small"><strong>Condition immunities:</strong> {(monster.conditionImmunities ?? []).join(", ")}</p>}

      {(monster.traits ?? []).length > 0 && <h4>Traits</h4>}
      {(monster.traits ?? []).map((trait: any, index: number) => (
        <p key={`${trait.name}-${index}`} className="small"><strong>{trait.name}.</strong> <span className="muted">{trait.desc}</span></p>
      ))}

      {actions.length > 0 && <h4>Actions & abilities</h4>}
      <div className="monster-action-list">
        {actions.map((action: any, index: number) => (
          <article key={`${action.name}-${index}`} className="monster-action-card">
            <div className="row-between">
              <strong>{action.name}</strong>
              <span className="badge">{action.kind || "Action"}</span>
            </div>
            <p className="muted small">
              {action.attribute ? `${action.attribute} · ` : ""}{action.rollMode || "normal"}
              {action.range ? ` · ${action.range}` : ""}{action.targets ? ` · ${action.targets}` : ""}
            </p>
            {(action.damageDice || action.damageBonus) && <p className="small"><strong>Damage:</strong> {action.damageDice || "0"}{action.damageBonus ? ` + ${action.damageBonus}` : ""}</p>}
            {action.auraCost > 0 && <p className="small"><strong>Aura cost:</strong> {action.auraCost}</p>}
            {action.desc && <p className="muted small">{action.desc}</p>}
          </article>
        ))}
      </div>

      {monster.gmNotes && <details className="monster-gm-notes"><summary>GM notes</summary><p>{monster.gmNotes}</p></details>}
    </div>
  );
}

export function RemnantMonsterEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
  uploadImage,
}: {
  draft: any;
  setDraft: (patch: any) => void;
  onSave: () => void;
  onCancel: () => void;
  uploadImage: (file: File) => Promise<string>;
}) {
  const tokenInput = useRef<HTMLInputElement>(null);
  const portraitInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState("");
  const attrs = draft.attributes ?? {};
  const trained = new Set<string>(draft.trainedSkills ?? []);

  const previewStyle = useMemo(() => ({
    transform: `scale(${draft.tokenScale ?? 1})`,
    objectFit: draft.tokenMode === "cover" ? "cover" as const : "contain" as const,
  }), [draft.tokenScale, draft.tokenMode]);

  const doUpload = async (kind: "token" | "portrait", file?: File) => {
    if (!file) return;
    setUploading(kind);
    try {
      const url = await uploadImage(file);
      setDraft(kind === "token" ? { tokenImageUrl: url } : { portraitUrl: url });
    } finally {
      setUploading("");
    }
  };

  const updateAction = (index: number, patch: any) => setDraft({
    actions: (draft.actions ?? []).map((entry: any, i: number) => i === index ? { ...entry, ...patch } : entry),
  });

  return (
    <section className="card stack monster-editor-card">
      <div className="row-between">
        <div>
          <p className="eyebrow">Monster Library</p>
          <h3>{draft.id ? `Edit: ${draft.name}` : "Create prepared monster"}</h3>
        </div>
        <span className="badge">Full sheet</span>
      </div>

      <div className="monster-editor-section">
        <h4>Identity</h4>
        <div className="field-grid">
          <label>Name<input value={draft.name} onChange={(e) => setDraft({ name: e.target.value })} /></label>
          <label>Subtitle<input value={draft.subtitle ?? ""} onChange={(e) => setDraft({ subtitle: e.target.value })} placeholder="Alpha Beowolf, Atlas prototype…" /></label>
          <label>Size<select value={draft.size} onChange={(e) => setDraft({ size: e.target.value })}>{SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>
          <label>Type<input value={draft.type} onChange={(e) => setDraft({ type: e.target.value })} /></label>
          <label>Category<input value={draft.category ?? ""} onChange={(e) => setDraft({ category: e.target.value })} placeholder="Grimm, Human, Robot, Boss…" /></label>
          <label>Tags<input value={join(draft.tags)} onChange={(e) => setDraft({ tags: csv(e.target.value) })} placeholder="boss, flying, pack" /></label>
        </div>
        <label>Description<textarea rows={3} value={draft.description ?? ""} onChange={(e) => setDraft({ description: e.target.value })} /></label>
      </div>

      <div className="monster-editor-section">
        <h4>Artwork & token</h4>
        <div className="monster-art-editor">
          <div className="monster-token-preview">
            {draft.tokenImageUrl ? <img src={draft.tokenImageUrl} style={previewStyle} alt="Token preview" /> : <span>PNG token preview</span>}
          </div>
          <div className="stack">
            <input ref={tokenInput} hidden type="file" accept="image/png,image/webp,image/jpeg" onChange={(e) => doUpload("token", e.target.files?.[0])} />
            <input ref={portraitInput} hidden type="file" accept="image/png,image/webp,image/jpeg" onChange={(e) => doUpload("portrait", e.target.files?.[0])} />
            <button type="button" className="ghost" onClick={() => tokenInput.current?.click()} disabled={Boolean(uploading)}>{uploading === "token" ? "Uploading…" : "Upload token PNG"}</button>
            <button type="button" className="ghost" onClick={() => portraitInput.current?.click()} disabled={Boolean(uploading)}>{uploading === "portrait" ? "Uploading…" : "Upload portrait"}</button>
            <label>Token scale<input type="range" min="0.5" max="2.5" step="0.05" value={draft.tokenScale ?? 1} onChange={(e) => setDraft({ tokenScale: Number(e.target.value) })} /></label>
            <label>Display<select value={draft.tokenMode ?? "contain"} onChange={(e) => setDraft({ tokenMode: e.target.value })}><option value="contain">Full transparent art</option><option value="cover">Fill token space</option></select></label>
          </div>
          <div className="monster-portrait-preview">{draft.portraitUrl ? <img src={draft.portraitUrl} alt="Portrait preview" /> : <span>Portrait</span>}</div>
        </div>
      </div>

      <div className="monster-editor-section">
        <h4>Combat profile</h4>
        <div className="field-grid">
          <label>Threat<input type="number" min={1} max={10} value={draft.threat} onChange={(e) => setDraft({ threat: Number(e.target.value) })} /></label>
          <label>HP<input type="number" min={1} value={draft.hitPoints} onChange={(e) => setDraft({ hitPoints: Number(e.target.value) })} /></label>
          <label>Aura<input type="number" min={0} value={draft.aura ?? 0} onChange={(e) => setDraft({ aura: Number(e.target.value) })} /></label>
          <label>Defense<input type="number" min={1} value={draft.defense ?? 8} onChange={(e) => setDraft({ defense: Number(e.target.value) })} /></label>
          <label>Armor<input type="number" min={0} value={draft.armor} onChange={(e) => setDraft({ armor: Number(e.target.value) })} /></label>
          <label>Movement<input type="number" min={0} value={draft.movement ?? 30} onChange={(e) => setDraft({ movement: Number(e.target.value) })} /></label>
          <label>Initiative attribute<select value={draft.initiativeAttribute ?? "finesse"} onChange={(e) => setDraft({ initiativeAttribute: e.target.value })}>{REMNANT_ATTRIBUTES.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</select></label>
          <label>Main attribute<select value={draft.mainAttribute ?? "ferocity"} onChange={(e) => setDraft({ mainAttribute: e.target.value })}><option value="ferocity">Ferocity</option>{REMNANT_ATTRIBUTES.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</select></label>
        </div>
      </div>

      <div className="monster-editor-section">
        <h4>Attributes</h4>
        <div className="monster-attribute-grid editor">
          {REMNANT_ATTRIBUTES.map((attribute) => (
            <label key={attribute.key}><span>{attribute.name}</span><select value={attrs[attribute.key] ?? 6} onChange={(e) => setDraft({ attributes: { ...attrs, [attribute.key]: Number(e.target.value) } })}>{DICE.map((die) => <option key={die} value={die}>d{die}</option>)}</select></label>
          ))}
        </div>
      </div>

      <div className="monster-editor-section">
        <h4>Trained skills</h4>
        <div className="monster-skill-grid">
          {REMNANT_SKILLS.map((skill) => (
            <label key={skill.key}><input type="checkbox" checked={trained.has(skill.key)} onChange={(e) => setDraft({ trainedSkills: e.target.checked ? [...trained, skill.key] : [...trained].filter((key) => key !== skill.key) })} /> {skill.name}</label>
          ))}
        </div>
      </div>

      <div className="monster-editor-section">
        <h4>Defenses</h4>
        <div className="field-grid">
          <label>Resistances<input value={join(draft.resistances)} onChange={(e) => setDraft({ resistances: csv(e.target.value) })} placeholder="Fire, physical…" /></label>
          <label>Immunities<input value={join(draft.immunities)} onChange={(e) => setDraft({ immunities: csv(e.target.value) })} /></label>
          <label>Vulnerabilities<input value={join(draft.vulnerabilities)} onChange={(e) => setDraft({ vulnerabilities: csv(e.target.value) })} /></label>
          <label>Condition immunities<input value={join(draft.conditionImmunities)} onChange={(e) => setDraft({ conditionImmunities: csv(e.target.value) })} /></label>
        </div>
      </div>

      <div className="monster-editor-section">
        <h4>Traits</h4>
        {(draft.traits ?? []).map((trait: any, index: number) => (
          <div key={index} className="stack trait-row"><div className="row-between"><input placeholder="Trait name" value={trait.name} onChange={(e) => setDraft({ traits: draft.traits.map((x: any, i: number) => i === index ? { ...x, name: e.target.value } : x) })} /><button type="button" className="ghost mini" onClick={() => setDraft({ traits: draft.traits.filter((_: any, i: number) => i !== index) })}>✕</button></div><textarea rows={2} value={trait.desc} onChange={(e) => setDraft({ traits: draft.traits.map((x: any, i: number) => i === index ? { ...x, desc: e.target.value } : x) })} /></div>
        ))}
        <button type="button" className="ghost mini" onClick={() => setDraft({ traits: [...(draft.traits ?? []), { name: "", desc: "" }] })}>+ Add trait</button>
      </div>

      <div className="monster-editor-section">
        <h4>Actions & abilities</h4>
        {(draft.actions ?? []).map((action: any, index: number) => (
          <article key={index} className="monster-action-editor stack">
            <div className="row-between"><input placeholder="Action name" value={action.name} onChange={(e) => updateAction(index, { name: e.target.value })} /><button type="button" className="ghost mini" onClick={() => setDraft({ actions: draft.actions.filter((_: any, i: number) => i !== index) })}>✕</button></div>
            <div className="field-grid compact">
              <label>Kind<select value={action.kind ?? "Attack"} onChange={(e) => updateAction(index, { kind: e.target.value })}>{ACTION_KINDS.map((kind) => <option key={kind}>{kind}</option>)}</select></label>
              <label>Attribute<select value={action.attribute ?? "ferocity"} onChange={(e) => updateAction(index, { attribute: e.target.value })}><option value="ferocity">Ferocity</option>{REMNANT_ATTRIBUTES.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}</select></label>
              <label>Roll<select value={action.rollMode ?? "normal"} onChange={(e) => updateAction(index, { rollMode: e.target.value })}>{ROLL_MODES.map((mode) => <option key={mode}>{mode}</option>)}</select></label>
              <label>Damage dice<input value={action.damageDice ?? ""} onChange={(e) => updateAction(index, { damageDice: e.target.value })} placeholder="1d8" /></label>
              <label>Damage bonus<input type="number" value={action.damageBonus ?? 0} onChange={(e) => updateAction(index, { damageBonus: Number(e.target.value) })} /></label>
              <label>Range<input value={action.range ?? ""} onChange={(e) => updateAction(index, { range: e.target.value })} placeholder="Close / Mid" /></label>
              <label>Targets<input value={action.targets ?? ""} onChange={(e) => updateAction(index, { targets: e.target.value })} placeholder="One / burst" /></label>
              <label>Aura cost<input type="number" min={0} value={action.auraCost ?? 0} onChange={(e) => updateAction(index, { auraCost: Number(e.target.value) })} /></label>
              <label>Uses<input type="number" min={0} value={action.maxUses ?? 0} onChange={(e) => updateAction(index, { maxUses: Number(e.target.value) })} /></label>
              <label>Recharge<input value={action.recharge ?? ""} onChange={(e) => updateAction(index, { recharge: e.target.value })} placeholder="Scene / 5–6 / HP 50%" /></label>
            </div>
            <textarea rows={2} placeholder="Description and rules" value={action.desc ?? ""} onChange={(e) => updateAction(index, { desc: e.target.value })} />
          </article>
        ))}
        <button type="button" className="ghost mini" onClick={() => setDraft({ actions: [...(draft.actions ?? []), { name: "", desc: "", kind: "Attack", attribute: "ferocity", rollMode: "normal", damageDice: "", damageBonus: 0, range: "Close", targets: "One", auraCost: 0, maxUses: 0, recharge: "" }] })}>+ Add action or ability</button>
      </div>

      <label>Private GM notes<textarea rows={4} value={draft.gmNotes ?? ""} onChange={(e) => setDraft({ gmNotes: e.target.value })} /></label>

      <div className="row-between monster-editor-actions"><button className="primary" onClick={onSave}>{draft.id ? "Save monster" : "Create monster"}</button><button className="ghost" onClick={onCancel}>Cancel</button></div>
    </section>
  );
}
