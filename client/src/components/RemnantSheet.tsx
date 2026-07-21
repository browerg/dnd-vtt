import {
  ACADEMIES,
  ARCHETYPES,
  ARMOR_TYPES,
  DIE_SIZES,
  DUST_TYPES,
  RANGE_BANDS,
  RANKS,
  REMNANT_ATTRIBUTES,
  REMNANT_CONDITIONS,
  REMNANT_SKILLS,
  SEMBLANCE_DURATIONS,
  SEMBLANCE_INTENSITIES,
  SEMBLANCE_SCOPES,
  SEMBLANCE_TYPES,
  SEMBLANCE_UPGRADES,
  auraMaxFor,
  defenseRating,
  hpMaxFor,
  remnantCheckFormula,
  semblanceCost,
  trainingBonus,
  type RemnantAttrKey,
  type RemnantData,
} from "../remnant";
import InventoryEditor from "./InventoryEditor";

interface Props {
  name: string;
  d: RemnantData;
  ro: boolean; // read-only
  update: (patch: Partial<RemnantData>, name?: string) => void;
  roll: (
    formula: string,
    label: string,
    mode?: "normal" | "edge" | "setback"
  ) => void;
  onUpload?: (file: File) => Promise<string>;
}

const num = (v: string, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
};

export default function RemnantSheet({ name, d, ro, update, roll, onUpload }: Props) {
  const tb = trainingBonus(d.rank);
  const auraMax = auraMaxFor(d);
  const hpMax = hpMaxFor(d);
  const dr = defenseRating(d);
  const cost = semblanceCost(d);

  // Any change that can move the computed maxima re-mirrors them into the data
  // so map tokens (which read hp/maxHp/aura/auraMax) stay honest.
  const patch = (p: Partial<RemnantData>) => {
    const next = { ...d, ...p };
    const nextAuraMax = auraMaxFor(next);
    const nextHpMax = hpMaxFor(next);
    update({
      ...p,
      auraMax: nextAuraMax,
      maxHp: nextHpMax,
      aura: Math.min(next.aura, nextAuraMax),
      hp: Math.min(next.hp, nextHpMax),
    });
  };

  const toggleIn = (list: string[], key: string) =>
    list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

  const attrDie = (k: RemnantAttrKey) => d.attributes[k];

  const pool = (label: string, value: number, max: number, onChange: (v: number) => void, cls: string) => (
    <div className={`vital pool ${cls}`}>
      <span className="vital-label">{label}</span>
      <div className="hp-controls">
        <button className="ghost" disabled={ro} onClick={() => onChange(Math.max(0, value - 5))}>
          −5
        </button>
        <button className="ghost" disabled={ro} onClick={() => onChange(Math.max(0, value - 1))}>
          −
        </button>
        <span className="vital-value">
          {value}
          <span className="muted">/{max}</span>
        </span>
        <button className="ghost" disabled={ro} onClick={() => onChange(Math.min(max, value + 1))}>
          +
        </button>
        <button className="ghost" disabled={ro} onClick={() => onChange(max)} title="Restore to full">
          ↺
        </button>
      </div>
      <span className="pool-bar">
        <span className={`pool-fill ${cls}`} style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
      </span>
    </div>
  );

  return (
    <main className="content sheet">
      {/* identity */}
      <section className="card sheet-header">
        <div className="field-grid">
          <label>
            Name
            <input value={name} disabled={ro} onChange={(e) => update({}, e.target.value)} />
          </label>
          <label>
            Age
            <input value={d.age} disabled={ro} onChange={(e) => update({ age: e.target.value })} />
          </label>
          <label>
            Pronouns
            <input value={d.gender} disabled={ro} onChange={(e) => update({ gender: e.target.value })} />
          </label>
          <label>
            Species / Faunus trait
            <input value={d.species} disabled={ro} onChange={(e) => update({ species: e.target.value })} />
          </label>
          <label>
            Hometown
            <input value={d.hometown} disabled={ro} onChange={(e) => update({ hometown: e.target.value })} />
          </label>
        </div>
        <div className="field-grid">
          <label>
            Academy
            <select value={d.academy} disabled={ro} onChange={(e) => update({ academy: e.target.value })}>
              {ACADEMIES.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Year
            <input value={d.academyYear} disabled={ro} onChange={(e) => update({ academyYear: e.target.value })} />
          </label>
          <label>
            Archetype
            <select value={d.archetype} disabled={ro} onChange={(e) => update({ archetype: e.target.value })}>
              {ARCHETYPES.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Main Attribute
            <select
              value={d.mainAttribute || "brawn"}
              disabled={ro}
              onChange={(e) =>
                update({ mainAttribute: e.target.value as RemnantAttrKey })
              }
              title="This character-level attribute die is added to weapon damage"
            >
              {REMNANT_ATTRIBUTES.map(({ key, name: attrName }) => (
                <option key={key} value={key}>
                  {attrName} (d{d.attributes[key]})
                </option>
              ))}
            </select>
          </label>
          <label>
            Rank
            <select value={d.rank} disabled={ro} onChange={(e) => patch({ rank: e.target.value as RemnantData["rank"] })}>
              {RANKS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Team
            <input
              value={d.teamName}
              disabled={ro}
              placeholder="Team acronym"
              onChange={(e) => update({ teamName: e.target.value })}
            />
          </label>
          <label>
            Role
            <input value={d.teamRole} disabled={ro} onChange={(e) => update({ teamRole: e.target.value })} />
          </label>
        </div>

        {/* vitals */}
        <div className="vitals">
          {pool("Aura", d.aura, auraMax, (v) => update({ aura: v }), "aura-pool")}
          <label className="vital aura-color-control" title="Aura color used on map tokens">
            <span className="vital-label">Aura Color</span>
            <input
              type="color"
              value={d.auraColor || "#78e1ff"}
              disabled={ro}
              onChange={(e) => update({ auraColor: e.target.value })}
            />
          </label>
          {pool("HP", d.hp, hpMax, (v) => update({ hp: v }), "hp-pool")}
          <div className="vital">
            <span className="vital-label">Defense</span>
            <span className="vital-value">{dr}</span>
            <select
              value={d.armor}
              disabled={ro}
              onChange={(e) => update({ armor: e.target.value })}
              title="Armor"
            >
              {ARMOR_TYPES.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.name} +{a.bonus}
                </option>
              ))}
            </select>
          </div>
          <div className="vital">
            <span className="vital-label">Training</span>
            <span className="vital-value">+{tb}</span>
          </div>
          <button
            className="vital rollable"
            onClick={() => roll(remnantCheckFormula(attrDie("finesse")), `${name}: Initiative`)}
          >
            <span className="vital-label">Initiative</span>
            <span className="vital-value">2d10+d{attrDie("finesse")}</span>
          </button>
        </div>
        {d.aura === 0 && <div className="aura-broken-banner">⚠ AURA BROKEN — shield down, Semblance locked</div>}
        {d.hp === 0 &&
          !d.conditions.includes("Downed") &&
          !d.conditions.includes("Critically Downed") && (
            <div className="final-flare-banner">
              <div>
                🔥 <strong>FINAL FLARE</strong> — one full turn, can't be downed, then make a Grit check DC 14
              </div>
              <div className="final-flare-actions">
                <button
                  className="ghost mini"
                  disabled={ro}
                  onClick={() =>
                    roll(remnantCheckFormula(attrDie("grit")), `${name}: Final Flare (Grit, DC 14)`)
                  }
                >
                  Roll Grit
                </button>
                <button
                  className="ghost mini"
                  disabled={ro}
                  title="Full success"
                  onClick={() =>
                    update({
                      hp: 1,
                      conditions: d.conditions.filter(
                        (condition) => condition !== "Downed" && condition !== "Critically Downed"
                      ),
                    })
                  }
                >
                  Stand at 1 HP
                </button>
                <button
                  className="ghost mini"
                  disabled={ro}
                  title="Partial success"
                  onClick={() =>
                    update({
                      conditions: [
                        ...d.conditions.filter(
                          (condition) =>
                            condition !== "Downed" && condition !== "Critically Downed"
                        ),
                        "Downed",
                      ],
                    })
                  }
                >
                  Downed
                </button>
                <button
                  className="ghost mini danger"
                  disabled={ro}
                  title="Failure"
                  onClick={() =>
                    update({
                      conditions: [
                        ...d.conditions.filter(
                          (condition) =>
                            condition !== "Downed" && condition !== "Critically Downed"
                        ),
                        "Critically Downed",
                      ],
                    })
                  }
                >
                  Critically Downed
                </button>
              </div>
            </div>
          )}
        {d.hp === 0 && d.conditions.includes("Downed") && (
          <div className="downed-state-banner">
            DOWNED — stable, unable to act until helped or recovered
          </div>
        )}
        {d.hp === 0 && d.conditions.includes("Critically Downed") && (
          <div className="critical-downed-state-banner">
            CRITICALLY DOWNED — immediate aid required
          </div>
        )}
      </section>

      <div className="columns">
        <div className="column">
          {/* attributes */}
          <section className="card">
            <h3>Attributes</h3>
            <div className="ability-grid">
              {REMNANT_ATTRIBUTES.map(({ key, name: attrName, blurb }) => (
                <div key={key} className="ability-box">
                  <span className="ability-name" title={blurb}>
                    {attrName.toUpperCase()}
                  </span>
                  <select
                    className="die-select"
                    value={d.attributes[key]}
                    disabled={ro}
                    onChange={(e) =>
                      patch({ attributes: { ...d.attributes, [key]: num(e.target.value, 6) } })
                    }
                  >
                    {DIE_SIZES.map((s) => (
                      <option key={s} value={s}>
                        d{s}
                      </option>
                    ))}
                  </select>
                  <button
                    className="ghost mini"
                    onClick={() => roll(remnantCheckFormula(d.attributes[key]), `${name}: ${attrName} check`)}
                  >
                    Roll 2d10+d{d.attributes[key]}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* skills */}
          <section className="card">
            <h3>Skills</h3>
            <ul className="skill-list">
              {REMNANT_SKILLS.map(({ key, name: skillName, attr }) => {
                const trained = d.trainedSkills.includes(key);
                const die = attrDie(attr);
                return (
                  <li key={key}>
                    <input
                      type="checkbox"
                      title="Trained"
                      checked={trained}
                      disabled={ro}
                      onChange={() => update({ trainedSkills: toggleIn(d.trainedSkills, key) })}
                    />
                    <button
                      className="skill-roll"
                      onClick={() =>
                        roll(remnantCheckFormula(die, trained ? tb : 0), `${name}: ${skillName}`)
                      }
                    >
                      {skillName} <span className="muted">({attr.slice(0, 3).toUpperCase()})</span>
                      <span className="skill-mod">
                        2d10+d{die}
                        {trained ? `+${tb}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* conditions */}
          <section className="card">
            <h3>Conditions</h3>
            <div className="condition-chips">
              {REMNANT_CONDITIONS.map((c) => (
                <button
                  key={c}
                  className={d.conditions.includes(c) ? "chip active" : "chip"}
                  disabled={ro}
                  onClick={() => update({ conditions: toggleIn(d.conditions, c) })}
                >
                  {c}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="column">
          {/* weapon */}
          <section className="card stack">
            <div className="row-between">
              <h3>Weapon</h3>
              <input
                className="weapon-name"
                placeholder="Weapon name"
                value={d.weaponName}
                disabled={ro}
                onChange={(e) => update({ weaponName: e.target.value })}
              />
            </div>
                        <p className="muted small weapon-main-attribute-note">
              Damage adds your selected Main Attribute:{" "}
              <strong>
                {REMNANT_ATTRIBUTES.find((attribute) => attribute.key === (d.mainAttribute || "brawn"))?.name}
                {" "}d{attrDie(d.mainAttribute || "brawn")}
              </strong>
            </p>
            {d.weaponForms.map((form, i) => (
              <div key={i} className={`trait-row weapon-form${d.activeForm === i ? " active-form" : ""}`}>
                <div className="row-between">
                  <strong className="small">
                    Form {i === 0 ? "A" : "B"}
                    {d.activeForm === i && <span className="badge src-custom">active</span>}
                  </strong>
                  {!ro && d.activeForm !== i && (
                    <button className="ghost mini" onClick={() => update({ activeForm: i })}>
                      Transform (Bonus Action)
                    </button>
                  )}
                </div>
                <div className="row-between">
                  <input
                    placeholder="Type — scythe, cannon…"
                    value={form.type}
                    disabled={ro}
                    onChange={(e) =>
                      update({
                        weaponForms: d.weaponForms.map((f, j) => (j === i ? { ...f, type: e.target.value } : f)),
                      })
                    }
                  />
                  <select
                    value={form.range}
                    disabled={ro}
                    onChange={(e) =>
                      update({
                        weaponForms: d.weaponForms.map((f, j) => (j === i ? { ...f, range: e.target.value } : f)),
                      })
                    }
                  >
                    {RANGE_BANDS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                  <select
                    value={form.damage}
                    disabled={ro}
                    title="Damage die"
                    onChange={(e) =>
                      update({
                        weaponForms: d.weaponForms.map((f, j) =>
                          j === i ? { ...f, damage: num(e.target.value, 8) } : f
                        ),
                      })
                    }
                  >
                    {DIE_SIZES.map((s) => (
                      <option key={s} value={s}>
                        d{s}
                      </option>
                    ))}
                  </select>
                  <select
                    value={form.styleDie ?? 0}
                    disabled={ro}
                    title="Style die — added to damage"
                    onChange={(e) =>
                      update({
                        weaponForms: d.weaponForms.map((f, j) =>
                          j === i ? { ...f, styleDie: num(e.target.value, 0) } : f
                        ),
                      })
                    }
                  >
                    <option value={0}>+ —</option>
                    {DIE_SIZES.map((s) => (
                      <option key={s} value={s}>
                        +d{s}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  placeholder="Special / effect"
                  value={form.special}
                  disabled={ro}
                  onChange={(e) =>
                    update({
                      weaponForms: d.weaponForms.map((f, j) => (j === i ? { ...f, special: e.target.value } : f)),
                    })
                  }
                />
                <div className="weapon-roll-panel">
                  {(() => {
                    // vivid-weapon-roll-controls
                    const attackAttrKey: RemnantAttrKey =
                      d.archetype === "Brawler" ? "brawn" : "finesse";
                    const attackAttrDie = attrDie(attackAttrKey);
                    const mainAttrKey: RemnantAttrKey = d.mainAttribute || "brawn";
                    const mainAttrDie = attrDie(mainAttrKey);
                    const mainAttrName =
                      REMNANT_ATTRIBUTES.find((attribute) => attribute.key === mainAttrKey)?.name ??
                      "Main Attribute";
                    const formName = form.type || `Form ${i === 0 ? "A" : "B"}`;
                    const attackFormula = remnantCheckFormula(attackAttrDie, tb);
                    const damageFormula = [
                      `1d${form.damage}`,
                      form.styleDie ? `1d${form.styleDie}` : "",
                      `1d${mainAttrDie}`,
                    ]
                      .filter(Boolean)
                      .join("+");

                    return (
                      <>
                        <div className="weapon-roll-heading">
                          <span>
                            Attack <strong>{attackFormula}</strong>
                          </span>
                          <span className="muted">
                            {attackAttrKey === "brawn" ? "Brawn" : "Finesse"}
                          </span>
                        </div>
                        <div className="weapon-attack-modes" role="group" aria-label={`${formName} attack mode`}>
                          <button
                            type="button"
                            className="ghost mini weapon-mode normal"
                            onClick={() =>
                              roll(attackFormula, `${name}: ${formName} attack`, "normal")
                            }
                          >
                            Normal
                          </button>
                          <button
                            type="button"
                            className="ghost mini weapon-mode edge"
                            onClick={() =>
                              roll(attackFormula, `${name}: ${formName} attack`, "edge")
                            }
                          >
                            Edge
                          </button>
                          <button
                            type="button"
                            className="ghost mini weapon-mode setback"
                            onClick={() =>
                              roll(attackFormula, `${name}: ${formName} attack`, "setback")
                            }
                          >
                            Setback
                          </button>
                        </div>
                        <button
                          type="button"
                          className="ghost mini weapon-damage-roll"
                          title="Weapon die + optional style die + main attribute die"
                          onClick={() =>
                            roll(damageFormula, `${name}: ${formName} damage`, "normal")
                          }
                        >
                          Damage ({`d${form.damage}`}
                          {form.styleDie ? ` + d${form.styleDie}` : ""}
                          {` + d${mainAttrDie}`} {mainAttrName})
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
          </section>

          {/* semblance */}
          <section className="card stack">
            <div className="row-between">
              <h3>Semblance</h3>
              <label className="prof-toggle">
                <input
                  type="checkbox"
                  checked={d.semblance.undiscovered}
                  disabled={ro}
                  onChange={(e) => patch({ semblance: { ...d.semblance, undiscovered: e.target.checked } })}
                />
                undiscovered (+10 Aura)
              </label>
            </div>
            <input
              placeholder="Semblance name"
              value={d.semblance.name}
              disabled={ro}
              onChange={(e) => update({ semblance: { ...d.semblance, name: e.target.value } })}
            />
            <div className="row-between">
              {(
                [
                  ["type", SEMBLANCE_TYPES as readonly string[]],
                  ["scope", SEMBLANCE_SCOPES.map((s) => s.key)],
                  ["intensity", SEMBLANCE_INTENSITIES.map((s) => s.key)],
                  ["duration", SEMBLANCE_DURATIONS.map((s) => s.key)],
                ] as [keyof RemnantData["semblance"], string[]][]
              ).map(([field, options]) => (
                <select
                  key={field}
                  value={d.semblance[field] as string}
                  disabled={ro}
                  title={field}
                  onChange={(e) => update({ semblance: { ...d.semblance, [field]: e.target.value } })}
                >
                  {options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ))}
            </div>
            <textarea
              rows={2}
              placeholder="Description & effect"
              value={d.semblance.description}
              disabled={ro}
              onChange={(e) => update({ semblance: { ...d.semblance, description: e.target.value } })}
            />
            <input
              placeholder="Limitation (every Semblance has one)"
              value={d.semblance.limitation}
              disabled={ro}
              onChange={(e) => update({ semblance: { ...d.semblance, limitation: e.target.value } })}
            />
            <div className="row-between">
              <span className="muted small">
                Cost: <strong>{cost.activation} Aura</strong>
                {cost.note}
              </span>
              {!ro && (
                <button
                  className="primary"
                  disabled={d.aura < cost.activation}
                  onClick={() => update({ aura: Math.max(0, d.aura - cost.activation) })}
                  title={d.aura < cost.activation ? "Not enough Aura" : "Spend Aura and activate"}
                >
                  ✨ Activate (−{cost.activation})
                </button>
              )}
            </div>
            <div className="condition-chips">
              {SEMBLANCE_UPGRADES.map((u) => (
                <button
                  key={u}
                  className={d.semblance.upgrades.includes(u) ? "chip active" : "chip"}
                  disabled={ro}
                  onClick={() =>
                    update({ semblance: { ...d.semblance, upgrades: toggleIn(d.semblance.upgrades, u) } })
                  }
                >
                  {u}
                </button>
              ))}
            </div>
          </section>

          {/* dust */}
          <section className="card">
            <h3>Dust — charges</h3>
            <div className="dust-grid">
              {DUST_TYPES.map((t) => {
                const charges = d.dust[t.key] ?? 0;
                return (
                  <div key={t.key} className={`dust-box${charges > 0 ? " has-dust" : ""}`}>
                    <span className="dust-name" title={t.note}>
                      {t.name}
                    </span>
                    <div className="slot-controls">
                      <button
                        className="ghost mini"
                        disabled={ro || charges === 0}
                        onClick={() => update({ dust: { ...d.dust, [t.key]: charges - 1 } })}
                      >
                        use
                      </button>
                      <span>{charges}</span>
                      <button
                        className="ghost mini"
                        disabled={ro}
                        onClick={() => update({ dust: { ...d.dust, [t.key]: charges + 1 } })}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="muted small">A vial holds 3 charges. Dust doesn't replenish on rests — buy, loot, or craft it.</p>
          </section>

          {/* inventory */}
          <section className="card stack">
            <h3>Inventory</h3>
            <InventoryEditor
              items={d.inventory}
              money={d.lien}
              moneyLabel="Lien 🪙"
              ro={ro}
              onItems={(inv) => update({ inventory: inv })}
              onMoney={(n) => update({ lien: n })}
              onUpload={onUpload}
            />
          </section>

          {/* background & notes */}
          <section className="card stack">
            <h3>Background</h3>
            <div className="field-grid">
              <label>
                Bond / motivation
                <input value={d.bond} disabled={ro} onChange={(e) => update({ bond: e.target.value })} />
              </label>
              <label>
                Flaw
                <input value={d.flaw} disabled={ro} onChange={(e) => update({ flaw: e.target.value })} />
              </label>
              <label>
                Fear
                <input value={d.fear} disabled={ro} onChange={(e) => update({ fear: e.target.value })} />
              </label>
            </div>
            <label>
              Equipment
              <textarea rows={2} value={d.equipment} disabled={ro} onChange={(e) => update({ equipment: e.target.value })} />
            </label>
            <label>
              Backstory & notes
              <textarea rows={4} value={d.backstory} disabled={ro} onChange={(e) => update({ backstory: e.target.value })} />
            </label>
          </section>
        </div>
      </div>
    </main>
  );
}
