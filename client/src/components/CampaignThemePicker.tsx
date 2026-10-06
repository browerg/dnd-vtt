import { useEffect, useRef, useState, type CSSProperties } from "react";
import { api } from "../api";
import { THEME_BY_ID, type ThemeDefinition, type ThemeId, type ThemeOverride, type useCampaignTheme } from "../theme";

type ThemeView = ReturnType<typeof useCampaignTheme>;

interface Props {
  campaignId: number;
  role: string;
  system: string;
  campaignTheme?: string;
  view: ThemeView;
  onCampaignThemeChange?: (theme: ThemeId) => void;
}

export default function CampaignThemePicker({
  campaignId,
  role,
  campaignTheme,
  view,
  onCampaignThemeChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const isDM = role === "dm" || role === "co-dm";

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const saveCampaignTheme = async (themeId: ThemeId) => {
    setSaving(true);
    setError("");
    try {
      await api(`/api/campaigns/${campaignId}`, {
        method: "PUT",
        body: JSON.stringify({ theme: themeId }),
      });
      onCampaignThemeChange?.(themeId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const cardStyle = (themeId: ThemeId) => {
    const colors = THEME_BY_ID[themeId].preview;
    return {
      "--preview-one": colors[0],
      "--preview-two": colors[1],
      "--preview-three": colors[2],
    } as CSSProperties;
  };

  const personalPick = (next: ThemeOverride) => view.setOverride(next);

  // Full makeovers restyle the whole dashboard, so they get their own group.
  const standard = view.compatible.filter((theme) => !theme.fullMakeover);
  const makeovers = view.compatible.filter((theme) => theme.fullMakeover);
  const makeoverHeading = (
    <div className="theme-makeover-heading">
      <span className="theme-makeover-title">Full makeovers</span>
      <span className="muted small">
        These change more than colours: a new backdrop, framed panels and a campaign title banner.
      </span>
    </div>
  );

  const personalCard = (theme: ThemeDefinition) => (
    <button
      type="button"
      key={theme.id}
      className={`theme-choice${view.override === theme.id ? " selected" : ""}`}
      onClick={() => personalPick(theme.id)}
      title={theme.description}
    >
      <span className="theme-choice-preview" style={cardStyle(theme.id)} />
      <span>
        <strong>{theme.name}</strong>
        <small>{theme.description}</small>
      </span>
    </button>
  );

  const campaignCard = (theme: ThemeDefinition) => (
    <button
      type="button"
      key={theme.id}
      disabled={saving}
      className={`theme-choice${view.campaignDefault === theme.id ? " selected campaign-selected" : ""}`}
      onClick={() => saveCampaignTheme(theme.id)}
    >
      <span className="theme-choice-preview" style={cardStyle(theme.id)} />
      <span>
        <strong>{theme.name}</strong>
        <small>{view.campaignDefault === theme.id ? "Current campaign default" : "Set for campaign"}</small>
      </span>
    </button>
  );

  return (
    <div className="campaign-theme-picker" ref={wrap}>
      <button
        type="button"
        className="ghost theme-picker-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        title="Change campaign appearance"
      >
        <span className="theme-trigger-dot" style={cardStyle(view.themeId)} />
        Theme
      </button>
      {open && (
        <div className="theme-picker-popover">
          <div className="theme-picker-heading">
            <div>
              <strong>Appearance</strong>
              <span className="muted small">Your view can follow the campaign or use a personal override.</span>
            </div>
            <button type="button" className="ghost mini" onClick={() => setOpen(false)} aria-label="Close theme picker">
              {"\u2715"}
            </button>
          </div>

          <section className="theme-picker-section">
            <span className="theme-picker-label">My view</span>
            <div className="theme-card-grid">
              <button
                type="button"
                className={`theme-choice${view.override === "campaign" ? " selected" : ""}`}
                onClick={() => personalPick("campaign")}
              >
                <span className="theme-choice-preview campaign-default-preview" style={cardStyle(view.campaignDefault)} />
                <span>
                  <strong>Campaign default</strong>
                  <small>{THEME_BY_ID[view.campaignDefault].name}</small>
                </span>
              </button>
              {standard.map(personalCard)}
            </div>
            {makeovers.length > 0 && (
              <div className="theme-makeover-group">
                {makeoverHeading}
                <div className="theme-card-grid">{makeovers.map(personalCard)}</div>
              </div>
            )}
            <p className="muted theme-picker-note">Personal overrides are saved for this account, campaign and device.</p>
          </section>

          {isDM && (
            <section className="theme-picker-section campaign-default-section">
              <span className="theme-picker-label">Campaign default</span>
              <p className="muted small">Everyone following the campaign theme will see this selection.</p>
              <div className="theme-card-grid compact">{standard.map(campaignCard)}</div>
              {makeovers.length > 0 && (
                <div className="theme-makeover-group">
                  {makeoverHeading}
                  <div className="theme-card-grid compact">{makeovers.map(campaignCard)}</div>
                </div>
              )}
              {error && <div className="error small">{error}</div>}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
