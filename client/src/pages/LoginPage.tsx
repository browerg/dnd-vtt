import { useEffect, useState, type FormEvent } from "react";
import { api, type User } from "../api";
import { useAuth } from "../App";

interface DevUser {
  id: number;
  display_name: string;
  is_dm: number;
}

export default function LoginPage() {
  const { setUser } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [devUsers, setDevUsers] = useState<DevUser[]>([]);

  // Dev-only account switcher; the endpoint 404s outside `npm run dev`.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    api<{ users: DevUser[] }>("/api/auth/dev-users")
      .then((r) => setDevUsers(r.users))
      .catch(() => {});
  }, []);

  const devLogin = async (userId: number) => {
    setError("");
    try {
      const user = await api<User>("/api/auth/dev-login", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      setUser(user);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body =
        mode === "login" ? { email, password } : { email, displayName, password };
      const user = await api<User>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setUser(user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-center">
      <div className="card login-card">
        <h1 className="brand">⚔️ Tabletop</h1>
        <p className="muted">Your campaign, your table, your rules.</p>
        <div className="tabs">
          <button className={mode === "login" ? "tab active" : "tab"} onClick={() => setMode("login")}>
            Log in
          </button>
          <button
            className={mode === "register" ? "tab active" : "tab"}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>
        <form onSubmit={submit} className="stack">
          {mode === "register" && (
            <input
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder={mode === "register" ? "Password (8+ characters)" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="error">{error}</div>}
          <button className="primary" disabled={busy}>
            {mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
        {devUsers.length > 0 && (
          <div className="dev-login">
            <p className="muted small">Dev quick login</p>
            <div className="dev-login-row">
              {devUsers.map((u) => (
                <button key={u.id} className="ghost mini" onClick={() => devLogin(u.id)}>
                  {u.display_name} {u.is_dm ? "(DM)" : "(player)"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
