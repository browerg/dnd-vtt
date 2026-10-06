import { Link, useNavigate } from "react-router-dom";
import GridLayout, { WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { useAuth } from "../App";
import { AtelierMasthead, AtelierTopbar } from "../atelier/AtelierTopbar";
import {
  AtelierCharacterCard,
  AtelierDice,
  AtelierMissionView,
  AtelierPanelHead,
  AtelierSessionLog,
  AtelierTeamStatus,
} from "../atelier/AtelierPanels";
import { ATELIER_ARRANGEMENT, ATELIER_GRID } from "../atelier/atelierModel";
import { EXAMPLE_CHARACTER, EXAMPLE_LOG, EXAMPLE_MISSION, EXAMPLE_TEAM, EXAMPLE_ASSETS } from "../atelier/atelierExample";
import { GRID_COLS } from "../dashboard/layouts";

const Grid = WidthProvider(GridLayout);

const PANELS: { id: string; title: string }[] = [
  { id: "sheet", title: "Character" },
  { id: "notes", title: "Mission notes" },
  { id: "dice", title: "Combat dice" },
  { id: "party", title: "Team status" },
  { id: "rolls", title: "Session log" },
];

/**
 * The approved Schnee Atelier comp, rendered by the real panel components
 * with sample data. Nothing here reads or writes a campaign.
 */
export default function AtelierExamplePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const layout = PANELS.map((panel) => ({ i: panel.id, ...ATELIER_ARRANGEMENT[panel.id], static: true }));
  const here = "/themes/schnee-atelier/example";

  const body = (id: string) => {
    if (id === "sheet") return <AtelierCharacterCard card={EXAMPLE_CHARACTER} />;
    if (id === "notes") return <AtelierMissionView mission={EXAMPLE_MISSION} />;
    if (id === "dice")
      return <AtelierDice system="remnant" stageImage={EXAMPLE_ASSETS.diceStage} initial={{ sides: 20, count: 1 }} hotkey={false} onRoll={async () => {}} />;
    if (id === "party") return <AtelierTeamStatus members={EXAMPLE_TEAM} />;
    return <AtelierSessionLog entries={EXAMPLE_LOG} />;
  };

  return (
    <div className="shell dashboard-shell campaign-themed atelier-example" data-system="remnant" data-theme="schnee-atelier">
      <AtelierTopbar
        nav={[
          { label: "Dashboard", to: here, active: true },
          { label: "Map", to: here },
          { label: "Characters", to: here },
        ]}
        onToggleEdit={() => {}}
        avatarUrl={user?.avatarPath || undefined}
        userName={user?.display_name}
        menu={
          <>
            <span className="atelier-menu-role">Example · sample data</span>
            <button type="button" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <Link to="/">All campaigns</Link>
          </>
        }
      />
      <AtelierMasthead name="Shadows of Remnant" sessionNumber={12} />
      <Grid
        className="dashboard-grid"
        layout={layout}
        cols={GRID_COLS}
        rowHeight={ATELIER_GRID.rowHeight}
        margin={ATELIER_GRID.margin}
        containerPadding={ATELIER_GRID.containerPadding}
        isDraggable={false}
        isResizable={false}
        compactType={null}
      >
        {PANELS.map((panel) => (
          <div key={panel.id} className={`panel panel-${panel.id} atelier-panel`}>
            <AtelierPanelHead title={panel.title} editing={false} menu={[{ label: "← Back", onSelect: () => navigate(-1) }]} />
            <div className="panel-body">{body(panel.id)}</div>
          </div>
        ))}
      </Grid>
      <div
        className="atelier-example-note"
        role="note"
        title="Sample data from the Schnee Atelier design. Your own campaign shows your real character, notes and rolls."
      >
        <strong>Example</strong> sample data
        <button type="button" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>
      <span className="atelier-scroll-pill" aria-hidden>
        <svg viewBox="0 0 24 20">
          <path d="M2 3c3.5-1.2 7-1 10 1v14c-3-2-6.5-2.2-10-1Zm20 0c-3.5-1.2-7-1-10 1v14c3-2 6.5-2.2 10-1Z" />
        </svg>
        Scroll
      </span>
    </div>
  );
}
