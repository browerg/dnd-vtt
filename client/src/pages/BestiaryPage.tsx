import { useAuth } from "../App";
import CampaignThemeBrand from "../components/CampaignThemeBrand";
import CampaignThemePicker from "../components/CampaignThemePicker";
import { useCampaignTheme, type ThemeId } from "../theme";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import CampaignDocks from "../components/CampaignDocks";

interface Hit {
  id: number;
  source: "srd" | "custom";
  system?: string;
  name: string;
  cr: number;
  type: string;
  size: string;
  hp: number;
  ac: number;
  threat?: number;
  armor?: number;
}

interface Ability {
  name: string;
  desc: string;
}

interface Action {
  name: string;
  desc: string;
  attack_bonus?: number | "";
  damage_dice?: string;
  damage_bonus?: number | "";
}

interface Detail {
  id: number;
  source: "srd" | "custom";
  cr: number;
  name: string;
  size: string;
  type: string;
  armor_class: number;
  hit_points: number;
  hit_dice: string;
  speed: Record<string, number | boolean>;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  senses: string;
  languages: string;
  special_abilities: Ability[] | null;
  actions: Action[] | null;
  // Remnant Grimm shape
  system?: string;
  threat?: number;
  ferocity?: number;
  armor?: number;
  traits?: Ability[];
}

// Editor working state, flat for form binding.
interface Draft {
  id: number | null;
  name: string;
  size: string;
  type: string;
  cr: number;
  armorClass: number;
  hitPoints: number;
  hitDice: string;
  speedWalk: number;
  speedFly: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  senses: string;
  languages: string;
  specialAbilities: Ability[];
  actions: Action[];
}

const BLANK: Draft = {
  id: null,
  name: "",
  size: "Medium",
  type: "monstrosity",
  cr: 1,
  armorClass: 12,
  hitPoints: 20,
  hitDice: "",
  speedWalk: 30,
  speedFly: 0,
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  senses: "",
  languages: "",
  specialAbilities: [],
  actions: [{ name: "", desc: "", attack_bonus: "", damage_dice: "", damage_bonus: "" }],
};

// Remnant Grimm editor state: Threat 1-5, Ferocity die, flat Armor, traits.
interface GrimmDraft {
  id: number | null;
  name: string;
  size: string;
  type: string;
  threat: number;
  ferocity: number;
  armor: number;
  hitPoints: number;
  traits: Ability[];
}

const BLANK_GRIMM: GrimmDraft = {
  id: null,
  name: "",
  size: "Medium",
  type: "Creature of Grimm",
  threat: 1,
  ferocity: 6,
  armor: 0,
  hitPoints: 20,
  traits: [],
};

const fmtCr = (cr: number) => ({ 0.125: "1/8", 0.25: "1/4", 0.5: "1/2" }[cr] ?? `${cr}`);
const mod = (s: number) => Math.floor((s - 10) / 2);
const fmtMod = (m: number) => (m >= 0 ? `+${m}` : `${m}`);

function detailToDraft(d: Detail): Draft {
  return {
    id: d.id,
    name: d.name,
    size: d.size,
    type: d.type,
    cr: d.cr,
    armorClass: d.armor_class,
    hitPoints: d.hit_points,
    hitDice: d.hit_dice ?? "",
    speedWalk: Number(d.speed?.walk ?? 30) || 30,
    speedFly: Number(d.speed?.fly ?? 0) || 0,
    strength: d.strength,
    dexterity: d.dexterity,
    constitution: d.constitution,
    intelligence: d.intelligence,
    wisdom: d.wisdom,
    charisma: d.charisma,
    senses: d.senses ?? "",
    languages: d.languages ?? "",
    specialAbilities: (d.special_abilities ?? []).map((a) => ({ name: a.name, desc: a.desc })),
    actions: (d.actions ?? []).map((a) => ({
      name: a.name,
      desc: a.desc,
      attack_bonus: a.attack_bonus ?? "",
      damage_dice: a.damage_dice ?? "",
      damage_bonus: a.damage_bonus ?? "",
    })),
  };
}

function detailToGrimmDraft(d: Detail): GrimmDraft {
  return {
    id: d.id,
    name: d.name,
    size: d.size,
    type: d.type,
    threat: d.threat ?? 1,
    ferocity: d.ferocity ?? 6,
    armor: d.armor ?? 0,
    hitPoints: d.hit_points,
    traits: (d.traits ?? []).map((t) => ({ name: t.name, desc: t.desc })),
  };
}

export default function BestiaryPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { user } = useAuth();
  const [role, setRole] = useState("");
  const [system, setSystem] = useState("dnd5e");
  const [campaignTheme, setCampaignTheme] = useState("");
  const [campaignName, setCampaignName] = useState("Campaign");
  const [campaignChapter, setCampaignChapter] = useState("");
  const [campaignSession, setCampaignSession] = useState(0);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [grimmDraft, setGrimmDraft] = useState<GrimmDraft | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isDM = role === "dm" || role === "co-dm";
  const themeView = useCampaignTheme({ campaignId, userId: user?.id, system, campaignTheme });
  const updateCampaignTheme = (theme: ThemeId) => setCampaignTheme(theme);

  useEffect(() => {
    api<{ yourRole: string; campaign: { system: string; theme: string; name: string; chapter: string; session_number: number } }>(`/api/campaigns/${campaignId}`)
      .then((r) => {
        setRole(r.yourRole);
        setSystem(r.campaign.system);
        setCampaignTheme(r.campaign.theme ?? "");
        setCampaignName(r.campaign.name);
        setCampaignChapter(r.campaign.chapter ?? "");
        setCampaignSession(r.campaign.session_number ?? 0);
      })
      .catch((e) => setError(e.message));
  }, [campaignId]);

  const search = useCallback(() => {
    api<{ monsters: Hit[] }>(
      `/api/monsters?campaignId=${campaignId}${query.trim() ? `&q=${encodeURIComponent(query)}` : ""}`
    )
      .then((r) => setHits(r.monsters))
      .catch(() => {});
  }, [campaignId, query]);

  useEffect(() => {
    const t = window.setTimeout(search, 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const open = (monsterId: number) => {
    setDraft(null);
    setGrimmDraft(null);
    api<{ monster: Detail }>(`/api/monsters/${monsterId}`)
      .then((r) => setDetail(r.monster))
      .catch((e) => setError(e.message));
  };

  const save = async () => {
    const working = draft ?? grimmDraft;
    if (!working) return;
    setError("");
    setNotice("");
    const body = grimmDraft ? { ...grimmDraft, system: "remnant", campaignId } : { ...draft, campaignId };
    try {
      if (working.id) {
        await api(`/api/monsters/${working.id}`, { method: "PUT", body: JSON.stringify(body) });
        setNotice("Saved.");
        open(working.id);
      } else {
        const r = await api<{ id: number }>(`/api/monsters`, { method: "POST", body: JSON.stringify(body) });
        setNotice("Created.");
        open(r.id);
      }
      search();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const clone = async (monsterId: number) => {
    setError("");
    try {
      const r = await api<{ id: number }>(`/api/monsters/${monsterId}/clone`, {
        method: "POST",
        body: JSON.stringify({ campaignId }),
      });
      search();
      const d = await api<{ monster: Detail }>(`/api/monsters/${r.id}`);
      setDetail(d.monster);
      if (d.monster.system === "remnant") {
        setDraft(null);
        setGrimmDraft(detailToGrimmDraft(d.monster));
      } else {
        setGrimmDraft(null);
        setDraft(detailToDraft(d.monster));
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const remove = async (monsterId: number) => {
    if (!window.confirm("Delete this custom monster?")) return;
    setError("");
    try {
      await api(`/api/monsters/${monsterId}`, { method: "DELETE" });
      setDetail(null);
      setDraft(null);
      setGrimmDraft(null);
      search();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setG = (patch: Partial<GrimmDraft>) => setGrimmDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <div className="shell campaign-themed" data-system={system} data-theme={themeView.themeId}>
      <header className="topbar campaign-topbar">
        <Link to={`/campaigns/${campaignId}`} className="ghost link campaign-back-link">{"\u2190"}</Link>
        <CampaignThemeBrand
          campaignName={campaignName}
          chapter={campaignChapter}
          sessionNumber={campaignSession}
          themeId={themeView.themeId}
          pageLabel={system === "remnant" ? "Grimm archive" : "Bestiary"}
        />
        <span className="spacer" />
        {isDM && (
          <button
            className="primary"
            onClick={() => {
              setDetail(null);
              if (system === "remnant") {
                setDraft(null);
                setGrimmDraft({ ...BLANK_GRIMM, traits: [] });
              } else {
                setGrimmDraft(null);
                setDraft({ ...BLANK, actions: BLANK.actions.map((a) => ({ ...a })) });
              }
            }}
          >
            {system === "remnant" ? "+ New Grimm" : "+ New monster"}
          </button>
        )}
        <CampaignThemePicker
          campaignId={campaignId}
          role={role}
          system={system}
          campaignTheme={campaignTheme}
          view={themeView}
          onCampaignThemeChange={updateCampaignTheme}
        />
      </header>
      <main className="content columns bestiary">
        <div className="column">
          <section className="card">
            <input
              placeholder="Search monsters…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="bestiary-list">
              {hits.map((h) => (
                <button key={h.id} className="bestiary-row" onClick={() => open(h.id)}>
                  <span className="mon-hit">
                    {h.name}{" "}
                    <span className={h.source === "custom" ? "badge src-custom" : "badge vis-badge"}>
                      {h.source === "custom" ? "custom" : "SRD"}
                    </span>
                  </span>
                  <span className="muted small">
                    {h.system === "remnant"
                      ? `Threat ${h.threat} · Armor ${h.armor} · ${h.hp} hp`
                      : `CR ${fmtCr(h.cr)} · AC ${h.ac} · ${h.hp} hp`}
                  </span>
                </button>
              ))}
              {hits.length === 0 && <p className="muted">No monsters match.</p>}
            </div>
          </section>
        </div>
        <div className="column">
          {error && <div className="error">{error}</div>}
          {notice && <div className="muted small">{notice}</div>}

          {detail && !draft && !grimmDraft && (
            <section className="card">
              <div className="row-between">
                <h3>{detail.name}</h3>
                <span className="codex-controls">
                  {isDM && detail.source === "srd" && (
                    <button className="ghost mini" onClick={() => clone(detail.id)}>
                      Clone to custom
                    </button>
                  )}
                  {isDM && detail.source === "custom" && (
                    <>
                      <button
                        className="ghost mini"
                        onClick={() =>
                          detail.system === "remnant"
                            ? setGrimmDraft(detailToGrimmDraft(detail))
                            : setDraft(detailToDraft(detail))
                        }
                      >
                        Edit
                      </button>
                      <button className="ghost mini" onClick={() => remove(detail.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </span>
              </div>
              {detail.system === "remnant" ? (
                <>
                  <p className="muted small">
                    {detail.size} {detail.type} · Threat {detail.threat}
                  </p>
                  <p>
                    Ferocity <strong>d{detail.ferocity}</strong> · Armor <strong>{detail.armor}</strong> · HP{" "}
                    <strong>{detail.hit_points}</strong>
                  </p>
                  <p className="muted small">
                    Attack 2d10+1d{detail.ferocity} vs Defense · Damage 1d{detail.ferocity} · No Aura
                  </p>
                  {(detail.traits ?? []).map((t) => (
                    <p key={t.name} className="small">
                      <strong>{t.name}.</strong> <span className="muted">{t.desc}</span>
                    </p>
                  ))}
                </>
              ) : (
                <>
                  <p className="muted small">
                    {detail.size} {detail.type} · CR {fmtCr(detail.cr)}
                  </p>
                  <p>
                    AC <strong>{detail.armor_class}</strong> · HP <strong>{detail.hit_points}</strong>
                    {detail.hit_dice && <span className="muted"> ({detail.hit_dice})</span>} · Speed{" "}
                    {Object.entries(detail.speed ?? {})
                      .map(([k, v]) => `${k} ${v}`)
                      .join(", ")}
                  </p>
                  <p className="muted small">
                    {(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const)
                      .map((k, i) => `${["STR", "DEX", "CON", "INT", "WIS", "CHA"][i]} ${detail[k]} (${fmtMod(mod(detail[k]))})`)
                      .join(" · ")}
                  </p>
                  {detail.senses && <p className="muted small">Senses: {detail.senses}</p>}
                  {detail.languages && <p className="muted small">Languages: {detail.languages}</p>}
                  {(detail.special_abilities ?? []).map((a) => (
                    <p key={a.name} className="small">
                      <strong>{a.name}.</strong> <span className="muted">{a.desc}</span>
                    </p>
                  ))}
                  {(detail.actions ?? []).length > 0 && <h4>Actions</h4>}
                  {(detail.actions ?? []).map((a) => (
                    <p key={a.name} className="small">
                      <strong>{a.name}.</strong>{" "}
                      {a.attack_bonus != null && a.attack_bonus !== "" && (
                        <span className="muted">{fmtMod(Number(a.attack_bonus))} to hit, </span>
                      )}
                      {a.damage_dice && (
                        <span className="muted">
                          {a.damage_dice}
                          {a.damage_bonus ? `+${a.damage_bonus}` : ""} dmg —{" "}
                        </span>
                      )}
                      <span className="muted">{a.desc}</span>
                    </p>
                  ))}
                </>
              )}
            </section>
          )}

          {draft && (
            <section className="card stack">
              <h3>{draft.id ? `Edit: ${draft.name}` : "New monster"}</h3>
              <div className="field-grid">
                <label>
                  Name
                  <input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
                </label>
                <label>
                  Size
                  <select value={draft.size} onChange={(e) => set({ size: e.target.value })}>
                    {["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Type
                  <input value={draft.type} onChange={(e) => set({ type: e.target.value })} />
                </label>
                <label>
                  CR
                  <input
                    type="number"
                    step="0.125"
                    value={draft.cr}
                    onChange={(e) => set({ cr: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="field-grid">
                <label>
                  AC
                  <input type="number" value={draft.armorClass} onChange={(e) => set({ armorClass: Number(e.target.value) })} />
                </label>
                <label>
                  HP
                  <input type="number" value={draft.hitPoints} onChange={(e) => set({ hitPoints: Number(e.target.value) })} />
                </label>
                <label>
                  Hit dice
                  <input value={draft.hitDice} placeholder="4d8+4" onChange={(e) => set({ hitDice: e.target.value })} />
                </label>
                <label>
                  Speed
                  <input type="number" value={draft.speedWalk} onChange={(e) => set({ speedWalk: Number(e.target.value) })} />
                </label>
                <label>
                  Fly
                  <input type="number" value={draft.speedFly} onChange={(e) => set({ speedFly: Number(e.target.value) })} />
                </label>
              </div>
              <div className="field-grid">
                {(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const).map(
                  (k, i) => (
                    <label key={k}>
                      {["STR", "DEX", "CON", "INT", "WIS", "CHA"][i]}
                      <input type="number" value={draft[k]} onChange={(e) => set({ [k]: Number(e.target.value) } as any)} />
                    </label>
                  )
                )}
              </div>
              <div className="field-grid">
                <label>
                  Senses
                  <input value={draft.senses} onChange={(e) => set({ senses: e.target.value })} />
                </label>
                <label>
                  Languages
                  <input value={draft.languages} onChange={(e) => set({ languages: e.target.value })} />
                </label>
              </div>

              <h4>Traits</h4>
              {draft.specialAbilities.map((a, i) => (
                <div key={i} className="stack trait-row">
                  <div className="row-between">
                    <input
                      placeholder="Trait name — e.g. Grimm Regeneration"
                      value={a.name}
                      onChange={(e) =>
                        set({
                          specialAbilities: draft.specialAbilities.map((x, j) =>
                            j === i ? { ...x, name: e.target.value } : x
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="ghost mini"
                      onClick={() => set({ specialAbilities: draft.specialAbilities.filter((_, j) => j !== i) })}
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="What it does"
                    value={a.desc}
                    onChange={(e) =>
                      set({
                        specialAbilities: draft.specialAbilities.map((x, j) =>
                          j === i ? { ...x, desc: e.target.value } : x
                        ),
                      })
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                className="ghost mini"
                onClick={() => set({ specialAbilities: [...draft.specialAbilities, { name: "", desc: "" }] })}
              >
                + Add trait
              </button>

              <h4>Actions</h4>
              {draft.actions.map((a, i) => (
                <div key={i} className="stack trait-row">
                  <div className="row-between">
                    <input
                      placeholder="Action name — e.g. Bite"
                      value={a.name}
                      onChange={(e) =>
                        set({ actions: draft.actions.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })
                      }
                    />
                    <button
                      type="button"
                      className="ghost mini"
                      onClick={() => set({ actions: draft.actions.filter((_, j) => j !== i) })}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="row-between">
                    <label className="inline-num">
                      to hit
                      <input
                        type="number"
                        value={a.attack_bonus}
                        onChange={(e) =>
                          set({
                            actions: draft.actions.map((x, j) =>
                              j === i ? { ...x, attack_bonus: e.target.value === "" ? "" : Number(e.target.value) } : x
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="inline-num">
                      dice
                      <input
                        placeholder="2d6"
                        value={a.damage_dice}
                        onChange={(e) =>
                          set({ actions: draft.actions.map((x, j) => (j === i ? { ...x, damage_dice: e.target.value } : x)) })
                        }
                      />
                    </label>
                    <label className="inline-num">
                      +dmg
                      <input
                        type="number"
                        value={a.damage_bonus}
                        onChange={(e) =>
                          set({
                            actions: draft.actions.map((x, j) =>
                              j === i ? { ...x, damage_bonus: e.target.value === "" ? "" : Number(e.target.value) } : x
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Description"
                    value={a.desc}
                    onChange={(e) =>
                      set({ actions: draft.actions.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)) })
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                className="ghost mini"
                onClick={() =>
                  set({ actions: [...draft.actions, { name: "", desc: "", attack_bonus: "", damage_dice: "", damage_bonus: "" }] })
                }
              >
                + Add action
              </button>

              <div className="row-between">
                <button className="primary" onClick={save}>
                  {draft.id ? "Save changes" : "Create monster"}
                </button>
                <button className="ghost" onClick={() => setDraft(null)}>
                  Cancel
                </button>
              </div>
            </section>
          )}

          {grimmDraft && (
            <section className="card stack">
              <h3>{grimmDraft.id ? `Edit: ${grimmDraft.name}` : "New Grimm"}</h3>
              <div className="field-grid">
                <label>
                  Name
                  <input value={grimmDraft.name} onChange={(e) => setG({ name: e.target.value })} />
                </label>
                <label>
                  Size
                  <select value={grimmDraft.size} onChange={(e) => setG({ size: e.target.value })}>
                    {["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Type
                  <input value={grimmDraft.type} onChange={(e) => setG({ type: e.target.value })} />
                </label>
              </div>
              <div className="field-grid">
                <label>
                  Threat (1–5)
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={grimmDraft.threat}
                    onChange={(e) => setG({ threat: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Ferocity
                  <select value={grimmDraft.ferocity} onChange={(e) => setG({ ferocity: Number(e.target.value) })}>
                    {[4, 6, 8, 10, 12].map((d) => (
                      <option key={d} value={d}>
                        d{d}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Armor
                  <input
                    type="number"
                    min={0}
                    value={grimmDraft.armor}
                    onChange={(e) => setG({ armor: Number(e.target.value) })}
                  />
                </label>
                <label>
                  HP
                  <input
                    type="number"
                    min={1}
                    value={grimmDraft.hitPoints}
                    onChange={(e) => setG({ hitPoints: Number(e.target.value) })}
                  />
                </label>
              </div>

              <h4>Traits</h4>
              {grimmDraft.traits.map((t, i) => (
                <div key={i} className="stack trait-row">
                  <div className="row-between">
                    <input
                      placeholder="Trait name — e.g. Pack Tactics"
                      value={t.name}
                      onChange={(e) =>
                        setG({
                          traits: grimmDraft.traits.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="ghost mini"
                      onClick={() => setG({ traits: grimmDraft.traits.filter((_, j) => j !== i) })}
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="What it does"
                    value={t.desc}
                    onChange={(e) =>
                      setG({
                        traits: grimmDraft.traits.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)),
                      })
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                className="ghost mini"
                onClick={() => setG({ traits: [...grimmDraft.traits, { name: "", desc: "" }] })}
              >
                + Add trait
              </button>

              <div className="row-between">
                <button className="primary" onClick={save}>
                  {grimmDraft.id ? "Save changes" : "Create Grimm"}
                </button>
                <button className="ghost" onClick={() => setGrimmDraft(null)}>
                  Cancel
                </button>
              </div>
            </section>
          )}

          {!detail && !draft && !grimmDraft && (
            <section className="card">
              <p className="muted">
                Pick a monster to view its stat block
                {isDM
                  ? system === "remnant"
                    ? ", tweak the seeded Grimm, or hit + New Grimm to build your own"
                    : ", clone an SRD monster to customize it, or hit + New monster to build your own — Grimm welcome"
                  : ""}
                .
              </p>
            </section>
          )}
        </div>
      </main>
      <CampaignDocks />
    </div>
  );
}
