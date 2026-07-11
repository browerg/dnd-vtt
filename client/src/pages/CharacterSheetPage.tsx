import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { api } from "../api";
import { useAuth } from "../App";
import {
  ABILITIES,
  CONDITIONS,
  SKILLS,
  abilityMod,
  d20Formula,
  fmtMod,
  saveMod,
  skillMod,
  type Character,
  type CharacterData,
} from "../sheet";
import RemnantSheet from "../components/RemnantSheet";
import type { RemnantData } from "../remnant";

type RollMode = "normal" | "advantage" | "disadvantage" | "edge" | "setback";

export default function CharacterSheetPage() {
  const { id, charId } = useParams();
  const campaignId = Number(id);
  const characterId = Number(charId);
  const { user } = useAuth();

  const [character, setCharacter] = useState<Character | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  const [spellQuery, setSpellQuery] = useState("");
  const [spellHits, setSpellHits] = useState<
    { id: number; name: string; level: number; school: string; desc: string; higherLevel: string; castingTime: string; range: string; duration: string; concentration: boolean }[]
  >([]);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [error, setError] = useState("");
  const saveTimer = useRef<number>();
  const dirtyRef = useRef(false);
  const portraitInput = useRef<HTMLInputElement>(null);

  const uploadPortrait = async (file: File) => {
    const fd = new FormData();
    fd.append("portrait", file);
    const res = await fetch(`/api/campaigns/${campaignId}/characters/${characterId}/portrait`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      window.alert((await res.json()).error ?? "Portrait upload failed");
      return;
    }
    const r = (await res.json()) as { portraitUrl: string };
    setCharacter((prev) => (prev ? { ...prev, portraitUrl: r.portraitUrl } : prev));
  };

  const removePortrait = async () => {
    await api(`/api/campaigns/${campaignId}/characters/${characterId}/portrait`, { method: "DELETE" });
    setCharacter((prev) => (prev ? { ...prev, portraitUrl: "" } : prev));
  };

  useEffect(() => {
    api<{ character: Character; canEdit: boolean }>(
      `/api/campaigns/${campaignId}/characters/${characterId}`
    )
      .then((r) => {
        setCharacter(r.character);
        setCanEdit(r.canEdit);
      })
      .catch((e) => setError(e.message));
  }, [campaignId, characterId]);

  // Live sync: apply other people's edits, but never stomp our unsaved changes.
  useEffect(() => {
    const socket: Socket = io();
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on(
      "character:update",
      (msg: { campaignId: number; updatedBy: number; character: Character }) => {
        if (msg.campaignId !== campaignId || msg.character.id !== characterId) return;
        if (msg.updatedBy === user?.id) return;
        if (dirtyRef.current) return;
        setCharacter(msg.character);
      }
    );
    return () => {
      socket.disconnect();
    };
  }, [campaignId, characterId, user?.id]);

  const persist = useCallback(
    (next: Character) => {
      window.clearTimeout(saveTimer.current);
      setSaveState("saving");
      saveTimer.current = window.setTimeout(async () => {
        try {
          await api(`/api/campaigns/${campaignId}/characters/${characterId}`, {
            method: "PUT",
            body: JSON.stringify({ name: next.name, data: next.data }),
          });
          dirtyRef.current = false;
          setSaveState("saved");
        } catch {
          setSaveState("error");
        }
      }, 700);
    },
    [campaignId, characterId]
  );

  const update = useCallback(
    (patch: Record<string, unknown>, name?: string) => {
      setCharacter((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          name: name ?? prev.name,
          data: { ...prev.data, ...patch },
        };
        dirtyRef.current = true;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  useEffect(() => {
    if (!spellQuery.trim()) {
      setSpellHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      api<{ spells: typeof spellHits }>(`/api/spells?q=${encodeURIComponent(spellQuery)}`)
        .then((r) => setSpellHits(r.spells))
        .catch(() => {});
    }, 250);
    return () => window.clearTimeout(t);
  }, [spellQuery]);

  const roll = async (formula: string, label: string) => {
    await api(`/api/campaigns/${campaignId}/rolls`, {
      method: "POST",
      body: JSON.stringify({ formula, label, mode: rollMode, visibility: "public" }),
    });
  };

  if (error) return <div className="page-center error">{error}</div>;
  if (!character) return <div className="page-center muted">Loading…</div>;
  const isRemnant = (character.data as unknown as RemnantData).system === "remnant";
  const d = character.data;
  const ro = !canEdit;
  const modeOptions: RollMode[] = isRemnant
    ? ["normal", "edge", "setback"]
    : ["normal", "advantage", "disadvantage"];
  const modeLabel = (m: RollMode) =>
    ({ normal: "Normal", advantage: "Adv", disadvantage: "Dis", edge: "Edge", setback: "Setback" })[m];

  const num = (v: string, fallback = 0) => {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? fallback : n;
  };

  const toggleInList = (list: string[], key: string) =>
    list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

  const passivePerception = isRemnant ? 0 : 10 + skillMod(d, "perception");

  return (
    <div className="shell">
      <header className="topbar">
        <Link to={`/campaigns/${campaignId}`} className="ghost link">
          ← Campaign
        </Link>
        <button
          type="button"
          className="avatar-btn"
          title={ro ? character.name : "Set portrait (PNG/JPEG/WebP)"}
          onClick={() => !ro && portraitInput.current?.click()}
        >
          {character.portraitUrl ? (
            <img src={character.portraitUrl} alt={character.name} />
          ) : (
            <span>{character.name[0]?.toUpperCase() ?? "?"}</span>
          )}
        </button>
        {!ro && character.portraitUrl && (
          <button className="ghost mini" title="Remove portrait" onClick={removePortrait}>
            ✕
          </button>
        )}
        {!ro && (
          <input
            ref={portraitInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadPortrait(f);
              e.target.value = "";
            }}
          />
        )}
        <span className="brand">{character.name}</span>
        <span className="muted">
          {character.ownerName}
          {ro ? " · view only" : ""}
        </span>
        <span className="spacer" />
        <div className="seg" role="group" aria-label="Roll mode for sheet rolls">
          {modeOptions.map((m) => (
            <button
              key={m}
              className={rollMode === m ? "seg-btn active" : "seg-btn"}
              onClick={() => setRollMode(m)}
            >
              {modeLabel(m)}
            </button>
          ))}
        </div>
        <span className={`save-state ${saveState}`}>
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed!" : "Saved"}
        </span>
      </header>

      {isRemnant ? (
        <RemnantSheet
          name={character.name}
          d={character.data as unknown as RemnantData}
          ro={ro}
          update={update}
          roll={roll}
        />
      ) : (
      <main className="content sheet">
        {/* ---- identity + vitals ---- */}
        <section className="card sheet-header">
          <div className="field-grid">
            <label>
              Name
              <input value={character.name} disabled={ro} onChange={(e) => update({}, e.target.value)} />
            </label>
            <label>
              Race
              <input value={d.race} disabled={ro} onChange={(e) => update({ race: e.target.value })} />
            </label>
            <label>
              Class
              <input value={d.class} disabled={ro} onChange={(e) => update({ class: e.target.value })} />
            </label>
            <label>
              Level
              <input
                type="number"
                min={1}
                max={20}
                value={d.level}
                disabled={ro}
                onChange={(e) => update({ level: num(e.target.value, 1) })}
              />
            </label>
            <label>
              Prof. bonus
              <input
                type="number"
                value={d.profBonus}
                disabled={ro}
                onChange={(e) => update({ profBonus: num(e.target.value) })}
              />
            </label>
          </div>
          <div className="vitals">
            <div className="vital hp-vital">
              <span className="vital-label">HP</span>
              <div className="hp-controls">
                <button className="ghost" disabled={ro} onClick={() => update({ hp: Math.max(0, d.hp - 1) })}>
                  −
                </button>
                <span className="vital-value">
                  {d.hp}
                  <span className="muted">/{d.maxHp}</span>
                  {d.tempHp > 0 && <span className="temp-hp"> +{d.tempHp}</span>}
                </span>
                <button
                  className="ghost"
                  disabled={ro}
                  onClick={() => update({ hp: Math.min(d.maxHp, d.hp + 1) })}
                >
                  +
                </button>
              </div>
              <div className="hp-edit">
                <label>
                  Max
                  <input
                    type="number"
                    value={d.maxHp}
                    disabled={ro}
                    onChange={(e) => update({ maxHp: num(e.target.value) })}
                  />
                </label>
                <label>
                  Temp
                  <input
                    type="number"
                    value={d.tempHp}
                    disabled={ro}
                    onChange={(e) => update({ tempHp: num(e.target.value) })}
                  />
                </label>
              </div>
            </div>
            <div className="vital">
              <span className="vital-label">AC</span>
              <input
                className="vital-input"
                type="number"
                value={d.ac}
                disabled={ro}
                onChange={(e) => update({ ac: num(e.target.value) })}
              />
            </div>
            <button
              className="vital rollable"
              onClick={() => roll(d20Formula(abilityMod(d.abilities.dex)), `${character.name}: Initiative`)}
            >
              <span className="vital-label">Initiative</span>
              <span className="vital-value">{fmtMod(abilityMod(d.abilities.dex))}</span>
            </button>
            <div className="vital">
              <span className="vital-label">Speed</span>
              <input
                className="vital-input"
                type="number"
                value={d.speed}
                disabled={ro}
                onChange={(e) => update({ speed: num(e.target.value) })}
              />
            </div>
            <div className="vital">
              <span className="vital-label">Passive Perc.</span>
              <span className="vital-value">{passivePerception}</span>
            </div>
            <div className="vital">
              <span className="vital-label">Hit dice</span>
              <span className="vital-value hit-dice">
                <input
                  type="number"
                  value={d.hitDiceRemaining}
                  disabled={ro}
                  onChange={(e) => update({ hitDiceRemaining: num(e.target.value) })}
                />
                <input
                  className="hd-type"
                  value={d.hitDiceType}
                  disabled={ro}
                  onChange={(e) => update({ hitDiceType: e.target.value })}
                />
              </span>
            </div>
          </div>
        </section>

        <div className="columns">
          <div className="column">
            {/* ---- abilities ---- */}
            <section className="card">
              <h3>Abilities</h3>
              <div className="ability-grid">
                {ABILITIES.map(({ key, name }) => {
                  const mod = abilityMod(d.abilities[key]);
                  const save = saveMod(d, key);
                  return (
                    <div key={key} className="ability-box">
                      <span className="ability-name">{key.toUpperCase()}</span>
                      <input
                        type="number"
                        className="ability-score"
                        value={d.abilities[key]}
                        disabled={ro}
                        onChange={(e) =>
                          update({ abilities: { ...d.abilities, [key]: num(e.target.value, 10) } })
                        }
                      />
                      <button className="ghost mini" onClick={() => roll(d20Formula(mod), `${character.name}: ${name} check`)}>
                        Check {fmtMod(mod)}
                      </button>
                      <button
                        className="ghost mini"
                        onClick={() => roll(d20Formula(save), `${character.name}: ${name} save`)}
                      >
                        Save {fmtMod(save)}
                      </button>
                      <label className="prof-toggle">
                        <input
                          type="checkbox"
                          checked={d.saveProfs.includes(key)}
                          disabled={ro}
                          onChange={() => update({ saveProfs: toggleInList(d.saveProfs, key) })}
                        />
                        prof.
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ---- skills ---- */}
            <section className="card">
              <h3>Skills</h3>
              <ul className="skill-list">
                {SKILLS.map(({ key, name, ability }) => {
                  const mod = skillMod(d, key);
                  return (
                    <li key={key}>
                      <input
                        type="checkbox"
                        title="Proficient"
                        checked={d.skillProfs.includes(key)}
                        disabled={ro}
                        onChange={() => update({ skillProfs: toggleInList(d.skillProfs, key) })}
                      />
                      <button
                        className="skill-roll"
                        onClick={() => roll(d20Formula(mod), `${character.name}: ${name}`)}
                      >
                        {name} <span className="muted">({ability.toUpperCase()})</span>
                        <span className="skill-mod">{fmtMod(mod)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* ---- conditions ---- */}
            <section className="card">
              <h3>Conditions</h3>
              <div className="condition-chips">
                {CONDITIONS.map((c) => (
                  <button
                    key={c}
                    className={d.conditions.includes(c) ? "chip active" : "chip"}
                    disabled={ro}
                    onClick={() => update({ conditions: toggleInList(d.conditions, c) })}
                  >
                    {c}
                  </button>
                ))}
                <label className="exhaustion">
                  Exhaustion
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={d.exhaustion}
                    disabled={ro}
                    onChange={(e) => update({ exhaustion: Math.min(6, Math.max(0, num(e.target.value))) })}
                  />
                </label>
              </div>
            </section>
          </div>

          <div className="column">
            {/* ---- inventory ---- */}
            <section className="card">
              <div className="row-between">
                <h3>Inventory</h3>
                <label className="gold">
                  🪙
                  <input
                    type="number"
                    value={d.gold}
                    disabled={ro}
                    onChange={(e) => update({ gold: num(e.target.value) })}
                  />
                </label>
              </div>
              <ul className="item-list">
                {d.inventory.map((item) => (
                  <li key={item.id} className="item-row">
                    <input
                      type="checkbox"
                      title="Equipped"
                      checked={item.equipped}
                      disabled={ro}
                      onChange={() =>
                        update({
                          inventory: d.inventory.map((i) =>
                            i.id === item.id ? { ...i, equipped: !i.equipped } : i
                          ),
                        })
                      }
                    />
                    <input
                      className="item-name"
                      value={item.name}
                      disabled={ro}
                      onChange={(e) =>
                        update({
                          inventory: d.inventory.map((i) =>
                            i.id === item.id ? { ...i, name: e.target.value } : i
                          ),
                        })
                      }
                    />
                    <input
                      type="number"
                      className="item-qty"
                      title="Quantity"
                      value={item.qty}
                      disabled={ro}
                      onChange={(e) =>
                        update({
                          inventory: d.inventory.map((i) =>
                            i.id === item.id ? { ...i, qty: num(e.target.value, 1) } : i
                          ),
                        })
                      }
                    />
                    {!ro && (
                      <button
                        className="ghost mini"
                        title="Remove"
                        onClick={() => update({ inventory: d.inventory.filter((i) => i.id !== item.id) })}
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {!ro && (
                <button
                  className="ghost"
                  onClick={() =>
                    update({
                      inventory: [
                        ...d.inventory,
                        { id: crypto.randomUUID(), name: "", qty: 1, weight: 0, equipped: false },
                      ],
                    })
                  }
                >
                  + Add item
                </button>
              )}
            </section>

            {/* ---- spellcasting ---- */}
            <section className="card">
              <h3>Spellcasting</h3>
              <div className="slot-grid">
                {d.spellSlots.map((slot, i) =>
                  slot.max > 0 || !ro ? (
                    <div key={i} className="slot-box">
                      <span className="muted">Lv {i + 1}</span>
                      <div className="slot-controls">
                        <button
                          className="ghost mini"
                          disabled={ro || slot.used >= slot.max}
                          title="Use slot"
                          onClick={() =>
                            update({
                              spellSlots: d.spellSlots.map((s, j) =>
                                j === i ? { ...s, used: s.used + 1 } : s
                              ),
                            })
                          }
                        >
                          Use
                        </button>
                        <span>
                          {slot.max - slot.used}/{slot.max}
                        </span>
                        {!ro && (
                          <input
                            type="number"
                            className="slot-max"
                            title="Max slots"
                            value={slot.max}
                            onChange={(e) =>
                              update({
                                spellSlots: d.spellSlots.map((s, j) =>
                                  j === i
                                    ? { max: Math.max(0, num(e.target.value)), used: Math.min(s.used, Math.max(0, num(e.target.value))) }
                                    : s
                                ),
                              })
                            }
                          />
                        )}
                      </div>
                    </div>
                  ) : null
                )}
              </div>
              {!ro && (
                <button
                  className="ghost mini"
                  onClick={() => update({ spellSlots: d.spellSlots.map((s) => ({ ...s, used: 0 })) })}
                >
                  Long rest (reset slots)
                </button>
              )}
              <label className="concentration">
                Concentrating on
                <input
                  value={d.concentratingOn}
                  disabled={ro}
                  placeholder="—"
                  onChange={(e) => update({ concentratingOn: e.target.value })}
                />
              </label>
              <ul className="item-list">
                {d.spells.map((spell) => (
                  <li key={spell.id} className="spell-row">
                    <div className="item-row">
                      <input
                        type="number"
                        className="item-qty"
                        title="Spell level (0 = cantrip)"
                        value={spell.level}
                        disabled={ro}
                        onChange={(e) =>
                          update({
                            spells: d.spells.map((s) =>
                              s.id === spell.id ? { ...s, level: Math.min(9, Math.max(0, num(e.target.value))) } : s
                            ),
                          })
                        }
                      />
                      <input
                        className="item-name"
                        placeholder="Spell name"
                        value={spell.name}
                        disabled={ro}
                        onChange={(e) =>
                          update({
                            spells: d.spells.map((s) => (s.id === spell.id ? { ...s, name: e.target.value } : s)),
                          })
                        }
                      />
                      {!ro && (
                        <button
                          className="ghost mini"
                          title="Remove"
                          onClick={() => update({ spells: d.spells.filter((s) => s.id !== spell.id) })}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {spell.notes && (
                      <details className="spell-desc">
                        <summary className="muted small">description</summary>
                        <p className="muted small pre-wrap">{spell.notes}</p>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
              {!ro && (
                <div className="stack spell-search">
                  <input
                    placeholder="Search SRD spells to add…"
                    value={spellQuery}
                    onChange={(e) => setSpellQuery(e.target.value)}
                  />
                  {spellHits.map((s) => (
                    <div key={s.id} className="row-between sidebar-row">
                      <span className="mon-hit">
                        {s.name}{" "}
                        <span className="muted small">
                          {s.level === 0 ? "cantrip" : `lv ${s.level}`} · {s.school}
                          {s.concentration ? " · conc." : ""}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="ghost mini"
                        onClick={() => {
                          const notes = `${s.castingTime} · ${s.range} · ${s.duration}\n\n${s.desc}${
                            s.higherLevel ? `\n\nAt higher levels: ${s.higherLevel}` : ""
                          }`;
                          update({
                            spells: [...d.spells, { id: crypto.randomUUID(), name: s.name, level: s.level, notes }],
                          });
                          setSpellQuery("");
                        }}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {!ro && (
                <button
                  className="ghost"
                  onClick={() =>
                    update({ spells: [...d.spells, { id: crypto.randomUUID(), name: "", level: 1, notes: "" }] })
                  }
                >
                  + Add spell
                </button>
              )}
            </section>

            {/* ---- text fields ---- */}
            <section className="card stack">
              <h3>Notes</h3>
              <label>
                Languages
                <input value={d.languages} disabled={ro} onChange={(e) => update({ languages: e.target.value })} />
              </label>
              <label>
                Other proficiencies
                <input
                  value={d.proficiencies}
                  disabled={ro}
                  onChange={(e) => update({ proficiencies: e.target.value })}
                />
              </label>
              <label>
                Backstory
                <textarea
                  rows={4}
                  value={d.backstory}
                  disabled={ro}
                  onChange={(e) => update({ backstory: e.target.value })}
                />
              </label>
              <label>
                Notes
                <textarea rows={4} value={d.notes} disabled={ro} onChange={(e) => update({ notes: e.target.value })} />
              </label>
            </section>
          </div>
        </div>
      </main>
      )}
    </div>
  );
}
