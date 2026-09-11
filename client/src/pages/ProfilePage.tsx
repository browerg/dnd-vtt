import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { api, uploadImage, type User } from "../api";
import { useAuth } from "../App";
import { Avatar } from "../components/Avatar";
import Achievements, { type AchievementSnapshot } from "../components/Achievements";
import ProfileIdentity, { PROFILE_PALETTES } from "../components/ProfileIdentity";
import "./ProfilePage.css";

const BIO_MAX = 280;

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [pronouns, setPronouns] = useState(user?.pronouns ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [profileStyle, setProfileStyle] = useState(user?.profileStyle ?? "astral");
  const [view, setView] = useState<"collection" | "settings">("collection");
  const [achievementData, setAchievementData] = useState<AchievementSnapshot>({ items: [], showcase: [] });
  const syncAchievements = useCallback((data: AchievementSnapshot) => setAchievementData(data), []);
  const earned = achievementData.items.filter((item) => item.unlockedAt);
  const [avatarPath, setAvatarPath] = useState(user?.avatarPath ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const url = await uploadImage(file);
      setAvatarPath(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const r = await api<{ user: User }>("/api/auth/me/profile", {
        method: "PUT",
        body: JSON.stringify({ displayName, pronouns, bio, avatarPath, profileStyle }),
      });
      setUser(r.user);
      setNotice("Saved.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setPasswordNotice("");
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Those new passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      await api("/api/auth/me/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice("Password changed. Other signed-in sessions were closed.");
    } catch (e: any) {
      setPasswordError(e.message);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="personal-profile" data-profile-style={profileStyle}>
      <header className="profile-navigation">
        <Link to="/">
          ← Campaigns
        </Link>
        <span className="profile-wordmark">VIVID REALMS</span>
        <Link to={`/profiles/${user?.id}`}>
          View as visitor ↗
        </Link>
      </header>
      <main className="profile-layout">
        {user && <ProfileIdentity profile={{ ...user, display_name: displayName, pronouns, bio, avatarPath, profileStyle }} badges={achievementData.showcase} editable onEdit={() => { setView("settings"); document.getElementById("profile-workbench")?.scrollIntoView({ block: "start" }); }} />}
        <div className="profile-workbench" id="profile-workbench"><div>
        <nav className="profile-tabs" aria-label="Profile sections">
          <button type="button" aria-pressed={view === "collection"} onClick={() => setView("collection")}>Distinctions & badges</button>
          <button type="button" aria-pressed={view === "settings"} onClick={() => setView("settings")}>Make it yours</button>
        </nav>
        <div hidden={view !== "collection"}><Achievements embedded onChange={syncAchievements} /></div>
        <div className="profile-settings" hidden={view !== "settings"} style={view !== "settings" ? { display: "none" } : undefined}>
        <section className="card profile-card">
          <span className="profile-eyebrow">Your identity</span><h3>The person behind the dice</h3>
          <p className="muted small">Your name, pronouns, bio, cover palette, and chosen badges are visible to members of your campaigns. Changes below preview above; save to publish them.</p>
          <div className="profile-palettes" aria-label="Profile cover palette">{PROFILE_PALETTES.map((palette) => <button key={palette.id} type="button" aria-pressed={profileStyle === palette.id} onClick={() => setProfileStyle(palette.id)}><i style={{ background: palette.color }} aria-hidden="true" />{palette.name}</button>)}</div>
          <div className="profile-head">
            <label className="profile-avatar-pick" title="Upload a profile picture">
              <Avatar name={displayName} src={avatarPath || undefined} id={user?.id} size={96} />
              <span className="profile-avatar-edit">{uploading ? "…" : "✎"}</span>
              <input
                type="file"
                aria-label="Upload profile picture"
                accept="image/png,image/jpeg,image/webp"
                hidden
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="profile-head-fields">
              <label className="stack">
                <span className="muted small">Display name</span>
                <input
                  value={displayName}
                  maxLength={40}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name at the table"
                />
              </label>
              <label className="stack">
                <span className="muted small">Pronouns</span>
                <input
                  value={pronouns}
                  maxLength={30}
                  onChange={(e) => setPronouns(e.target.value)}
                  placeholder="she/her, they/them…"
                />
              </label>
            </div>
          </div>
          <label className="stack">
            <span className="muted small">
              Bio <span className="muted">({bio.length}/{BIO_MAX})</span>
            </span>
            <textarea
              value={bio}
              maxLength={BIO_MAX}
              rows={3}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A line about you the table can see."
            />
          </label>
          {error && <div className="error">{error}</div>}
          {notice && <p className="muted small" role="status">{notice}</p>}
          <div className="row-between">
            <span className="muted small">This is your account identity — not your character.</span>
            <button className="primary" onClick={save} disabled={saving || uploading}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </section>

        <details className="card">
          <summary>Account security</summary>
          <p className="muted small">
            Change your password here. Your current device stays signed in; other sessions are closed.
          </p>

          <label className="stack">
            <span className="muted small">Current password</span>
            <input
              type="password"
              value={currentPassword}
              autoComplete="current-password"
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
            />
          </label>

          <label className="stack">
            <span className="muted small">New password</span>
            <input
              type="password"
              value={newPassword}
              autoComplete="new-password"
              minLength={8}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </label>

          <label className="stack">
            <span className="muted small">Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              autoComplete="new-password"
              minLength={8}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Enter it again"
            />
          </label>

          {passwordError && <div className="error">{passwordError}</div>}
          {passwordNotice && <p className="muted small">{passwordNotice}</p>}

          <div className="row-between">
            <span className="muted small">Minimum 8 characters.</span>
            <button
              className="primary"
              type="button"
              onClick={changePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            >
              {changingPassword ? "Changing…" : "Change password"}
            </button>
          </div>
        </details>
        </div>
        </div><aside className="profile-journal">
          <span className="profile-eyebrow">II — Your journey</span><h3>A collection in the making</h3>
          <div className="profile-completion">{earned.length}<small> / {achievementData.items.length || "—"}</small></div>
          <p>Distinctions earned. Each one, a moment that belongs to you.</p>
          <progress value={earned.length} max={achievementData.items.length || 7} aria-label="Achievement collection completion" />
          <h3>Moments worth keeping</h3>
          {earned.length ? <ol>{[...earned].sort((a, b) => b.unlockedAt!.localeCompare(a.unlockedAt!)).slice(0, 4).map((item) => <li key={item.id}>{item.name}<time>{new Date(item.unlockedAt!.replace(" ", "T") + "Z").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></li>)}</ol> : <p>Your opening chapter is still ahead. Join your table and let the dice tell the story.</p>}
          <Link to="/customize">Explore your cosmetics ↗</Link>
        </aside></div>
        <footer className="profile-footer">NO TWO ADVENTURES LEAVE THE SAME MARK.</footer>
      </main>
    </div>
  );
}
