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
        {theme.glyph}
      </span>
      <span className="campaign-brand-copy">
        <span className="brand campaign-theme-brand">{theme.brand}</span>
        <span className="campaign-theme-subline">
          {campaignName}
          {chapter ? ` Ã‚Â· ${chapter}` : ""}
          {typeof sessionNumber === "number" ? ` Ã‚Â· Session ${sessionNumber}` : ""}
          {` Ã‚Â· ${pageLabel}`}
        </span>
      </span>
    </div>
  );
}
