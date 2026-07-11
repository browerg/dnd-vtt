// Remnant quick rules card — condensed from the Quick Reference PDF so nobody
// has to alt-tab to a rulebook mid-session.

const DCS: [string, string][] = [
  ["8", "Simple"],
  ["11", "Moderate"],
  ["14", "Challenging"],
  ["17", "Hard"],
  ["20", "Extreme"],
  ["23+", "Legendary"],
];

const RANGES: [string, string][] = [
  ["Close", "Arm's reach / grappling"],
  ["Mid", "Across a room / street"],
  ["Long", "Across a field / rooftops"],
  ["Extreme", "Maximum engagement"],
];

const RANK_BONUSES: [string, string, string][] = [
  ["Initiate", "+1", "+5"],
  ["Huntsman", "+2", "+10"],
  ["Specialist", "+3", "+15"],
  ["Legendary Huntsman", "+4", "+20"],
];

const SEMBLANCE_COSTS: [string, string, string, string][] = [
  ["Minor", "4", "6", "8"],
  ["Moderate", "8", "12", "16"],
  ["Major", "12", "18", "24"],
  ["Extreme", "16", "24", "32"],
];

const CONDITIONS: [string, string][] = [
  ["Aura Broken", "No shield, Semblance locked"],
  ["Burning", "Die at start of next 2 turns"],
  ["Frozen", "No Movement next turn"],
  ["Shocked", "Setback on next attack"],
  ["Drenched", "Setback vs Fire; chains Lightning"],
  ["Disoriented", "Setback on all rolls (1 turn)"],
  ["Disarmed", "Weapon dropped"],
  ["Slowed", "No range-band move (1 turn)"],
  ["Staggered", "No Bonus Action next turn"],
  ["Grappled", "No Movement; Brawn DC 14 to break"],
  ["Poisoned", "Setback Brawn/Finesse 3 rounds"],
  ["Terrified", "Must flee; Setback 2 rounds"],
  ["Despairing", "Only move toward exit"],
  ["Prone", "Stand costs Movement; Edge to melee"],
  ["Weapon Jam", "No transformation next turn"],
];

const THREAT_BUDGET: [string, string][] = [
  ["Initiate", "4–6"],
  ["Huntsman", "8–12"],
  ["Specialist", "14–18"],
  ["Legendary Huntsman", "20–28"],
];

function Table({ rows, head }: { rows: string[][]; head?: string[] }) {
  return (
    <table className="qr-table">
      {head && (
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((r) => (
          <tr key={r[0]}>
            {r.map((c, i) => (
              <td key={i}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function RemnantReference() {
  return (
    <div className="quickref">
      <p className="muted small">
        Checks: <strong>2d10 + attribute die</strong> (+ training if Trained) vs DC. Full success = meet
        or beat the DC · Partial = within 3 below (cost or complication) · Failure = 4+ below.
        Edge/Setback reroll the attribute die and keep higher/lower.
      </p>
      <details>
        <summary>Difficulty classes</summary>
        <Table rows={DCS} head={["DC", "Difficulty"]} />
      </details>
      <details>
        <summary>Your turn</summary>
        <ul className="small qr-list">
          <li>
            <strong>Action</strong> — attack, Semblance, Dust, skill, help
          </li>
          <li>
            <strong>Bonus Action</strong> — weapon transform, archetype, quick Semblance
          </li>
          <li>
            <strong>Reaction</strong> — Intercept, counter, certain Semblances
          </li>
          <li>
            <strong>Movement</strong> — one range band free per turn
          </li>
        </ul>
        <p className="muted small">Initiative: 2d10 + Finesse die. Crit: beat Defense by 8+.</p>
      </details>
      <details>
        <summary>Range bands</summary>
        <Table rows={RANGES} />
      </details>
      <details>
        <summary>Aura, HP &amp; Final Flare</summary>
        <p className="muted small">
          Aura absorbs <em>all</em> damage until it breaks; Aura Broken locks your Semblance. Called
          shots: full Aura negates the effect · below half downgrades it (Setback to resist) · Aura
          Broken means full effect, no resist.
        </p>
        <p className="muted small">
          At 0 HP your turn ends — next turn you rise for one full Final Flare turn (can't be downed),
          then Grit DC 14: Full = stand at 1 HP · Partial = Downed (stable) · Failure = Critically
          Downed (dying).
        </p>
      </details>
      <details>
        <summary>Semblance Aura costs</summary>
        <Table rows={SEMBLANCE_COSTS} head={["Intensity", "Personal", "Single", "Area"]} />
        <p className="muted small">Duration: Short +2 · Sustained +2/round · Scene +8.</p>
      </details>
      <details>
        <summary>Dust combinations</summary>
        <p className="muted small">
          Primaries: Fire, Water, Lightning, Wind. Steam = Fire+Water · Gravity = Fire+Lightning ·
          Combustion = Fire+Wind · Ice = Water+Wind · Rock = Lightning+Water · Hard-Light = all four ·
          Lava = Fire+Rock (Tier 2).
        </p>
      </details>
      <details>
        <summary>Conditions</summary>
        <Table rows={CONDITIONS} />
      </details>
      <details>
        <summary>Rank bonuses &amp; encounter budget</summary>
        <Table rows={RANK_BONUSES} head={["Rank", "Training", "Aura pool"]} />
        <Table rows={THREAT_BUDGET} head={["Party rank", "Threat points"]} />
      </details>
    </div>
  );
}
