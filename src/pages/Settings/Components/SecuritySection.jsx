import { useState } from "react";

export function SecuritySection({ settings, busy, onSave }) {
  const [enabled, setEnabled] = useState(Boolean(settings?.appLoginConfigured));
  const [currentPassword, setCurrentPassword] = useState("");
  const [username, setUsername] = useState(settings?.appLogin?.username || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (enabled && !settings?.appLoginConfigured && newPassword.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    try {
      await onSave({ enabled, currentPassword, username, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (saveError) {
      setError(saveError.message || "Could not update sign-in settings.");
    }
  }

  return (
    <section className="settings-section" aria-labelledby="security-settings-title">
      <div className="settings-section-heading">
        <h2 id="security-settings-title">Application sign-in</h2>
        <p>Choose whether to require a username and password whenever the software opens.</p>
      </div>
      <form className="settings-security-form" onSubmit={submit}>
        {error && <p className="settings-security-error" role="alert">{error}</p>}
        <label className="settings-security-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <span>Require username and password at startup</span>
        </label>
        {settings?.appLoginConfigured && (
          <label className="settings-field">
            <span>Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>
        )}
        {enabled && (
          <>
            <label className="settings-field">
              <span>Username</span>
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                maxLength={64}
              />
            </label>
            <label className="settings-field">
              <span>
                {settings?.appLoginConfigured
                  ? "New password (leave blank to keep current)"
                  : "Password (at least 8 characters)"}
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={newPassword || !settings?.appLoginConfigured ? 8 : undefined}
                maxLength={1024}
                required={!settings?.appLoginConfigured}
              />
            </label>
            {newPassword && (
              <label className="settings-field">
                <span>Confirm new password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </label>
            )}
          </>
        )}
        {enabled && !settings?.appLoginConfigured && (
          <p className="settings-security-note">
            You will need this username and password the next time the software opens.
          </p>
        )}
        <button className="settings-action settings-action-primary" type="submit" disabled={Boolean(busy)}>
          {busy === "security" ? "Saving..." : "Save sign-in settings"}
        </button>
      </form>
    </section>
  );
}
