export function ProfilesSection({
      settings,
      busy,
      profileId,
      profileUsername,
      setProfileUsername,
      profilePassword,
      setProfilePassword,
      profileDialogMode,
      profileDialog,
      onOpenDialog,
      onSelectProfile,
      onSubmit,
      onClose,
}) {
      return (
            <section className="settings-section" aria-labelledby="profiles-settings-title">
                  <div className="settings-section-heading">
                        <h2 id="profiles-settings-title">Profiles</h2>
                        <p>Each profile has separate inventory, bills, finances, and database. Enter its credentials every time you switch.</p>
                  </div>
                  <div className="settings-profile-switch">
                        <div className="settings-field">
                              <label htmlFor="profile-select">Switch profile</label>
                              <select
                                    id="profile-select"
                                    value={profileId || settings?.activeProfileId || "user"}
                                    onChange={onSelectProfile}
                                    disabled={!settings || Boolean(busy)}
                              >
                                    {settings?.profiles.map((profile) => (
                                          <option key={profile.id} value={profile.id}>
                                                {profile.username}{profile.id === settings.activeProfileId ? " (active)" : ""}
                                          </option>
                                    ))}
                                    <option value="create-new">Create new</option>
                              </select>
                        </div>
                        <button
                              className="settings-action"
                              type="button"
                              onClick={onOpenDialog}
                              disabled={!settings || Boolean(busy) || profileId === settings?.activeProfileId}
                        >
                              Switch Profile
                        </button>
                  </div>
                  <dialog
                        ref={profileDialog}
                        className="settings-profile-dialog"
                        onCancel={(event) => {
                              event.preventDefault();
                              onClose();
                        }}
                  >
                        <form className="settings-profile-dialog-form" onSubmit={onSubmit}>
                              <button className="settings-profile-dialog-close" type="button" aria-label="Close" onClick={onClose}>
                                    ×
                              </button>
                              <h3>
                                    {profileDialogMode === "create"
                                          ? "Create profile"
                                          : profileId === "user" && !settings?.defaultProfilePasswordSet
                                                ? "Set up the user profile"
                                                : "Switch profile"}
                              </h3>
                              {profileDialogMode === "create" && (
                                    <p>Create a profile with its own separate database.</p>
                              )}
                              {profileDialogMode === "switch" && profileId === "user" &&
                                    !settings?.defaultProfilePasswordSet && (
                                          <p>Set a password for the existing user profile. This password will be required whenever you switch back to it.</p>
                                    )}
                              <div className="settings-field">
                                    <label htmlFor="profile-dialog-username">Username</label>
                                    <input
                                          id="profile-dialog-username"
                                          autoComplete="username"
                                          value={profileUsername}
                                          onChange={(event) => setProfileUsername(event.target.value)}
                                          readOnly={profileId === "user" && profileDialogMode !== "create"}
                                          required
                                    />
                              </div>
                              <div className="settings-field">
                                    <label htmlFor="profile-dialog-password">
                                          {profileDialogMode === "create" ||
                                                (profileId === "user" && !settings?.defaultProfilePasswordSet)
                                                ? "Password (at least 8 characters)"
                                                : "Password"}
                                    </label>
                                    <input
                                          id="profile-dialog-password"
                                          type="password"
                                          autoComplete={profileDialogMode === "create" ||
                                                (profileId === "user" && !settings?.defaultProfilePasswordSet)
                                                ? "new-password"
                                                : "current-password"}
                                          minLength={profileDialogMode === "create" ||
                                                (profileId === "user" && !settings?.defaultProfilePasswordSet)
                                                ? 8
                                                : undefined}
                                          value={profilePassword}
                                          onChange={(event) => setProfilePassword(event.target.value)}
                                          required
                                    />
                              </div>
                              <div className="settings-profile-dialog-actions">
                                    <button className="settings-action" type="button" onClick={onClose} disabled={Boolean(busy)}>
                                          Cancel
                                    </button>
                                    <button className="settings-action" type="submit" disabled={Boolean(busy)}>
                                          {busy === "profile-create"
                                                ? "Creating..."
                                                : busy === "profile-switch"
                                                      ? "Switching..."
                                                      : busy === "default-profile-password"
                                                            ? "Setting up..."
                                                            : profileDialogMode === "create"
                                                                  ? "Create Profile"
                                                                  : "Continue"}
                                    </button>
                              </div>
                        </form>
                  </dialog>
            </section>
      );
}
