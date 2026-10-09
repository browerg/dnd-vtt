import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { api, type User } from "../api";
import { useAuth } from "../App";
import MusicToggle from "../components/MusicToggle";
import { gatewayMusic, GATEWAY_MUSIC_KEY } from "../loginAudio";
import { useBackgroundMusic } from "../useBackgroundMusic";
import { useEntranceDone } from "../useEntranceDone";
import "./LoginPage.css";
import GatewayPreviewToggle, { useGatewayPreview } from "../components/GatewayPreview";

interface DevUser {
  id: number;
  display_name: string;
  is_dm: number;
}

export default function LoginPage() {
  const preview = useGatewayPreview();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [devBusyId, setDevBusyId] = useState<number | null>(null);
  const [devUsers, setDevUsers] = useState<DevUser[]>([]);
  const accessRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [formScale, setFormScale] = useState(1);

  useEffect(() => {
    if (!preview || !accessRef.current) return;
    const panel = accessRef.current;
    const update = () => setFormScale(Math.min(1, (panel.clientWidth - 52) / 390, (panel.clientHeight - 68) / Math.max(650, formRef.current?.scrollHeight ?? 650)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    if (formRef.current) observer.observe(formRef.current);
    return () => observer.disconnect();
  }, [preview]);

  // Held until the opening video is gone, so the two soundtracks never
  // overlap. On a repeat visit the entrance is skipped and this is true at once.
  const music = useBackgroundMusic(gatewayMusic, GATEWAY_MUSIC_KEY, useEntranceDone());

  const displayNameId = useId();
  const emailId = useId();
  const passwordId = useId();

  // Dev-only account switcher; the endpoint 404s outside `npm run dev`.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    api<{ users: DevUser[] }>("/api/auth/dev-users")
      .then((response) => setDevUsers(response.users))
      .catch(() => {});
  }, []);

  const changeMode = (nextMode: "login" | "register" | "forgot") => {
    setMode(nextMode);
    setError("");
    setNotice("");
  };

  const devLogin = async (userId: number) => {
    setError("");
    setDevBusyId(userId);
    try {
      const user = await api<User>("/api/auth/dev-login", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      signIn(user, true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDevBusyId(null);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "forgot") {
        const response = await api<{ ok: true; message: string }>("/api/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        setNotice(response.message);
        return;
      }

      const body =
        mode === "login" ? { email, password } : { email, displayName, password };
      const user = await api<User>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      signIn(user, mode === "login");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={`gateway${preview ? " gateway-library" : ""}`}>
      <GatewayPreviewToggle />
      <div className="gateway-atmosphere" aria-hidden>
        <span className="gateway-orbit orbit-one" />
        <span className="gateway-orbit orbit-two" />
        <span className="gateway-beacon beacon-one" />
        <span className="gateway-beacon beacon-two" />
      </div>

      <section className="gateway-world" aria-labelledby="gateway-title">
        <div className="gateway-world-inner">
          <div className="gateway-wordmark">
            <span className="gateway-mark" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            <div>
              <strong>{preview ? <><span>Vivid</span><span>Realms</span></> : "VIVID REALMS"}</strong>
              <small>CAMPAIGN GATEWAY</small>
            </div>
          </div>

          <div className="gateway-hero-copy">
            <p className="gateway-eyebrow">LIVE COLLABORATIVE TABLE</p>
            <h1 id="gateway-title">
              Every world begins
              <span>at the table.</span>
            </h1>
            <p>
              Gather your party, track every story, and turn maps, characters, and dice
              into one shared campaign space.
            </p>
          </div>

          <div className="gateway-system-grid" aria-label="Available tabletop systems">
            <article>
              <span className="system-glyph remnant-glyph" aria-hidden />
              <div>
                <strong>Remnant</strong>
                <small>Huntsmen, Aura, Dust and Grimm</small>
              </div>
              <span className="system-state">ONLINE</span>
            </article>
            <article>
              <span className="system-glyph fantasy-glyph" aria-hidden />
              <div>
                <strong>Fantasy</strong>
                <small>Adventurers, monsters and magic</small>
              </div>
              <span className="system-state">ONLINE</span>
            </article>
            <article>
              <span className="system-glyph tactical-glyph" aria-hidden />
              <div>
                <strong>Tactical maps</strong>
                <small>Live tokens, fog and combat tools</small>
              </div>
              <span className="system-state">READY</span>
            </article>
          </div>

          <div className="gateway-map-card" aria-hidden>
            <div className="gateway-map-grid" />
            <span className="map-route route-one" />
            <span className="map-route route-two" />
            <span className="map-node node-one" />
            <span className="map-node node-two" />
            <span className="map-node node-three" />
            <div className="map-readout">
              <small>TABLE STATUS</small>
              <strong>AWAITING PARTY</strong>
            </div>
          </div>
        </div>
      </section>

      <section ref={accessRef} className={`gateway-access${preview ? ` library-mode-${mode}` : ""}`} aria-label="Account access">
        <div ref={formRef} className={`gateway-access-inner${preview && devOpen ? " library-dev-open" : ""}`} style={preview ? { transform: `translate(-50%, -50%) scale(${formScale})` } : undefined}>
          <div className="gateway-access-heading">
            <p className="gateway-eyebrow">SECURE ACCESS TERMINAL</p>
            <h2>
              {mode === "login"
                ? "Welcome back"
                : mode === "register"
                  ? "Open your gateway"
                  : "Restore access"}
            </h2>
            <p>
              {mode === "login"
                ? preview ? <>Sign in to your <span className="library-account-name">VIVID REALMS</span> account<br />and return to the table.</> : "Sign in to return to your campaigns."
                : mode === "register"
                  ? "Create an account and begin building your table."
                  : "Enter your account email and we'll send a secure recovery link."}
            </p>
          </div>

          <div className="gateway-mode-tabs" role="tablist" aria-label="Account mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "active" : ""}
              onClick={() => changeMode("login")}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? "active" : ""}
              onClick={() => changeMode("register")}
            >
              Create account
            </button>
          </div>

          <form className="gateway-form" onSubmit={submit}>
            {mode === "register" && (
              <label className="gateway-field" htmlFor={displayNameId}>
                <span>Display name</span>
                <span className="gateway-input-wrap">
                  <span className="field-icon user-icon" aria-hidden />
                  <input
                    id={displayNameId}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="nickname"
                    placeholder="How the table will know you"
                    required
                  />
                </span>
              </label>
            )}

            <label className="gateway-field" htmlFor={emailId}>
              <span>{preview ? "Email" : "Email address"}</span>
              <span className="gateway-input-wrap">
                <span className="field-icon mail-icon" aria-hidden />
                <input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  autoFocus
                  required
                />
              </span>
            </label>

            {mode !== "forgot" && (
              <label className="gateway-field" htmlFor={passwordId}>
                <span>Password</span>
                <span className="gateway-input-wrap">
                  <span className="field-icon lock-icon" aria-hidden />
                  <input
                    id={passwordId}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder={mode === "register" ? "At least 8 characters" : "Enter your password"}
                    minLength={mode === "register" ? 8 : undefined}
                    required
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {preview ? <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{!showPassword && <path d="m4 21 16-18"/>}</svg> : showPassword ? "Hide" : "Show"}
                  </button>
                </span>
              </label>
            )}

            <div className="gateway-form-meta">
              <span className="connection-state">
                <span aria-hidden />
                Connection secure
              </span>
              {mode === "register" && <span>8+ characters required</span>}
              {mode === "login" && (
                <button
                  type="button"
                  className="gateway-meta-link"
                  onClick={() => changeMode("forgot")}
                >
                  Forgot password?
                </button>
              )}
              {mode === "forgot" && (
                <button
                  type="button"
                  className="gateway-meta-link"
                  onClick={() => changeMode("login")}
                >
                  ← Back to login
                </button>
              )}
            </div>

            {error && (
              <div className="gateway-error" role="alert">
                <span aria-hidden>!</span>
                <p>{error}</p>
              </div>
            )}

            {notice && (
              <div className="gateway-success" role="status">
                <span aria-hidden>✓</span>
                <p>{notice}</p>
              </div>
            )}

            <button className="gateway-submit" disabled={busy}>
              <span>
                {busy
                  ? mode === "forgot"
                    ? "Sending recovery link..."
                    : "Authenticating..."
                  : mode === "login"
                    ? preview ? "Sign in" : "Enter tabletop"
                    : mode === "register"
                      ? "Create account"
                      : "Send recovery link"}
              </span>
              {!busy && <span className="submit-arrow" aria-hidden />}
            </button>
          </form>

          {preview && <p className="library-account-switch">{mode === "login" ? "New here?" : "Already have an account?"} <button type="button" onClick={() => changeMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Create an account" : "Sign in"}</button></p>}

          {devUsers.length > 0 && (
            <details className="gateway-dev-access" onToggle={(event) => setDevOpen(event.currentTarget.open)}>
              <summary>
                <span>{preview && devOpen ? "← Back to sign in" : "Development access"}</span>
                <small>{devUsers.length} local accounts</small>
              </summary>
              <div className="gateway-dev-users">
                {preview && <h3>Choose a local account</h3>}
                {devUsers.map((devUser) => (
                  <button
                    key={devUser.id}
                    type="button"
                    disabled={devBusyId !== null}
                    onClick={() => devLogin(devUser.id)}
                  >
                    <span className="dev-avatar">{devUser.display_name.slice(0, 1).toUpperCase()}</span>
                    <span>
                      <strong>{devUser.display_name}</strong>
                      <small>{devUser.is_dm ? "Dungeon Master" : "Player"}</small>
                    </span>
                    <span className="dev-enter">
                      {devBusyId === devUser.id ? "..." : "ENTER"}
                    </span>
                  </button>
                ))}
              </div>
            </details>
          )}

          <MusicToggle music={music} className="gateway-music" />

          <p className="gateway-footnote">
            One account. Every campaign. Your table remains yours.
          </p>
        </div>
      </section>
    </main>
  );
}

