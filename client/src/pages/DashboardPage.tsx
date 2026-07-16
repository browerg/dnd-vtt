import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, type CampaignSummary } from "../api";
import { useAuth } from "../App";
import { Avatar } from "../components/Avatar";
import "./DashboardPage.css";

type CampaignFilter = "all" | "remnant" | "dnd5e";

const systemLabel = (system: string) =>
  system === "dnd5e" ? "D&D 5e" : "Remnant";

const roleLabel = (role: string) => {
  if (role === "co-dm") return "Co-DM";
  if (role === "dm") return "Game Master";
  if (role === "spectator") return "Spectator";
  return "Player";
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<CampaignFilter>("all");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [system, setSystem] = useState("remnant");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () =>
    api<{ campaigns: CampaignSummary[] }>("/api/campaigns").then((response) =>
      setCampaigns(response.campaigns)
    );

  useEffect(() => {
    load();
  }, []);

  const visibleCampaigns = useMemo(
    () =>
      filter === "all"
        ? campaigns
        : campaigns.filter((campaign) => campaign.system === filter),
    [campaigns, filter]
  );

  const remnantCount = campaigns.filter(
    (campaign) => campaign.system !== "dnd5e"
  ).length;
  const dndCount = campaigns.filter(
    (campaign) => campaign.system === "dnd5e"
  ).length;
  const totalTables = campaigns.length;

  const closeCreate = () => {
    setShowForm(false);
    setError("");
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setCreating(true);
    try {
      await api("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({ name, description, system }),
      });
      setName("");
      setDescription("");
      setSystem("remnant");
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="campaign-select-shell">
      <div className="campaign-select-atmosphere" aria-hidden>
        <span className="select-orbit select-orbit-one" />
        <span className="select-orbit select-orbit-two" />
        <span className="select-scanline" />
      </div>

      <header className="campaign-select-header">
        <Link to="/" className="select-wordmark" aria-label="Tabletop home">
          <span className="select-mark" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span>
            <strong>VIVID REALMS</strong>
            <small>CAMPAIGN DIRECTORY</small>
          </span>
        </Link>

        <nav className="select-nav" aria-label="Account navigation">
          <Link to="/customize" className="select-nav-link">
            <span className="select-nav-icon customize-icon" aria-hidden />
            Customize
          </Link>
          <Link to="/shop" className="select-nav-link">
            <span className="select-nav-icon shop-icon" aria-hidden />
            Shop
          </Link>
          <Link to="/profile" className="select-profile-link">
            <Avatar
              name={user?.display_name ?? ""}
              src={user?.avatarPath || undefined}
              id={user?.id}
              size={30}
            />
            <span>
              <small>OPERATIVE</small>
              <strong>{user?.display_name}</strong>
            </span>
          </Link>
          <button className="select-logout" type="button" onClick={logout}>
            Log out
          </button>
        </nav>
      </header>

      <main className="campaign-select-main">
        <section className="campaign-select-hero">
          <div className="campaign-select-intro">
            <p className="select-eyebrow">ACTIVE TABLE NETWORK</p>
            <h1>
              Choose your next
              <span>adventure.</span>
            </h1>
            <p>
              Enter an existing campaign or open a new table for your party.
              Every map, roll, character and story waits behind one door.
            </p>
          </div>

          <div className="campaign-select-stats" aria-label="Campaign totals">
            <article>
              <small>ALL TABLES</small>
              <strong>{String(totalTables).padStart(2, "0")}</strong>
            </article>
            <article>
              <small>REMNANT</small>
              <strong>{String(remnantCount).padStart(2, "0")}</strong>
            </article>
            <article>
              <small>FANTASY</small>
              <strong>{String(dndCount).padStart(2, "0")}</strong>
            </article>
          </div>
        </section>

        <section className="campaign-select-toolbar" aria-label="Campaign controls">
          <div className="campaign-filter-tabs" role="tablist" aria-label="Filter campaigns">
            <button
              type="button"
              role="tab"
              aria-selected={filter === "all"}
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              All campaigns
              <span>{campaigns.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "remnant"}
              className={filter === "remnant" ? "active" : ""}
              onClick={() => setFilter("remnant")}
            >
              Remnant
              <span>{remnantCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "dnd5e"}
              className={filter === "dnd5e" ? "active" : ""}
              onClick={() => setFilter("dnd5e")}
            >
              D&D 5e
              <span>{dndCount}</span>
            </button>
          </div>

          <button
            type="button"
            className={showForm ? "campaign-create-button active" : "campaign-create-button"}
            onClick={() => (showForm ? closeCreate() : setShowForm(true))}
          >
            <span className="create-plus" aria-hidden />
            {showForm ? "Close setup" : "New campaign"}
          </button>
        </section>

        {showForm && (
          <section className="campaign-create-panel" aria-labelledby="create-campaign-title">
            <div className="campaign-create-heading">
              <div>
                <p className="select-eyebrow">NEW TABLE PROTOCOL</p>
                <h2 id="create-campaign-title">Open a campaign</h2>
                <p>Choose a system, name your world and invite the party when it is ready.</p>
              </div>
              <button
                type="button"
                className="campaign-create-close"
                onClick={closeCreate}
                aria-label="Close campaign setup"
              >
                {"\u2715"}
              </button>
            </div>

            <form className="campaign-create-form" onSubmit={create}>
              <fieldset className="campaign-system-picker">
                <legend>Game system</legend>
                <label className={system === "remnant" ? "selected remnant-choice" : "remnant-choice"}>
                  <input
                    type="radio"
                    name="campaign-system"
                    value="remnant"
                    checked={system === "remnant"}
                    onChange={(event) => setSystem(event.target.value)}
                  />
                  <span className="system-choice-mark" aria-hidden />
                  <span>
                    <strong>Remnant</strong>
                    <small>Aura, Dust, Semblances and Grimm</small>
                  </span>
                  <span className="system-choice-state">STANDARD</span>
                </label>
                <label className={system === "dnd5e" ? "selected dnd-choice" : "dnd-choice"}>
                  <input
                    type="radio"
                    name="campaign-system"
                    value="dnd5e"
                    checked={system === "dnd5e"}
                    onChange={(event) => setSystem(event.target.value)}
                  />
                  <span className="system-choice-mark" aria-hidden />
                  <span>
                    <strong>D&D 5e</strong>
                    <small>Heroes, monsters, magic and adventure</small>
                  </span>
                  <span className="system-choice-state">AVAILABLE</span>
                </label>
              </fieldset>

              <div className="campaign-create-fields">
                <label>
                  <span>Campaign name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="The name of your world"
                    maxLength={80}
                    autoFocus
                    required
                  />
                </label>
                <label>
                  <span>Description</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="A short briefing for your players"
                    rows={4}
                    maxLength={500}
                  />
                  <small>{description.length}/500</small>
                </label>
              </div>

              {error && (
                <div className="campaign-create-error" role="alert">
                  <span aria-hidden>!</span>
                  {error}
                </div>
              )}

              <div className="campaign-create-actions">
                <button type="button" className="campaign-secondary-button" onClick={closeCreate}>
                  Cancel
                </button>
                <button type="submit" className="campaign-primary-button" disabled={creating}>
                  <span>{creating ? "Opening table..." : "Create campaign"}</span>
                  {!creating && <span className="campaign-enter-arrow" aria-hidden />}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="campaign-directory" aria-labelledby="campaign-directory-title">
          <div className="campaign-directory-heading">
            <div>
              <p className="select-eyebrow">YOUR CAMPAIGNS</p>
              <h2 id="campaign-directory-title">
                {filter === "all" ? "Campaign directory" : `${systemLabel(filter)} tables`}
              </h2>
            </div>
            <span className="campaign-directory-count">
              {visibleCampaigns.length} {visibleCampaigns.length === 1 ? "TABLE" : "TABLES"} FOUND
            </span>
          </div>

          {campaigns.length === 0 && !showForm && (
            <div className="campaign-empty-state">
              <span className="empty-state-mark" aria-hidden>
                <span />
                <span />
              </span>
              <p className="select-eyebrow">NO ACTIVE TABLES</p>
              <h3>Your first world is waiting.</h3>
              <p>
                Create a campaign here, or follow an invite link from another game master.
              </p>
              <button
                type="button"
                className="campaign-primary-button"
                onClick={() => setShowForm(true)}
              >
                Open your first campaign
              </button>
            </div>
          )}

          {campaigns.length > 0 && visibleCampaigns.length === 0 && (
            <div className="campaign-empty-filter">
              No campaigns match this system filter.
            </div>
          )}

          <div className="campaign-card-grid">
            {visibleCampaigns.map((campaign, index) => {
              const isDnd = campaign.system === "dnd5e";
              return (
                <Link
                  key={campaign.id}
                  to={`/campaigns/${campaign.id}`}
                  className={`campaign-directory-card ${isDnd ? "dnd-card" : "remnant-card"}`}
                  style={{ "--card-index": index } as React.CSSProperties}
                >
                  <div className="campaign-card-visual" aria-hidden>
                    <div className="campaign-card-gridlines" />
                    <span className="campaign-card-orbit" />
                    <span className="campaign-card-core">
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className="campaign-card-scan" />
                    <span className="campaign-card-id">
                      TABLE {String(campaign.id).padStart(3, "0")}
                    </span>
                  </div>

                  <div className="campaign-card-body">
                    <div className="campaign-card-meta">
                      <span className="campaign-system-badge">
                        <span aria-hidden />
                        {systemLabel(campaign.system)}
                      </span>
                      <span className={`campaign-role-badge role-${campaign.role}`}>
                        {roleLabel(campaign.role)}
                      </span>
                    </div>

                    <div className="campaign-card-copy">
                      <h3>{campaign.name}</h3>
                      <p>{campaign.description || "No campaign briefing has been added yet."}</p>
                    </div>

                    <div className="campaign-card-footer">
                      <span className="campaign-member-count">
                        <span className="member-cluster" aria-hidden>
                          <i />
                          <i />
                          <i />
                        </span>
                        {campaign.member_count}{" "}
                        {campaign.member_count === 1 ? "member" : "members"}
                      </span>
                      <span className="campaign-enter-link">
                        Enter campaign
                        <span className="campaign-enter-arrow" aria-hidden />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

