import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api, type User } from "./api";
import { applyBackground, getBackground } from "./background";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CampaignPage from "./pages/CampaignPage";
import CharacterSheetPage from "./pages/CharacterSheetPage";
import MapPage from "./pages/MapPage";
import BestiaryPage from "./pages/BestiaryPage";
import JoinPage from "./pages/JoinPage";
import CustomizePage from "./pages/CustomizePage";
import ShopPage from "./pages/ShopPage";

interface AuthState {
  user: User | null;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>(null!);
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api<{ user: User | null }>("/api/auth/me")
      .then((r) => setUser(r.user))
      .finally(() => setLoading(false));
  }, []);

  // Restore the chosen backdrop before anything paints.
  useEffect(() => {
    applyBackground(getBackground());
  }, []);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    navigate("/login");
  };

  if (loading) return <div className="page-center muted">Loading…</div>;

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {/* The chosen backdrop, behind everything (driven by the --app-bg var). */}
      <div className="app-bg" aria-hidden />
      {/* Lives outside the routes so the 3D dice canvas survives navigation. */}
      <div id="dice-overlay" className="dice-overlay" />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/" element={user ? <DashboardPage /> : <Navigate to="/login" />} />
        <Route path="/campaigns/:id" element={user ? <CampaignPage /> : <Navigate to="/login" />} />
        <Route
          path="/campaigns/:id/characters/:charId"
          element={user ? <CharacterSheetPage /> : <Navigate to="/login" />}
        />
        <Route path="/campaigns/:id/map" element={user ? <MapPage /> : <Navigate to="/login" />} />
        <Route path="/campaigns/:id/bestiary" element={user ? <BestiaryPage /> : <Navigate to="/login" />} />
        <Route path="/customize" element={user ? <CustomizePage /> : <Navigate to="/login" />} />
        <Route path="/shop" element={user ? <ShopPage /> : <Navigate to="/login" />} />
        <Route path="/join/:code" element={<JoinPage />} />
      </Routes>
    </AuthContext.Provider>
  );
}
