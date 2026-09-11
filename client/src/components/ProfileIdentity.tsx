import { Avatar } from "./Avatar";
import type { ProfileBadge } from "./BadgeShowcase";
import "../pages/ProfilePage.css";

export const PROFILE_PALETTES = [
  { id: "astral", name: "Astral violet", color: "#b899ee" },
  { id: "ember", name: "Ember rose", color: "#eea39c" },
  { id: "verdant", name: "Verdant gold", color: "#afd6a6" },
  { id: "tide", name: "Moonlit tide", color: "#9ed6e9" },
];

export interface ProfileIdentityData {
  id: number;
  display_name: string;
  avatarPath?: string;
  pronouns?: string;
  bio?: string;
  profileStyle?: string;
}

export default function ProfileIdentity({ profile, badges, editable = false, onEdit }: {
  profile: ProfileIdentityData; badges: ProfileBadge[]; editable?: boolean; onEdit?: () => void;
}) {
  return <section className="identity-record" aria-label={`${profile.display_name}'s profile`}>
    <div className="identity-cover" aria-hidden="true">
      <div className="identity-orbit orbit-one" /><div className="identity-orbit orbit-two" />
      <div className="identity-compass">✧</div>
      <span className="identity-cover-caption">EVERY ROLL LEAVES A STORY.</span>
      <span className="identity-cover-mark">VR / PLAYER ARCHIVE</span>
    </div>
    <div className="identity-introduction">
      <div className="identity-avatar"><Avatar name={profile.display_name} src={profile.avatarPath} id={profile.id} size={112} /></div>
      <div className="identity-name">
        <span className="profile-eyebrow">{badges[0] ? "✦ " + badges[0].name : "A story in the making"}</span>
        <h1>{profile.display_name}</h1>
        <span className="identity-pronouns">{profile.pronouns || "Vivid Realms adventurer"}</span>
      </div>
      {editable && <button className="profile-outline" type="button" onClick={onEdit}>Personalize profile ↗</button>}
    </div>
    <div className="identity-story"><span className="profile-eyebrow">In my own words</span>
      <p>{profile.bio || (editable ? "Your story belongs here. Add a few words about the person behind the dice." : "Still writing the opening chapter.")}</p>
    </div>
    <div className="identity-honors">
      <div className="profile-section-heading"><div><span className="profile-eyebrow">Chosen by you. Earned at the table.</span><h2>Marks of distinction</h2></div><span className="profile-folio">I — SHOWCASE</span></div>
      <div className="identity-podium">
        {[0, 1, 2].map((slot) => {
          const badge = badges[slot];
          return badge ? <figure key={badge.id} className={`identity-medal medal-${slot}`}>
            <div className="identity-medal-art"><img src={badge.badgeImage} alt="" width="160" height="160" /><span aria-hidden="true" /></div>
            <figcaption><span className="profile-eyebrow">{slot === 0 ? "Signature distinction" : "Featured honor"}</span><strong>{badge.name}</strong><p>{badge.description}</p></figcaption>
          </figure> : <div key={slot} className="identity-empty-medal"><span aria-hidden="true">✧</span><strong>A story yet to be told</strong><p>{editable ? "Earn a badge and display it here." : "An open place for a future achievement."}</p></div>;
        })}
      </div>
    </div>
  </section>;
}
