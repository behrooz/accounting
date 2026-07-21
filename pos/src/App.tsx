import { useEffect, useState } from "react";
import LoginPage from "./components/LoginPage";
import PosShell from "./components/PosShell";
import { getSessionUser, getToken, type SessionUser } from "./lib/config";
import "./App.css";

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    const session = getSessionUser();
    if (token && session) setUser(session);
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="boot">در حال آماده‌سازی…</div>;
  }

  if (!user) {
    return <LoginPage onSuccess={setUser} />;
  }

  return <PosShell user={user} onLogout={() => setUser(null)} />;
}
