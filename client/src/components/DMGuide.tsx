import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

interface Props {
  campaignId: number;
  system: string;
}

type GuideSection = {
  id: string;
  icon: string;
  title: string;
  summary: string;
  steps: string[];
  tips?: string[];
};

const QUICK_STEPS = [
  {
    title: "Your command dashboard",
    icon: "◇",
    body: "This is your main control room. Every panel can be moved, resized, removed, or restored with Edit layout.",
  },
  {
    title: "Build the campaign",
    icon: "✦",
    body: "Use Campaign for the briefing, announcements, house rules, invitations, and your saved Google Drive campaign notes.",
  },
  {
    title: "Prepare your cast",
    icon: "△",
    body: "Create NPC sheets in Field Assets. Assign each NPC only to the exact players allowed to view, edit, roll as, and control it.",
  },
  {
    title: "Stock the encounter",
    icon: "▦",
    body: "Use the Grimm Archive or Bestiary to create creatures, preserve their artwork, and send prepared tokens to the tactical map.",
  },
  {
    title: "Direct the scene",
    icon: "⬡",
    body: "The Tactical Map holds maps, tokens, encounters, initiative, visibility, audio, triggers, formations, and Scene Director controls.",
  },
  {
    title: "Run combat",
    icon: "⚔",
    body: "Use initiative, Aura and HP controls, conditions, weapon modes, Dust, damage tools, and the shared session log to keep combat moving.",
  },
  {
    title: "Help is always here",
    icon: "?",
    body: "Open DM Guide at any time for focused walkthroughs. The quick tour can also be replayed from the guide library.",
  },
];

const REMNANT_SECTIONS: GuideSection[] = [
  {
    id: "campaign",
    icon: "✦",
    title: "Campaign setup",
    summary: "Create the briefing, invite players, organize sessions, and link your notes.",
    steps: [
      "Open Campaign from the dashboard navigation.",
      "Use Edit hub to set the campaign description, chapter, session number, announcement, and house rules.",
      "Paste your Google Docs or Google Drive notes link and save the hub.",
      "Create invite links and assign campaign roles carefully: DM, co-DM, player, or spectator.",
      "Confirm Google sharing permissions separately so the intended players can open the notes document.",
    ],
    tips: [
      "Use announcements for information everyone should immediately notice.",
      "Keep private planning inside your external campaign notes rather than player-visible fields.",
    ],
  },
  {
    id: "dashboard",
    icon: "◇",
    title: "Dashboard and panels",
    summary: "Arrange the command center around the way you actually run sessions.",
    steps: [
      "Select Edit layout in the dashboard header.",
      "Drag panels by their headers and resize them from their lower-right corners.",
      "Use + Panel to restore a panel you previously removed.",
      "Select Done after arranging the dashboard.",
      "Use Reset only when you want to restore the complete role-based default layout.",
    ],
    tips: [
      "Layouts save per campaign and per user on the server.",
      "A co-DM can maintain a different dashboard arrangement from the primary DM.",
    ],
  },
  {
    id: "npcs",
    icon: "△",
    title: "NPCs and player control",
    summary: "Create full NPC sheets and decide exactly which players may operate each one.",
    steps: [
      "Open the Field Assets panel and create an NPC by name.",
      "Select the NPC tab to open its full sheet.",
      "Under Player control, check each individual player allowed to use that NPC.",
      "Assigned players may view, edit, roll as, and control the NPC.",
      "Uncheck a player to revoke access immediately; the DM and co-DM always retain access.",
    ],
    tips: [
      "Assign multiple players for shared companions, vehicles, or temporary party allies.",
      "Do not assign secret enemies or unrevealed NPC sheets.",
    ],
  },
  {
    id: "archive",
    icon: "▦",
    title: "Grimm Archive and prepared tokens",
    summary: "Build reusable enemies and move them efficiently into encounters.",
    steps: [
      "Open Grimm Archive from the campaign navigation.",
      "Create or edit a Grimm entry, including stats, traits, actions, portrait, and token artwork.",
      "Use Prepare token to place the creature in the prepared token tray.",
      "Open the Tactical Map and drag or place prepared creatures onto the active map.",
      "Reuse library entries without rebuilding the creature for every scene.",
    ],
    tips: [
      "Library artwork is protected when temporary map tokens are deleted.",
      "Use clear names and tags so the archive remains searchable as it grows.",
    ],
  },
  {
    id: "map",
    icon: "⬡",
    title: "Tactical Map",
    summary: "Create scenes, place tokens, control visibility, and direct the table.",
    steps: [
      "Open Tactical Map and choose or create the active map.",
      "Set the grid and scale before placing large encounters.",
      "Place player, NPC, Grimm, and prepared tokens.",
      "Use visibility and darkness controls to reveal only what players should know.",
      "Use map audio, triggers, and Scene Director for atmosphere and scripted moments.",
      "Save reusable token groups with encounters and formations when appropriate.",
    ],
    tips: [
      "Test player visibility from a player account before an important reveal.",
      "Prepare maps and token groups before the session to reduce live setup time.",
    ],
  },
  {
    id: "combat",
    icon: "⚔",
    title: "Initiative and combat",
    summary: "Run initiative, damage, conditions, Aura, Dust, and combat state.",
    steps: [
      "Add the relevant combatants and roll or set initiative.",
      "Resolve initiative ties using the system's configured tie-breaker.",
      "Track Aura before HP where appropriate, then apply armor and damage rules.",
      "Apply conditions and downed states directly to the affected combatants.",
      "Use weapon modes, main-attribute damage, sustained Semblance, and Dust effects from character sheets.",
      "Advance turns and use the session log to confirm rolls and outcomes.",
    ],
    tips: [
      "Keep only active combatants in initiative for a cleaner turn tracker.",
      "Use Final Flare and downed controls deliberately; they represent major combat-state changes.",
    ],
  },
  {
    id: "permissions",
    icon: "⌁",
    title: "Permissions and visibility",
    summary: "Understand what players, spectators, co-DMs, and assigned controllers can access.",
    steps: [
      "DM and co-DM roles have broad campaign-management access.",
      "Players control their own characters and any NPC specifically assigned to them.",
      "Spectators should remain read-only and cannot operate character sheets.",
      "Character sheets remain private unless ownership, role, or an NPC assignment grants access.",
      "Map visibility, token visibility, and sheet access are separate controls—check all three when hiding information.",
    ],
    tips: [
      "Use a temporary test-player account when checking secret information.",
      "Remove NPC assignments when a temporary companion leaves the party.",
    ],
  },
  {
    id: "session",
    icon: "◈",
    title: "Session preparation checklist",
    summary: "A repeatable checklist for the hour before play.",
    steps: [
      "Update the chapter, session number, briefing, and announcement.",
      "Confirm the campaign notes link and sharing permissions.",
      "Prepare maps, map audio, triggers, and scene transitions.",
      "Prepare required Grimm and NPC tokens.",
      "Review player sheets, Aura, HP, Dust, and ongoing conditions.",
      "Verify NPC assignments and player permissions.",
      "Open the tunnel, test the player link, and confirm everyone reaches the correct campaign.",
    ],
    tips: [
      "Keep one low-complexity fallback encounter ready.",
      "Restart and test the server before players arrive rather than at session start.",
    ],
  },
];

const DND_RENAMES: Record<string, [string, string]> = {
  archive: ["Bestiary and prepared tokens", "Build reusable monsters and move them efficiently into encounters."],
  map: ["Battle Map", "Create scenes, place tokens, control visibility, and direct the table."],
};

export default function DMGuide({ campaignId, system }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"library" | "tour" | "section">("library");
  const [tourIndex, setTourIndex] = useState(0);
  const [sectionId, setSectionId] = useState("campaign");
  const [statusLoaded, setStatusLoaded] = useState(false);

  const sections = useMemo(
    () =>
      REMNANT_SECTIONS.map((section) => {
        const rename = system === "dnd5e" ? DND_RENAMES[section.id] : undefined;
        return rename ? { ...section, title: rename[0], summary: rename[1] } : section;
      }),
    [system]
  );

  const activeSection = sections.find((section) => section.id === sectionId) ?? sections[0];

  useEffect(() => {
    let cancelled = false;
    api<{ completed: boolean }>(`/api/campaigns/${campaignId}/dm-guide-status`)
      .then((response) => {
        if (cancelled) return;
        setStatusLoaded(true);
        if (!response.completed) {
          setTourIndex(0);
          setMode("tour");
          setOpen(true);
        }
      })
      .catch(() => setStatusLoaded(true));

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const markComplete = async () => {
    await api(`/api/campaigns/${campaignId}/dm-guide-status`, {
      method: "PUT",
      body: JSON.stringify({ completed: true }),
    }).catch(() => {});
  };

  const finishTour = async () => {
    await markComplete();
    setMode("library");
  };

  const closeGuide = async () => {
    if (mode === "tour") await markComplete();
    setOpen(false);
    setMode("library");
  };

  const startTour = () => {
    setTourIndex(0);
    setMode("tour");
    setOpen(true);
  };

  const openSection = (id: string) => {
    setSectionId(id);
    setMode("section");
  };

  const step = QUICK_STEPS[tourIndex];

  return (
    <>
      {statusLoaded && (
        <button
          type="button"
          className="dm-guide-launch"
          onClick={() => {
            setMode("library");
            setOpen(true);
          }}
          title="Open the DM guide"
        >
          <span>?</span>
          DM Guide
        </button>
      )}

      {open && (
        <div className="dm-guide-backdrop" role="presentation" onMouseDown={closeGuide}>
          <section
            className="dm-guide-modal"
            role="dialog"
            aria-modal="true"
            aria-label="DM Guide"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="dm-guide-header">
              <div>
                <span className="eyebrow">Vivid Realms Field Manual</span>
                <h2>
                  {mode === "tour"
                    ? "DM Quick Start"
                    : mode === "section"
                      ? activeSection.title
                      : "DM Guide"}
                </h2>
              </div>
              <button type="button" className="ghost dm-guide-close" onClick={closeGuide} aria-label="Close guide">
                ×
              </button>
            </header>

            {mode === "tour" && (
              <div className="dm-guide-tour">
                <div className="dm-guide-progress" aria-label={`Step ${tourIndex + 1} of ${QUICK_STEPS.length}`}>
                  {QUICK_STEPS.map((_, index) => (
                    <span key={index} className={index <= tourIndex ? "active" : ""} />
                  ))}
                </div>

                <div className="dm-guide-tour-icon">{step.icon}</div>
                <span className="muted small">STEP {tourIndex + 1} OF {QUICK_STEPS.length}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>

                <footer className="dm-guide-footer">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      markComplete();
                      setMode("library");
                    }}
                  >
                    Skip to guide
                  </button>
                  <span className="spacer" />
                  {tourIndex > 0 && (
                    <button type="button" className="ghost" onClick={() => setTourIndex((index) => index - 1)}>
                      Back
                    </button>
                  )}
                  {tourIndex < QUICK_STEPS.length - 1 ? (
                    <button type="button" className="primary" onClick={() => setTourIndex((index) => index + 1)}>
                      Next
                    </button>
                  ) : (
                    <button type="button" className="primary" onClick={finishTour}>
                      Open field manual
                    </button>
                  )}
                </footer>
              </div>
            )}

            {mode === "library" && (
              <div className="dm-guide-library">
                <div className="dm-guide-welcome">
                  <div>
                    <h3>Choose what you need help with</h3>
                    <p className="muted">
                      Each guide is a focused walkthrough you can reopen during preparation or while running a session.
                    </p>
                  </div>
                  <button type="button" className="ghost" onClick={startTour}>
                    ↺ Replay quick tour
                  </button>
                </div>

                <div className="dm-guide-grid">
                  {sections.map((section) => (
                    <button
                      type="button"
                      key={section.id}
                      className="dm-guide-card"
                      onClick={() => openSection(section.id)}
                    >
                      <span className="dm-guide-card-icon">{section.icon}</span>
                      <span>
                        <strong>{section.title}</strong>
                        <small>{section.summary}</small>
                      </span>
                      <span className="dm-guide-arrow">›</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "section" && (
              <div className="dm-guide-section">
                <button type="button" className="ghost mini dm-guide-back" onClick={() => setMode("library")}>
                  ← All guides
                </button>

                <p className="dm-guide-section-summary">{activeSection.summary}</p>

                <ol className="dm-guide-steps">
                  {activeSection.steps.map((item, index) => (
                    <li key={item}>
                      <span>{index + 1}</span>
                      <p>{item}</p>
                    </li>
                  ))}
                </ol>

                {!!activeSection.tips?.length && (
                  <aside className="dm-guide-tips">
                    <strong>Field notes</strong>
                    {activeSection.tips.map((tip) => (
                      <p key={tip}>✦ {tip}</p>
                    ))}
                  </aside>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
