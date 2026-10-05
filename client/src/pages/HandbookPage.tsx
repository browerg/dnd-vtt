import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../App";
import { api } from "../api";
import CampaignThemeBrand from "../components/CampaignThemeBrand";
import { useCampaignTheme } from "../theme";

// Bundled with the client, so a new edition ships with the next update.
// Replace the file in client/public/rules/ to change it.
export const HANDBOOK_URL = "/rules/remnant-huntsmans-handbook.pdf";

export default function HandbookPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { user } = useAuth();
  const [system, setSystem] = useState("remnant");
  const [campaignTheme, setCampaignTheme] = useState("");
  const [campaignName, setCampaignName] = useState("Campaign");
  const [campaignChapter, setCampaignChapter] = useState("");
  const [campaignSession, setCampaignSession] = useState(0);
  const themeView = useCampaignTheme({ campaignId, userId: user?.id, system, campaignTheme });

  useEffect(() => {
    api<{ campaign: { system: string; theme: string; name: string; chapter: string; session_number: number } }>(`/api/campaigns/${campaignId}`)
      .then((r) => {
        setSystem(r.campaign.system);
        setCampaignTheme(r.campaign.theme ?? "");
        setCampaignName(r.campaign.name);
        setCampaignChapter(r.campaign.chapter ?? "");
        setCampaignSession(r.campaign.session_number ?? 0);
      })
      .catch(() => {});
  }, [campaignId]);

  return (
    <div className="shell campaign-themed handbook-shell" data-system={system} data-theme={themeView.themeId}>
      <header className="topbar campaign-topbar">
        <Link to={`/campaigns/${campaignId}`} className="ghost link campaign-back-link">{"←"}</Link>
        <CampaignThemeBrand
          campaignName={campaignName}
          chapter={campaignChapter}
          sessionNumber={campaignSession}
          themeId={themeView.themeId}
          pageLabel="Huntsman's Handbook"
        />
        <span className="current-page-indicator" aria-current="page">
          <span className="current-page-indicator-dot" />
          Handbook
        </span>
        <span className="spacer" />
        <Link to={`/campaigns/${campaignId}`} className="ghost link campaign-nav-link">
          Dashboard
        </Link>
        <Link to={`/campaigns/${campaignId}/bestiary`} className="ghost link campaign-nav-link">
          Grimm archive
        </Link>
        <a href={HANDBOOK_URL} target="_blank" rel="noreferrer" className="ghost link campaign-nav-link">
          Open in new tab
        </a>
        <a href={HANDBOOK_URL} download="Remnant Huntsman's Handbook.pdf" className="ghost link campaign-nav-link">
          Download
        </a>
      </header>
      <main className="handbook-viewer">
        <iframe src={HANDBOOK_URL} title="Remnant Huntsman's Handbook" />
      </main>
    </div>
  );
}
