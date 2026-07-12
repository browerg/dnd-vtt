import { Link, useParams } from "react-router-dom";
import SheetView from "../components/SheetView";
import CampaignDiceDock from "../components/CampaignDiceDock";

export default function CharacterSheetPage() {
  const { id, charId } = useParams();
  const campaignId = Number(id);
  const characterId = Number(charId);

  return (
    <div className="shell">
      <header className="topbar">
        <Link to={`/campaigns/${campaignId}`} className="ghost link">
          ← Campaign
        </Link>
        <span className="brand">Character sheet</span>
      </header>
      <SheetView campaignId={campaignId} characterId={characterId} />
      <CampaignDiceDock />
    </div>
  );
}
