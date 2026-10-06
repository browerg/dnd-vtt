import { THEME_BY_ID, type ThemeId } from "../theme";

interface Props {
  campaignName: string;
  chapter?: string;
  sessionNumber?: number;
  themeId: ThemeId;
  pageLabel: string;
}

export default function CampaignThemeBrand({
  campaignName,
  chapter,
  sessionNumber,
  themeId,
  pageLabel,
}: Props) {
  const theme = THEME_BY_ID[themeId];
  return (
    <div className="campaign-brand-block">
      <span className="campaign-theme-crest" aria-hidden>
        {themeId === "schnee-atelier" ? <img src="/assets/themes/schnee-atelier/glyph.svg" alt="" /> : theme.glyph}
      </span>
      <span className="campaign-brand-copy">
        <span className="brand campaign-theme-brand">{themeId === "schnee-atelier" ? "Vivid Realms" : theme.brand}</span>
        <span className="campaign-theme-subline">
          {campaignName}
          {chapter ? ` \u00B7 ${chapter}` : ""}
          {typeof sessionNumber === "number" ? ` \u00B7 Session ${sessionNumber}` : ""}
          {` \u00B7 ${pageLabel}`}
        </span>
      </span>
    </div>
  );
}
