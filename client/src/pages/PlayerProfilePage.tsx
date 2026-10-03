import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import ProfileGalleryView, { CampaignList, CharacterGrid, GalleryTopbar, type GalleryData, type GalleryTab } from "../components/ProfileGallery";
import { EXAMPLE_PROFILE } from "../profileExample";

// A visitor's view of someone's Personal Gallery, or the labelled Ruby Rose
// example at /profiles/example.
export default function PlayerProfilePage() {
  const { userId } = useParams();
  const example = userId === "example";
  const [data, setData] = useState<GalleryData | null>(example ? EXAMPLE_PROFILE : null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<GalleryTab>("gallery");

  useEffect(() => {
    setTab("gallery");
    if (example) { setData(EXAMPLE_PROFILE); setError(""); return; }
    let active = true;
    setData(null); setError("");
    api<GalleryData>(`/api/achievements/profiles/${userId}`)
      .then((result) => { if (active) setData(result); })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [userId, example]);

  if (error || !data) {
    return <div className="pg-page">
      <GalleryTopbar active="other" />
      <main className="pg-main">
        {error ? <p className="pg-error" role="alert">{error === "Profile not found." ? "You can only see the profiles of players who share a campaign with you." : error}</p> : <p className="pg-tab-empty" role="status">Loading profile…</p>}
      </main>
    </div>;
  }

  const name = data.profile.display_name;
  const heading = (title: string) => <div className="pg-tab-heading"><h2>{title}</h2><span className="pg-ornament is-rule" aria-hidden="true"><i /><b /><i /></span></div>;
  return <ProfileGalleryView
    data={data}
    mode={example ? "example" : "visitor"}
    tab={tab}
    onTab={setTab}
    toolbar={example ? <div className="pg-toolbar pg-example-bar" role="note">
      <p><strong>Example profile.</strong> Ruby Rose shows what a finished gallery can look like. Her art, badges and campaign are illustrations.</p>
      <div className="pg-done"><Link to="/profile">Make yours</Link></div>
    </div> : undefined}
    tabContent={tab === "characters"
      ? <>{heading("Characters")}<CharacterGrid characters={data.characters} emptyText={`${name} has no characters in your shared campaigns.`} /></>
      : tab === "campaigns"
        ? <>{heading("Campaigns")}<CampaignList campaigns={data.campaigns} linked={!example} emptyText="No shared campaigns." /></>
        : null}
  />;
}
