import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../App";
import SheetView from "../components/SheetView";
import CampaignDocks from "../components/CampaignDocks";
import CampaignThemeBrand from "../components/CampaignThemeBrand";
import CampaignThemePicker from "../components/CampaignThemePicker";
import { useCampaignTheme, type ThemeId } from "../theme";

interface CampaignMeta {
  name: string;
  system: string;
  theme: string;
  chapter: string;
  session_number: number;
  role: string;
}

export default function CharacterSheetPage() {
  const { id, charId } = useParams();
  const campaignId = Number(id);
  const characterId = Number(charId);
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<CampaignMeta>({
    name: "Campaign",
    system: "remnant",
    theme: "",
    chapter: "",
    session_number: 0,
    role: "player",
  });

  useEffect(() => {
    api<{ campaign: Omit<CampaignMeta, "role">; yourRole: string }>(`/api/campaigns/${campaignId}`)
      .then((response) => setCampaign({ ...response.campaign, role: response.yourRole }))
      .catch(() => {});
  }, [campaignId]);

  const themeView = useCampaignTheme({
    campaignId,
    userId: user?.id,
    system: campaign.system,
    campaignTheme: campaign.theme,
  });

  const updateCampaignTheme = (theme: ThemeId) => setCampaign((current) => ({ ...current, theme }));

  return (
    <div className="shell campaign-themed" data-system={campaign.system} data-theme={themeView.themeId}>
      <header className="topbar campaign-topbar">
        <Link to={`/campaigns/${campaignId}`} className="ghost link campaign-back-link">{"\u2190"}</Link>
        <CampaignThemeBrand
          campaignName={campaign.name}
          chapter={campaign.chapter}
          sessionNumber={campaign.session_number}
          themeId={themeView.themeId}
          pageLabel="Character sheet"
        />
        <span className="spacer" />
        <CampaignThemePicker
          campaignId={campaignId}
          role={campaign.role}
          system={campaign.system}
          campaignTheme={campaign.theme}
          view={themeView}
          onCampaignThemeChange={updateCampaignTheme}
        />
      </header>
      <SheetView campaignId={campaignId} characterId={characterId} />
      <CampaignDocks />
    </div>
  );
}
