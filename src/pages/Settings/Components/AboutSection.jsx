export function AboutSection() {
  return (
    <div className="settings-panel-content">
      <div className="settings-panel-header">
        <h2>About</h2>
        <p>Application version and support information.</p>
      </div>

      <div className="about-card">
        <div className="about-app-info">
          <h3>Dipali Traders - Inventory Manager</h3>
          <p className="about-version">Version 1.0</p>
        </div>

        <div className="about-details">
          <div className="about-row">
            <span className="about-label">Developer</span>
            <span className="about-value">Dipali Traders</span>
          </div>
          <div className="about-row">
            <span className="about-label">Platform</span>
            <span className="about-value">Electron + React</span>
          </div>
          <div className="about-row">
            <span className="about-label">Database</span>
            <span className="about-value">SQLite (better-sqlite3)</span>
          </div>
          <div className="about-row">
            <span className="about-label">License</span>
            <span className="about-value">Proprietary</span>
          </div>
        </div>

        <div className="about-footer">
          <p>Built by Midnight Sphere for Dipali Traders</p>
        </div>
      </div>
    </div>
  );
}
