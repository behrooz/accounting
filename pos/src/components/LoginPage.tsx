import { useState, type FormEvent } from "react";
import { login } from "../lib/auth";
import {
  DEFAULT_API_BASE,
  getApiBase,
  setApiBase,
  type SessionUser,
} from "../lib/config";

type Props = {
  onSuccess: (user: SessionUser) => void;
};

export default function LoginPage({ onSuccess }: Props) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [apiBase, setApiBaseInput] = useState(getApiBase() || DEFAULT_API_BASE);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      setApiBase(apiBase.trim() || DEFAULT_API_BASE);
      const user = await login(username.trim(), password);
      onSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ورود ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>آبرنگ POS</h1>
        <p className="login-sub">ورود صندوق فروش حضوری</p>

        <label>
          نام کاربری
          <input
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>

        <label>
          رمز عبور
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="button" className="linkish" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "پنهان کردن تنظیمات API" : "تنظیمات API"}
        </button>

        {showAdvanced && (
          <label>
            آدرس API
            <input
              value={apiBase}
              onChange={(e) => setApiBaseInput(e.target.value)}
              placeholder={DEFAULT_API_BASE}
              dir="ltr"
            />
          </label>
        )}

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "در حال ورود…" : "ورود"}
        </button>
      </form>
    </div>
  );
}
