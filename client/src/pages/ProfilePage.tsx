import { useState } from "react";
import { Link } from "react-router-dom";
import { api, uploadImage, type User } from "../api";
import { useAuth } from "../App";
import { Avatar } from "../components/Avatar";

const BIO_MAX = 280;

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [pronouns, setPronouns] = useState(user?.pronouns ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarPath, setAvatarPath] = useState(user?.avatarPath ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

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
        body: JSON.stringify({ displayName, pronouns, bio, avatarPath }),
      });
      setUser(r.user);
      setNotice("Saved.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="ghost link">
          ← Campaigns
        </Link>
        <span className="brand">🪪 Profile</span>
        <span className="spacer" />
        <Link to="/customize" className="ghost link">
          🎨 Customize
        </Link>
      </header>
      <main className="content">
        <section className="card profile-card">
          <div className="profile-head">
            <label className="profile-avatar-pick" title="Upload a profile picture">
              <Avatar name={displayName} src={avatarPath || undefined} id={user?.id} size={96} />
              <span className="profile-avatar-edit">{uploading ? "…" : "✎"}</span>
              <input
                type="file"
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
          {notice && <p className="muted small">{notice}</p>}
          <div className="row-between">
            <span className="muted small">This is your account identity — not your character.</span>
            <button className="primary" onClick={save} disabled={saving || uploading}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
