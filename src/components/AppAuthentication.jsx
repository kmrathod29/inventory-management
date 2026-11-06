import { useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import dipaliLogo from "../assets/Dipali_Logo.png";
import "./AppAuthentication.css";

export function AppAuthentication({ status, onAuthenticated }) {
  const [username, setUsername] = useState(status.username || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Enter both your username and password.");
      return;
    }
    setBusy(true);
    try {
      const result = await window.auth.login(username.trim(), password);
      onAuthenticated(result);
    } catch (requestError) {
      setPassword("");
      setError(
        typeof requestError?.message === "string" && requestError.message.trim()
          ? requestError.message
          : "Sign-in failed. Please try again. If the problem continues, contact support.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-auth">
      <section className="app-auth-brand" aria-label="Dipali Traders">
        <div className="app-auth-brand-glow" />
        <div className="app-auth-brand-content">
          <div className="app-auth-brand-logo">
            <img src={dipaliLogo} alt="Dipali Traders" />
          </div>
          <span className="app-auth-brand-eyebrow">INVENTORY MANAGEMENT</span>
          <h1>Welcome back</h1>
          <p>One place to manage your inventory, billing, and business.</p>
          <div className="app-auth-brand-footer">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Your business workspace, securely in one place</span>
          </div>
        </div>
      </section>

      <section className="app-auth-panel">
        <form className="app-auth-card" onSubmit={submit} noValidate>
          <div className="app-auth-mobile-logo">
            <img src={dipaliLogo} alt="Dipali Traders" />
          </div>
          <span className="app-auth-kicker">ACCOUNT ACCESS</span>
          <h2>Sign in to your account</h2>
          <p className="app-auth-description">Enter the username and password configured in Settings.</p>

          {error && (
            <p className="app-auth-message is-error" role="alert" aria-live="assertive">
              {error}
            </p>
          )}

          <label className="app-auth-field" htmlFor="app-auth-username">
            <span>Username</span>
            <div className="app-auth-input-wrap">
              <UserRound size={18} aria-hidden="true" />
              <input
                id="app-auth-username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  if (error) setError("");
                }}
                aria-invalid={Boolean(error)}
                required
                maxLength={64}
                autoFocus
              />
            </div>
          </label>

          <label className="app-auth-field" htmlFor="app-auth-password">
            <span>Password</span>
            <div className="app-auth-input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                id="app-auth-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError("");
                }}
                aria-invalid={Boolean(error)}
                required
              />
            </div>
          </label>

          <button className="app-auth-submit" type="submit" disabled={busy}>
            <span>{busy ? "Signing in..." : "Sign in"}</span>
            {!busy && <ArrowRight size={18} aria-hidden="true" />}
          </button>

          <p className="app-auth-hint">
            <LockKeyhole size={14} aria-hidden="true" />
            <span>In case you forget your password, contact midnightsphere Team.</span>
          </p>
        </form>
      </section>
    </main>
  );
}
