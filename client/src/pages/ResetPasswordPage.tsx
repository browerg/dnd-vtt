import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import "./LoginPage.css";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This recovery link is missing its reset token.");
      return;
    }
    if (password.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
      setPassword("");
      setConfirm("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="gateway">
      <div className="gateway-atmosphere" aria-hidden>
        <span className="gateway-orbit orbit-one" />
        <span className="gateway-orbit orbit-two" />
        <span className="gateway-beacon beacon-one" />
        <span className="gateway-beacon beacon-two" />
      </div>

      <section className="gateway-world" aria-labelledby="reset-title">
        <div className="gateway-world-inner">
          <div className="gateway-wordmark">
            <span className="gateway-mark" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            <div>
              <strong>VIVID REALMS</strong>
              <small>ACCOUNT RECOVERY</small>
            </div>
          </div>

          <div className="gateway-hero-copy">
            <p className="gateway-eyebrow">SECURE RECOVERY GATEWAY</p>
            <h1 id="reset-title">
              Restore access
              <span>to your worlds.</span>
            </h1>
            <p>
              Choose a new password for your Vivid Realms account. Recovery links
              expire after 30 minutes and can only be used once.
            </p>
          </div>

          <div className="gateway-map-card" aria-hidden>
            <div className="gateway-map-grid" />
            <span className="map-route route-one" />
            <span className="map-route route-two" />
            <span className="map-node node-one" />
            <span className="map-node node-two" />
            <span className="map-node node-three" />
            <div className="map-readout">
              <small>RECOVERY STATUS</small>
              <strong>{done ? "ACCESS RESTORED" : "TOKEN RECEIVED"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="gateway-access" aria-label="Reset password">
        <div className="gateway-access-inner">
          {done ? (
            <>
              <div className="gateway-access-heading">
                <p className="gateway-eyebrow">ACCESS RESTORED</p>
                <h2>Password changed</h2>
                <p>Your old sessions were closed. Sign in again with your new password.</p>
              </div>
              <div className="gateway-success">
                <span aria-hidden>✓</span>
                <p>Your Vivid Realms account is ready.</p>
              </div>
              <Link to="/login" className="gateway-submit gateway-submit-link">
                <span>Return to login</span>
                <span className="submit-arrow" aria-hidden />
              </Link>
            </>
          ) : (
            <>
              <div className="gateway-access-heading">
                <p className="gateway-eyebrow">NEW ACCESS CREDENTIAL</p>
                <h2>Choose a new password</h2>
                <p>Use at least 8 characters. This recovery link works only once.</p>
              </div>

              <form className="gateway-form" onSubmit={submit}>
                <label className="gateway-field">
                  <span>New password</span>
                  <span className="gateway-input-wrap">
                    <span className="field-icon lock-icon" aria-hidden />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      minLength={8}
                      required
                    />
                    <button
                      className="password-toggle"
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </span>
                </label>

                <label className="gateway-field">
                  <span>Confirm new password</span>
                  <span className="gateway-input-wrap">
                    <span className="field-icon lock-icon" aria-hidden />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      autoComplete="new-password"
                      placeholder="Enter it again"
                      minLength={8}
                      required
                    />
                  </span>
                </label>

                {error && (
                  <div className="gateway-error" role="alert">
                    <span aria-hidden>!</span>
                    <p>{error}</p>
                  </div>
                )}

                <button className="gateway-submit" disabled={busy || !token}>
                  <span>{busy ? "Restoring access..." : "Set new password"}</span>
                  {!busy && <span className="submit-arrow" aria-hidden />}
                </button>

                <div className="gateway-reset-footer">
                  <Link to="/login">← Return to login</Link>
                </div>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
