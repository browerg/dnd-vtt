import "./Achievements.css";

export interface ProfileBadge {
  id: string;
  name: string;
  description: string;
  badgeImage: string;
  badgeThumbnail: string;
  badgeThumbnail2x: string;
}

export default function BadgeShowcase({ badges }: { badges: ProfileBadge[] }) {
  return <div className="badge-showcase">
    {badges.map((badge) => <figure className="showcase-medal" key={badge.id}>
      <img src={badge.badgeImage} alt="" width="112" height="112" />
      <figcaption><strong>{badge.name}</strong><span>{badge.description}</span></figcaption>
    </figure>)}
    {!badges.length && <p className="muted">No badges on display yet.</p>}
  </div>;
}
